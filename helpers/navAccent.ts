import { BRAND_ACCENT, BRAND_ACCENT_LIGHT } from "@/constants/theme";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

/**
 * navAccent — the single source of truth for per-nav-item accent colours,
 * shared by the desktop sidebar (NewSidebar) and the mobile bottom nav
 * (MobileNavigationBar) so both stay perfectly in sync. Theme-aware.
 */
export function navAccent(icon: string, isDark: boolean): string {
  const S = CB_TOKENS.semantic;
  const map: Record<string, string> = {
    dashboard: isDark ? BRAND_ACCENT_LIGHT : BRAND_ACCENT,
    transactions: isDark ? S.info.dark : S.info.light,
    invoices: isDark ? S.warning.dark : S.warning.light,
    products: isDark ? S.warning.dark : S.warning.light,
    "payment-links": isDark ? BRAND_ACCENT_LIGHT : BRAND_ACCENT,
    creator: isDark ? "#C084FC" : "#9333EA",
    wallets: isDark ? S.positive.dark : S.positive.light,
    customers: isDark ? "#94A3B8" : "#64748B",
    api: isDark ? "#2DD4BF" : "#0D9488",
    referrals: isDark ? "#F472B6" : "#DB2777",
    notifications: isDark ? S.negative.dark : S.negative.light,
    settings: isDark ? "#94A3B8" : "#64748B",
  };
  return map[icon] || (isDark ? S.info.dark : S.info.light);
}

export default navAccent;
