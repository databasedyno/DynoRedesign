/* "Where to test" for every QA catalog case: the in-app menu path a tester follows
 * and the route to open. Keyed by case id; section ids act as fallbacks. */

export interface QaWhere {
  /** Menu / navigation path as the tester sees it (Sidebar → Money → Payout wallets). */
  menu: string;
  /** Route to open (relative to the app origin). */
  route: string;
  /** Optional extra hint (e.g. API-only, which tab to click). */
  hint?: string;
}

const PROFILE = "/settings?section=profile";
const PROFILE_MENU = "App → Sidebar → Settings → Account → Profile & security";
const API_MENU = "Server-to-server (curl / Postman) — get an x-api-key under Sidebar → Settings → Developers → API keys";

export const QA_WHERE: Record<string, QaWhere> = {
  /* ---- sections (fallbacks) ---- */
  public: { menu: "Public website", route: "/" },
  auth: { menu: "Public website → Log in / Start free", route: "/auth/login" },
  dashboard: { menu: "App → Sidebar → Dashboard", route: "/dashboard" },
  company: { menu: "App → Sidebar → Settings → Business → Company", route: "/settings?section=company" },
  wallet: { menu: "App → Sidebar → Money → Payout wallets", route: "/wallet" },
  paylinks: { menu: "App → Sidebar → Sell → Payment Links", route: "/pay-links" },
  checkout: { menu: "Buyer-facing checkout (open any payment link, or the sandbox)", route: "/pay/demo" },
  invoices: { menu: "App → Sidebar → Money → Receipts & Tax", route: "/invoices" },
  devkeys: { menu: "App → Sidebar → Settings → Developers", route: "/developer-keys" },
  notifications: { menu: "App → top bar → Bell icon", route: "/notifications" },
  settings: { menu: "App → Sidebar → Settings", route: "/settings" },
  referrals: { menu: "App → Sidebar → Grow → Refer & earn", route: "/referrals" },
  subscriptions: { menu: API_MENU, route: "/api/docs", hint: "No UI — subscriptions are API-only (see Swagger → Subscriptions)." },
  kyc: { menu: "App → KYC banner on Dashboard, or Sidebar → Settings → Business → Company → Verification", route: "/kyc" },
  merchantapi: { menu: API_MENU, route: "/api/docs" },
  admin: { menu: "Admin panel (separate login)", route: "/admin/login" },
  i18n: { menu: "Public header → globe icon · App → top bar → language menu", route: "/" },
  realtime: { menu: "Buyer checkout (live status) · Dashboard live tiles", route: "/pay/demo" },
  crosscut: { menu: "Whole app — start on the Dashboard and the public landing", route: "/dashboard" },

  /* ---- end-to-end journeys ---- */
  journeys: { menu: "Whole app — follow the flow end to end", route: "/dashboard" },
  "JRN-01": { menu: "Start at Public → Start free, then follow the app end to end (company → wallet → link → checkout)", route: "/auth/register" },
  "JRN-02": { menu: "Buyer checkout — open a payment link in a private window, or the sandbox", route: "/pay/demo" },
  "JRN-03": { menu: "Server-to-server (Swagger /api/docs, curl/Postman) + Settings → Developers → API keys & Webhooks", route: "/developer-keys" },
  "JRN-04": { menu: "Payment states demo (all states) + buyer checkout for behaviour", route: "/pay/payment-states-demo" },
  "JRN-05": { menu: "Log in → Forgot password, then the 2FA prompt on next login", route: "/auth/login" },
  "JRN-06": { menu: "App → Sidebar → Settings → Payments → Auto-convert, then settle a sandbox payment", route: "/settings?section=payments" },
  "JRN-07": { menu: "App → Sidebar → Grow → Refer & earn, plus register a new merchant via ?ref=", route: "/referrals" },
  "JRN-08": { menu: "Admin panel → Transactions / Withdrawals (separate login)", route: "/admin/login" },

  /* ---- public ---- */
  "PUB-001": { menu: "Public website → Home", route: "/" },
  "PUB-002": { menu: "Public website → top navigation (Products · Pricing · Security · Developers) + mobile hamburger", route: "/" },
  "PUB-003": { menu: "Public website → footer → Blog", route: "/blog" },
  "PUB-004": { menu: "Public website → Pricing (nav) → Fees page", route: "/fees" },
  "PUB-005": { menu: "Public website → Developers → Documentation (Swagger at /api/docs)", route: "/documentation" },
  "PUB-006": { menu: "Public website → footer → System status", route: "/system-status" },
  "PUB-007": { menu: "App → Sidebar → Settings → Help & Support (also footer → Help)", route: "/help-support" },
  "PUB-008": { menu: "Public website → footer → Privacy · Terms · AML policy", route: "/privacy-policy", hint: "Also /terms-conditions and /aml-policy." },
  "PUB-009": { menu: "Browser address bar", route: "/sitemap.xml", hint: "Also /robots.txt and view-source of / for meta tags." },

  /* ---- auth ---- */
  "AUTH-001": { menu: "Public website → Start free", route: "/auth/register" },
  "AUTH-002": { menu: "Public website → Start free → Phone tab", route: "/auth/register" },
  "AUTH-003": { menu: "Public website → Log in", route: "/auth/login" },
  "AUTH-004": { menu: "Log in → Continue with Google (new account)", route: "/auth/login" },
  "AUTH-005": { menu: "Log in → Continue with Google (existing account)", route: "/auth/login" },
  "AUTH-006": { menu: "Log in → Continue with Facebook", route: "/auth/login" },
  "AUTH-007": { menu: "Log in → social button → redirect back", route: "/auth/validateSocialLogin" },
  "AUTH-008": { menu: "Log in → Forgot password? → email link", route: "/auth/login", hint: "Reset link lands on /reset-password." },
  "AUTH-009": { menu: `${PROFILE_MENU} → Two-factor authentication`, route: PROFILE },
  "AUTH-010": { menu: `${PROFILE_MENU} → Active sessions`, route: PROFILE },
  "AUTH-011": { menu: "Any app page left open ≥ 15 min (e.g. Dashboard)", route: "/dashboard" },
  "AUTH-012": { menu: "App → top-right avatar menu → Log out", route: "/dashboard" },
  "AUTH-013": { menu: "Registration email → Verify link · marketing email → Unsubscribe link", route: "/unsubscribe" },

  /* ---- dashboard ---- */
  "DASH-001": { menu: "App → Sidebar → Dashboard", route: "/dashboard" },
  "DASH-002": { menu: "App → top bar → Company selector (left of the header)", route: "/dashboard" },
  "DASH-003": { menu: "First login → Get started checklist", route: "/get-started" },
  "DASH-004": { menu: "App → Sidebar → Dashboard → Conversions / auto-convert card", route: "/dashboard" },
  "DASH-005": { menu: "App → Sidebar → Dashboard (with a brand-new company selected)", route: "/dashboard" },

  /* ---- company ---- */
  "COMP-001": { menu: "App → top bar → Company selector → Add company", route: "/company" },
  "COMP-002": { menu: "App → Sidebar → Settings → Business → Company", route: "/settings?section=company" },
  "COMP-003": { menu: "App → Sidebar → Settings → Business → Tax", route: "/settings?section=tax" },
  "COMP-004": { menu: "App → Sidebar → Settings → Developers → Webhooks tab", route: "/developer-keys?tab=webhooks" },
  "COMP-005": { menu: "App → Sidebar → Settings → Payments → Auto-convert to stablecoin", route: "/settings?section=payments" },
  "COMP-006": { menu: "App → Sidebar → Settings → Business → Company → Danger zone", route: "/settings?section=company" },
  "COMP-007": { menu: "App → Sidebar → Money → Transactions", route: "/transactions" },

  /* ---- wallet ---- */
  "WAL-001": { menu: "App → Sidebar → Money → Payout wallets", route: "/wallet" },
  "WAL-002": { menu: "App → Sidebar → Money → Payout wallets → Add address", route: "/wallet" },
  "WAL-003": { menu: "App → Sidebar → Money → Payout wallets → address row → Edit", route: "/wallet" },
  "WAL-004": { menu: "App → Sidebar → Money → Payout wallets → address row → Delete", route: "/wallet" },
  "WAL-005": { menu: "App → Sidebar → Money → Payout wallets → Add address (invalid inputs)", route: "/wallet" },
  "WAL-006": { menu: "Public website → Fees page (network fees) · Buyer checkout (live rate)", route: "/fees" },
  "WAL-007": { menu: "App → Sidebar → Money → Transactions → Export", route: "/transactions" },
  "WAL-008": { menu: "App → Sidebar → Money → Payout wallets → wallet card → Remove wallet", route: "/wallet" },

  /* ---- payment links ---- */
  "PAY-001": { menu: "App → Sidebar → Sell → Payment Links → New link", route: "/create-pay-link" },
  "PAY-002": { menu: "App → Sidebar → Sell → Payment Links", route: "/pay-links" },
  "PAY-003": { menu: "App → Sidebar → Sell → Payment Links → row ⋯ → Edit", route: "/pay-links" },
  "PAY-004": { menu: "App → Sidebar → Sell → Payment Links → row ⋯ → Delete", route: "/pay-links" },
  "PAY-005": { menu: "App → Sidebar → Sell → Payment Links → New link → fee preview panel", route: "/create-pay-link" },

  /* ---- checkout ---- */
  "CHK-001": { menu: "Payment Links → row → Copy link → open in a private window (or use the sandbox)", route: "/pay/demo" },
  "CHK-002": { menu: "Buyer checkout → Choose a coin → payment details (address, amount, QR)", route: "/pay/demo" },
  "CHK-003": { menu: "Buyer checkout → payment method options", route: "/pay/demo" },
  "CHK-004": { menu: "Buyer checkout → after sending → status timeline · App → Transactions", route: "/pay/demo" },
  "CHK-005": { menu: "Payment states demo (all statuses side by side)", route: "/pay/payment-states-demo" },
  "CHK-006": { menu: "Success / failed screens demo", route: "/pay/success-demo", hint: "Also /pay/state-demo." },
  "CHK-007": { menu: "Buyer checkout → footer → Terms · AML", route: "/pay/terms-of-service", hint: "Also /pay/aml-policy." },
  "CHK-008": { menu: "Public website → Try a live checkout (hero) → sandbox", route: "/pay/demo" },

  /* ---- invoices ---- */
  "INV-001": { menu: "App → Sidebar → Money → Receipts & Tax → Invoices tab", route: "/invoices" },
  "INV-002": { menu: "App → Sidebar → Money → Receipts & Tax → invoice row → PDF", route: "/invoices" },
  "INV-003": { menu: "App → Sidebar → Settings → Business → Tax · Receipts & Tax → Tax report tab", route: "/settings?section=tax" },

  /* ---- developers ---- */
  "DEV-001": { menu: "App → Sidebar → Settings → Developers → API keys → Create key", route: "/developer-keys" },
  "DEV-002": { menu: "App → Sidebar → Settings → Developers → API keys", route: "/developer-keys" },
  "DEV-003": { menu: "App → Sidebar → Settings → Developers → Webhooks tab → delivery log", route: "/developer-keys?tab=webhooks" },
  "DEV-004": { menu: "App → Sidebar → Settings → Developers → API keys → key row → limits", route: "/developer-keys" },
  "DEV-005": { menu: API_MENU, route: "/api/docs", hint: "Sub-merchant plans are API-only." },
  "DEV-006": { menu: "App → Sidebar → Grow → Customers", route: "/customers" },

  /* ---- notifications ---- */
  "NOTIF-001": { menu: "App → top bar → Bell icon → See all", route: "/notifications" },
  "NOTIF-002": { menu: "App → Sidebar → Settings → Account → Notifications", route: "/settings?section=notifications" },
  "NOTIF-003": { menu: "App → Sidebar → Settings → Account → Notifications → Push", route: "/settings?section=notifications" },

  /* ---- settings ---- */
  "SET-001": { menu: "App → Sidebar → Settings", route: "/settings" },
  "SET-002": { menu: PROFILE_MENU, route: PROFILE },
  "SET-003": { menu: `${PROFILE_MENU} → Change password`, route: PROFILE },
  "SET-004": { menu: `${PROFILE_MENU} → Contact info → Email`, route: PROFILE },
  "SET-005": { menu: `${PROFILE_MENU} → Contact info → Phone`, route: PROFILE },
  "SET-006": { menu: `${PROFILE_MENU} → Contact info → Remove`, route: PROFILE },
  "SET-007": { menu: `${PROFILE_MENU} → Login activity`, route: PROFILE },
  "SET-008": { menu: `${PROFILE_MENU} → Danger zone → Delete account`, route: PROFILE },

  /* ---- referrals ---- */
  "REF-001": { menu: "App → Sidebar → Grow → Refer & earn → Your link", route: "/referrals" },
  "REF-002": { menu: "App → Sidebar → Grow → Refer & earn → Leaderboard", route: "/referrals" },
  "REF-003": { menu: "Public website → Start free → Referral code field (or ?ref= link)", route: "/auth/register" },
  "REF-004": { menu: "App → Sidebar → Grow → Refer & earn → Earnings / payout", route: "/referrals" },

  /* ---- subscriptions / kyc ---- */
  "SUB-001": { menu: API_MENU, route: "/api/docs", hint: "No UI — use Swagger → Subscriptions endpoints." },
  "KYC-001": { menu: "App → Dashboard KYC banner · Sidebar → Settings → Business → Company → Verification", route: "/kyc" },
  "KYC-002": { menu: "App → KYC page → Start verification (Veriff)", route: "/kyc" },
  "KYC-003": { menu: "App → KYC page → Resubmit / history", route: "/kyc" },

  /* ---- merchant API ---- */
  "MAPI-001": { menu: API_MENU, route: "/api/docs", hint: "POST /api/user/createUser" },
  "MAPI-002": { menu: API_MENU, route: "/api/docs", hint: "POST /api/user/createPayment" },
  "MAPI-003": { menu: API_MENU, route: "/api/docs", hint: "POST /api/user/cryptoPayment" },
  "MAPI-004": { menu: API_MENU, route: "/api/docs", hint: "Add funds / use wallet endpoints" },
  "MAPI-005": { menu: API_MENU, route: "/api/docs", hint: "Balances & transactions endpoints" },
  "MAPI-006": { menu: "App → Sidebar → Settings → Developers → Webhooks tab (delivery log) + your receiver", route: "/developer-keys?tab=webhooks" },

  /* ---- admin ---- */
  "ADM-001": { menu: "Admin panel → Login", route: "/admin/login" },
  "ADM-002": { menu: "Admin panel → Overview", route: "/admin" },
  "ADM-003": { menu: "Admin panel → Merchants → merchant → wallets", route: "/admin/merchants" },
  "ADM-004": { menu: "Admin panel → Overview → Platform fee revenue / fee tiers", route: "/admin", hint: "Tier config may be API-only — confirm with dev." },
  "ADM-005": { menu: "Admin panel → Overview", route: "/admin", hint: "Transfer speed config may be API-only — confirm with dev." },
  "ADM-006": { menu: "Admin panel → Transactions", route: "/admin/transactions" },
  "ADM-007": { menu: "Admin panel → Profile", route: "/admin/profile" },
  "ADM-008": { menu: "Admin panel → Support inbox / knowledge base", route: "/admin/support" },
  "ADM-009": { menu: "Admin panel → Overview → health alerts · Public → System status", route: "/admin" },

  /* ---- cross-cutting ---- */
  "I18N-001": { menu: "Public header → globe icon · App → top bar → language menu · checkout → language", route: "/" },
  "RT-001": { menu: "Buyer checkout (status updates live) · App → Dashboard live tiles", route: "/pay/demo" },
  "CC-001": { menu: "Whole app — try bad inputs on Payment Links, Wallets, Settings", route: "/pay-links" },
  "CC-002": { menu: "Browser dev tools → Network tab while using the app", route: "/dashboard" },
  "CC-003": { menu: "Log in page (repeat wrong password) · API with a key", route: "/auth/login" },
  "CC-004": { menu: "Every page — resize the browser or use device emulation (390 / 768 / 1280 / 1920)", route: "/" },
  "CC-005": { menu: "Public header → theme toggle · App → top bar → theme toggle", route: "/dashboard" },
  "CC-006": { menu: "App pages with a brand-new company (empty states) · slow network (loading)", route: "/dashboard" },
  "CC-007": { menu: "Browser back / forward / refresh while moving through the app", route: "/dashboard" },
  "CC-008": { menu: "Browser dev tools → Lighthouse / Performance on landing and Dashboard", route: "/" },
};

export const resolveWhere = (sectionId: string, caseId: string): QaWhere | undefined =>
  QA_WHERE[caseId] ?? QA_WHERE[sectionId];
