import { getRuntimeFlags } from "@/helpers/runtimeFlags";

/**
 * Frontend helpers to recognise the single SafeDeal operator brand.
 * The SafeDeal escrow product lives under ONE Dynopay brand (SAFEDEAL_COMPANY_ID
 * on the backend). That brand is an escrow product, not a payment-links merchant —
 * so the merchant "getting started" onboarding must never apply to it, and it
 * carries the SafeDeal mark.
 *
 * Resolution: the build-time inline NEXT_PUBLIC_SAFEDEAL_COMPANY_ID when present,
 * else the server-provided runtime flag (droplet .env → __NEXT_DATA__), so a
 * production deploy does NOT need a rebuild for the id to apply.
 */
export const safeDealCompanyId = (): number | null => {
  const inline = Number(process.env.NEXT_PUBLIC_SAFEDEAL_COMPANY_ID);
  if (Number.isFinite(inline) && inline > 0) return inline;
  return getRuntimeFlags().safedealCompanyId;
};

export const isSafeDealBrandId = (companyId: number | string | null | undefined): boolean => {
  const id = safeDealCompanyId();
  return id != null && companyId != null && Number(companyId) === id;
};

/** The SafeDeal gold shield mark (app-icon tile), served from /public/safedeal. */
export const SAFEDEAL_BRAND_LOGO = "/safedeal/favicon-192.png";
