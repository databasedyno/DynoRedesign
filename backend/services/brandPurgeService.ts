import { Op, QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { companyModel, userModel, apiModel, paymentLinkModel, customerModel } from "../models";
import { deleteRedisItem } from "../utils/redisInstance";
import { companyLogger } from "../utils/loggers";
import { getErrorMessage } from "../helper";
import { sendBrandPermanentlyDeletedEmail } from "./emailService";
import { canPurgeCompany } from "../helper/protectedEntities";

/** Days a soft-deleted brand is retained before the cron permanently purges it.
 *  AML/KYC compliance: retain financial + identity records ~10 years. The brand
 *  is hidden/deactivated immediately on delete; the purge only runs after this. */
export const BRAND_DELETE_GRACE_DAYS = 3650;

interface PurgeTarget {
  company_id: number | string;
  user_id: number | string;
  company_name?: string | null;
}

/**
 * Permanently delete a single (already soft-deleted) brand: revoke its API keys,
 * remove payment links + their Redis entries, prune auto-provisioned orphan
 * customers, then hard-delete the row (force so paranoid actually removes it).
 * This is the cleanup that used to run inline in deleteCompany — it now runs
 * ONLY at purge time (after the 7-day grace window) or when an admin forces it.
 */
export const purgeBrand = async (
  company: PurgeTarget,
  opts: { notifyMerchant?: boolean } = {},
): Promise<{ ok: boolean; revokedApiIds: number[]; reason?: string }> => {
  const company_id = company.company_id;
  const user_id = company.user_id;
  const revokedApiIds: number[] = [];

  // SAFEGUARD: never hard-delete the SafeDeal operator brand or any brand that
  // still holds escrow deals — the ON DELETE CASCADE would silently destroy
  // those financial records. Keep it soft-deleted instead.
  const guard = await canPurgeCompany(company_id);
  if (!guard.allowed) {
    companyLogger.error(`[purgeBrand] REFUSED — ${guard.reason}. Brand ${company_id} kept soft-deleted; not purged.`);
    return { ok: false, revokedApiIds, reason: guard.reason };
  }

  // Revoke API keys (explicit audit trail + Redis cache invalidation).
  try {
    const apis = await apiModel.findAll({ where: { company_id } });
    for (const api of apis) {
      const apiId = (api as any).dataValues.api_id;
      const adminToken = (api as any).dataValues.adminToken || (api as any).dataValues.admin_token;
      revokedApiIds.push(apiId);
      await apiModel.update({ status: "revoked" } as any, { where: { api_id: apiId } });
      if (adminToken) {
        try {
          await deleteRedisItem(`api-token-${adminToken}`);
          await deleteRedisItem(`api-key-${adminToken}`);
        } catch (_e) { /* non-fatal */ }
      }
    }
    companyLogger.info(`[purgeBrand] Revoked ${revokedApiIds.length} API keys for company ${company_id}`);
  } catch (apiErr) {
    companyLogger.warn(`[purgeBrand] Failed to revoke API keys for company ${company_id}: ${getErrorMessage(apiErr)}`);
  }

  // Delete payment links + clean their Redis entries.
  try {
    const companyPaymentLinks = await paymentLinkModel.findAll({
      where: { company_id },
      attributes: ["payment_link"],
    });
    for (const link of companyPaymentLinks) {
      const paymentLinkUrl = link.dataValues.payment_link;
      const urlMatch = paymentLinkUrl?.match(/[?&]d=([a-f0-9]+)/i);
      if (urlMatch && urlMatch[1]) {
        await deleteRedisItem("customer-" + urlMatch[1]);
      }
    }
    await paymentLinkModel.destroy({ where: { company_id } });
    await deleteRedisItem(`dashboard:${user_id}:all`);
  } catch (redisError) {
    companyLogger.warn(`[purgeBrand] Payment-link/Redis cleanup failed for company ${company_id}: ${getErrorMessage(redisError)}`);
  }

  // Prune auto-provisioned orphan customer rows (no transactions).
  try {
    const orphanCustomers = await sequelize.query(
      `SELECT c.customer_id FROM tbl_customer c
       WHERE c.company_id = :cid
         AND NOT EXISTS (SELECT 1 FROM tbl_user_transaction ut WHERE ut.customer_id = c.customer_id)
         AND NOT EXISTS (SELECT 1 FROM tbl_customer_transaction ct WHERE ct.customer_id = c.customer_id)`,
      { replacements: { cid: company_id }, type: QueryTypes.SELECT },
    );
    const orphanIds = (orphanCustomers as Array<{ customer_id: string | number }>).map((r) => r.customer_id);
    if (orphanIds.length > 0) {
      await customerModel.destroy({ where: { customer_id: orphanIds } });
      companyLogger.info(`[purgeBrand] Deleted ${orphanIds.length} orphan customer rows for company ${company_id}`);
    }
  } catch (custErr) {
    companyLogger.warn(`[purgeBrand] Failed to prune orphan customers for company ${company_id}: ${getErrorMessage(custErr)}`);
  }

  // Hard-delete the company row (force bypasses paranoid soft-delete). CASCADE
  // removes tbl_api / tbl_api_usage_log / remaining tbl_customer / etc.
  const rowsDeleted = await companyModel.destroy({ where: { company_id }, force: true });
  if (rowsDeleted === 0) {
    companyLogger.error(`[purgeBrand] destroy(force) affected 0 rows for company_id=${company_id}`);
    return { ok: false, revokedApiIds };
  }
  companyLogger.info(`[purgeBrand] Brand ${company_id} permanently deleted (revoked ${revokedApiIds.length} API keys)`);

  // Tell the merchant the recovery window closed (best-effort).
  if (opts.notifyMerchant !== false) {
    try {
      const owner = await userModel.findOne({ where: { user_id }, attributes: ["name", "email"] });
      const ownerEmail = owner?.dataValues.email;
      if (ownerEmail) {
        await sendBrandPermanentlyDeletedEmail(ownerEmail, owner?.dataValues.name || "", company.company_name || "your brand");
      }
    } catch (emailErr) {
      companyLogger.warn(`[purgeBrand] Permanently-deleted email failed for company ${company_id}: ${getErrorMessage(emailErr)}`);
    }
  }

  return { ok: true, revokedApiIds };
};

/**
 * Sweep every soft-deleted brand whose 7-day grace window has elapsed and purge
 * it permanently. Invoked by the daily leader cron (and the admin manual trigger).
 */
export const purgeExpiredBrands = async (): Promise<{ scanned: number; purged: number; failed: number; skipped: number }> => {
  const now = new Date();
  // Due-ness is derived from deleted_at + the CURRENT grace window (not the
  // stored scheduled_purge_at) so extending retention to 10 years also protects
  // brands that were soft-deleted under the old 7-day policy — no data migration.
  const cutoff = new Date(now.getTime() - BRAND_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const due = await companyModel.findAll({
    where: {
      deleted_at: { [Op.ne]: null, [Op.lte]: cutoff },
    },
    paranoid: false,
  });

  let purged = 0;
  let failed = 0;
  let skipped = 0;
  for (const c of due) {
    const target: PurgeTarget = {
      company_id: c.dataValues.company_id,
      user_id: c.dataValues.user_id,
      company_name: c.dataValues.company_name,
    };
    // Preserve the SafeDeal brand and any brand still holding escrow deals.
    const guard = await canPurgeCompany(target.company_id);
    if (!guard.allowed) {
      skipped++;
      companyLogger.warn(`[purgeExpiredBrands] skipped company ${target.company_id} — ${guard.reason}`);
      continue;
    }
    try {
      const r = await purgeBrand(target);
      if (r.ok) purged++;
      else failed++;
    } catch (e) {
      failed++;
      companyLogger.error(`[purgeExpiredBrands] Failed to purge company ${target.company_id}: ${getErrorMessage(e)}`);
    }
  }

  if (due.length > 0) {
    companyLogger.info(`[purgeExpiredBrands] Scanned ${due.length}, purged ${purged}, skipped ${skipped}, failed ${failed}`);
  }
  return { scanned: due.length, purged, failed, skipped };
};

/**
 * DISABLED under the 10-year AML/KYC retention policy. There is no longer a
 * short "recovery window" to remind merchants about (a soft-deleted brand is
 * retained for ~10 years), so this daily nudge is a no-op. Kept as a stub so
 * the cron wiring in server.ts stays valid.
 */
export const remindExpiringBrands = async (): Promise<{ scanned: number; reminded: number }> => {
  return { scanned: 0, reminded: 0 };
};
