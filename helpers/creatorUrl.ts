/**
 * Creator page public URL helpers.
 *
 * Creator pages are shared/accessed under a dedicated branded domain
 * (NEXT_PUBLIC_CREATOR_BASE_URL, e.g. https://dynopay.com) so the "access URL"
 * a creator copies/shares is short and on-brand. Falls back to the main app
 * base URL (NEXT_PUBLIC_BASE_URL) when the creator domain is not configured.
 */

/** Base origin for creator page access URLs, no trailing slash. */
export const getCreatorBaseUrl = (): string => {
  const creatorBase = (process.env.NEXT_PUBLIC_CREATOR_BASE_URL || "").replace(/\/+$/, "");
  if (creatorBase) return creatorBase;
  return (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
};

/** Full public URL for a creator handle, e.g. "https://dynopay.com/alice". */
export const buildCreatorUrl = (handle?: string | null): string => {
  if (!handle) return "";
  const base = getCreatorBaseUrl();
  return base ? `${base}/${handle}` : `/${handle}`;
};

/** Scheme-less display form, e.g. "dynopay.com/alice". */
export const prettyCreatorUrl = (handle?: string | null): string =>
  buildCreatorUrl(handle).replace(/^https?:\/\//, "");

/** Scheme-less base domain for display, e.g. "dynopay.com". */
export const prettyCreatorDomain = (): string =>
  getCreatorBaseUrl().replace(/^https?:\/\//, "");
