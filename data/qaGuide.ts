/* QA Playbook — the reference material a tester needs to work effectively.
 * Pure data (no imports). Rendered by Components/Page/Quality/QaGuidePanel.
 * NOTE: never put real passwords / API keys here — this compiles into the
 * client bundle. Reference the team vault for secrets; only non-secret
 * identifiers (URLs, brand IDs, sandbox routes) live here. */

export interface GuideRoute {
  label: string;
  route: string;
  note?: string;
}

export interface GuideAccount {
  role: string;
  detail: string;
  credentials: string;
}

export interface GuideKV {
  term: string;
  desc: string;
}

/* ---- Where to test: environments, sandboxes & tools ---- */
export const GUIDE_ENVIRONMENTS: GuideRoute[] = [
  { label: "App (this preview pod)", route: "/dashboard", note: "Wired to the PRODUCTION database in SAFE MODE — prefer read-only, never mutate live merchant data." },
  { label: "Public website", route: "/", note: "Landing, pricing, blog, legal, status." },
  { label: "API reference (Swagger)", route: "/api/docs", note: "Live merchant contract. Every path also under /api/v1/…" },
  { label: "Developer docs (guide)", route: "/documentation", note: "Human-readable API + webhook docs." },
  { label: "Buyer checkout — sandbox", route: "/pay/demo", note: "Safe end-to-end checkout without a real on-chain payment." },
  { label: "Payment states demo", route: "/pay/payment-states-demo", note: "Waiting / Confirming / Completed / Underpaid / Overpaid / Expired / Failed side by side." },
  { label: "Success & failed demos", route: "/pay/success-demo", note: "Also /pay/state-demo." },
  { label: "Admin panel", route: "/admin/login", note: "Separate super-admin login." },
  { label: "System status", route: "/system-status", note: "Should mirror /api/status." },
];

/* ---- Test accounts & brands (identifiers only — creds from the team vault) ---- */
export const GUIDE_ACCOUNTS: GuideAccount[] = [
  {
    role: "Merchant (owner test account)",
    detail: "2-step login: email → Continue → password → email OTP. Use it to exercise the full merchant app.",
    credentials: "From the team vault — not stored here.",
  },
  {
    role: "Super-admin",
    detail: "Login at /admin/login for the admin panel (withdrawals, fee tiers, merchants).",
    credentials: "From the team vault — not stored here.",
  },
  {
    role: "Merchant API key (x-api-key)",
    detail: "Create under Settings → Developers → API keys — the secret is shown once. Use for Swagger / curl / Postman.",
    credentials: "Generate your own; never reuse a live merchant key.",
  },
  {
    role: "Throwaway signups",
    detail: "Register fresh accounts for onboarding / recovery journeys. In SAFE MODE, OTPs are surfaced for testing (outbound email is off).",
    credentials: "Always use a qa_-prefixed email so cleanup is safe.",
  },
];

/* Brand fixtures on the owner account (company switcher). Non-secret ids only. */
export const GUIDE_BRANDS: GuideKV[] = [
  { term: "The Dev Store (1)", desc: "Populated (many payments) → normal dashboard with data." },
  { term: "Nameword (165)", desc: "Wallets but 0 links/payments → new-merchant hero; wizard resumes at ‘link’." },
  { term: "QA Throwaway Brand 2 (179)", desc: "0 wallets/links → wizard resumes at ‘payouts’ (good for empty states)." },
  { term: "SMADAV (71)", desc: "Wallets + a couple of links/payments → normal dashboard." },
];

/* ---- Priority legend (what a rating means for release) ---- */
export const GUIDE_PRIORITY: GuideKV[] = [
  { term: "Critical", desc: "Money path / auth / data loss. A failure blocks release — stop and report immediately." },
  { term: "High", desc: "Core feature broken or a common flow degraded. Fix before shipping." },
  { term: "Medium", desc: "Secondary feature or edge case. Should fix, but not a release blocker on its own." },
  { term: "Low", desc: "Cosmetic / rare / nice-to-have. Log it and move on." },
];

/* ---- Status legend (the buttons on each test) ---- */
export const GUIDE_STATUS: GuideKV[] = [
  { term: "Pass", desc: "Behaved exactly as the Expected column says." },
  { term: "Fail", desc: "Deviated from Expected — add a note with steps, expected vs actual, and evidence." },
  { term: "Blocked", desc: "Could not run (dependency down, missing data, needs dev). Note why." },
  { term: "Pending", desc: "Not tested yet." },
];

