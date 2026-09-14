import paymentLinkModel from "../../models/userModels/paymentLinkModel";
import { FRONTEND_BASE_URL } from "./emailShared";

/**
 * Buyer Auto-Invite — resolves the "Buy from {Brand} again, faster" destination
 * for a settled payment's receipt email.
 *
 * Priority (user-approved "smart pick"):
 *   1. Donation contribution -> the multi-use campaign parent (always live).
 *   2. A standard/cart link that is STILL live & reusable (rare -- most flip to
 *      status='successful' after payment and then render an "already paid"
 *      screen, so they are intentionally skipped here).
 *   3. The merchant's public storefront (/<handle>) when creator_page_enabled.
 *   4. Otherwise omit (returns null).
 *
 * Best-effort and read-only: never throws (the receipt email must always send).
 */

const NON_REUSABLE_STATUSES = new Set([
  "successful",
  "success",
  "completed",
  "complete",
  "confirmed",
  "paid",
  "expired",
  "cancelled",
  "canceled",
  "disabled",
  "refunded",
]);

const refFromUrl = (url?: string | null): string | null =>
  (typeof url === "string" ? url.match(/[?&]d=([A-Za-z0-9]+)/)?.[1] : null) ?? null;

const isLive = (row?: Record<string, unknown> | null): boolean => {
  if (!row) return false;
  const status = String(row.status ?? "").trim().toLowerCase();
  if (NON_REUSABLE_STATUSES.has(status)) return false;
  const expiresAt = row.expires_at as string | Date | null | undefined;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return false;
  return true;
};

export interface BuyAgainLink {
  url: string;
  /** 'donation' tweaks the copy to "Support {Brand} again". */
  kind: "donation" | "default";
}

export const buildBuyAgainLink = async (opts: {
  linkId?: number | string | null;
  linkType?: string | null;
  parentLinkId?: number | string | null;
  company?: { handle?: string | null; creator_page_enabled?: boolean | null } | null;
  buyerEmail?: string | null;
  buyerName?: string | null;
}): Promise<BuyAgainLink | null> => {
  const { linkId, linkType, parentLinkId, company, buyerEmail, buyerName } = opts;
  const lt = String(linkType || "").trim().toLowerCase();

  const withPrefill = (baseUrl: string): string => {
    const params = new URLSearchParams();
    const email = (buyerEmail || "").trim();
    if (email && !email.toLowerCase().endsWith(".local") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      params.set("be", email);
    }
    const name = (buyerName || "").trim();
    if (name && !name.includes("@")) params.set("bn", name);
    const qs = params.toString();
    if (!qs) return baseUrl;
    return baseUrl + (baseUrl.includes("?") ? "&" : "?") + qs;
  };

  try {
    // 1) Donation contribution -> reuse the multi-use campaign parent.
    if (lt === "contribution" && parentLinkId) {
      const parent = (
        await paymentLinkModel.findOne({
          where: { link_id: parentLinkId },
          attributes: ["payment_link", "status", "expires_at"],
        })
      )?.get({ plain: true }) as Record<string, unknown> | undefined;
      const ref = refFromUrl(parent?.payment_link as string | undefined);
      if (ref && isLive(parent)) {
        return { url: withPrefill(String(parent!.payment_link)), kind: "donation" };
      }
    }

    // 2) A standard/cart link still live & reusable.
    if (linkId && lt !== "contribution") {
      const row = (
        await paymentLinkModel.findOne({
          where: { link_id: linkId },
          attributes: ["payment_link", "status", "expires_at", "link_type"],
        })
      )?.get({ plain: true }) as Record<string, unknown> | undefined;
      const ref = refFromUrl(row?.payment_link as string | undefined);
      if (ref && isLive(row)) {
        return { url: withPrefill(String(row!.payment_link)), kind: "default" };
      }
    }
  } catch {
    // read-only best-effort — fall through to the storefront / omit path.
  }

  // 3) Storefront fallback (no prefill — it is a different, catalog-level flow).
  if (company?.creator_page_enabled && company?.handle) {
    return {
      url: `${FRONTEND_BASE_URL}/${String(company.handle)}`,
      kind: lt === "contribution" || lt === "donation" ? "donation" : "default",
    };
  }

  // 4) omit
  return null;
};
