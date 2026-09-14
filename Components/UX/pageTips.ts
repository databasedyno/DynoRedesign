/**
 * Route → first-visit tip key map.
 *
 * A single source of truth so `ClientLayout` can render the correct one-time
 * `PageTip` under the shared page header for any merchant page, with no
 * per-page wiring. Add a route here + copy in `common:pageTips.<key>` (all 6
 * languages) to light up a new page's hint.
 *
 * Only pages that render the SHARED ClientLayout header are listed, so the tip
 * always sits directly beneath the title/description and reads as intentional.
 */
export const PAGE_TIP_ROUTES: Record<string, string> = {
  "/pay-links": "payLinks",
  "/transactions": "transactions",
  "/payouts": "payouts",
  "/wallet": "wallet",
  "/invoices": "invoices",
  "/customers": "customers",
  "/referrals": "referrals",
  // Secondary pages (all render the shared ClientLayout header).
  "/storefront": "storefront",
  "/settings": "settings",
  "/developer-keys": "developers",
  "/notifications": "notifications",
  "/help-support": "helpSupport",
  // Checkpoint 3 pages built 2026-09-09 (plan 3.4 / 3.10).
  "/wallet/security": "walletSecurity",
  "/kyc": "kyc",
};

export const getPageTipKey = (pathname: string): string | undefined =>
  PAGE_TIP_ROUTES[pathname];
