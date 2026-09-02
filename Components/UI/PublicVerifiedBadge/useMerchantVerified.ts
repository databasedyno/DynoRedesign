import useSWR from "swr";

/**
 * Shared read-only hook behind the buyer-facing "Verified Everywhere" UI
 * (PublicVerifiedBadge + MerchantTrustRow). Resolves a merchant's KYC identity
 * verification from a PUBLIC identifier via GET /api/public/merchant-verification.
 * Uses a plain relative fetch (no merchant axios) so it is safe on anonymous
 * buyer routes. Returns false until resolved and on any error.
 */
export interface MerchantVerifiedParams {
  handle?: string | null;
  linkRef?: string | null;
  orderId?: string | null;
}

export const buildVerificationUrl = (p: MerchantVerifiedParams): string | null => {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const q = new URLSearchParams();
  if (p.handle) q.set("handle", String(p.handle));
  else if (p.linkRef) q.set("linkRef", String(p.linkRef));
  else if (p.orderId) q.set("orderId", String(p.orderId));
  else return null;
  return `${base}/api/public/merchant-verification?${q.toString()}`;
};

const fetchVerified = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json?.data?.verified);
  } catch {
    return false;
  }
};

export function useMerchantVerified(params: MerchantVerifiedParams): boolean {
  const url = buildVerificationUrl(params);
  const { data } = useSWR(url, fetchVerified, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
    dedupingInterval: 60000,
  });
  return Boolean(data);
}
