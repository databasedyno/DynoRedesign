/**
 * Merchant identity-verification (KYC) helpers — powers the buyer-facing
 * "Identity verified" badge shown on public payment pages, storefronts and
 * receipts ("Verified Everywhere").
 *
 * A merchant is considered identity-verified when tbl_kyc has an `approved`
 * row for the owning account — either scoped to the specific brand/company OR
 * an account-level row (company_id IS NULL), which verifies the person/business
 * across all of their brands. This mirrors the authenticated dashboard badge
 * (Components/UI/KycVerifiedBadge) but is exposed read-only to anonymous
 * buyers, resolved only from a PUBLIC identifier (storefront handle, payment
 * link ref, or order id) so no company enumeration surface is created.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { resolveStorefrontByHandle } from "../controller/storefrontScope";
import { apiLogger } from "../utils/loggers";

export interface ResolvedMerchant {
  userId: number | null;
  companyId: number | null;
  businessName: string | null;
}

/**
 * Is the owner of (userId, companyId) identity-verified?
 * Account-level: any approved KYC for the user counts for every brand.
 * `companyId` is kept for call-site compatibility; it no longer narrows the check.
 */
export async function isMerchantIdentityVerified(
  userId?: number | null,
  _companyId?: number | null
): Promise<boolean> {
  if (!userId) return false;
  try {
    // Identity is verified per ACCOUNT (the person, not the brand): an approved
    // record under any brand — or none — verifies every brand the user owns.
    const rows = (await sequelize.query(
      `SELECT 1 FROM tbl_kyc WHERE user_id = :userId AND status = 'approved' LIMIT 1`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    )) as unknown[];
    return rows.length > 0;
  } catch (err: unknown) {
    apiLogger.warn(
      "[merchantVerification] isMerchantIdentityVerified failed:",
      (err as Error)?.message
    );
    return false;
  }
}

/** base62 payment-link/order refs only — strip anything that could widen a LIKE. */
const cleanRef = (v: unknown): string =>
  String(v ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);

/**
 * Resolve a public identifier to its owning merchant.
 * Accepts (in priority order) a storefront/creator handle, a payment-link ref
 * (the `d` param from /pay?d=<ref>), or a product order id. Returns nulls when
 * nothing matches — callers should treat that as "not verified".
 */
export async function resolveMerchantForVerification(params: {
  handle?: unknown;
  linkRef?: unknown;
  orderId?: unknown;
}): Promise<ResolvedMerchant> {
  const empty: ResolvedMerchant = { userId: null, companyId: null, businessName: null };

  try {
    const handle = params.handle ? String(params.handle).trim() : "";
    if (handle) {
      const owner = await resolveStorefrontByHandle(handle);
      if (!owner) return empty;
      return {
        userId: Number((owner as { user_id?: number }).user_id) || null,
        companyId: (owner as { company_id?: number | null }).company_id ?? null,
        businessName: (owner as { name?: string }).name ?? null,
      };
    }

    const linkRef = cleanRef(params.linkRef);
    if (linkRef) {
      const rows = (await sequelize.query(
        `SELECT user_id, company_id FROM tbl_payment_link
          WHERE payment_link LIKE :pattern
          ORDER BY link_id DESC LIMIT 1`,
        { replacements: { pattern: `%?d=${linkRef}` }, type: QueryTypes.SELECT }
      )) as Array<{ user_id: number; company_id: number | null }>;
      if (!rows.length) return empty;
      return { userId: rows[0].user_id ?? null, companyId: rows[0].company_id ?? null, businessName: null };
    }

    const orderId = cleanRef(params.orderId);
    if (orderId) {
      const rows = (await sequelize.query(
        `SELECT merchant_user_id AS user_id, company_id FROM tbl_product_order
          WHERE public_ref = :orderId LIMIT 1`,
        { replacements: { orderId }, type: QueryTypes.SELECT }
      )) as Array<{ user_id: number; company_id: number | null }>;
      if (!rows.length) return empty;
      return { userId: rows[0].user_id ?? null, companyId: rows[0].company_id ?? null, businessName: null };
    }
  } catch (err: unknown) {
    apiLogger.warn(
      "[merchantVerification] resolveMerchantForVerification failed:",
      (err as Error)?.message
    );
  }
  return empty;
}
