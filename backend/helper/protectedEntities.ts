import { companyModel } from "../models";
import escrowDealModel from "../models/escrowDealModel";

/**
 * Purge guard rails.
 *
 * WHY THIS EXISTS
 * ---------------
 * `tbl_escrow_deal.company_id` has `ON DELETE CASCADE` to `tbl_company`, so
 * hard-deleting a brand silently wipes EVERY escrow/SafeDeal deal under it.
 * The whole SafeDeal product lives under a single brand (SAFEDEAL_COMPANY_ID),
 * owned by one Dynopay user — so if that account/brand is ever soft-deleted and
 * the scheduled purge job runs, it would destroy the entire SafeDeal history in
 * one cascade. Escrow deals are financial records that must survive the AML/KYC
 * retention window. These helpers are the choke-point that the account/brand
 * purge paths consult before any irreversible delete.
 */

/** The company_id that powers SafeDeal (env-configured), or null if unset. */
export const getSafeDealCompanyId = (): number | null => {
  const id = Number(process.env.SAFEDEAL_COMPANY_ID);
  return Number.isFinite(id) && id > 0 ? id : null;
};

/** Is this the SafeDeal operator brand? */
export const isSafeDealBrand = (companyId: number | string | null | undefined): boolean => {
  const sd = getSafeDealCompanyId();
  return sd != null && companyId != null && Number(companyId) === sd;
};

/** Does this user own the SafeDeal operator brand? */
export const ownsSafeDealBrand = async (userId: number | string): Promise<boolean> => {
  const sd = getSafeDealCompanyId();
  if (sd == null) return false;
  try {
    const row = await companyModel.findOne({ where: { company_id: sd }, attributes: ["user_id"], paranoid: false });
    return !!row && String((row as any).dataValues.user_id) === String(userId);
  } catch {
    return false;
  }
};

/** Count escrow deals under a company (financial records that must survive a purge). */
export const companyEscrowDealCount = async (companyId: number | string): Promise<number> => {
  try {
    return await escrowDealModel.count({ where: { company_id: companyId } });
  } catch {
    return 0;
  }
};

/**
 * Decide whether a company may be permanently purged (hard-deleted). Refuses the
 * SafeDeal operator brand and any brand still holding escrow deals so the
 * `ON DELETE CASCADE` can never silently destroy financial records.
 */
export const canPurgeCompany = async (
  companyId: number | string,
): Promise<{ allowed: boolean; reason?: string }> => {
  if (isSafeDealBrand(companyId)) {
    return { allowed: false, reason: `company ${companyId} is the SafeDeal operator brand (SAFEDEAL_COMPANY_ID) and is protected from deletion` };
  }
  const deals = await companyEscrowDealCount(companyId);
  if (deals > 0) {
    return { allowed: false, reason: `company ${companyId} still holds ${deals} escrow deal(s); its financial records are retained and cannot be purged` };
  }
  return { allowed: true };
};

/**
 * Decide whether a user account may be permanently purged. Refuses if the user
 * owns the SafeDeal brand or any brand that still holds escrow deals (the user
 * hard-delete cascades to their companies and then to those deals).
 */
export const canPurgeAccount = async (
  userId: number | string,
): Promise<{ allowed: boolean; reason?: string }> => {
  if (await ownsSafeDealBrand(userId)) {
    return { allowed: false, reason: `user ${userId} owns the SafeDeal operator brand and is protected from deletion` };
  }
  const companies = await companyModel.findAll({ where: { user_id: userId }, attributes: ["company_id"], paranoid: false });
  for (const co of companies) {
    const cid = (co as any).dataValues.company_id;
    const check = await canPurgeCompany(cid);
    if (!check.allowed) {
      return { allowed: false, reason: `user ${userId}: ${check.reason}` };
    }
  }
  return { allowed: true };
};
