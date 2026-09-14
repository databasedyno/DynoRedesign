/**
 * Branded short payment-link helpers (DISPLAY ONLY).
 *
 * Payment links are stored / returned by the API as the hosted-checkout URL
 * (e.g. https://checkout.dynopay.com/pay?d=abc123) — that stays untouched so
 * old links and merchant integrations keep working. For the dashboard we show
 * a short, on-brand form (https://dynopay.com/abc123) that redirects to the
 * checkout when opened. This module only reshapes the string for display /
 * copy / QR; it never changes what is sent to the backend.
 */

/** Pull the 6-char checkout ref out of a stored link (handles ?d= and short). */
export const extractPayRef = (paymentLink?: string | null): string => {
  if (!paymentLink) return "";
  // Primary form: hosted checkout "…/pay?d=<ref>".
  const m = paymentLink.match(/[?&]d=([A-Za-z0-9]+)/);
  if (m) return m[1];
  // Already-short "…/<ref>" — take a trailing 6-char base62 segment.
  const tail =
    paymentLink.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() || "";
  return /^[A-Za-z0-9]{6}$/.test(tail) ? tail : "";
};

/** Main branded origin for short links (dynopay.com), no trailing slash. */
const payBaseUrl = (): string =>
  (process.env.NEXT_PUBLIC_CREATOR_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "").replace(
    /\/+$/,
    "",
  );

/**
 * Branded short URL for a stored payment link, e.g.
 * "https://checkout.dynopay.com/pay?d=abc123" -> "https://dynopay.com/abc123".
 * Falls back to the original link if a ref can't be derived or no base is set.
 */
export const toShortPayLink = (paymentLink?: string | null): string => {
  const ref = extractPayRef(paymentLink);
  const base = payBaseUrl();
  if (ref && base) return `${base}/${ref}`;
  return paymentLink || "";
};
