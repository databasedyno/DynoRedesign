import type { StatusTone } from "@/Components/UI/StatusDot";

/** Payment-link status → StatusDot tone + i18n key (paymentLinks ns). Shared by list + detail panel. */
export const linkStatusTone = (status?: string): StatusTone => {
  switch (String(status || "").toLowerCase()) {
    case "paid":
    case "completed":
      return "settled";
    case "active":
      return "info";
    case "expired":
      return "neutral";
    default:
      return "pending";
  }
};

export const linkStatusLabelKey = (status?: string): string => {
  switch (String(status || "").toLowerCase()) {
    case "paid":
    case "completed":
      return "statusPaid";
    case "active":
      return "statusActive";
    case "expired":
      return "statusExpired";
    default:
      return "statusPending";
  }
};

export const isLinkPaid = (status?: string) => ["paid", "completed"].includes(String(status || "").toLowerCase());
export const isLinkExpired = (status?: string) => String(status || "").toLowerCase() === "expired";
/** Edit + delete are only offered on links that can still be paid (matches the list's row rules). */
export const isLinkEditable = (status?: string) => !isLinkPaid(status) && !isLinkExpired(status);

export const EXPIRING_SOON_MS = 48 * 60 * 60 * 1000;

/** Live link whose expiry lands within the next 48 hours (Wave 3a "Expiring soon" badge / filter). */
export const isExpiringSoon = (link: { status?: string; expiresAtIso?: string | null }, now = Date.now()): boolean => {
  if (!link.expiresAtIso || isLinkPaid(link.status) || isLinkExpired(link.status)) return false;
  const t = new Date(link.expiresAtIso).getTime();
  return Number.isFinite(t) && t > now && t - now <= EXPIRING_SOON_MS;
};
