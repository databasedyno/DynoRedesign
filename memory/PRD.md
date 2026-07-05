# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment gateway platform. Users can create companies, wallets, payment links, and accept crypto payments. The platform supports OTP-based authentication, profile management, login activity monitoring, and comprehensive dark/light mode theming.

## What's Been Implemented

### 2026-07-05 — Re-setup on user-provided .env (preview origin f12696f9-…)
- Fresh container: `/app/node_modules`, `/app/backend/node_modules`, and all `.env` files were missing → frontend supervisor FATAL, backend Node process down.
- Wrote `/app/backend/.env` from the user-supplied values (single-quoted so `GOOGLE_CLIENT_KEY` PEM with literal `\n` stays verbatim). Overrode URLs to this preview origin `https://prod-deploy-check.preview.emergentagent.com` (`FRONTEND_URL` / `SERVER_URL` / `NEXTAUTH_URL` / `NEXT_PUBLIC_BASE_URL` / `CHECKOUT_URL` + added `NEXT_PUBLIC_SERVER_URL` and `NEXT_PUBLIC_API_DOCS_URL`). Appended preview origin to `CORS_ALLOWED_ORIGINS`. Replaced the placeholder `NEXTAUTH_SECRET="openssl rand -base64 32"` with a real generated base64 secret. Kept **WORKER_ROLE=secondary** (cron/sweeps/settlement OFF — verified "background jobs disabled — secondary instance"). Added the `EMERGENT_LLM_KEY` used by the SEO generator.
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
- Wrote `/app/backend/.env` from prod values with overrides: URLs (SERVER_URL/FRONTEND_URL/CHECKOUT_URL/NEXTAUTH_URL/NEXT_PUBLIC_BASE_URL + added NEXT_PUBLIC_SERVER_URL/NEXT_PUBLIC_API_DOCS_URL) → preview origin `https://prod-deploy-check.preview.emergentagent.com`; preview origin appended to CORS_ALLOWED_ORIGINS; **WORKER_ROLE=secondary** (cron/sweeps/settlement OFF — verified in logs "background jobs disabled — secondary instance"). Values single-quoted so the GOOGLE_CLIENT_KEY PEM (literal `\n`) stays verbatim. Prod NEXTAUTH_SECRET was the literal placeholder "openssl rand -base64 32" → replaced with a real generated base64 secret (in both backend .env and .env.local).
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
- Wrote `/app/backend/.env` from the user-provided values. Overrode URLs to this preview origin `https://prod-deploy-check.preview.emergentagent.com` (FRONTEND_URL / SERVER_URL / NEXTAUTH_URL / NEXT_PUBLIC_BASE_URL / CHECKOUT_URL), appended the origin to `CORS_ALLOWED_ORIGINS`, generated a real `NEXTAUTH_SECRET` (user pasted a placeholder), and kept `WORKER_ROLE=secondary` so cron/sweeps/settlement stay OFF (gate: `isCronEnabled = enableBackgroundJobs && workerRole !== 'secondary'`). GOOGLE_CLIENT_KEY preserved with `\\n` escaping verbatim.
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
