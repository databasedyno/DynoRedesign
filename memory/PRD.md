# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment gateway platform. Users can create companies, wallets, payment links, and accept crypto payments. The platform supports OTP-based authentication, profile management, login activity monitoring, and comprehensive dark/light mode theming.

## What's Been Implemented

### 2026-07-07 — Bug fix: invisible/low-contrast text app-wide + wrong first-payment celebration ✅ VERIFIED
User reported (1) text invisible in BOTH light & dark across in-app pages, layouts & landing (e.g. dashboard KPIs, API-keys page, raw key `keys.usd`, "Active" pill), and (2) an EXISTING merchant (350+ tx) wrongly saw the "First payment landed!" celebration.
- **Root cause (contrast):** the bento reskin overloaded two palette tokens that the app uses as *surfaces*: `secondary.main` (was a light-gray/dark surface → reskin made it the near-black/lime ACCENT) and `success.main` (was a light tint → reskin made it a saturated green). Every component using them as a *background* (sidebar ReferralCard, /referrals step cards, RadioGroup, CustomSwitch, PanelCard header pills, wallet/dashboard panels, HelpAndSupport, OtpInputPanel, status badges) rendered near-1:1 (dark-on-dark / green-on-green).
- **Fix:** restored `secondary` in `styles/appTheme.ts` to a neutral SURFACE token (light `#F4F6FA`, dark `#1E1E28`) — one palette correction fixed ~30 surfaces at once; `primary`/`success` remain the true lime accents used with explicit contrastText. Also fixed 3 success badges (`Components/Page/API/styled.tsx` Tags, `Dashboard/styled.tsx` PercentageChip, `DashboardRightSection.tsx` tier badge → `success.light` bg). Fixed `/referrals` share button (`primary.contrastText`) and darkened landing muted-caption token (`homeTheme` text.disabled).
- **i18n:** `ApiKeysPage.tsx` card title was a raw `keys.usd` string → now `t("apiKeyTitle",{currency})` ("USD API Key"), key added to all 6 locales.
- **Celebration fix:** `Components/Page/Transactions/index.tsx` now fires the first-payment celebration ONLY when the merchant has exactly ONE confirmed payment (was: any confirmed payment + localStorage gate) — existing merchants with history never see it.
- **Verified** by frontend testing agent (iteration_23): 13/13 — all previously-invisible items readable in light+dark (sidebar 16–20:1, referrals steps, dev-keys title/body, dashboard KPI, wallet chips, landing captions), celebration correctly suppressed for hostbay (350+ tx), no console blockers. Live-prod-safe (JWT read-only, no mutations).


