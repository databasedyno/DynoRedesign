/**
 * Frontend helpers to recognise the single SafeDeal operator brand.
 * The SafeDeal escrow product lives under ONE Dynopay brand (SAFEDEAL_COMPANY_ID
 * on the backend, mirrored here as NEXT_PUBLIC_SAFEDEAL_COMPANY_ID). That brand is
 * an escrow product, not a payment-links merchant — so the merchant "getting
 * started" onboarding must never apply to it, and it carries the SafeDeal mark.
 */
export const SAFEDEAL_COMPANY_ID: number | null = (() => {
  const n = Number(process.env.NEXT_PUBLIC_SAFEDEAL_COMPANY_ID);
  return Number.isFinite(n) && n > 0 ? n : null;
})();

export const isSafeDealBrandId = (companyId: number | string | null | undefined): boolean =>
  SAFEDEAL_COMPANY_ID != null && companyId != null && Number(companyId) === SAFEDEAL_COMPANY_ID;

/** The SafeDeal gold shield mark (app-icon tile), served from /public/safedeal. */
export const SAFEDEAL_BRAND_LOGO = "/safedeal/favicon-192.png";
