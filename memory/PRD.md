# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment gateway platform. Users can create companies, wallets, payment links, and accept crypto payments. The platform supports OTP-based authentication, profile management, login activity monitoring, and comprehensive dark/light mode theming.

## What's Been Implemented

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
- Wrote `/app/backend/.env` from the user-provided values. Overrode URLs to this preview origin `https://quick-start-233.preview.emergentagent.com` (FRONTEND_URL / SERVER_URL / NEXTAUTH_URL / NEXT_PUBLIC_BASE_URL / CHECKOUT_URL), appended the origin to `CORS_ALLOWED_ORIGINS`, generated a real `NEXTAUTH_SECRET` (user pasted a placeholder), and kept `WORKER_ROLE=secondary` so cron/sweeps/settlement stay OFF (gate: `isCronEnabled = enableBackgroundJobs && workerRole !== 'secondary'`). GOOGLE_CLIENT_KEY preserved with `\\n` escaping verbatim.
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
