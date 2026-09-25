/**
 * Theme preference model (Theme Memory, 2026-09).
 *
 * ONE remembered light/dark choice per browser, shared by marketing, checkout,
 * auth and the merchant dashboard:
 *  - `dyno-theme`     — the visitor's MANUAL choice (localStorage + cookie).
 *                       Only written by an explicit toggle (or the one-time
 *                       migration from the legacy per-context keys below).
 *  - `dyno-theme-eff` — cookie with the last EFFECTIVE mode (manual or device),
 *                       written by the blocking script so SSR agrees with the
 *                       client on the next request (no flash).
 * When nothing is remembered the site follows `prefers-color-scheme` live.
 *
 * SafeDeal (/safedeal/*) is a fixed-brand surface: always light, never persists.
 *
 * Pure module — no React / window / MUI — safe for _document.tsx (inlined
 * logic must be kept IN SYNC by hand), _app.tsx getInitialProps and the client
 * ThemeContext provider.
 */

export type ThemeMode = "light" | "dark";
export type ThemeSource = "manual" | "system" | "fixed";

export const THEME_KEY = "dyno-theme";
export const THEME_EFFECTIVE_COOKIE = "dyno-theme-eff";

/** Legacy per-context keys (2025-07 → 2026-09). Precedence on migration:
 *  dashboard choice > legacy single key > public choice. */
export const LEGACY_THEME_KEYS = [
  "theme-mode-inapp",
  "theme-mode",
  "theme-mode-public",
  "theme-mode-public-v2",
] as const;

export function parseMode(value: unknown): ThemeMode | null {
  return value === "light" || value === "dark" ? value : null;
}

export function isSafeDealPath(pathname: string | undefined | null): boolean {
  if (!pathname) return false;
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return path === "/safedeal" || path.startsWith("/safedeal/");
}

/** Read a cookie value from a raw `Cookie` header / `document.cookie` string. */
export function readCookieValue(cookieHeader: string | undefined | null, name: string): string | null {
  if (!cookieHeader) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`).exec(cookieHeader);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** Resolve a legacy preference via a getter over storage/cookies (first hit wins). */
export function resolveLegacyMode(get: (key: string) => string | null | undefined): ThemeMode | null {
  for (const key of LEGACY_THEME_KEYS) {
    const v = parseMode(get(key));
    if (v) return v;
  }
  return null;
}
