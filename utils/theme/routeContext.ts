/**
 * Theme route-context helper (2025-07 pass).
 *
 * DynoPay now runs TWO independent theme preferences:
 *  - "inapp"  — merchant admin surfaces (dashboard, transactions, wallets,
 *               settings, etc.)  → defaults to DARK, feels like a tool.
 *  - "public" — landing, marketing, buyer checkout, docs → defaults to
 *               LIGHT, feels like a trusted brand surface.
 *
 * Auth surfaces (/auth/*, /reset-password) are a special third case: they
 * technically live under "public" (default light for a Coinbase-clean sign
 * in), BUT if a returning merchant has already toggled the in-app to dark,
 * the login card should inherit that so clicking a link from a dark email
 * doesn't feel jarring. That inheritance is implemented as a soft override
 * in `resolvePreferredTheme` (see ThemeContext.tsx): when the active
 * context is "public" AND the path is an auth path AND the user has an
 * explicit `theme-mode-inapp=dark` in storage, we use dark.
 *
 * A single manual toggle only mutates the preference for the CURRENT
 * context, so flipping the dashboard to light doesn't also blow away
 * the landing page's clean white brand.
 *
 * This file is pure — no React, no window, no MUI — so it's safe to import
 * from _document.tsx blocking scripts (inlined), _app.tsx getInitialProps
 * (SSR), and the ThemeContext client provider.
 */

export type ThemeMode = "light" | "dark";
export type ThemeContext = "inapp" | "public";

/**
 * Paths (prefix-matched) that render inside the authenticated merchant
 * shell. Everything else — landing, marketing, buyer checkout, auth,
 * static/legal, docs — is treated as PUBLIC and defaults to LIGHT.
 *
 * Keep this list conservative: adding a path here changes the DEFAULT for
 * users who have never toggled, so an over-broad match will silently flip
 * the landing page to dark for new visitors.
 */
const INAPP_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/wallet",       // matches /wallet and /wallets
  "/wallets",
  "/customers",
  "/invoices",
  "/notifications",
  "/settings",
  "/profile",
  "/create-pay-link",
  "/referrals",
  "/developer-keys",
  "/company",
  "/fees",
  "/admin",
  "/creator",
  "/payouts",
];

/**
 * Auth / password-reset paths — technically "public" (they can be visited
 * without a session) but styling-wise they mirror the in-app when the user
 * has already chosen dark on the dashboard. See `isAuthPath()` consumers
 * in ThemeContext and _document.tsx.
 */
const AUTH_PREFIXES = ["/auth", "/reset-password"];

export function getRouteContext(pathname: string | undefined | null): ThemeContext {
  if (!pathname) return "public";
  // Strip query string / hash / trailing slash before prefix matching.
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  for (const prefix of INAPP_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return "inapp";
  }
  return "public";
}

/** True for `/auth/*` and `/reset-password` — used to trigger the "inherit
 *  the merchant's in-app dark preference" behaviour. */
export function isAuthPath(pathname: string | undefined | null): boolean {
  if (!pathname) return false;
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  for (const prefix of AUTH_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function getDefaultThemeForContext(context: ThemeContext): ThemeMode {
  return context === "inapp" ? "dark" : "light";
}

export function getStorageKeyForContext(context: ThemeContext): string {
  return context === "inapp" ? "theme-mode-inapp" : "theme-mode-public";
}

export function getCookieNameForContext(context: ThemeContext): string {
  return context === "inapp" ? "theme-mode-inapp" : "theme-mode-public";
}
