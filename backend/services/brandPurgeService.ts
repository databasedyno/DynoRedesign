import { Op, QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { companyModel, userModel, apiModel, paymentLinkModel, customerModel } from "../models";
import { deleteRedisItem } from "../utils/redisInstance";
import { companyLogger } from "../utils/loggers";
import { getErrorMessage } from "../helper";
import { sendBrandPermanentlyDeletedEmail, sendBrandDeleteReminderEmail } from "./emailService";
import { setRedisItemWithTTL, getRedisItem } from "../utils/redisInstance";

/** Days a soft-deleted brand is retained before the cron permanently purges it. */
export const BRAND_DELETE_GRACE_DAYS = 7;

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
): Promise<{ ok: boolean; revokedApiIds: number[] }> => {
  const company_id = company.company_id;
  const user_id = company.user_id;
  const revokedApiIds: number[] = [];

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
export const purgeExpiredBrands = async (): Promise<{ scanned: number; purged: number; failed: number }> => {
  const now = new Date();
  const due = await companyModel.findAll({
    where: {
      deleted_at: { [Op.ne]: null },
      scheduled_purge_at: { [Op.ne]: null, [Op.lte]: now },
    },
    paranoid: false,
  });

  let purged = 0;
  let failed = 0;
  for (const c of due) {
    const target: PurgeTarget = {
      company_id: c.dataValues.company_id,
      user_id: c.dataValues.user_id,
      company_name: c.dataValues.company_name,
    };
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
    companyLogger.info(`[purgeExpiredBrands] Scanned ${due.length}, purged ${purged}, failed ${failed}`);
  }
  return { scanned: due.length, purged, failed };
};

/**
 * Day-5 nudge: email merchants whose soft-deleted brand is ~2 days from being
 * permanently purged. Redis-deduped per company so each brand is nudged once.
 */
export const remindExpiringBrands = async (): Promise<{ scanned: number; reminded: number }> => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // within the next 2 days
  const soon = await companyModel.findAll({
    where: {
      deleted_at: { [Op.ne]: null },
      scheduled_purge_at: { [Op.ne]: null, [Op.gt]: now, [Op.lte]: windowEnd },
    },
    paranoid: false,
  });

  let reminded = 0;
  for (const c of soon) {
    const companyId = c.dataValues.company_id;
    const dedupeKey = `brand-delete-reminder-sent:${companyId}`;
    try {
      if (await getRedisItem(dedupeKey)) continue; // already nudged
      const purgeAt = new Date(c.dataValues.scheduled_purge_at);
      const daysLeft = Math.max(1, Math.ceil((purgeAt.getTime() - now.getTime()) / 86400000));
      const owner = await userModel.findOne({ where: { user_id: c.dataValues.user_id }, attributes: ["name", "email"] });
      const ownerEmail = owner?.dataValues.email;
      if (ownerEmail) {
        await sendBrandDeleteReminderEmail(ownerEmail, owner?.dataValues.name || "", c.dataValues.company_name || "your brand", purgeAt, daysLeft);
        reminded++;
      }
      // Dedupe for 4 days (longer than the 2-day window) so we never double-nudge.
      await setRedisItemWithTTL(dedupeKey, { sentAt: now.toISOString() }, 4 * 24 * 60 * 60);
    } catch (e) {
      companyLogger.warn(`[remindExpiringBrands] Failed for company ${companyId}: ${getErrorMessage(e)}`);
    }
  }
  if (soon.length > 0) companyLogger.info(`[remindExpiringBrands] Scanned ${soon.length}, reminded ${reminded}`);
  return { scanned: soon.length, reminded };
};