### 2026-07-07 — Auth suite bold redesign: "Floating Glass Bento" ✅ (design-verified)
- Full redesign of Login + Register + Forgot/Reset password to a bold, Emergent-style aesthetic (user request: "not bold like emergent"). Approved direction: cyber-lime (#CCFF00) on void-black glass (dark) / near-black buttons w/ lime text (light).
- Implemented as a **scoped MUI theme** (`styles/authTheme.ts` → `authThemeLight`/`authThemeDark`) wired into `pages/_app.tsx` for the `login` layout (covers `/auth/*`, `/reset-password`, `/admin/login`) — so the accent/glass cascades through ALL shared auth components (inputs, buttons, OTP/forgot dialogs) WITHOUT touching the ~2000-line auth logic. Rest of app untouched.
- Redesigned shell `Containers/Login/styled.tsx` (animated gradient-mesh + grain canvas, floating glass form card w/ entrance motion) and `Components/UI/AuthLayout/AuthBrandPanel.tsx` (bento tiles: 1,000+ businesses / 15+ coins / <1min settlements pulse + scrolling coin marquee, Unbounded/Manrope/JetBrains Mono fonts).
- Backward-compatible `CustomButton` tweak (uses `primary.contrastText` + optional `primary.hover` token; falls back to old values app-wide). Added 3 Google Fonts in `_document.tsx`. Added `brandBusinessesCaption` i18n key ×6 locales.
- **Verified via screenshots**: Login (dark+light), Register (dark), Phone-tab + email-focus interactions render beautifully; home/fees/documentation still compile (no app regression). NOTE: reset-password card body needs a valid token to view (redirects to login otherwise) — shares the same redesigned shell, compiles 200. No live auth mutations triggered.
- Backlog: extend this bold theme into the app/dashboard (user said "yes, later").


### 2026-07-07 — i18n "Batch A": high-priority merchant pages ✅ VERIFIED
- Internationalized 4 merchant surfaces across all 6 locales (en/pt/fr/es/de/nl):
  - **Referrals** (`pages/referrals.tsx`, `referrals` ns): How It Works 3-steps, You Get/They Get reward cards, Fee Discount panel (+ `daysRemaining` interpolation), Earnings Breakdown, My Referrals table, Leaderboard (`referralsCount`/`you` interpolation). ~21 keys added.
  - **Invoices & Tax** (`pages/invoices.tsx`, keys nested under `common.invoices`): tabs, invoice table headers, empty state, pagination, period/group dropdowns, Export CSV/Print, Total Revenue/Tax Collected/Total Invoices cards, Tax-by-Period + Tax-by-Jurisdiction tables. ~40 keys.
  - **Customers** (`pages/customers.tsx` + `Components/Page/Customers/index.tsx`, keys nested under `common.customers`; added `useTranslation` to both): stat cards, search, table, detail dialog, wallet credit/debit modal, toasts (`creditSuccess`/`debitSuccess`/`txns` interpolation). ~46 keys.
  - **Profile** (`AccountSetting.tsx`, `UpdatePassword.tsx`, `LoginActivity.tsx`, `AddContactInfo.tsx`, `profile` ns): email/phone change + OTP dialogs, Set/Update Password OTP flow, Login Activity relative-time labels + Flagged, all validation/toast strings. ~57 keys.
- Keys injected via `scripts/i18n_batchA.js` (merges into referrals.json, common.json[invoices/customers], profile.json ×6 locales). `invoices`/`customers` reuse the already-loaded `common` namespace to avoid touching the large `i18n.js` loader.
- Fixed a `search_replace` tail-corruption crash on `pages/referrals.tsx` (`errals is not defined`).
- **Verified** by frontend testing agent (iteration 20): 4/4 pages render translated in EN/DE/NL, no raw dotted keys leak, /referrals crash fixed. No data mutations performed (live-prod-safe).
- Minor/optional (non-blocking): "Unknown" jurisdiction label in Tax-by-Jurisdiction is backend-supplied data (not a UI key).


### 2026-07-07 — UX microcopy pass + i18n hardening (auth / wallet / payment-link) ✅ VERIFIED
User asked to fix "some pages still in English after switching", do a UX-copy pass across auth/payment-link/wallet, write a copy style guide, and remove the `t()||"English"` fallback anti-pattern. Delivered (order per user):
- **Auth register page fully internationalized** (`pages/auth/register.tsx`) — it was the main "still English" offender: ~19 hardcoded strings (Google button, divider, Email/Mobile toggle, labels/placeholders, referral link, Continue, footer, OTP-step titles/subtitles, account-exists banner, "Change email/phone", success-step copy). All now use `t()` (auth ns). 18 new keys added × 6 langs. **Note:** the Email/Mobile segmented toggle needed a second edit — the first `search_replace` silently no-op'd (recurring tool bug) and also appended a corrupted `xport default` line to `AddWalletModal.tsx` which had to be repaired.
- **Wallet Add modal** (`Components/UI/AddWalletModal/index.tsx`) — fixed hardcoded "Done/Add Another/Edit Wallet/Save Changes" + success heading, and added helper microcopy under Wallet name & Wallet address fields (`walletNameHelper`, `walletAddressHelper`).
- **Create payment link** (`Components/UI/pay-link/PaymentSettingsBasic.tsx`) — moved the hardcoded expiry recommendation to i18n (`expiryRecommendation`) and added `valueHelper` + `clientNameHelper` under the Value & Client name fields.
- **Removed the `t("key") || "English"` anti-pattern** — stripped **56** fallbacks across 10 frontend files (login, register OTP panel, OtpDialog, IdleTimeoutManager, MobileNavigationBar, UserMenu, HelpAndSupport, Profile AddContactInfo/UpdatePassword, reset-password). Critically this surfaced **7 latent missing keys** whose fallback masked a raw-key leak (`verifying`, `mustBeNumeric`, `mobilePlaceholder` [auth], `passwordComplexity` [profile], `idleTimeoutTitle`/`signOutNow`/`staySignedIn` [dashboardLayout]) — all added × 6 langs so users no longer see raw camelCase keys.
- **Copy Style Guide** written at `docs/COPY_STYLE_GUIDE.md` (voice, sentence-case buttons, CTA/helper/error rules, i18n rules, canonical terminology).
- All new copy translated to pt/es/fr/de/nl; `scripts/check-i18n.mjs` passes (all 5 non-EN locales complete).
- **Verified** by frontend testing agent (iterations 18 + 19): register localizes EN/DE/NL incl. toggle; login DE no raw keys; wallet & payment-link helper texts render localized EN/DE (hostbay JWT); mobile bottom-nav localized; NO raw i18n keys leak on any scoped screen.
- **i18n note for testers:** client language is localStorage key **`lang`** (+ `lang_manual`), NOT `i18nextLng`; SSR renders EN then client switches on hydration. Documented in `memory/test_credentials.md`.

**Remaining i18n backlog (out of THIS scope — same "still English" class, flagged by testing agent):** sidebar labels (Customers/API/Referrals/Settings), `/create-pay-link` & `/wallet` onboarding-gate/empty-state copy, Profile "Change/Add Phone/Update Password/Login Activity" block, mobile dashboard KPI widgets, and the Create-Company modal.


### 2026-07-05 — Removed non-crypto marketing claims (PCI DSS + credit-card copy)
User feedback: "Remove PCI DSS from MainMenu because I doubt it has to do with crypto. Also remove anything unrelated to crypto." Rationale is correct — PCI DSS is a card-industry (Visa/Mastercard) data-security standard, and DynoPay is a **non-custodial** crypto gateway that never touches card PANs, so claiming PCI DSS compliance is (a) misleading and (b) irrelevant to a merchant evaluating crypto rails.

Applied:
- **`Components/Page/Home/ComplianceLogoStrip.tsx`** — dropped the PCI DSS badge (with the `CreditScore` icon). Replaced it in-place with a **"Non-custodial · Funds go direct to your wallet"** badge (Shield icon) so the row still has 5 items and layout is preserved on desktop + 2-col mobile grid.
- **`langs/locales/{en,nl,de,es,fr,pt}/landing.json`** — changed the FinalCTA subtitle from "No credit card required" to "No signup fees, no lock-in" across all 6 supported languages. Same intent (signal a low-friction signup) without a card-payment phrase that belongs to fiat SaaS. English version now reads: *"Start in minutes. No signup fees, no lock-in. Your first $500 is on us."*

Not touched — deliberately (they're either non-user-visible dev comments or positive crypto-vs-cards contrast that IS pro-crypto messaging):
- FAQ, testimonials, hero subtitle references to "no chargebacks", "cut processing fees from 3.2% to 0.8%" — these are contrasting crypto AGAINST cards as a competitive advantage, not claiming card support.
- The dead `ComparisonTable.tsx` still has "credit-card baseline" text but the component isn't rendered anywhere (removed from `Home/index.tsx` in a prior pass).
- `pages/payment/*` still lists Card/Google Pay/Apple Pay as merchant checkout options — this is an actual PRODUCT feature (multi-method checkout including crypto), not a false marketing claim. Left alone unless product intent changes.

Verified via Playwright: `PCI DSS` count = 0 on landing, `Non-custodial` label = present in strip, `No credit card required` count = 0, `No signup fees` = present in FinalCTA. Both desktop (1440) and mobile (390) screenshots confirm 5 tiles / 2-col mobile grid still lays out cleanly.

**Files touched (7):** `ComplianceLogoStrip.tsx` + 6 `landing.json` locale files.

### 2026-07-05 — In-app UX pass: tables + filters + wallets
Audited 9 authenticated pages × 3 viewports (desktop 1440 / tablet 820 / mobile 390) using the QA account (`hostbay@moxx.co`) via JWT injection. User said "fix all" of the 8 items I proposed. Delivered:

- **H1 — Payment Links filter row**: replaced two raw `<input type="date">` boxes with the same `CustomDatePicker` component used on `/transactions`. Same styled pill trigger, same calendar popover. Verified via Playwright: `input[type="date"]` count = 0.
- **H2 — Payment Links Actions column clipped past viewport**: the `<TableBodyCell>` had `display: flex; width: fit-content` on the `<td>` itself, which broke the table's column-width calculation and let the Actions cell escape past the right edge. Fixed by moving `display: flex` to an inner `<Box>` so the `<td>` is a normal table cell. Verified: `actionsCell.right = tableWidth.right` (0px overflow).
- **H3 — Mobile wallets list**: was ~13 stacked ~205px cards = major scroll on iPhone. Cleaned up in `Components/Page/Wallet/`: (a) inlined "Total processed" label + value onto a single row on mobile (was stacked), (b) tightened `WalletCardBody` gap (12 → 8), (c) reduced PanelCard header/body padding on mobile, (d) shrunk "View Transactions" button (32→28px). Result: 3 full wallet cards visible in the first fold on iPhone 14 (was 2) → +50% above-the-fold density.
- **M1 — "Create payment link" button on Wallets page**: removed. It duplicated the global "Create" tab in the mobile bottom nav and the sidebar "Payment Links" nav item. `pages/wallet.tsx` now only renders the "Add wallet" primary CTA in the page action slot.
- **M3 — Unified filter bar**: Payment Links now reuses the same `CustomDatePicker` + `DatePickerTriggerButton` styled components as Transactions, so date filtering feels identical across both tables. `PaymentLinksTopBar.tsx` was rewritten to match.
- **M4 — Skeleton loading rows**: `PaymentLinksTable` now takes an optional `loading` prop and renders 6 shimmer rows (`Skeleton` × 9 columns) during the initial fetch. `Components/Page/Payment-link/index.tsx` no longer shows a full-page `<CircularProgress>` — filters stay interactive while data loads.
- **L1 — Tighter table row density**: Payment Links row height 63px → 52px on desktop (-17%), 59px → 48px on mobile.
- **L2 — Pagination copy**: kept the existing "Showing X of Y" phrasing but the surrounding layout is now aligned with the tighter row height.
- **M2 — Mobile bottom nav "More" tab**: audited, confirmed already good (expandable panel with Invoices & Tax, Customers, Pay Links, API, Referrals, Notifications, Language, Help & Support). No change needed.
- **L3 — Breadcrumbs on inner pages**: intentionally skipped for now (bottom-nav + sidebar already give sufficient wayfinding; adding breadcrumbs would add vertical space to every page).

**Files touched (5):** `Components/Page/Payment-link/PaymentLinksTopBar.tsx` (rewritten), `Components/Page/Payment-link/PaymentLinksTable.tsx` (Actions cell + Skeleton), `Components/Page/Payment-link/index.tsx` (loading prop), `pages/wallet.tsx` (M1 button removed), `Components/Page/Wallet/index.tsx` + `Components/Page/Wallet/styled.tsx` (H3 mobile compaction). Next.js compile clean (2861 modules, 256ms).

### 2026-07-05 — Sandbox checkout demo actually interactive (`/pay/demo`)
User bug: "Payment button doesn't work — nothing happens when clicked". The `/pay/demo` page (used both standalone and embedded on the landing via `/pay/demo?embed=1`) had the "Cryptocurrency" CTA rendered with all its hover/press styles but **no `onClick`** — click did literally nothing. Combined with the 3-step ProgressBar (Order → Payment → Done) and the "INTERACTIVE" pill on the parent iframe, this read as broken.

Rewrote `pages/pay/demo.tsx` as a small 3-step client-side state machine (no backend calls — it's a sandbox):
- **Step 0 Order** — unchanged card, but the CTA now has `onClick={goToPayment}`.
- **Step 1 Payment** — new UI: 5 coin chips (USDT-TRC20 / USDC-ERC20 / BTC / ETH / SOL), each clicking swaps the amount + wallet address + brand color live. Mock QR SVG on the left, real-format wallet addresses (`TTve…`, `0x9a…`, `1JH5…`, etc.), "Copy address" (writes to clipboard). Awaiting-confirmation box with a spinner and a live countdown ("auto-confirms in {n}s") that ticks down every second — at 0, auto-advances to Done. Back + "Simulate payment received" buttons.
- **Step 2 Done** — green checkmark, "Payment received · {crypto amount} {short} · €125.50 EUR settled to the merchant wallet", receipt block (Merchant / Invoice / Network in the coin's brand color), "Try the demo again" reset button that returns to Step 0 + resets timer.

ProgressBar's `activeStep` is now bound to the step state, so the stepper actually walks Order → Payment → Done. All existing i18n keys reused (`checkout.title`, `checkout.orderDetails`, `checkout.cryptocurrency`, etc.) — no missing translations.

Verified end-to-end via Playwright at 460×900:
- Step 0 button present · Click → Step 1 renders (coin chips × 5, wallet address, awaiting box, simulate button all present) · Click BTC chip → address updates from `TTve8v6Y…4mAkxR` to `1JH5TnZz…Hc1Do7` and amount from `125.5 USDT` to `0.00189 BTC` · Click "Simulate" → Step 2 renders (checkmark + reset button) · Click Reset → back to Step 0. Next.js compiled clean in 3.3s (2658 modules), no errors.

Files touched (1): `pages/pay/demo.tsx` (390 → 500 lines).

### 2026-07-05 — Landing + SEO pages: deep "clean" pass (Stripe/Linear-style)
User feedback: "Landing page and other pages on the footer links appears too busy and unclean." After narrowing down (A + C = landing `/` + SEO country/vertical templates), applied a system-wide cleanup:

**1. `Components/UI/SectionTitle/styled.tsx` — the highest-leverage change.**
- `Badge`: was a pill (blue text on light background, `9999px` radius, 14px). Now a subtle uppercase eyebrow — 12px, letter-spacing 1.6px, muted gray, no background.
- `HighlightText`: was a `linear-gradient(90deg, #0004FF, #6A4DFF)` with `WebkitBackgroundClip: text` + transparent fill (the "brochure gradient text" pattern in every section h2). Now a solid `theme.palette.primary.main` span with the same font weight.
- Heading sizes tuned down slightly (large: 60px → 48px, small: 36px → 32px, mobile: 45→36 / 36→28) so section titles feel calmer.
- This one file automatically cleaned up every downstream section title across `/`, `/fees`, `/documentation`, and BOTH SEO templates (`/accept-crypto-payments-in/[country]`, `/for/[vertical]`) without touching their JSX.

**2. `Components/Page/Home/HeroClean.tsx` (new) — replaces HeroV2 on `/`.**
Dropped from HeroV2 (which was 620 lines of complexity):
- Audience switcher pills (For merchants / For developers)
- Right-hand tabbed product preview (Checkout iframe / Dashboard mock / API code)
- Mesh-gradient / drifting radial background
- Blue→purple gradient text on the second h1 line
- Trust-badges row ("🔒 Non-custodial · ⚡ Under 2-minute payouts")
- Star-rating pill above the h1
Kept: country-personalized trust line via `useCountry`, 90s-demo video modal, primary → /auth/register CTA. HeroV2.tsx kept in repo for rollback.

**3. `Components/Page/Home/index.tsx` — dropped 2 more elements.**
- Removed `StickyPromoBar` (kept file in repo — sticky "$500 fee-free" bar at top of every page added constant visual pressure).
- Removed `LivePriceStrip` (full-width scrolling marquee of live crypto prices — marquees add motion noise).
- Swapped `HeroV2` → `HeroClean`.
Section count is unchanged (still 9 sections) but visual density dropped significantly because Hero, Section titles, and top-of-page overlays are all calmer.

**4. `Components/Page/SEO/SEOLandingPage.tsx` — SEO template cleanup (applies to all `/accept-crypto-payments-in/*` and `/for/*` pages).**
- Hero illustration: `size={128}` → `size={72}`. Was cartoonish/loud; now an accent.
- Removed the standalone "Intro paragraph" section (its content just restates the h1/subtitle).
- Removed the secondary "See fees" outline button in the hero (kept only the primary CTA).
- H1 typography: 32/52px, weight 700 → 30/44px, weight 600 with -0.02em tracking (still prominent, less shouty).
- Final CTA: was a `linear-gradient(135deg, blue→purple)` bordered panel; now a plain subtle contrast panel with the same border radius, so the CTA doesn't look like a marketing brochure.
- SEO stuff untouched (breadcrumbs, JSON-LD, canonical, OG, related-pages cross-links).

**Verification (Playwright, 5 scenarios):**
| Scenario | StickyPromoBar | LivePriceStrip | "See fees" btn | scrollWidth |
|---|---|---|---|---|
| Desktop `/` (1440) | 0 ✅ | 0 ✅ | — | 1440 |
| Desktop `/accept-crypto-payments-in/united-states` (1440) | 0 ✅ | 0 ✅ | 0 ✅ | 1440 |
| Desktop `/for/saas` (1440) | 0 ✅ | 0 ✅ | 0 ✅ | 1440 |
| Mobile `/` (390) | 0 ✅ | 0 ✅ | — | 390 |
| Mobile `/accept-crypto-payments-in/united-states` (390) | 0 ✅ | 0 ✅ | 0 ✅ | 390 |
Landing page height at 1440w: was ~8500px, now 6552px (-23%). SEO US page: was 4172px, now 3802px (-9%). Next.js compiled clean (2.7s, 2662 modules).

**Files touched (4):** `Components/UI/SectionTitle/styled.tsx`, `Components/Page/Home/HeroClean.tsx` (new), `Components/Page/Home/index.tsx`, `Components/Page/SEO/SEOLandingPage.tsx`. Removed components kept in repo for A/B rollback: `HeroV2.tsx`, `LivePriceStrip.tsx`, `StickyPromoBar.tsx`.

### 2026-07-05 — Mobile alignment fixes (iPhone SE / 14 / Pro Max)
User reported: "Mobile doesn't look properly aligned on iPhone". Diagnosed at 375/390/430px viewports:
- **StickyPromoBar** — the full copy "🎁 Your first $500 in payments is fee-free" wrapped to 3-4 lines at 375px, blowing the 36px bar height and pushing the Claim button + X into the wrap mess. Fix: added a `display: {xs:'inline', sm:'none'}` short variant "🎁 First $500 fee-free" for mobile, + `whiteSpace: nowrap` + `minWidth: 0` on the Typography. Bar now stays exactly 36px tall on all iPhones.
- **TryItNow iframe overflow** — grid `gridTemplateColumns: {xs:'1fr', md:'minmax(320px, 460px) 1fr'}` was fine intent but broken behavior: CSS Grid `1fr` defaults to `min-width: auto`, so the intrinsic size of children (long `<pre>` curl block on the right, checkout iframe on the left) forced the whole column to grow past the viewport (iframe was 515px wide inside a 375px viewport → 180px clipped past the right edge). Fix: changed to `minmax(0, 1fr)` for both mobile and the right desktop column, and added `sx={{ minWidth: 0 }}` on both grid item wrappers so the pre's overflow-x can actually scroll instead of forcing column growth. iframe now: 293px @ 375, 308px @ 390, 348px @ 430 — all fit inside their columns.
- Verification via Playwright at 3 iPhone viewports (375×667, 390×844, 430×932): `document.documentElement.scrollWidth === viewport width` on all three (no horizontal overflow anywhere on the page). Screenshots confirmed clean rendering of hero, product tabs, TryItNow playground, curl block, FeeCalculator, compliance/chains grids, testimonials, FAQ, final CTA.
- Files touched: `Components/Common/StickyPromoBar.tsx`, `Components/Page/Home/TryItNow.tsx`.

### 2026-07-05 — Landing page slim-down (4 sections + exit-intent modal removed)
User feedback: "How we stack up doesn't appear needed", "exit-intent popup keeps popping up repeatedly even when the user isn't leaving", "landing looks rough or too busy". Trimmed `Components/Page/Home/index.tsx`:
- **Removed** `ComparisonTable` (L) — the "How we stack up" DynoPay-vs-Coinbase/BitPay/Stripe table.
- **Removed** `ExitIntentModal` (N) — the desktop exit-intent overlay fired on any `mouseout` with `clientY <= 0`, i.e. also when the user reached for the URL bar / tab strip / bookmark bar / dev-tools. On real usage that reads as "keeps popping up repeatedly". Killed the whole component from the tree.
- **Removed** `LiveActivityStrip` — its own file header labels it "CURATED FAKE data" (approved in the original overhaul). Contributes to the "fake feel" of the page.
- **Removed** `IndustryLogoWall` (G) — fabricated per-industry merchant counts (E-commerce 180+, SaaS 95+, …). Same fake-feel issue.
- Kept everything else (StickyPromoBar, LivePriceStrip w/ REAL prices, HeroV2, ComplianceLogoStrip, SupportedChainsRail, FeeCalculator, TryItNow, CoreValueProps, TestimonialsV2, FAQ, FinalCTA).
- Section count: 12 → 10 sections + 2 → 1 overlays. Playwright screenshots confirm the removed sections' text ("How we stack up", "Trusted across", "Settled just now") is gone from the DOM; ExitIntentModal count = 0. Next.js recompiled clean in 631ms (2655 modules) — no errors. Component files kept in the repo for A/B rollback.

### 2026-07-05 — Re-setup on user-provided .env (preview origin f12696f9-…)
- Fresh container: `/app/node_modules`, `/app/backend/node_modules`, and all `.env` files were missing → frontend supervisor FATAL, backend Node process down.
- Wrote `/app/backend/.env` from the user-supplied values (single-quoted so `GOOGLE_CLIENT_KEY` PEM with literal `\n` stays verbatim). Overrode URLs to this preview origin `https://fast-start-8.preview.emergentagent.com` (`FRONTEND_URL` / `SERVER_URL` / `NEXTAUTH_URL` / `NEXT_PUBLIC_BASE_URL` / `CHECKOUT_URL` + added `NEXT_PUBLIC_SERVER_URL` and `NEXT_PUBLIC_API_DOCS_URL`). Appended preview origin to `CORS_ALLOWED_ORIGINS`. Replaced the placeholder `NEXTAUTH_SECRET="openssl rand -base64 32"` with a real generated base64 secret. Kept **WORKER_ROLE=secondary** (cron/sweeps/settlement OFF — verified "background jobs disabled — secondary instance"). Added the `EMERGENT_LLM_KEY` used by the SEO generator.
- Wrote `/app/.env.local` (Next.js public vars → preview origin) and `/app/frontend/.env` (`REACT_APP_BACKEND_URL` → preview origin, K8s ingress contract).
- `yarn install` in `/app` (Next.js 14.2.35) and `/app/backend` (Node/TS). Hit the recurring corrupted `axios-1.14.0` yarn cache (`ENOENT` while extracting) — cleared `npm-axios-*` from `/usr/local/share/.cache/yarn/v6/` and retried; both clean.
- Restarted backend + frontend via supervisor. Health verified:
  - Internal: `GET /api/` → 200, `/api/geo-detect` → 200, `/api/pay/network-fees` → 200, `/` → 200, `/auth/login` → 200.
  - Public preview: `GET /api/` → 200, `/auth/login` → 200; login page renders correctly (screenshot).
- Backend connected to Railway Postgres + Redis, 40 Tatum rates cached. Binance WS geo-blocked → CoinGecko rate-limited → Kraken REST fallback active (expected). This instance talks to the **live prod DB/Redis** — WORKER_ROLE=secondary keeps background work off, but UI actions still write to prod data.

### 2026-07-03 — Full fund audit (A) + gas-deferral hardening (B) + fee under-collection finding (C)
- **A — On-chain audit of ALL Hostbay (user 1) payments across all 45 temp addresses: ZERO stuck funds.** Verified each recent payment was forwarded to the merchant's own wallet (Tronscan + Ethereum RPC, Transfer logs decoded): $114.50→`0x9a72…`(114.488), $105.10→`0x9a72…`(105.036), $115.00→`TTve8v6`(112.92), $95.10→`TTve8v6`(93.014), $61.00→`TTve8v6`(58.938) — all payout txs SUCCESS. The "detected-not-completed" journal rows were: the spurious `ed41de1f` payout-webhook, an unpaid $105 invoice, an already-swept $10/$49.99 (on-chain USDT=0), and BTC re-detections (both BTC pool addrs = 0 BTC). Temp addresses hold only dust + DynoPay admin-fee balance. **Nothing to recover.**
- **B — Gas-deferral hardening** (`services/webhookProcessor.ts`): A retry loop already existed (reconciliation re-queues `gas_pending`/`failed` sessions ≤7d/5x; `setRedisItem` uses plain SET → clears TTL → session persists). Gap: the `DEFERRED:` (critically-low gas) throw was caught by the *generic* failure handler → session marked `failed` + a false `payment.settlement_failed` webhook sent to the merchant. Fix: detect `err.message.startsWith("DEFERRED:")`, mark session `gas_pending`, persist, and **suppress the false failure webhook** (payment auto-retries when gas is topped up). Backend boots clean, `/api/`→200.
- **C — Fee under-collection finding (NOT fixed — needs sign-off, touches money math).** In `controller/payment/cryptoSettlement.ts` settlement is correct by construction (`adminAmountToSend = received − userAmountToSend`, so merchant+admin=received; merchant is NEVER short-changed). But on some payments the pre-calculated `merchant_amount` (set at payment creation) ≈ the FULL received amount (a `fee_payer=customer` case where expected excluded the fee), so admin gets ~0 and the recorded `admin_fee_amount` (e.g. 2.72) is never actually collected → **DynoPay under-collects its fee** (merchant got more, never less). Root is on the payment-creation side (expected/merchant_amount). Recommended: verify how `amount`/`merchant_amount`/`fee_payer` are set at creation and align expected = base+fee for customer-pays. Deferred pending owner confirmation of intended fee behavior (risk of merchant shortfall if changed blindly).
### 2026-07-03 — Incident forensics + fix: spurious "payment pending" email from our OWN outgoing payout
- **Reported**: a "payment pending" email showed raw i18n keys AND a merchant claimed a USDT payment "wasn't forwarded" (tx `ed41de1f…`, 58.93755 USDT-TRC20, ~$58.94).
- **Forensics (read-only: DO logs + prod Postgres + Redis + on-chain Tronscan)** — corrected an initial wrong assumption (I first queried the UNUSED `tbl_usdt_pool_*` tables; the live merchant-pool tables are `tbl_merchant_*`):
  - `tbl_merchant_pool_transaction` pool_tx **262**: incoming `ff91ca96…` = customer paid **61 USDT** → pool addr `TMsSrj1Z…` (temp_address_id 23); merchant payout `ed41de1f…` = **58.93755 USDT** → merchant wallet `TTve8v6…`; admin fee 1.93166667; **status = completed** (Jul‑02 12:52).
  - On-chain (Tronscan, both **SUCCESS**): `ff91ca96` TU4vEr…→TMsSrj1Z 61 USDT; `ed41de1f` TMsSrj1Z→TTve8v6 58.93755 USDT.
  - `TTve8v6…` = `tbl_user_wallet` wallet_id 4, user 1 (company "hostbay"), type USDT-TRC20 → the merchant's own wallet. **Funds WERE delivered; nothing to recover (a "recovery" would have double-paid).**
  - The Jul‑03 email: a `reconciled-tx` (`source: tatum-failed-webhook`) re-queued txId `ed41de1f` (our OWN outgoing payout). The webhook (address=merchant wallet, counterAddress=our pool addr) was misread as a NEW incoming payment → spurious "pending" notif (`pending-notif` sentAt `12:33:55Z`, ~17s BEFORE the email-fix deploy went live `12:34:12Z` → hence raw keys). Also mislabeled chain as ERC20 (it's TRC20).
- **Fix** (`services/webhookProcessor.ts`): added `isOwnOutgoingTransaction()` guard (runs right after the INTERNAL_WALLETS check). Skips a webhook when **(A)** `counterAddress` (sender) is one of our `tbl_merchant_temp_address.wallet_address` pool addresses, or **(B)** `txId` matches a recorded `merchant_tx_id`/`gas_funding_tx_id` in `tbl_merchant_pool_transaction`. Fail-open on error (never drops a real payment). Uses dynamic `import("../models")` to avoid circular deps.
- **Verified** against real prod data: spurious payout → both signals TRUE (skipped); real customer payment (customer sender + fresh incoming txId) → both FALSE (processed normally). Backend boots clean, `/api/`→200.
- **Also hardened (graceful drain)**: `server.ts` now captures the HTTP server instance and `gracefulShutdown` closes it FIRST (bounded 5s) — stops accepting new requests / fails health check before tearing down — then the existing `shutdownWebhookQueue()` (`worker.close()`, graceful) drains in-flight BullMQ webhook jobs, then DB closes. Verified in logs: `Received SIGTERM → HTTP server closed → Webhook queue shut down → Graceful shutdown complete`. Reduces deploy-restart-induced failed/dropped webhooks.
- **Separate $105 session (`e841a02f`, `crypto-TMsSrj1Z`, status "retrying") investigated**: NO on-chain incoming for it — an unpaid/expired invoice; its Jul-03 journal rows were just the spurious `ed41de1f` webhook. Full on-chain reconciliation of pool addr `TMsSrj1Z` (30 transfers): every incoming USDT has a matching settlement → **0 unsettled/stuck transfers**. Pool addr now AVAILABLE, settling new payments (pool_tx 266, 95.10 USDT, Jul-03 16:07).


### 2026-07-03 — Bug fix: localized emails/PDFs rendered raw i18n keys in production
- **Symptom** (reported on a real prod payment-pending email): subject/body showed literal keys — `paymentPending.subject`, `paymentPending.heading`, `common.greeting`, `labels.amount`, `statusLabels.awaitingConfirmation`, `paymentPending.btcTime`, etc. — while interpolated values (amount, tx hash) came through fine.
- **Root cause**: `utils/emailI18n.ts` `loadCatalog()` read the catalog from `path.join(__dirname, "..", "locales", lang, "emails.json")`. That works under ts-node (source: `backend/utils` → `backend/locales`), but in the production Docker image the backend runs compiled (`node dist/server.js`, `__dirname=backend/dist/utils`) and (a) `tsc` never emits the `.json` catalogs into `dist/`, and (b) the Dockerfile copied `dist/`, `node_modules`, `public`, `swagger` into the runner but **never copied `locales/`**. So every catalog load threw → cached `{}` → `t()` fell through to its "return the key" last resort. (Not reproducible in preview, which runs ts-node from source.)
- **Fix (2 parts)**:
  1. `utils/emailI18n.ts` — `loadCatalog()` now tries multiple candidate dirs (`../locales`, `../../locales`, `cwd/locales`, `cwd/backend/locales`) and only caches a non-empty catalog. Works from both source and compiled builds.
  2. `Dockerfile` (runner stage) — added `COPY --from=backend-builder /app/locales ./backend/locales` (alongside the existing swagger/public copies) so the JSON catalogs exist at `/app/backend/locales` in prod; the `../../locales` candidate resolves there.
- **Verified**: real `t()` (via backend ts-node) renders correct English + German with interpolation (`Hey Alex,`, `BTC: 10-60 min (3 confirmations)`, `Ihre Zahlung wartet auf Bestätigung`); simulated compiled `__dirname=/app/backend/dist/utils` and confirmed it resolves to the real catalog; backend boots clean, `/api/`→200 (no regression). Also fixes localized PDF receipts (same `t()`).
- **Deploy note**: preview already worked (source runtime), so this only changes production behavior. It takes effect on the next prod deploy (Save to GitHub → DO rebuilds the Docker image incl. the new locales copy).


### 2026-07-03 — Re-setup on fresh container from DigitalOcean prod env (WORKER_ROLE=secondary)
- Fresh container: `/app/node_modules`, `/app/backend/node_modules`, and all `.env` files were missing → frontend FATAL (`next: not found`), Node backend down.
- User provided a DigitalOcean API token. Pulled the prod app **`dynopay`** (app id `f86b27dc-feb0-4a44-a4e9-ebd2053e0468`, live `https://dynopay.com`) spec via `GET /v2/apps/{id}`. All 150 env vars were stored as GENERAL (plaintext) — retrieved every value incl. DB/Redis/Tatum/Brevo/Telnyx/Google KMS PEM.
- Wrote `/app/backend/.env` from prod values with overrides: URLs (SERVER_URL/FRONTEND_URL/CHECKOUT_URL/NEXTAUTH_URL/NEXT_PUBLIC_BASE_URL + added NEXT_PUBLIC_SERVER_URL/NEXT_PUBLIC_API_DOCS_URL) → preview origin `https://fast-start-8.preview.emergentagent.com`; preview origin appended to CORS_ALLOWED_ORIGINS; **WORKER_ROLE=secondary** (cron/sweeps/settlement OFF — verified in logs "background jobs disabled — secondary instance"). Values single-quoted so the GOOGLE_CLIENT_KEY PEM (literal `\n`) stays verbatim. Prod NEXTAUTH_SECRET was the literal placeholder "openssl rand -base64 32" → replaced with a real generated base64 secret (in both backend .env and .env.local).
- Wrote `/app/.env.local` (Next.js public vars → preview origin) and `/app/frontend/.env` (`REACT_APP_BACKEND_URL` → preview origin, ingress contract).
- `yarn install` in `/app` (Next.js 14.2.35) and `/app/backend` (Node/TS) — both clean. Restarted backend + frontend via supervisor.
- Health verified: internal `GET /api/`→200, `/api/pay/network-fees`→200, `/api/geo-detect`→200; frontend `/`→200; login page renders via public preview origin (screenshot). Backend connected to Railway Postgres (models synced) + Redis, Tatum rates cached. Binance WS geo-blocked → CoinGecko fallback (expected). NOTE: this instance talks to the **live prod DB/Redis** — WORKER_ROLE=secondary keeps it read/serve-only for background work, but UI actions still write to prod data.


## 2026-07-05 — Programmatic SEO landing pages (Claude Sonnet 4.5)

### What was built
- **Offline content generator** at `/app/scripts/generate-seo-pages.py` — Python script using `emergentintegrations` + Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via the Emergent Universal Key. Reads a curated list of 8 countries + 6 verticals, prompts Claude for strict JSON (meta title/description, H1, subheading, intro paragraph, 3 features, 3-step how-it-works, 5 FAQs, CTA copy), validates schema, and writes to `/app/data/seo-pages/{countries,verticals}/{slug}.json`. Idempotent — skips files under `--max-age-days` unless `--force` or `--only country:xxx` is passed.
- **14 pre-generated JSON files** committed to the repo. Content is fact-grounded via a hardcoded `DYNOPAY_FACTS` block in the script (chains, fee %, onboarding flow, custody model) so Claude cannot hallucinate features/fees.
- **Next.js dynamic pages** (pages router, SSG via `getStaticProps` + `getStaticPaths`, `fallback: false`):
  - `/accept-crypto-payments-in/[country]` — 8 country pages (US, UK, Nigeria, India, Brazil, Vietnam, Germany, Turkey).
  - `/for/[vertical]` — 6 vertical pages (e-commerce, SaaS, freelancers, gaming, remittance, digital-downloads).
- **Shared page component** `/app/Components/Page/SEO/SEOLandingPage.tsx` — reuses the site's design system (MUI, `HomeCard`, `HomeSectionTitle`, theme-aware colors, `useThemeMode`). Sections: breadcrumbs → hero (flag + H1 + subheading + dual CTA) → intro → 3-feature grid → 3-step how-it-works → FAQ accordion → final CTA card.
- **SEO essentials** on every page:
  - Unique `<title>` and `<meta name="description">` (Head tags after _app's default → override).
  - Canonical URL, OpenGraph, Twitter Card meta.
  - 3 JSON-LD scripts: `WebPage`, `FAQPage` (from the 5 Q&A), `BreadcrumbList`.
  - Proper heading hierarchy: 1×H1, 4×H2, 8×H3.
  - Real `<a href>` CTAs (Next.js `<Link>` + MUI `Button component="a"`) so Google can crawl them — critically, NOT the shared `HomeButton` which uses JS `router.push` and produces no `href`.
  - Attribution query params on every signup link: `/auth/register?src=seo&page={slug}&kind={country|vertical}` — ready for downstream funnel measurement.
- **Sitemap update** — `/app/pages/sitemap.xml.tsx` now dynamically appends all 14 SEO pages via `getAllSEOPagesIndex()` from `/app/utils/seoContent.ts`. Total: 21 URLs (7 public + 14 SEO).
- **robots.txt** — added `Allow: /accept-crypto-payments-in/` and `Allow: /for/`.
- **Layout routing fix** — `/app/pages/_app.tsx` `resolvedLayout` was defaulting the new SEO paths to `ClientLayout` (the authenticated dashboard shell) which produced an empty SSR body. Added prefix matching so `/accept-crypto-payments-in/*` and `/for/*` resolve to `"home"` (public HomeLayout with header/footer).

### Environment
- `EMERGENT_LLM_KEY=sk-emergent-9F621Db8357Ce055fE` added to `/app/backend/.env` (used only by the offline generator, not by the running Next.js app).

### Regeneration
```bash
# Refresh all pages older than 30 days
python3 /app/scripts/generate-seo-pages.py

# Force regenerate everything
python3 /app/scripts/generate-seo-pages.py --force

# Regenerate a single page
python3 /app/scripts/generate-seo-pages.py --only country:brazil
python3 /app/scripts/generate-seo-pages.py --only vertical:saas
```

### Follow-ups (not implemented, ranked by impact)
1. Expand to 30–50 countries + 12–15 verticals (each JSON file is a couple KB and takes ~2s to generate).
2. Add internal cross-linking: country page → 3 relevant vertical pages (and vice versa) → improves crawl depth + PageRank distribution.
3. Add hreflang alternates once translated versions exist.
4. `Product` / `Service` JSON-LD with pricing offer, once we're comfortable committing to structured pricing in schema.
5. Wire the `src=seo&page=...` UTM params into the register funnel analytics.


### 2026-06-30 — Email Internationalization, Phase 2 (full email-copy localization) ✅ VERIFIED
Phase 2a (customer payment emails + PDF) and Phase 2b (all merchant lifecycle emails) — all email copy now localizes into the 6 supported languages (en/pt/es/fr/de/nl) with EN fallback.
- **Phase 2a (verified)**: 8 customer payment email functions in `emailService.ts` + `pdfReceiptService.ts` refactored to `t(key,lang,vars)`; `lang` threaded through `cryptoSettlement.ts`, `pendingPaymentService.ts`, `merchantPoolSweep.ts`. Verified via `scripts/_tmp_verify_emails.ts` (all keys render, PDFs generate en/de/fr).
- **Phase 2b (verified)**: refactored ALL merchant lifecycle emails (~38 functions) to `t()`: auth (welcome, email-verify OTP, login OTP, forgot-password OTP, password changed, profile updated + email-changed, security alert, new-device login, login notification, failed logins), company (created, contact-welcome, updated), wallet (OTP, verified, update-OTP, deleted, add-reminder, added, updated, withdrawal OTP, withdrawal success, exchange OTP, edit OTP, delete OTP), KYC (required, approved, rejected, started, resubmission), weekly summary, invoice, API key, large transaction, payment-link created, subscriptions (created/cancelled/payment-failed — both customer & merchant copy), auto-conversion payout, weekly conversion report.
- **Lang resolution**: added `resolveLangByEmail(email)` (cached 5-min raw SQL on `tbl_user.language`) + `resolveEmailLang(lang, email)` to `emailI18n.ts`. Merchant functions take optional `lang?` and auto-resolve the recipient's stored language by email — **zero call-site churn** (call sites untouched, fully backward compatible). Customer subscription emails resolve customer vs merchant language independently.
- **Catalog**: `locales/*/emails.json` `merchant` block — 313 keys each, identical key set across all 6 languages (parity-checked). Full human-quality translations written for pt/es/fr/de/nl.
- **Intentionally left English** (out of "merchant lifecycle" scope): admin-internal notifications (platform fee, new-user/onboarding/first-payment/new-visitor admin alerts) and customer/prospect marketing reminders (payment-expiring, payment-link reminder, referee-code reminder) — recipient language unknown.
- **Verified**: `tsc --noEmit` clean on `emailService.ts`/`emailI18n.ts`; 313 keys × 6 langs render with no missing keys / no un-interpolated `{{vars}}`; PDFs generate; live-DB `resolveLangByEmail` returns correct language + explicit override + null fallback; backend health 200. NOT sent via real Brevo (avoided spamming live accounts) — validated via catalog render + DB resolution instead.


### 2026-06-30 — Communication language control, wallet email gate, API docs cleanup ✅ VERIFIED
- **#1 Communication language (Profile)** — user chose "one language, surfaced clearly" (UI + emails always match). Added a labeled "Communication language" `Select` in `AccountSetting.tsx` (6 langs) that calls `i18n.changeLanguage` + `PUT /api/user/profile {language}` + persists to localStorage, with helper text. Keys `communicationLanguage/Help/Saved` added to all 6 `profile.json`. Verified: UI renders + backend round-trip (en→de→en).
- **#2 Wallet add requires verified email** — user chose "gate on VERIFIED email; require our own OTP even for Google". Backend gate added to `walletController.validateWallet` + `addWalletAddress`: fetches user, returns `403 {code:"EMAIL_VERIFICATION_REQUIRED"}` if no email OR not verified (also fixed a latent null-email `.replace` crash). Note: existing `emailVerifiedMiddleware` only blocks when `email && !email_verified`, so the no-email/phone case is caught by the new gate. Frontend `AddWalletModal` gates on modal open by **fetching the fresh profile** (`GET user/profile`) — not stale Redux — and shows an inline add-email + OTP step (reuses `addEmail`/`verifyAddEmail`) before the wallet form. Wallet-gate i18n keys added to all 6 `walletScreen.json`. Verified: backend both 403 paths (curl), gate UI renders, verified users get the normal form.
- **#3 API docs (`pages/documentation.tsx`)** — removed "admin" framing: "Admin API" section → "Merchant Wallet Management" (id `wallet-management`), endpoint titles dropped "(Admin)", descriptions clarify the `/admin` path prefix is legacy but merchant-callable via API key, headers say "Your DynoPay API key". Clarity pass: added Base URL callout, "When to use each section", and a 4-step "A typical payment, end to end". Standardized all prose `Dynopay`→`DynoPay` (lowercase `dynopay.com` URLs untouched). Verified via screenshot.

### 2026-06-30 — Email Internationalization, Phase 1 (foundation) ✅ VERIFIED
User approved persisting language (not just capturing in-the-moment) + automated translation. Phase 1 = foundation only; no email copy is translated yet (all emails still send in English via EN fallback).
- **DB (LIVE Railway prod)**: added nullable `language VARCHAR(5) DEFAULT 'en'` to `tbl_user` (merchant) and `tbl_customer_transaction` (customer). Additive/idempotent via `backend/scripts/addLanguageColumns.ts` (standalone `pg` client, no Sequelize/server side-effects). Both Sequelize models updated to match.
- **i18n layer** (`backend/utils/emailI18n.ts`): `SUPPORTED_EMAIL_LANGUAGES=[en,pt,es,fr,de,nl]`, `normalizeLang` (coerces `de-DE`/`PT`/null→supported, default en), `t(key,lang,vars)` with `{{var}}` interpolation + EN fallback + key-as-last-resort, `resolveMerchantLanguage` (user.language→en), `resolveCustomerLanguage` (transactionLang→checkoutLang→merchantLang→en), `getRequestLanguage` (body→Accept-Language). Catalog scaffold `backend/locales/{en,pt,es,fr,de,nl}/emails.json` seeded with a `common` block (greeting/regards/team/securedBy/questions) translated into all 6 — Phase 2 fills per-template keys.
- **Merchant capture**: `language` added to user creation in `registerEmailVerifyOtp`, `registerPhoneStep2`, `googleSignIn`, `registerUser`; `updateProfile` accepts `language` (updated silently — no notification email). `getProfile` already returns it.
- **Customer capture**: checkout `getData` persists `req.body.language` onto the `customer-{ref}` Redis session; both settlement create paths (`cryptoCheckout.confirmPayment` ×2, `cryptoSettlement` webhook path) write `language` onto `tbl_customer_transaction`.
- **Frontend wiring**: `register.tsx` sends `language: i18n.language` on email/phone verify; `pay/index.tsx` sends `language` in `getData`; `LanguageSwitcher.changeLang` persists the choice to `PUT /api/user/profile` when a merchant token exists (lazy axios import; no-op on public/checkout pages).
- **Verified e2e**: migration confirmed (`information_schema`); `t()`/resolvers/interpolation/fallback unit-checked; merchant round-trip `PUT /user/profile {language:'de'}`→GET shows `de`→reset to `en` (cache invalidation OK); customer `getData {language:'de'}`→Redis session `language=de`; backend boots clean (health 200); register page compiles & renders.
- **Language switcher false-alarm**: user reported "DE for Dutch". Investigated all switchers — CORRECT: `DE=Deutsch=German` (German flag), `NL=Nederlands=Dutch` (Dutch flag). "Deutsch" is a false friend for "Dutch". Verified config, flag pixels, translation files, and the live rendered dropdown. No change needed.

### 2026-06-30 — Copy overhaul to a friendly, plain-language voice (tone "c")
User asked to improve copy across "everything" with a friendly/approachable voice, keep the (real) stat claims, and move hardcoded auth brand-panel copy into i18n.
- **Auth (login/register)**: rewrote `en/auth.json` login/register descriptions; `register.tsx` now uses `t("register")`/`t("registerDescription")` (was hardcoded "Registration"/"Create your DynoPay account in seconds"). `AuthBrandPanel.tsx` converted to i18n (new keys `brandHeadlineLine1/2`, `brandSubtitle`, `brandStat*Label`) so it localizes; also removed a pre-existing duplicate `display` CSS key.
- **Landing**: full rewrite of `en/landing.json` to the friendly voice (kept titles + their `*Highlight` substrings intact so heading highlights don't break). `TrustBadges.tsx`: fixed a real desktop bug ("Built for Security **& and** Peace of Mind") + sentence-cased header + tuned descriptions ("15+ cryptocurrencies"→"15+ coins", etc.).
- **Brand leftovers**: `homeTagline` in en/es/pt/fr `common.json` said "...BozzWallet" → now "DynoPay" (note: these keys appear unused/dead). FLAGGED, NOT changed: `Components/Page/Common/TelegramLogin/index.tsx` uses `data-telegram-login="BozzWalletBot"` — a functional Telegram bot username; needs the real DynoPay bot @username from the user. Backend swagger examples still say "Bozzmail" (dev-facing only, left as-is).
- **Emails**: brand consistency pass — `services/emailService.ts` (49×) and `utils/emailTemplate.ts` (copy only) "Dynopay" → "DynoPay". Left intact: identifier `getDynopayLogoUrl`, Telegram handle `t.me/Dynopay_Announcements`, and lowercase `dynopay.com`/`dynopay.io` URLs. Also friendlier subjects for 4 title-cased emails (account/company profile updated, payment pending, partial payment).
- **Translations (auth)**: translated the new/changed auth strings (descriptions + brand panel) into pt/fr/es/de/nl. Also updated pt/fr/es landing `heroBadge`+`heroSubtitle` (which were showing stale old copy) to the new voice. de/nl landing fall back to English.
- **Verified**: login/register/landing render the new copy (screenshots); all 6×21 locale JSON files validate; backend restarted clean (health 200) after email edits; touched components lint clean.
- **REMAINING (large, optional)**: full translation of the rest of the landing body + email bodies into pt/fr/es/de/nl. Non-en landing files were ALREADY partial (de/nl=51, pt/fr/es=78 vs en=104 lines) and rely on English fallback, so the app is fully functional in the meantime.

### 2026-06-30 — Auth placeholder + console-warning fixes
- **Placeholder bug (login SMS step)**: `pages/auth/login.tsx` rendered `t("codeWillBeSentTo")` whose translation literally contained `"+xxxxxxx"` (present in ALL 6 locales: en/de/nl/es/pt/fr), followed by an odd `mobile.substring(7)` mask → users saw "Code will be sent to: +xxxxxxx41000". Removed `+xxxxxxx` from all 6 `auth.json` files and changed the JSX to a clean last-4 mask: `••••${mobile.slice(-4)}`.
- **React DOM-property console warnings**: SVG icon components used HTML-attribute casing in JSX. Fixed `assets/Icons/coins/ETH.tsx` (`fill-opacity`→`fillOpacity` ×4) and `assets/Icons/ChatIcon.tsx` (`stop-color`→`stopColor` ×2, `color-interpolation-filters`→`colorInterpolationFilters` ×2, `flood-opacity`→`floodOpacity` ×2). `assets/Icons` now lints clean; runtime console shows NO "Invalid DOM property" warnings.

### 2026-06-30 — Re-setup on provided .env (new preview origin: 01ded10d-…)
- Fresh container: `/app/node_modules`, `/app/backend/node_modules`, and all `.env` files were missing → frontend FATAL, backend :8001 returned 500 (Node :3300 down).
- Wrote `/app/backend/.env` from the user-provided values. Overrode URLs to this preview origin `https://fast-start-8.preview.emergentagent.com` (FRONTEND_URL / SERVER_URL / NEXTAUTH_URL / NEXT_PUBLIC_BASE_URL / CHECKOUT_URL), appended the origin to `CORS_ALLOWED_ORIGINS`, generated a real `NEXTAUTH_SECRET` (user pasted a placeholder), and kept `WORKER_ROLE=secondary` so cron/sweeps/settlement stay OFF (gate: `isCronEnabled = enableBackgroundJobs && workerRole !== 'secondary'`). GOOGLE_CLIENT_KEY preserved with `\\n` escaping verbatim.
- Wrote `/app/.env.local` (Next.js public vars → preview origin) and `/app/frontend/.env` (`REACT_APP_BACKEND_URL` → preview origin, ingress contract).
- `yarn install` in `/app` (Next.js 14.2.35, 108s) and `/app/backend` (Node/TS, 70s) — both clean. Restarted backend + frontend via supervisor.
- Health verified (internal + via preview origin): `GET /api/` → 200, `/api/pay/network-fees` → 200, `/api/geo-detect` → 200, `/api/status` → 200; frontend `/`, `/auth/login`, `/auth/register`, `/fees` → 200. Login page renders correctly (screenshot). Console clean (only base-URL log + HMR). Backend connected to Railway Postgres + Redis, 40 Tatum rates cached. Binance WS geo-blocked → CoinGecko fallback active (expected, unchanged).

### 2026-06-30 — UX Audit Fix Batch (production readiness, 6 items)
Audit was performed across desktop/tablet/mobile + light/dark on both empty-state (qa.empty) and data-rich (hostbay@moxx.co) accounts. JWTs minted via `/app/scripts/mint_ux_tokens.js` to bypass OTP. Fixes applied:
1. **Empty-state grammar + teaching copy** (`langs/locales/en/common.json`): "There is no transactions" → "No transactions yet" + a description that EXPLAINS what creates a transaction. Same for wallets, API keys, payment links. Now each empty state teaches the next action.
2. **/create-pay-link inline modals** (`pages/create-pay-link.tsx`): replaced the navigation-away gate with inline `CreateCompanyModal` + `AddWalletModal`. User never leaves the page. Step cards now show progress (check ring for done steps) and helper copy ("Used on invoices and receipts. Takes ~30 seconds.").
3. **Mobile wallet address truncation** (`Components/Page/Wallet/index.tsx`): mobile wallet card now middle-truncates addresses (`{first8}…{last6}`) with full address in the title tooltip. Copy button still copies the full address.
4. **Pay link expiry default & helper** (`Components/UI/pay-link/PaymentSettingsBasic.tsx`): default `expirationDate` is now +7 days (not "now"). When expire is "no", a helper text reminds: "For security, we recommend setting an expiry date so the link can't be used indefinitely."
5. **Header banner red → blue** (`Components/Layout/NewHeader/index.tsx`): the "Company setup" and wallet-warning banners now use `primary.main` (blue) instead of `error.main` (red, anxiety-inducing). The KYC-required banner correctly stays red (real compliance warning). Fix required overriding both the icon color (via `sx`) and the `RequiredKYCText` color (also via `sx`), because the styled component hardcoded error.main.
6. **"What is a payout wallet?" help link** (`Components/UI/EmptyDataModel/index.tsx`): added a help link below the "Add wallet" CTA pointing to dynopay.com help, opens in a new tab. Reduces drop-off for non-crypto-native merchants.

Verified by testing agent (Python Playwright + JWT injection): 6/6 PASS. Banner computed color confirmed `rgb(0, 4, 255)` (blue), not red. Dashboard / transactions / pay-links / wallet regressions all clean.

### 2026-06-30 — Quick re-setup on provided .env (Railway Postgres + Redis)
- Wrote `/app/backend/.env` from the user-provided values (FRONTEND_URL / SERVER_URL / NEXTAUTH_URL / NEXT_PUBLIC_BASE_URL all repointed to this preview origin, this origin appended to `CORS_ALLOWED_ORIGINS`, `WORKER_ROLE=secondary` so cron/sweeps stay off here).
- Wrote `/app/.env.local` (Next.js): `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SERVER_URL`, `NEXTAUTH_URL` → preview origin.
- Wrote `/app/frontend/.env` (`REACT_APP_BACKEND_URL` → preview origin, for the Kubernetes ingress contract).
- Re-ran `yarn install` in `/app` (Next.js) and `/app/backend` (Node/TS). Backend deps needed a `yarn cache clean axios` once due to a corrupted cached tarball, then installed clean.
- Restarted backend + frontend via supervisor. Backend (uvicorn proxy on :8001 → Node ts-node on :3300) connected to Railway Postgres + Redis; Tatum rate cache populated (40 rates). Frontend Next.js 14.2.35 ready on :3000. Binance WS geo-blocked → CoinGecko fallback active (expected).
- Health (internal + preview): `GET /api/` → 200, `GET /api/pay/network-fees` → 200, `GET /api/geo-detect` → 200, `GET /` → 200, `GET /auth/login` → 200.

### 2026-06-30 — Design uniformity sweep (4 areas)
- **Company modal unified**: `pages/company.tsx` now reuses `Components/UI/OnboardingFlow/CreateCompanyModal` for the "Add Company" flow (via new optional props `showStepIndicator/title/subtitle`). Deleted the inline 700px 2-column `PopupModal` form. Add-from-/company now matches onboarding visually 1:1.
- **Checkout token sweep** (`pages/pay/index.tsx`, `Components/Page/Pay3Components/cryptoTransfer.tsx` + `header.tsx` + `pages/pay/demo.tsx`): replaced ~80 hardcoded hex colors with `theme.palette.{primary,border,text,background,action}.*` tokens. Also added `palette.border.{main,focus,success,error}` to `styles/theme.ts` lightTheme/darkTheme (which only had `palette.surface.border` before, breaking convention with the rest of the app). Dark-mode primary brand color in checkout is now indigo `#6C7BFF` (was white, which made buttons identical to background).
- **Dark-mode text sweep** (14 files updated automatically via AST-like regex): EmailVerificationBanner, pay-link ExpireSelector/SaveChangeModel/CryptoItemCard, CompanySettingsDialog/CompanyDetailsSection, Toast, DeleteWalletModal, AreaChart, ThemeToggle, HelpAndSupport (Slugs + index), Profile (UpdatePassword + AccountSetting), pages reset-password, pages help-support/[slug], pages auth/login. ~63 hardcoded `#242428`/`#676768`/`#88898D`/`#676B7E`/`#FFFFFF`/`#E9ECF2` replaced with `theme.palette.text.primary` / `text.secondary` / `text.disabled` / `background.paper` / `border.main`. `useTheme()` hook + import added to files that didn't already have it.
- **Landing page crypto polish**:
  - NEW `Components/Page/Home/LivePriceStrip.tsx` — auto-scrolling marquee with real BTC/ETH/USDT/etc. prices + 24h % change. Pulls from `GET /api/public/tickers` every 30s, hides itself if endpoint returns empty.
  - NEW `Components/Page/Home/SupportedChainsRail.tsx` — chain logo rail "Settle on the chains your customers already use" displaying 13 chain icons (BTC, ETH, USDT, USDC, SOL, BNB, XRP, POL, RLUSD, TRX, LTC, DOGE, BCH) using existing `/assets/Icons/coins/*` files.
  - `Components/Page/Home/Hero.tsx`: emoji icons (`₿ ⚡ $`) replaced with real coin SVGs (`<BTC/>`, MUI `<Bolt/>`, `<USDT/>`).
  - NEW backend route `GET /api/public/tickers` in `backend/routes/index.ts` — returns `[{symbol, price, change24h, updatedAt}]` from the in-memory price cache; no auth.

### 2026-06-30 — OTP UX Unification (4 OTP screens)
- created `Components/UI/OtpInputPanel` (shared headless OTP block: 6 boxes + countdown + resend + auto-submit).
- `OtpDialog`, `pages/auth/register`, `Components/UI/ForgotPasswordDialog`, `Components/UI/DeleteWalletModal` all now use it. Resend countdown added to DeleteWalletModal (was missing).
- All 4 `OtpDialog` instances in `pages/auth/login.tsx` standardized to `primaryButtonLabel="Verify & log in"`.
- `langs/locales/en/auth.json`: `verifyAndLogin` → "Verify & log in" + new `didntReceiveCode`.

### 2026-06-30 — Re-setup on provided .env (Railway Postgres + Redis)
- Recreated `/app/backend/.env` from user-provided values; appended this preview origin to `CORS_ALLOWED_ORIGINS`. `WORKER_ROLE=secondary` (cron/sweeps disabled here — primary Railway instance handles them).
- Recreated `/app/.env.local` for Next.js → points `NEXT_PUBLIC_BASE_URL` / `NEXT_PUBLIC_SERVER_URL` / `NEXTAUTH_URL` to this preview origin.
- Ran `yarn install` in `/app` (Next.js) and `/app/backend` (Node/TS) — both clean.
- Restarted via supervisor. Backend (uvicorn → Node ts-node proxy on :3300 ← :8001) connected to Railway Postgres + Redis; Tatum rate cache populated. Frontend Next.js 14.2.35 ready on :3000.
- Health: `GET /api/` → 200 (internal + preview), `GET /api/pay/network-fees` → 200, `GET /api/geo-detect` → 200, `/auth/login` → 200. Note: Binance WS geo-blocked from this region — CoinGecko fallback active (expected, unchanged from prior runs).

### 2026-06-29 — Setup on provided .env + Idempotent Onboarding (existing account → OTP login)
- **Env setup**: Created `/app/backend/.env` (user-provided values; preview origin appended to CORS) and `/app/.env.local` (frontend → this instance's backend). Installed missing deps for `/app` (Next.js) and `/app/backend` (Node/TS). Backend connects to live Railway PostgreSQL + Redis; WORKER_ROLE=secondary so cron/sweeps are disabled on this instance.
- **Onboarding bug fix**: `/auth/register` previously dead-ended (HTTP 400 "account already exists") when an existing email/phone was entered. Now idempotent — backend (`controller/userController.ts`: registerEmailStep1/verify-otp, registerPhoneStep1/verify) sends an OTP and, on verify, logs the existing user in via `getAccessToken` (returns `accessToken` + `account_exists:true`). Frontend (`pages/auth/register.tsx`) shows "Welcome Back" + banner, "Verify & Log In" button, and login-appropriate success. New-account signup unchanged.
- **Verified**: deep_testing_backend_v2 — 5/5 PASS (existing→200/account_exists=true→login w/ accessToken; new→200/account_exists=false→create; health 200). Frontend pending user approval to test.


### 2026-06-28 — Company Page Redesign & Settings Fix
- **Company Page**: Replaced old DataTable with modern card-based layout (matching wallet page pattern). Cards show company logo/initials, email, phone, website, location, and "Manage" button that opens `CompanySettingsDialog`. Empty state with business icon and "Add Company" CTA. Loading spinner with proper fallback via saga error handling fix.
- **Settings Page**: Redesigned from accordion to 8-card grid (3 columns desktop, 2 tablet, 1 mobile). Each card has colored icon, title, description, and navigates correctly: Company Profile→/company, Wallet Addresses→/wallet, Payment Settings→/company?section=payment, Webhook Configuration→/company?section=webhook, API Keys→/developer-keys, Profile & Security→/profile, Notifications→/notifications, My Account→/referrals.
- **Saga Error Fix**: Fixed all 4 catch blocks in `CompanySaga.ts` — changed `e.response.data.message` to `e?.response?.data?.message` to prevent crashes on network errors (CORS, timeouts).
- **Verified**: Testing agent Iteration 15 — all features verified, 100% frontend pass rate.

### 2026-06-28 — Dark Mode & UI/UX QA Fixes
- Dashboard crash from `user_image.png` relative path (4 files fixed)
- Empty state text invisible in dark mode — `EmptyDataModel`, `NoData`, `PaymentLink`, `Wallet` dialog all fixed to use theme-aware colors
- **Verified**: Testing agent Iteration 14

### 2026-07-05 — IndexNow Deploy Ping Automation
- New `scripts/indexnow-ping.mjs` (zero-dep Node): reads local `/sitemap.xml` (retry loop) → submits all URLs to api.indexnow.org (Bing/Yandex/Seznam/Naver); key from `public/indexnow-key.txt`; flags `--dry-run`/`--delay`/`--urls`; opt-out `INDEXNOW_DISABLED=true`
- `start-all.sh` fires it on every production boot (90s delay, fire-and-forget); `Dockerfile` runner ships the script
- **Verified**: dry-run captured all 21 sitemap URLs (7 static + 14 SEO); real homepage submission accepted HTTP 202 with the live prod key

### 2026-07-05 — SEO Pages: OG Share Images + Social Meta
- Generated 14 branded 1200×630 OpenGraph images (PIL + repo Urbanist/Outfit fonts) → `public/og/{kind}-{slug}.png`; reproducible via `scripts/generate-og-images.py`
- `SEOLandingPage.tsx`: added `og:image` (+width/height/alt) and `twitter:image` (+alt) with absolute dynopay.com URLs; FAQ/WebPage/Breadcrumb JSON-LD already existed
- **Verified**: self-test — all 14 pages SSR-render og:image + twitter:image + FAQPage schema; images served 200 image/png; ships with existing `COPY public/` in Dockerfiles

### 2026-07-05 — Production SEO Landing Pages 404 Fix
- Bug: all `/accept-crypto-payments-in/*` (8) and `/for/*` (6) pages 404'd on production dynopay.com (worked in preview)
- Root cause: both Dockerfiles copied every frontend dir EXCEPT `data/` → `getStaticPaths` silently emitted zero paths at Docker build time (`fallback: false` → 404)
- Fix: `COPY data/ ./data/` added to builder stages + runtime data copy to runner stages of `Dockerfile` and `Dockerfile.frontend` (sitemap.xml reads data/ via fs at runtime); `getStaticPaths` in both dynamic pages now throws loudly if slugs are empty
- **Verified**: Testing agent Iteration 17 — 19/19 (all 14 pages 200, homepage link integrity, sitemap coverage, unknown-slug 404s); simulated production build emitted all 14 pages into standalone output
- ⚠️ USER ACTION: production must be REDEPLOYED with the updated Dockerfile for the fix to go live

### 2026-07-05 — Paid-Link Checkout Flash Fix (checkout.dynopay.com report)
- Bug: opening an already-paid link flashed the OLD checkout form ("Total 0.01" dust) for a few seconds before the success card
- Fix in `pages/pay/index.tsx`: `initialLoading` render gate (neutral loader, testid `checkout-loading`) until `pay/getData` resolves; `router.isReady` guard on the query effect; payment_completed branch clears stale sessionStorage keys (`payment_active_step`, `payment_transfer_method`) instead of `setActiveStep(2)`; walletState currency/amount guarded against degenerate payloads
- **Verified**: Testing agent Iteration 16 — 5/5 scenarios (rapid-sample no-flash, same-tab revisit, unpaid regression, bogus token, PT i18n)
- NOTE: production checkout.dynopay.com requires redeploy to pick up this fix

### 2026-06-28 — Password Update OTP Bug Fixes
- Removed "current password" requirement, replaced with OTP channel selector
- Fixed OTP dialog close button overflow, "Verify" text, auto-submit
- **Verified**: Testing agent Iteration 13

### 2026-06-28 — Email Template Standardization
- Dark mode CSS overhaul, 11 new helper functions, converted all templates
- **Verified**: Iteration 12

### 2026-06-28 — Login Activity & Profile Settings
- Login notification emails, Login Activity section on Profile, Secure Account flow
- Profile: OTP-based email/phone/password updates
- **Verified**: Iterations 10-11

### Earlier Work
- Dashboard stats, registration UI, phone validation, login page fixes
- Forgot Password OTP, Onboarding OTP-only, Company Creation with Name fields

## Prioritized Backlog

### P1 — Upcoming
- Merchant webhook 404 debugging
- Landing page "Network Error" (needs Railway frontend rebuild — user action)

### P2 — Future
- Low gas balance alerting (Slack/email)
- Webhook retry logic + dead letter queue
- Admin dashboard for stuck payment visibility
- Further `paymentController.ts` refactoring


### 2026-07-05 — Landing page overhaul: 14 conversion-focused improvements (A–N)

Full landing-page redesign benchmarked against Stripe / Vercel / Linear / Ramp /
Emergent / Coinbase Commerce / BitPay. Additive only — no existing section was
deleted; the old `Hero.tsx`, `SocialProof.tsx`, `Testimonials.tsx`, `FeeSection.tsx`
remain in the repo (unused) for easy A/B rollback.

**New order of `/` (see `Components/Page/Home/index.tsx`):**
StickyPromoBar → LivePriceStrip → HeroV2 → ComplianceLogoStrip → LiveActivityStrip
→ SupportedChainsRail → FeeCalculator → TryItNow → CoreValueProps → ComparisonTable
→ IndustryLogoWall → TestimonialsV2 → FAQ → FinalCTA → ExitIntentModal.

**Item-by-item:**
- **A + J + M + K → `HeroV2.tsx`**. Two-column hero. Left column: audience switcher
  (`For merchants` / `For developers`) that swaps H1, subtext, and CTA; H1 has gradient
  highlight; country-personalized trust line (`🇺🇸 Trusted in United States — for
  merchants`) via `useCountry()`. Right column: tabbed product surface (Checkout /
  Dashboard / API) auto-rotating every 5s until the user clicks a tab. Checkout tab is
  the actual `/pay/demo?embed=1` iframe. Dashboard tab is a full-fidelity CSS mock
  (KPI cards, animated bar chart, recent-tx list). API tab is a syntax-highlighted
  fake-terminal with copyable curl + 200 status footer. Layered radial-gradient mesh
  background with 22s/26s drift animations (Linear/Cursor feel). "Watch 90s demo"
  opens `DemoVideoModal`.
- **B → `FeeCalculator.tsx`**. Slider (500 → $500K/mo, log-ish stepping). Alternative
  picker = Stripe / Coinbase Commerce / BitPay / PayPal / typical credit card.
  Side-by-side cost bars (DynoPay wins the "Best" badge). "You save $XXX/month —
  that's $XX,XXX/yr, XX.X% less than {alt}" headline card with a "Start saving today"
  CTA. Assumes $75 avg transaction to compute tx count for fixed-fee alternatives.
  Section id="fee-calculator" for the header scroll-spy anchor.
- **C → `StickyPromoBar.tsx`**. Fixed at viewport top (z-index 1500, height 36px).
  "🎁 Your first $500 in payments is fee-free — [Claim →]" with a dismiss X.
  Dismiss persisted in localStorage (`dyno_promo_dismissed_v1`). Uses a CSS custom
  property `--dyno-promo-h` (0px | 36px) that shifts the `FixedHeader.top` and adds
  to `HomeWrapper.paddingTop` so nothing overlaps.
- **D → HomeHeader scroll-spy**. Existing sticky header now has an animated
  gradient underline on the currently-visible section (`hero` / `fee-calculator` /
  `features` / `use-cases`). Highlight state derived from `window.scrollY` via
  requestAnimationFrame. Only runs on the homepage.
- **E → `SystemStatusPill.tsx`**. Inlined into HomeHeader right group (desktop only).
  Reads `overall_uptime_percentage` from `GET /api/status/uptime`; falls back to
  99.98%. Green/amber/red thresholds at ≥99.5 / ≥97 / else. Links to `/system-status`.
  Pulses.
- **F → `ComplianceLogoStrip.tsx`**. Monochrome 5-badge row directly under the hero:
  SOC 2 (Type II in progress) · GDPR · PCI DSS · KYT · Chainalysis (Tatum
  intentionally excluded per direction). Material icons rather than 3rd-party logos to
  avoid trademark issues. Grayscale + `opacity: 0.85`; `filter: grayscale(0)` on hover.
- **G → `IndustryLogoWall.tsx`**. "Trusted across 40+ countries" heading + 8-tile
  industry grid (E-commerce 180+, SaaS 95+, Marketplaces 60+, Agencies 50+,
  Freelancers 75+, Digital goods 40+, Web3 startups 55+, Creators 30+). Colored
  gradient tile with material icon. Hover raises the tile.
- **H → `TestimonialsV2.tsx`**. Three richer cards (desktop grid, mobile carousel with
  dot pagination). Each card: 5-star row, quote, initials-in-gradient-circle avatar
  (Name · Role · Company + Industry · Country + chain-badge). Placeholders since no
  real logos: Amelia Rodrigues (Bloomvue Studio · Portugal · USDT-TRC20), David Kimani
  (Payflex · Kenya · USDT-ERC20), Sofia Chen (North Gate Marketplace · Singapore ·
  USDC-Polygon).
- **I → `DemoVideoModal.tsx`**. Triggered by "Watch 90s demo" in HeroV2. Since we
  don't have a produced video yet, it shows a 3-step storyboard modal that
  auto-advances every 4.5s (Create link → Customer picks any chain → You settle in
  stablecoins). Big gradient hero pane, step dots, dark backdrop with blur. When we
  ship a real video, swap the storyboard for an `<iframe src={videoUrl}>` — same
  open/close plumbing.
- **K → `hooks/useCountry.ts`**. Wraps `/api/geo-detect` (existing endpoint, no changes).
  Cached in sessionStorage. Returns `{ country, countryCode, flag }`. Used by HeroV2
  trust line. SSR-safe: returns null on server, hydrates cleanly on client.
- **L → `ComparisonTable.tsx`**. 4-column head-to-head (DynoPay · Coinbase Commerce ·
  BitPay · Stripe). 14 feature rows including fee, chains, settlement time,
  non-custodial, chargebacks, KYC, developer surface, recurring billing, free tier.
  DynoPay column has a subtle gradient wash + "Best value" gradient badge above the
  header cell. Green/red check-cross for booleans. Horizontally scrollable on mobile
  (min-width 720). Footnote about pricing accuracy as of 2026-07.
- **N → `ExitIntentModal.tsx`**. Fires on `mouseout` when `e.clientY ≤ 0` (mouse
  leaving the viewport top). Desktop-only (skipped on `window.innerWidth < 900`).
  Only fires once per session (sessionStorage). Armed 4s after page load to avoid
  catching bounce-back-through visitors. Escape to close. Shows the sandbox key
  (`dyno_sk_sandbox_demo_9f621db8`) in a copyable code pill + "Claim $500 fee-free"
  and "View API docs" CTAs.

**Verification (Playwright headless, 1440×900, US IP):**
- Console errors: 0 non-preexisting (only `[next-auth] CLIENT_FETCH_ERROR` which is a
  session-fetch race unrelated to these changes).
- All 13 element locators found (`Promo bar`, `Hero H1`, `Audience switcher`,
  `Watch 90s demo`, `Status pill`, `Compliance SOC 2`, `Fee Calculator`, `Compare
  against`, `Coinbase Commerce`, `E-commerce`, `What builders are saying`,
  `Merchant accepted` ×32 marquee, `Try the API`).
- Bounding-box check: promo bar `{y:0, h:36}`, header `{y:36, h:69}`. After dismissing
  the promo bar, header snaps back to `{y:0, h:69}` (CSS var `--dyno-promo-h` cycles
  36→0). No visual overlap.
- HeroV2 tab auto-rotation observed cycling Checkout → Dashboard → API every 5s.
- FeeCalculator at $10K/mo with Stripe alt shows DynoPay $50 vs Stripe $330 → "You
  save $280/month · $3,359/yr · 84.8% less" (math verified: 10000×2.9% + 133×0.30 =
  329.90 ≈ $330).

**Files touched (new = 11, modified = 4):**
- New: `hooks/useCountry.ts`, `Components/Common/StickyPromoBar.tsx`,
  `Components/Common/SystemStatusPill.tsx`, `Components/Modals/ExitIntentModal.tsx`,
  `Components/Modals/DemoVideoModal.tsx`, `Components/Page/Home/HeroV2.tsx`,
  `Components/Page/Home/FeeCalculator.tsx`, `Components/Page/Home/ComparisonTable.tsx`,
  `Components/Page/Home/IndustryLogoWall.tsx`,
  `Components/Page/Home/TestimonialsV2.tsx`,
  `Components/Page/Home/ComplianceLogoStrip.tsx`.
- Modified: `Components/Page/Home/index.tsx` (new section order),
  `Components/Page/Home/styled.tsx` (paddingTop includes --dyno-promo-h),
  `Components/Layout/HomeHeader/index.tsx` (SystemStatusPill import + scroll-spy
  useEffect + activeSection underline in NavLinks),
  `Components/Layout/HomeHeader/styled.tsx` (FixedHeader.top uses --dyno-promo-h var).

**Test credentials**: unchanged. No new accounts. No prod DB writes. No third-party
integrations added.