/* ---- How to test effectively (app-specific + general best practice) ---- */
export const GUIDE_CHECKLIST: string[] = [
  "Test the journeys first (Section 🧭). A feature can pass alone yet break the end-to-end flow.",
  "For every flow, cover three angles: happy path, edge cases (limits, empty, huge, special chars), and negative (bad input, wrong OTP, expired link).",
  "Keep DevTools open — watch the Console for errors and the Network tab for failed/4xx/5xx calls. After social login there must be NO CSRF 403; a 401 should auto-refresh the token, not log you out.",
  "Auth is 2-step: email → Continue → password → email OTP (not a single form). 2FA adds a TOTP/backup-code step. Verify each stage, resend cooldowns, and wrong-code handling.",
  "Money must be exact: crypto amounts render as strings (no float drift), fiat as numbers. Re-check the crypto amount matches the QR and the right number of decimals.",
  "Fees on PUBLIC pages must NOT show the internal ‘+ $1’ fixed fee — only the percentage / effective rate. It stays visible in-app under Settings → Plan & fees.",
  "SAFE MODE etiquette: don’t mutate live merchant data. Clicking Continue on a real payment link reserves a real pool address — use the sandbox (/pay/demo) or mock POST /api/pay/addPayment.",
  "Webhooks: an endpoint is signed only when it has a secret (auto-generated whsec_, shown once) — otherwise unsigned. Verify X-Dynopay-Signature-V2 over the RAW body; reconcile via GET /events and re-send via POST /events/:id/resend.",
  "OTP-gated actions (add/edit/delete wallet, change email/phone, delete account/brand) — confirm the OTP step actually gates the action; in SAFE MODE the code is surfaced for testing.",
  "Brand scoping: switch companies and confirm the data changes and persists across refresh. Use empty brands (165/179) for empty states and populated ones (1/71) for data states.",
  "Onboarding wizard should resume at the correct step for the selected brand’s state.",
  "Double-submit & idempotency: mash Create/Pay buttons — they should debounce/disable and not create duplicates. Use browser Back / Forward / Refresh mid-flow and confirm nothing corrupts.",
  "Responsive: check 390 / 768 / 1280 / 1920 px. Test dark AND light mode. Test i18n (en/de/es/fr/pt/nl) — copy translates and amounts/dates are locale-formatted.",
  "Empty, loading and error states: brand-new company (empty), slow network (loading skeletons), and forced failures (clear error + retry).",
  "Accessibility basics: keyboard-only navigation, visible focus states, and alt text on images/icons.",
  "Always capture a Request-Id / response body from the Network tab when something fails — it makes the bug report actionable.",
];

/* ---- Bug report template (what to capture) ---- */
export const GUIDE_BUG_TEMPLATE: GuideKV[] = [
  { term: "Title", desc: "Area + one-line summary, e.g. ‘Checkout: BTC amount off by a decimal’." },
  { term: "Journey / Test ID", desc: "e.g. JRN-01 step 5, or CHK-002." },
  { term: "Environment", desc: "URL (preview vs prod), browser + version, device/viewport, dark/light, language." },
  { term: "Steps to reproduce", desc: "Numbered, from a known starting point. Note if it’s always vs intermittent." },
  { term: "Expected vs Actual", desc: "What the Expected column said vs what happened." },
  { term: "Evidence", desc: "Screenshot/video + Console error + failing Network request (URL, status, Request-Id, response body)." },
  { term: "Severity", desc: "Critical / High / Medium / Low (see priority legend)." },
  { term: "Notes", desc: "Workaround, first seen, related account/brand id." },
];

/* ---- Glossary of domain terms ---- */
export const GUIDE_GLOSSARY: GuideKV[] = [
  { term: "Payment states", desc: "waiting → confirming → completed; plus underpaid, overpaid, expired, failed." },
  { term: "Settlement", desc: "When a confirmed payment is credited to the merchant (optionally after auto-convert)." },
  { term: "Auto-convert", desc: "Automatically converting incoming crypto to a stablecoin (USDC/USDT) at settlement." },
  { term: "Fee tier / effective rate", desc: "The percentage drops with volume; the ‘effective rate’ blends the percentage + fixed fee." },
  { term: "Fee payer", desc: "Who covers the fee — merchant (buyer pays the sticker price) or customer (added on top)." },
  { term: "whsec_ secret", desc: "Per-endpoint webhook signing secret, auto-generated when a webhook URL is saved and shown once." },
  { term: "Signature V2", desc: "X-Dynopay-Signature-V2: t=<unix>,v1=<hmac> over ‘<t>.<rawBody>’ — verify against the raw request body." },
  { term: "Idempotency-Key", desc: "Header on create endpoints so a retried request never double-charges." },
  { term: "KYC / Veriff", desc: "Identity verification; unlocks full platform access. States: not_started, pending, verified, rejected." },
  { term: "Payout wallet", desc: "A merchant’s own crypto address where funds are sent; adding/editing it is OTP-gated." },
  { term: "Sandbox", desc: "Demo checkout (/pay/demo) that runs the full flow without a real on-chain payment." },
  { term: "SAFE MODE", desc: "This pod is read-only against the production DB; outbound email and background jobs are off." },
  { term: "x-api-key", desc: "The merchant API credential for server-to-server calls (Direct/Merchant API)." },
];
