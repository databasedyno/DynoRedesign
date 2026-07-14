# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment gateway platform. Users can create companies, wallets, payment links, and accept crypto payments. The platform supports OTP-based authentication, profile management, login activity monitoring, and comprehensive dark/light mode theming.


### 2026-07-14 — Session 45 (contd.) — DigitalOcean Deployment Diagnosis + Preemptive TS Fix — ✅ RESOLVED
User reported "digitalocean deployment appear stucked" and shared a DO API token. Investigation via `api.digitalocean.com`:
- **App**: `dynopay` (id `f86b27dc-feb0-…`) in `ams` region, GitHub-connected to `databasedyno/DynoRedesign` branch `New-Onboarding2`, `deploy_on_push=true`.
- **Diagnosis**: ACTIVE deploy `b534eac5` (manual, 2026-07-14T02:52:44Z → completed 03:01:16Z) is on commit `164712b3c68f9bda626c9868d86919241afa4e5d` — **exactly matches GitHub HEAD** (verified via public `/repos/.../commits/New-Onboarding2` API). The deployment is **NOT stuck**; it's on the latest commit and healthy.
- **Prior ERROR builds (3 of them: `b4c8a6b6`, `686b5f52`, `31167f1f` on 2026-07-13)** all failed at the `yarn build → tsc` step with `TS2339: Property 'parent_link_id'|'donor_name'|'donor_message'|'is_anonymous' does not exist on type 'RedisPaymentItem'` — those were fixed in commit `164712b` (interface augmented in `cryptoCheckout.ts`).
- **Preemptive fix (this session)**: `yarn tsc --noEmit -p .` on the CURRENT /app tree still surfaced **8 more strict-mode errors** in `controller/payment/paymentLinkController.ts` (Phase 3.1 columns `donation_story_md`, `donation_gallery`, `donation_ends_at`, `donation_category`, `donation_organizer_thanks`, `donation_beneficiary` were spread onto the response literal without being declared on the local `PaymentLinkData` interface, plus a `Decimal → number|null` cast on `donationFields.goal_amount` line 760). Would have hit DO the moment Session 45 code was pushed. Fixed by augmenting the interface + explicit `(donationFields.goal_amount as number | null) ?? null` cast.
- **Verification (testing_agent_v3_fork iteration 30)**: `yarn tsc --noEmit -p .` from `/app/backend` = **0 errors** in ~8.7s. `GET /api/pay/getPaymentLinks` returns 200 with donation link_id=77 including all 6 crowdfunding v2 keys (`story_md`, `gallery[3]`, `ends_at`, `category='creative'`, `organizer_thanks`, `beneficiary`). Phase 3.3 regression endpoints (`/pay/campaign/77/tiers` → 5 tiers, `/updates` → 3 updates) unchanged. `success_rate.backend=100%`, `retest_needed=false`.
- **Fresh DO redeploy triggered**: manual force_build id `551a9f1a-d18b-4645-aea9-96abe7fb14a7` — currently phase=BUILDING (progressing cleanly, 0 errors). Not strictly necessary but confirms the pipeline is healthy.

**Testing agent code-review notes for follow-up (non-blocking)**:
- `paymentLinkController.ts` is 2376 lines — recommend splitting into feature modules.
- Local inline `PaymentLinkData` interface duplicates the Sequelize model — should export/share instead.
- The `as number | null` cast on line 760 is a type-assertion band-aid — a proper narrowing (`typeof x === 'number' ? x : null`) would be strict-mode ideal.



### 2026-07-14 — Session 45 (contd.) — Country-Aware Landing Prices — ✅ COMPLETE
Added `useLocalPrice()` hook that converts landing showcase amounts to the visitor's local currency using a static rate table (rounded, not live FX — this is marketing copy). Applied to `CrowdfundingShowcase` (campaign goal, raised amount, all 3 tier chips, update text) + `CreatorShowcase` (3 tip preset chips) + `FeeStrip` (Stripe/PayPal flat fees).
- **New hook** `/app/hooks/useLocalPrice.ts` (~110 lines): reads visitor country via existing `useCountry()` → maps ISO-2 to a currency preset. Supports **USD (default), EUR (20 EU codes), GBP, INR (with lakh formatting), AUD, CAD, JPY, MXN, BRL, ZAR, NGN**. Handles zero-decimal currencies (JPY), Indian thousand-grouping (`8,30,000`), and "clean tier" snapping for small ceremonial amounts (e.g. `$5 → €5 / ₹500 / A$8 / R$25`) so copy still reads well.
- **i18n interpolation**: added `{{goal}}` / `{{raised}}` vars to `crowdfundingShowcase.mockGoal` + `mockUpdateTitle`, and `{{flat}}` to `feeStrip.col2Value` + `col3Value`, across all 6 locales. Component passes the localized string into `t()`.
- **Verified live**: DE visitor sees `€1.840 raised of €9.200 goal` with EU decimal notation. IN visitor sees `₹1.7L raised of ₹8.3L goal` with lakh formatting + fee strip `2.9% + ₹25 / 3.49% + ₹41`. US visitor sees the original `$2,000 of $10,000 goal`. No layout shift.
- `tsc --noEmit -p .` clean, `next build` clean.



### 2026-07-14 — Session 45 (contd.) — Landing Copy Pass 2: Full i18n + Dead File Cleanup — ✅ COMPLETE
- **All 5 remaining locales translated** — added the ~55 new/changed keys (`heroCleanEyebrow`, `heroSwiss*`, `heroCleanSubtitle`, `heroTrust*`, `heroStat*`, `doors.*`, `crowdfundingShowcase.*`, `creatorShowcase.*`, `feeStrip.*`, `showcase.title/subtitle`, `finalCta*`, refreshed `faq5/7/8`) to `es/fr/de/nl/pt`. Each locale is now 220 keys — parity with English. Deep-merged into existing files via python (no keys clobbered).
- **Native-language hero verified** across all 5:
  - ES: *"Cobra en cripto."* / *"Vende productos. Lanza una campaña. Dale propina a un creador."*
  - FR: *"Encaissez en crypto."* / *"Vendez des produits. Lancez une campagne. Soutenez un créateur."*
  - DE: *"Kassiere in Krypto."* / *"Verkaufe Produkte. Starte eine Kampagne. Trinkgeld für Creator."*
  - NL: *"Word betaald in crypto."* / *"Verkoop producten. Start een campagne. Tip een creator."*
  - PT: *"Receba em cripto."* / *"Venda produtos. Lance uma campanha. Dê gorjeta a um criador."*
- **Currency-aware price hints**: EUR examples in FR/DE/NL, USD in ES/PT (Latin-American default), preserved `{{country}}` and `{{campaign}}` interpolations everywhere.
- **Dead files removed**: deleted `Components/Page/Home/FeeCalculator.tsx` and `Components/Page/Home/ComparisonTable.tsx` (replaced by `FeeStrip.tsx` in previous turn — no other imports referenced them).
- **Verified**: `next build` clean, Spanish preview page loads at 200, `es/fr/de/nl/pt` JSON files all validated for key presence.



### 2026-07-14 — Session 45 (contd.) — Landing Page Copy Revamp (English) — ✅ SHIPPED
User asked for landing copy consistent with the latest product. Pass 1 = English end-to-end; Pass 2 (other 5 locales) is scheduled next.
- **New hero positioning**: "Get paid in crypto. / Sell products. Run a campaign. Tip a creator." Subtitle: "One dashboard, three payment surfaces — checkout, crowdfunding, and creator tips. Every dollar settles straight to your wallet in minutes." CTA: "Start free". Stats relabelled to `SIGN-UPS · CHAINS · AVG SETTLE`. Trust line: "Live in {{country}} · No monthly fee".
- **New section — AudienceDoors** (`Components/Page/Home/AudienceDoors.tsx`, ~180 lines): 3 doors right under the hero — **Merchants → Sell for crypto**, **Fundraisers → Run a campaign**, **Creators → Get tipped** — each with its own accent color (blue/lime/pink), icon glyph, kicker/title/description, and CTA that anchor-scrolls to the matching showcase further down.
- **New section — CrowdfundingShowcase** (`CrowdfundingShowcase.tsx`, ~250 lines): dedicated "Not just a donation button. **A full campaign page.**" section with 4 feature bullets (story/gallery/countdown, reward tiers, updates that email supporters, donor wall + replies) + a mock campaign card showing goal bar (20% raised, 41 supporters), 3 tier chips ($5/$25/$100) and an "Update · emailed to 41 supporters" pill.
- **New section — CreatorShowcase** (`CreatorShowcase.tsx`, ~210 lines): "Your own tipping page — dynopay.com/@you" with checkmark bullets + a mock creator page (avatar, `@ada` handle, bio, three preset tip amounts $5/$10/$25, `Send a tip · USDT` button, "Direct to wallet · no signup" caption).
- **Killed** FeeCalculator and ComparisonTable, replaced by **FeeStrip** (`FeeStrip.tsx`, ~200 lines): compact 3-column band showing `Dynopay 0.5%–1.5%` (with a "YOU" pill) vs `Stripe 2.9% + $0.30` vs `PayPal 3.49% + $0.49`, plus "See full pricing" pill CTA. Preserves `#fee-calculator` id so hero's "See fees ↓" still anchors correctly.
- **FAQ** — updated q5 (removed obsolete "$500 fee-free" phrasing), refreshed q7 to reflect crowdfunding-as-first-class-product, and **added q8** for creator page tips.
- **Home layout** re-ordered: Hero → AudienceDoors → ChainsMarquee → ProductShowcase → **CrowdfundingShowcase** → **CreatorShowcase** → StatWall → CoreValueProps → UseCasesBento → **FeeStrip** → ComplianceLogoStrip → TestimonialsV2 → FAQ → FinalCTA.
- **i18n safety**: `fallbackLng: "en"` is already set in `/app/i18n.js`, so `es/fr/de/nl/pt` visitors will see English for the new keys until Pass 2 translates them — no broken keys in the UI.
- **Verified live** on `/` (screenshots captured for hero, doors, crowdfunding, creator, fee strip) — `tsc --noEmit -p .` clean; `next build` clean; all 5 new sections mount with correct data-testids.



### 2026-07-14 — Session 45 (contd.) — Phase 3.3 P1: Contribution Receipt Email Branching — ✅ COMPLETE
Fixed the last deferred item from Session 44: when a completed transaction settles on a `link_type='contribution'` row, both the **merchant receipt** and the **donor receipt** now render contribution-flavored copy (subject + heading + intro + outro) instead of the generic "Payment received" / "Your payment to X" templates.
- **i18n**: Added `contributionReceived.*` (merchant) and `contributionThankYou.*` (donor) namespaces to all 6 locales (`en, es, fr, de, nl, pt`). Merchant: "You just received a contribution — 25.00 USD" / "New contribution received". Donor: "Thank you for contributing to <Campaign>" / "Thank you for supporting <Campaign>".
- **Templates** (`services/emailService.ts`): both `sendPaymentReceivedEmail` and `sendCustomerPaymentConfirmationEmail` got an **additive** optional trailing param `campaignName?: string`. When present, the subject/heading/intro/outro/CTA switch to the `contribution*` locale keys via a single `isContribution` bool inside the template — no new email functions, no new mailer wrapper, zero breakage for existing standard-payment callers.
- **Settlement wiring** (`controller/payment/cryptoSettlement.ts` line ~2738): after `userData` load, added a small parent-lookup block that fires ONLY when `customerData.link_type === 'contribution' && parent_link_id`. It queries `paymentLinkModel.findOne({link_id: parent_link_id}, attributes: ['title','description'])`, extracts the title, and passes it as `campaignName` to both email calls. Failure is soft-logged (`cronLogger.warn`) — falls back to standard copy.
- **Verified**: `test_email_branching.ts` (in `/app/backend/tests/`) prints subject+heading strings for standard vs contribution across all 6 locales — all 12 pairs distinct and semantically correct. `tsc --noEmit -p .` clean; other `sendPaymentReceivedEmail` callers (`merchantPoolSweep`, `testRouter`) unaffected because the new param is optional trailing.



### 2026-07-14 — Session 45 — UX Revamp Phase 3.3: Merchant Editor UI + Update Fan-out — ✅ COMPLETE (self-tested, curl + screenshot)
Completed the last two P0 items from Phase 3.3 of the crowdfunding UX revamp.
- **i18n**: Added `contributor.crowdfundingUpdate.{subject,friend,intro,outro,heading,cta}` across all 6 locales (`en, es, fr, de, nl, pt`) — the shape `sendCrowdfundingUpdateEmail` in `services/emailService.ts` already expected.
- **Backend fan-out** (`controller/payment/crowdfundingController.ts`): `createUpdate` now spawns a fire-and-forget `fanOutUpdateEmail(...)` when `notify_contributors=true`. It selects `DISTINCT ON (LOWER(email))` from `tbl_payment_link` where `parent_link_id=:pid AND link_type='contribution' AND status='completed' AND email <> ''`, then `Promise.allSettled`s `sendCrowdfundingUpdateEmail` for each donor. Never blocks the 201; ok/fail counts logged.
- **Merchant editor UI** (`Components/UI/pay-link/CampaignManager.tsx`, ~575 lines): two-tab card (`Reward tiers · N | Updates · N`) mounted inside `Components/Page/CreatePaymentLink/index.tsx` and shown only when `linkKind==='donation' && hasPaymentLinkData && paymentSettings.linkId`. Full CRUD for tiers (title / min / description) and updates (title / body_md) with an inline **"Email all contributors"** toggle on new updates. Optimistic-free — each save re-fetches. All controls have data-testids (`cm-tab-tiers`, `cm-tab-updates`, `cm-tier-*`, `cm-update-*`).
- **Verified live**: `POST /pay/campaign/77/tiers` → 201 tier_id=6; `POST /pay/campaign/77/updates {notify_contributors:true}` → 201 update_id=5, log `[fanOutUpdateEmail] update_id=5 no contributors to notify` (campaign has 0 completed donors so nothing to send — code path executed correctly, non-blocking); `DELETE /pay/tier/6` + `DELETE /pay/update/5` clean up. Screenshot on `/pay-links/77` shows both tabs (5 tiers + 3 updates from Session 44 seed) rendering and matching design.


## What's Been Implemented

### 2026-07-13 — Session 39 — Dashboard Display Currency (decoupled from API key) — ✅ COMPLETE + VERIFIED (testing_agent 100% BE + FE, iteration_29.json)
Merchants can now choose the currency their **dashboard + wallet balances** are displayed in, independent of the API-key pricing currency. **DISPLAY-ONLY** — never changes stored data, payment pricing, invoices, exports, or webhooks. Curated to 6 currencies: USD, EUR, GBP, NGN, CAD, AUD.
- **DB**: `tbl_company.display_currency VARCHAR(3)` (idempotent `ADD COLUMN IF NOT EXISTS` migration `scripts/add_company_display_currency.js`, already run on live Railway PG; all 4 companies backfilled to USD).
- **Backend resolver** (`utils/currencyUtils.ts`): `SUPPORTED_DISPLAY_CURRENCIES`, `isSupportedDisplayCurrency`, `getCompanyDisplayCurrency` (order: company.display_currency → API base_currency clamped → USD), plus Redis-cached `getUsdToFiatRate`/`convertUsdForDisplay` (key `fxrate:USD:<CUR>`, 600s TTL). Dashboard/wallet controllers already swapped from `getCompanyBaseCurrency` → `getCompanyDisplayCurrency`; invoices/emails/webhooks UNCHANGED (still pricing currency).
- **NEW endpoints** (`companyController.ts` + `companyRouter.ts`, authMiddleware + companyOwnershipMiddleware): `GET /api/company/display-currency/:id` → `{display_currency, currency_info, supported[]}`; `PATCH /api/company/display-currency/:id` body `{display_currency}` → validates (400 on unsupported), persists, returns new value. Verified: GET 200, PATCH persists, invalid→400, not-owned→403, no-auth→401.
- **Frontend**: NEW `Components/UI/DisplayCurrencySelector/index.tsx` (GET on mount, PATCH on change via axiosBaseApi, MUI Snackbar toast, dispatches DASHBOARD_FETCH_ALL + WALLET_FETCH refresh). Mounted in Settings → Payments via `CompanyConfigSection showDisplayCurrency` (uses the same company picker). Test-ids: `display-currency-selector`, `display-currency-select`, `display-currency-option-<CODE>`, `display-currency-toast`.
- **Verified (testing_agent iteration_29.json, 100%)**: change to EUR → toast + persists on reload → /dashboard shows € amounts ('Lifetime Volume €17,653.99 EUR'); switch back → '$' restored. Live DB left at USD. Spec: `/app/DISPLAY_CURRENCY_IMPLEMENTATION.md`.

### 2026-07-13 — Session 39 — Prior bug fixes (verified earlier in session): DigitalOcean deploy TS-error fix, invoice $0 fixed_fee (USD-canonical tier lookup + historical backfill of 6 invoices to v2), 'Payment Received' email $1→full-amount fix (paymentAmountDisplay.ts).


### 2026-06 — Session 33 — UX re-fix VERIFICATION (F1/F2/F3/F4/F5/F10/F22) — 7/7 PASS + 2 bug fixes
Ran frontend testing_agent (iteration_28.json) to verify Session-31 re-fixes that had never been re-tested. ALL 7 PASS: F1 (mobile chat-FAB no longer occludes 'View all'/Create Company — collision-aware auto-hide), F2 (login focus-visible rings), F3 (pay-links row actions labeled+tooltip'd), F4 (API-failure shows Retry banner not the false onboarding gate), F5 (no stacked onboarding modals), F10 (creator explore CTA), F22 (dark-mode watermark dimmed). FIXED 2 bugs found during the run: (1) MEDIUM `AutoAwesomeRounded is not defined` on dashboard — missing import in `Components/Page/Dashboard/EmptyStatePanel.tsx`; (2) LOW F3 aria-labels rendered raw i18n keys — switched to `t(key,{defaultValue})` in `PaymentLinksTable.tsx`. next build PASS, frontend 200. Auto-API-key provisioning (see AUTO_API_KEY_PROVISIONING_PLAN.md) remains the only pending P0, awaiting user "go".

### 2026-07-12 — Session 29 — Full UX usability audit (all devices) + simulated user research — REPORT-ONLY (no code changes)
**User request:** "conduct UX usability audit based on all device types and report; conduct user research and testing to understand user needs and pain points and report." User choices: full end-to-end coverage (public + logged-in + checkout), simulated persona research, two markdown reports, **report only + recommendations — DO NOT FIX yet**.
**Method:** 75 instrumented page loads (25 pages × mobile 390/tablet 768/desktop 1440, own Node Playwright at /pw-browsers) checking overflow/touch-targets/tiny-text/labels/alt/h1/console+hydration errors; ~30 screenshots reviewed light+dark; dark-mode pass (localStorage key `theme-mode`); testing_agent ran 7 persona task flows (iteration_27.json) incl. coordinate-verified tap-interception probes; QA pay-link 32 "QA UX AUDIT DELETE ME" created + DELETED (live DB clean).
**Deliverables:** `/app/memory/UX_AUDIT_REPORT.md` (24 severity-ranked findings F1–F24 + device matrix + quick wins) and `/app/memory/USER_RESEARCH_REPORT.md` (6 personas, 7 task flows all completed, needs synthesis, prioritized recs).
**Top P0 findings (NOT yet fixed — awaiting user prioritization):**
- F1 chat FAB occludes "Create Company" CTA / "View all" / txn status region at 390px (coordinate-verified tap interception)
- F2 no visible keyboard focus rings on login form (likely global MUI override; WCAG 2.4.7)
- F3 /pay-links row actions are unlabeled 14–20px icon buttons (copy-link undiscoverable; WCAG 4.1.2)
- F4 API-failure states render as EMPTY states (rate-limited create-pay-link showed onboarding gate to a merchant WITH company; broken img icons; no retry)
- P1s: stacked first-run modals (company wizard + $500 promo), 573-unread notification fatigue, "Lifetime volume ↓68.2%" impossible-delta label, preview CTA ≠ checkout CTA color, Customers page swamped by $0 synthetic rows, creator public page mobile avatar clipped under header + dead-end empty state, donation-demo hydration errors #418/423/425 (desktop+tablet only, NOT mobile).
**False positives ruled out:** docs "something went wrong" = API error-code content; docs curl/node/python tabs DO swap content (verified after testing-agent flag); zero horizontal overflow anywhere (confirms session 26).
**Positives:** 0px overflow on all 75 combos, checkout+auth+dark-mode strong, all 7 persona tasks completable, loads < ~4s on production build.
Artifacts: /tmp/uxaudit/ (screenshots + results.json), /app/test_reports/iteration_27.json.

### 2026-07-12 — Session 29 — Fresh container re-provisioned ✅ (see test_credentials.md session-29 entry for full detail)

### 2026-07-11 — Session 28-cont — Creator page: flagship discovery + full feature expansion
**Problem:** the Creator vanity page (dynopay.com/{handle}) had full backend + settings UI + public SSR page, and was heavily marketed on the landing, but had **zero discovery inside the app** (no sidebar link, no dashboard card, no header). Confirmed via grep across every layout/nav file. Users had to hunt in `/settings → Creator page` (6th item).

**Shipped (option C + r2 + sparkles icon):**
- **Backend** — migration `addCreatorFlagship.ts` (idempotent, ran ✅ on live Railway PG): added `tbl_user.cover_image VARCHAR(500)` + `tbl_user.social_links JSONB`. `updateCreatorProfile` now accepts cover_image + social_links (allowlist twitter/instagram/youtube/tiktok/website, blocks js/data URIs). NEW endpoints: `POST /api/user/creator/upload-cover` (auth + multer reuse) + `GET /api/user/creator/stats` (returns `{total_visits, this_week_visits, supporters_count}` from Redis daily buckets + SQL supporter count). Public `getCreatorProfile` now returns cover + socials and INCRs Redis visit counters (fire-and-forget).
- **Frontend — new** — `pages/creator.tsx` (first-class route with status banner + 3 stat tiles + 2-column form/preview). `Components/Page/Creator/CreatorLivePreview.tsx` (non-interactive visual clone of the public page). `Components/Page/Dashboard/CreatorPageCard.tsx` (right-column dashboard card, 3 smart states: no handle → claim CTA; draft → publish CTA; live → URL pill + Copy + View + mini stats).
- **Frontend — edits** — `CreatorPageSettings.tsx` (added cover upload, 5 socials, onChange broadcast). `CreatorProfile.tsx` public page (cover hero + social icons row). `NewSidebar/index.tsx` (Creator page item in Payments section w/ `AutoAwesomeRounded` sparkles icon + lime "NEW" pill until claimed+published). `UserMenu/index.tsx` (View my creator page ↗ / Claim my creator page). `DashboardRightSection.tsx` (injected CreatorPageCard above GrowPanel). `EmptyStatePanel.tsx` (second CTA "Or claim your creator page →"). `pages/settings/index.tsx` (removed creator section from rail + redirect `?section=creator → /creator` for backward-compat).
- **i18n** — 32 keys added to `dashboardLayout.json` × 6 locales (en/es/fr/de/nl/pt) via `scripts/i18n_add_creator_flagship.py`.
- **Verified live** (Playwright + JWT injection): `hostbay@moxx.co` sees live-state card + full /creator page + UserMenu "View my creator page"; `qa.empty` sees claim-state card + sidebar NEW pill + UserMenu "Claim my creator page"; public `/hostbay` SSR renders; backend endpoints healthy. `next build` clean, all URLs 200.

### 2026-07-11 — Session 28-cont — Fresh container re-provisioned ✅
Fresh container: no node_modules, no .env, no build. Re-provisioned per documented procedure:
- SEQUENTIAL yarn installs — `/app` root (82s, 551+ pkgs) then `/app/backend` (30s, 572+ pkgs)
- Wrote 3 .env from user continuation env (`/app/backend/.env` + `/app/.env` + `/app/frontend/.env`)
- All app URLs → preview URL `https://coin-checkout-5.preview.emergentagent.com`; preview host FIRST in `CORS_ALLOWED_ORIGINS` (+ dynopay.com + checkout.dynopay.com)
- Fresh `NEXTAUTH_SECRET` (openssl rand -base64 32) — user's placeholder was literal `"openssl rand -base64 32"`
- Fixed typo `EXT_PUBLIC_ENABLE_GITHUB_AUTH` → `NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true`
- `GOOGLE_CLIENT_KEY` kept `\n`-escaped (single backslash — .env is not JSON)
- `PORT` omitted (server.py injects 3300 internally)
- Added `OPENAI_API_KEY` + `SUPPORT_CHAT_MODEL=gpt-5.4`
- **SAFETY OVERRIDES** for preview: `NODE_ENV=production` / `WORKER_ROLE=secondary` / **`ENABLE_BACKGROUND_JOBS=false` (OVERRIDE — user's env had `true`)** — verified in logs (error-digest / webhook-URL-migration / BullMQ webhook worker / startup-reconciliation all skipped)
- `next build` standalone OK (all pages, ~433KB shared JS)
- **Health verified:** `/health` OK, PostgreSQL connected, Redis connected, Tatum operational (40 rates refreshed); internal `:8001 /api/` + `/health` + `/api/csrf-token` = 200; internal `:3000 /` = 200; external `/` + `/api/` + `/api/csrf-token` + `/auth/login` = 200 (`google-login-btn` + `github-login-btn` + "Continue with Google/GitHub" all present); bad-creds POST `/api/user/login` = 401 "Invalid email or password"
- **Expected quirks:** `sshpass` missing on PATH → SSH tunnel disabled (Binance WS may fall back to CoinGecko/Tatum for rates — currently OK, 40 Tatum rates refreshed)

### 2026-07-11 — Session 27d — Landing refresh (creator vanity mockup) + /pay checkout lime polish
- Landing "Digital creators" use-case card now shows a Creator vanity-page mockup (avatar + `dynopay.com/ava-designs` + "Support my work"); copy updated in all 6 locales (`useCase2Tag`→"Creator page"). File: `Components/Page/Home/UseCasesBento.tsx`.
- Standard /pay checkout polished to match landing/donation: selection + primary CTA rebranded to brand lime `#CCFF00`/ink (green kept only for success states); added low-fee network hint, tap-to-copy address row, and a trust strip. Files: `pages/pay/index.tsx`, `Components/Page/Pay3Components/cryptoTransfer.tsx`, `pages/pay/demo.tsx`.
- Verified via full standalone build + testing_agent (iteration_26.json, frontend 100%, 0 console errors). Full detail in `memory/CHANGELOG.md` (session 27d). Pre-existing note: /pay page body does not follow the header dark-mode toggle (flagged in ROADMAP).


### 2026-07-11 — Session 24 — Embeddable Checkout Phase 3(b) "Elements Inline Widget" — BACKEND + SDK COMPLETE + BACKEND-TESTED 17/17

Previous Session 23 built Elements endpoints + tests, but the container was recreated and the uncommitted work was lost. Session 24 rebuilds the feature from scratch based on `EMBED_INTEGRATION_PLAN.md §7`. Now committed.

**Backend (Node/TS):**
- NEW `backend/controller/elementsController.ts` (~475 lines) — 3 handlers with intent lifecycle in Redis (`elements-intent:<pi_id>`, 24h TTL) + idempotent currency selection + live status polling. Reuses `merchantPoolService.reserveAddress`, `currencyConvert`, `generateQRCodeWithLogo`, `findOrRecreateCustomer`, and the existing pk middleware (Origin allow-list + rate limit + usage stats).
- Endpoints (mounted at `/api/embed/public/elements`, pk + Origin auth):
  - `POST /elements/intent` — Body `{amount, currency?, redirect_uri?, meta_data?}`. Validates amount ≥ 5 and ≤ pk.max_amount, currency in effective set (intersect of merchant wallets, pk.allowed_currencies, MERCHANT_POOL_CRYPTO_TYPES). Returns `{intent_id: "pi_...", client_secret: "elm_...", available_currencies, amount, base_currency, expires_at, status: "requires_currency"}`.
  - `POST /elements/select-currency` — Body `{intent_id, currency}`. Reserves ONE address from the merchant pool via the SAME service the hosted checkout uses. Converts fiat→crypto. Generates QR. Creates a pending `tbl_user_transaction` row for webhook lookup. Idempotent: 2nd call with same currency returns the same address. Currency switch after `processing`/`succeeded` is rejected 400.
  - `GET /elements/status?intent_id=pi_...` — Reads intent from Redis + refreshes live status from `tbl_user_transaction`. DB status → SDK status: `completed/successful/confirmed → succeeded`, `underpaid/partial/processing → processing`, `failed/expired/cancelled → failed`.
- MOD `backend/routes/publishableKeyRouter.ts` — added 3 elements routes.
- MOD `backend/middleware/publishableKeyMiddleware.ts` — CORS `Access-Control-Allow-Methods` now includes `GET` for status polling.

**SDK (`public/v1/embed.js` — 16,981 → 32,597 bytes):**
- Added `Dynopay(pk).elements({ appearance }).create('crypto', {amount, currency?, redirectUri?, meta?})` returning a `CryptoElement` with `.mount(selector)`, `.on(event, cb)`, `.destroy()`. Events: `currency_selected`, `succeeded`, `expired`, `failed`, `error`.
- 3 UI phases in merchant's own DOM (no iframe): loading → currency picker (grid) → address panel (amount both crypto+fiat, QR, mono address + Copy, destination-tag banner, live status pill polled every 5s, "Change currency" link).
- Appearance API: `{theme: 'dark'|'light', accent: '#hex', radius: number}`.
- **Backward-compat preserved**: `window.Dynopay` is now BOTH callable (`Dynopay(pk)` for Phase 3b) AND has the existing namespace properties (`Dynopay.initEmbeddedCheckout`/`openCheckout`/`redirectToCheckout`/`createSessionWithPk` + `dynopay-buy-button` custom element for Phases 1a/1c). Verified via Playwright.

**Merchant QA page:** `public/elements-test.html` (`/elements-test.html`). Pk + amount + optional currency inputs, "Mount" button, real-time event log. Prefills from `?pk=&amt=&ccy=`.

**Test suite:** `backend_test_session24_elements.js` — 19 test cases against LIVE Railway PG + Redis + mainnet Tatum. **17 PASS · 0 FAIL · 2 SKIP** (skips are K8s ingress limitations, not defects: T2b bogus-Origin — ingress rewrites the Origin header; T9c /health — ingress only exposes `/api/*`).

**T4 SAFETY note:** Test T4 reserved ONE real USDT-TRC20 pool address for hostbay company_id=1 at $5. Address `TRyk74od7FfrRYeopp1azu26HcxKdb6zj2`, RESERVED status. Idempotency verified (2nd call returns same address). Will show RESERVED in `tbl_merchant_temp_address` until the ~2h reservation timeout expires. No wallet writes, no tx broadcast, safe.

**Frontend smoke test:** Playwright confirmed `window.Dynopay` is callable + still has `.initEmbeddedCheckout` (regression). Mount triggered the intent call — 403 rendered as inline SDK error card because the browser's rewritten Origin (`https://4e39dada-…cluster-5.preview.emergentcf.cloud`) was not in the pk's allow-list at the moment of the click (test suite cleanup had restored the original values). This proves: SDK wires the API call correctly, origin validation works from the actual browser, SDK error handling renders as designed.

**Phase 3 tracker (in `EMBED_INTEGRATION_PLAN.md §11`):**
- 3A backend endpoints — ✅ DONE + TESTED
- 3B SDK bindings — ✅ DONE + BROWSER-VERIFIED
- 3C dashboard UI ("Elements" tab in `/developer-keys` with snippet + live preview) — DEFERRED
- 3D docs (guide + `/documentation` page) — DEFERRED
- 3E end-to-end payment test on a real merchant page — DEFERRED (would consume real crypto)

### 2026-07-11 — Session 24: Fresh container re-provisioned ✅
Fresh container: no node_modules, no .env, no build. Re-provisioned per documented procedure: SEQUENTIAL yarn installs — /app root (79s, 551 pkgs) then /app/backend (29s, 572 pkgs); wrote 3 .env from user continuation env (backend/.env + /app/.env + frontend/.env) with all app URLs → the preview URL `https://coin-checkout-5.preview.emergentagent.com`, preview host FIRST in CORS_ALLOWED_ORIGINS (+ dynopay.com + checkout.dynopay.com), fresh NEXTAUTH_SECRET, GitHub creds (Ov23liBuaGCFqNpp2QzW), user typo EXT_PUBLIC → NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true, GOOGLE_CLIENT_KEY kept \\n-escaped, PORT omitted (server.py injects 3300), OPENAI_API_KEY + SUPPORT_CHAT_MODEL=gpt-5.4 included. SAFETY OVERRIDES: NODE_ENV=production / WORKER_ROLE=secondary / ENABLE_BACKGROUND_JOBS=false verified in logs (error-digest / webhook-URL-migration / BullMQ webhook worker / startup-reconciliation all skipped). next build standalone OK (18/18 static pages, 429KB shared JS). Health: /health database=connected redis=connected tatum operational (40 rates); internal :8001 /api/ /health /api/csrf-token + :3000 / /auth/login = 200; external / /api/ /api/csrf-token /auth/login = 200 (google-login-btn + github-login-btn + "Continue with Google/GitHub" present); bad-creds POST /api/user/login = 401 "Invalid email or password". Expected quirks: Binance WS geo-blocked (451) → CoinGecko/Tatum fallback; sshpass missing → SSH tunnel disabled.

### 2026-07-10 — Embeddable Checkout Phase 1(a) "Embedded Checkout" — BACKEND DONE + VERIFIED (frontend iframe test pending)
Stripe-style embedded (iframe) crypto checkout, built method-agnostic (see /app/EMBED_INTEGRATION_PLAN.md §5/§12).
- Backend: `POST /api/user/embed/session` (secret `x-api-key`) → `{ client_secret, checkout_url(/pay?d=..&embed=1),
  payment_methods:[{type:'crypto',currencies}], ui_mode:'embedded', expires_at, fee_payer }`. Reuses createPayment
  flow (only writes Redis `customer-<id>`, no address reserved). **Backend-tested 7/7 (Session 20c)** incl. auth/min/bad-key
  negatives, session persistence, cleanup.
- Frontend SDK: `/v1/embed.js` (window.Dynopay.initEmbeddedCheckout / openCheckout(modal) / redirectToCheckout).
- `/pay?...&embed=1` renders embedded (Pay3Layout embed hides chrome) + `EmbedBridge` posts dynopay:ready/resize/
  success/redirect to parent. Merchant test page: `/embed-test.html?cs=<client_secret>`.
- PENDING: frontend iframe-mount test (needs user OK), Dashboard "Embed" snippet UI, docs, then Phases (c)+(b).


### 2026-07-10 — Embeddable Checkout (a/b/c) — PLAN CREATED (not started)
User wants Stripe-style embeds: (a) Embedded Checkout [iframe], (b) Elements inline widget, (c) Buy Button.
Full implementation plan + phased checklists + API contracts + security model live in **`/app/EMBED_INTEGRATION_PLAN.md`**.
Key facts captured there: single SECRET api key today (`dpk_live_`/`dpk_test_`), need a NEW publishable key (`pk_live_`)
for (b)/(c); `server.ts` helmet sets `frame-ancestors 'none'` (blocks all iframing — must relax per-embed-route);
checkout is `/pay?d=<token>` with an existing `Pay3Layout embedded` mode. Recommended build order: (a) → (c) → (b).
Resume by reading that doc's §1 + §11 tracker.


### 2026-07-10 — Session 20b: Brand casing "DynoPay"→"Dynopay" (end-to-end) + similar-overflow hardening ✅ FIXED + VERIFIED

**User request:** (1) fix brand casing — it's "Dynopay" not "DynoPay" — everywhere that matters; (2) analyze/fix
overflow issues similar to the create-pay-link crypto-card bug.

**Branding:** Replaced whole-word `DynoPay` → `Dynopay` (1114 occurrences across 112 files): UI copy, ALL i18n
locales (en/es/fr/de/nl/pt), SEO JSON (data/seo-pages), email templates, 2FA issuer `APP_NAME`, push-notif title
(public/sw-push.js + assets/public-runtime mirror), legal text, swagger. Used a protective regex
`(?<![\w-])DynoPay(?![\w])(?!-(?:Event|Signature|Timestamp|Webhook-Id|Type|Auth))` so it did NOT touch:
- camelCase identifiers / component & file names (`WhyChooseDynoPay.tsx`, `DynoPayLogo`, …)
- the `X-DynoPay-*` webhook header names (public API contract merchants depend on — backend/webhooks + docs + swagger)
- the `DynoPay-Auth` User-Agent header in userController.ts
- JSON keys (only values changed). All changed JSON re-validated.

**Similar-overflow analysis + fix:** The reported bug was CryptoItemCard's fixed-width/no-shrink design. Audited the
analogs that render the same long labels: `CryptocurrencySelector` (wallet add/edit) had the same risk → hardened
(trigger left content `flex:1/minWidth:0/overflow:hidden`, name ellipsis, right divider/chevron `flexShrink:0`,
dropdown `ListItemText` `noWrap`+`minWidth:0`). Wallet-page cards and LivePreviewPanel already use ellipsis/minWidth:0
(no change). Checkout selector uses `fullWidth` (no constrained-width overflow).

**Verified (frontend testing agent):** Branding 6/6 pages show "Dynopay", zero wrong-cased "DynoPay". create-pay-link
crypto cards 0px overflow + mobile FAB/drawer OK. CryptocurrencySelector trigger + dropdown 0px overflow for
USDT-POLYGON / RLUSD-ERC20 / USDC-ERC20 / USDT-ERC20 at desktop 1920 AND mobile 390. Coin-toggle regression OK.


### 2026-07-10 — Session 20: Crypto-card overflow fix + mobile/tablet live-preview bottom sheet ✅ FIXED + VERIFIED

**User report (screenshot):** On Create Payment Link → "Accepted cryptocurrencies", long network-label cards
(USDT-TRC20, USDT-ERC20, USDC-ERC20, USDT-POLYGON, RLUSD-ERC20 + the "stable" tag) overflowed the card border
and pushed the green checkbox outside the card. Also: the live checkout preview didn't appear on mobile.

**Fixes:**
- `Components/UI/pay-link/CryptoItemCard.tsx` — removed fixed `maxWidth:326px` + fixed 66px height (→ width:100%,
  height:auto, minHeight kept). Left group is now `flex:1 + minWidth:0`; icon/badge/checkbox are `flexShrink:0`;
  name + label badge + "stable" sit in a `flexWrap` group so a long badge wraps to a 2nd line instead of
  overflowing. Checkbox now pinned inside the card.
- `Components/Page/CreatePaymentLink/index.tsx` — desktop (≥lg/1200px) keeps the existing sticky sidebar preview.
  Below lg (phones + portrait tablets) added a fixed "Preview" FAB (`data-testid=mobile-preview-fab`) that opens a
  bottom-sheet MUI Drawer (`data-testid=mobile-preview-drawer`, close btn `mobile-preview-close`) rendering the
  same `LivePreviewPanel`.

**Verified (frontend testing agent):** Desktop 1920 — 0px overflow on all 15 cards incl. the 5 long-label ones,
checkbox inside. Tablet 768 + mobile 390 — FAB visible, drawer opens/closes with live preview; FAB hidden on
desktop. Regression: coin toggle + Select all/Clear all OK. Known pre-existing/unrelated: desktop sidebar preview
total didn't update on amount entry in the test (mobile drawer using the same component DID update) — not touched
by this change.


### 2026-07-10 — Session 17: P0 Bug Fix — Silent-Drop of ERC-20 Incoming Webhooks ✅ RECOVERED + FIXED + VERIFIED

**Bug**: Two USDT-ERC20 API payments to `hostbay@moxx.co` (52 + 30 USDT) were detected on-chain but silently dropped by the webhook processor — no `payment_journal` entry, no merchant webhook, no settlement, funds stuck in temp addresses `0xe8c0…` (id=8) and `0x84aa…` (id=7).

**Root cause**: `isOwnOutgoingTransaction()` in `/app/backend/services/webhookProcessor.ts` (added commit `61cc2422` Jul 3 15:37 UTC) treated `payload.counterAddress` as the transaction SENDER. Empirically, Tatum's ADDRESS_EVENT payload for ERC-20 INCOMING transfers sends `payload.address = external sender` and `payload.counterAddress = OUR subscribed pool address` (receiver). The buggy check found the receiver in `tbl_merchant_temp_address` → returned `"pool_sender"` → processor bailed with `own_outgoing_pool_sender`, silently marking every legitimate ERC-20 incoming as our own outgoing tx and dropping it. Every ERC-20 payment on hostbay since Jul 3 15:37 required `manual_recovery`.

**Recovery (executed against production DB + chain)**:
- Payment 1 (`3264a681-…`, 52 USDT): incoming tx `0x8241d24e…7ca59`, settlement tx [`0x1b59674f…5d630`](https://etherscan.io/tx/0x1b59674f06279214d36b3bb0159f534b80b24e4f4d97ea839c736aac7875d630) → merchant received 50.22 USDT (1.78 admin fee retained on temp addr).
- Payment 2 (`780ebded-…`, 30 USDT): incoming tx `0xddf05cfe…f25cb`, settlement tx [`0x9cf047f2…6a9ad`](https://etherscan.io/tx/0x9cf047f2a280b2c107394dedd1e53ae4eab6b9ee01437cddec572de42496a9ad) → merchant received 28.55 USDT (1.45 admin fee retained).
- 6 merchant webhooks fired (3 per payment: pending → confirmed → settled), all HTTP 200 from `https://nomadly-email-ivr-production.up.railway.app/dynopay/crypto-wallet`.
- DB reconciliation: `tbl_user_transaction` → status=completed with both tx hashes; `tbl_merchant_temp_address` → status=AVAILABLE + admin_fee_balance credited; 3 `tbl_payment_journal` entries per payment (payment_detected → settlement_sent → payment_completed) with `source: manual_recovery`; new `tbl_merchant_pool_transaction` audit rows; merchant wallet `wallet_id=5` credited +78.77 USDT total.
- Rescue script preserved for audit: `/app/backend/scripts/rescue_hostbay_finalize.ts` (and initial attempt `rescue_hostbay_2payments.ts`).

**Code fix** (`/app/backend/services/webhookProcessor.ts` lines 260-305):
- Removed the buggy `payload.counterAddress`-as-sender heuristic entirely (never actually worked — Tatum's payload semantics don't guarantee counterAddress is the sender for any chain).
- Detection now relies ONLY on tx-hash lookups against DB records of transactions we ourselves broadcast:
  - `tbl_merchant_pool_transaction.merchant_tx_id` → `"known_merchant_settlement"`
  - `tbl_merchant_pool_transaction.gas_funding_tx_id` → `"known_gas_funding"`
  - `tbl_merchant_pool_sweep.sweep_tx_id` OR `.gas_funding_tx_id` → `"known_admin_sweep"` (NEW signal — belt-and-suspenders for admin fee sweeps)
- Outer `try/catch` in `processWebhookJob` still fails-open — if the DB is transiently unavailable, a genuine incoming payment is NOT dropped.
- Added regression tests to `/app/backend/__tests__/webhookProcessor.test.ts` (new describe block "Regression — Tatum ERC-20 incoming NOT misclassified as our-own-outgoing").
- Lightweight prod-data verification script `/app/backend/scripts/verify_fix.js` — plain Node + `pg` (no ts-node), runs 5 classification checks + 2 recovery-state checks against live Railway PG. All pass: bug regression tx correctly returns null; recovery settlement + gas funding txs correctly return their respective known_* labels; unknown tx returns null; both recovered payments confirmed in `completed` status with correct tx hashes.

**Testing**: `verify_fix.js` — all 7 assertions ✅ PASS against production data. Existing Jest suite (`__tests__/webhookProcessor.test.ts`) hit heap OOM in this preview pod — `--transpile-only` + `tsc --noEmit -p tsconfig.json` confirm clean compile of the fix.

### 2026-07-10 — Session 16 (IN PROGRESS): Donation/Crowdfunding + create-page redesign
**Feature approved by user:** payment-link creation page redesign (type selector + live preview + sections instead of tabs) + full donation/crowdfunding support (goal, presets, min amount, cover image upload, supporter wall, auto-close-at-goal toggle). User answers: live preview YES, cover image INCLUDE, supporter wall YES, auto-close = merchant toggle, build order = my call (backend → checkout → create page).

**ARCHITECTURE (key decision):** a donation link is a multi-use campaign PARENT row in tbl_payment_link (link_type='donation', base_amount 0). Each donor spawns a CONTRIBUTION child row (link_type='contribution', parent_link_id=parent) via public POST /api/pay/startDonation which creates the child row + its own Redis "customer-<ref>" session → checkout then continues the 100% unchanged normal payment flow on the child ref. Aggregates (raised_amount/supporters_count) are computed live via SQL over completed children (status IN successful/completed/confirmed/processing/converted/payout_complete — DONATION_COMPLETED_STATUSES in paymentLinkController.ts). No settlement-pipeline code touched. Auto-close computed dynamically (no cron).

**✅ PHASE A — BACKEND: COMPLETE & TESTED (23/24 by deep_testing_backend_v2 + main-agent re-verified the 1 flaky case; see test_result.md "Session 16" section).**
- scripts/add_donation_cols.js — 14 additive cols + idx_payment_link_parent ALREADY RUN on live Railway PG (link_type, parent_link_id, title, goal_amount, preset_amounts, min_amount, allow_custom_amount, show_progress, show_supporters, auto_close_at_goal, campaign_image, donor_name, donor_message, is_anonymous).
- models/userModels/paymentLinkModel.ts: same fields added.
- controller/payment/paymentLinkController.ts: validateDonationInput()/parsePresetAmounts()/getDonationAggregates()/getRecentSupporters() helpers (exported); createPaymentLink donation branch (title required, apply_tax forced false, expire default No, Direct-Pay + customer-email skipped); updatePaymentLink donation fields (base_amount ignored for donations, merged presets/allowCustom cross-rule); getPaymentLinks (children excluded via parent_link_id:null, donation{} aggregates block, no 'pending' status for donation parents, auto-closed→'completed'); getPaymentLinkById (donation{} + contributions[≤100], donor_name null when anonymous); deletePaymentLink cascades children; NEW startDonation (public; validates min/presets/closed; child expires_at=24h; customer_name=donor unless anonymous); NEW uploadCampaignImage (uses shared uploadImage multer → backend/public/images, returns SERVER_URL+/api/static/images/<file>).
- controller/payment/cryptoCheckout.ts getData: donation parents skip payment-completed gate; expired donations return campaign_closed:true instead of 410; payload gains is_donation:true + donation{title,purpose,campaign_image,currency,goal_amount,raised_amount,supporters_count,progress_percent,min_amount,preset_amounts[],allow_custom_amount,show_progress,show_supporters,campaign_closed,closed_reason,recent_supporters[≤10]} (settings read fresh from DB).
- routes/paymentRouter.ts: POST /pay/startDonation (paymentRateLimiter, public) + POST /pay/uploadCampaignImage (authMiddleware + uploadImage.single("image")). csrfMiddleware EXEMPT_PATHS += /api/pay/startDonation. paymentController.ts re-exports both. Testing agent also fixed middleware/linkMiddleware.ts (Joi amount optional when link_type==='donation') — reviewed, kept.

**✅ PHASE B — DONOR CHECKOUT: COMPLETE & SMOKE-TESTED (screenshots: campaign card renders; preset $25 → Donate → router.push child ref → standard checkout with $25/donor name/campaign title verified live).**
- NEW Components/Page/Pay3Components/donationCampaign.tsx (DonationCampaign + DonationCampaignData type): cover image, title/purpose, progress bar + % + supporters, preset tiles (testids donation-preset-<n>), custom amount, donor name/message/anonymous, Donate btn (donation-donate-btn), closed banner (goal_reached/expired), supporter wall. Green #10B981 accent, checkout Paper style maxWidth 500.
- pages/pay/index.tsx: donationData/donationRef/donateSubmitting state; getQueryData handles data.is_donation (renders DonationCampaign inside Pay3Layout, no stepper); handleStartDonation POSTs pay/startDonation then clears payment_active_step/payment_transfer_method sessionStorage + router.push(/pay?d=<child>) (push not replace so Back returns to campaign).
- i18n: donation.* keys (25) added to common.json ×6 locales (script pattern: /tmp/add_donation_i18n.py).

**✅ PHASE C — CREATE-PAGE REDESIGN: COMPLETE & VERIFIED (main agent, Playwright screenshots 2026-07-10 10:34-10:39 UTC).** i18n scripts saved at /app/scripts/i18n_add_donation_create_keys.py + i18n_add_donation_checkout_keys.py (both run; keys ×6 locales in createPaymentLinkScreen.json + paymentLinks.json + common.json). Verified live: type-selector cards render + switch; standard mode form unchanged w/ working live preview (mock Review-Your-Order card w/ total + accepted-coin count); donation mode form (title/purpose/goal+currency/min/preset chips w/ remove/cover upload/campaign-ends/fee pills/4 toggles) with REAL-TIME live preview (campaign title, purpose, $0.00 raised of $2,500.00 goal bar, 0 supporters, preset chips, Donate button); FULL UI create flow (donation, goal 1000, preset 10) → saga → backend row verified correct via API (link_id 21, all fields right) → pay-links list shows green "Donation" badge + 0% mini progress bar + raised-amount value column (standard rows unaffected) → QA row deleted, DB confirmed zero donation/contribution/QA rows. BONUS FIX: pre-existing missing i18n keys advancedOptions/advancedOptionsHint added ×6 (accordion previously rendered raw key "advancedOptions"); Advanced accordion verified translated + now hosts Customer Email + Tax + Post-payment webhook/redirect/callback fields for new links (old 2nd tab removed).
Done so far in Phase C:
- NEW Components/UI/pay-link/LinkTypeSelector.tsx (LinkKind type; cards testids link-type-standard/donation; disabled in edit mode).
- NEW Components/UI/pay-link/DonationSettingsSection.tsx (DonationSettingsState + DonationErrors types; title/purpose/goal+currency Menu/min/presets editor (max 6, chips)/cover upload (file input → onUploadImage cb)/campaign-ends Menu/fee pills/4 toggle Switches; testids donation-title-input, donation-goal-input, donation-min-input, donation-preset-input/-add, donation-image-upload, donation-toggle-*).
- NEW Components/UI/pay-link/LivePreviewPanel.tsx (mock checkout card, donation or standard flavor, non-interactive, testid live-preview-panel).
- Components/UI/pay-link/index.ts exports the 3.
- ActionButtons.tsx + types/create-pay-link.ts: new requireAmount/extraDisabled props.
- utils/types/paymentLink.ts: PaymentLink.link_type/donation (PaymentLinkDonation), PaymentLinkData.linkType/donation.
- pages/pay-links/[slug]/index.tsx maps link_type + donation into paymentLinkData.
- Components/Page/CreatePaymentLink/index.tsx REWORKED: imports (LinkTypeSelector/DonationSettingsSection/LivePreviewPanel/axiosBaseApi, TabNavigation removed); linkKind/donationSettings/donationErrors/imageUploading state (+init & async-sync from paymentLinkData.donation for edit mode); handleUploadCampaignImage (multipart POST /pay/uploadCampaignImage); validateDonationSettings; handleCreatePaymentLink donation branch + donation apiPayload (link_type/title/goal_amount/min_amount/preset_amounts/allow_custom_amount/show_progress/show_supporters/auto_close_at_goal/campaign_image; customer_email skipped); success-modal reset resets donation state; JSX: outer flex wrapper + PanelCard(flex:1) + sticky 350px LivePreviewPanel (lg+ only), LinkTypeSelector replaces TabNavigation, donation mode renders DonationSettingsSection instead of PaymentSettingsBasic+DescriptionSection, Advanced accordion now hides email+tax for donations and hosts PostPaymentSettings for NEW links (old tab 2 deleted), feePreview gated to standard, ActionButtons gets requireAmount/extraDisabled.
- Components/Page/Payment-link/index.tsx mapping: linkType/donation; donation rows show campaign title + RAISED amount as value. PaymentLinksTable.tsx: donationChip + donationProgressBar helpers rendered in desktop description cell + mobile card.
- tsc baseline check: 94 errors BEFORE and AFTER my changes (all pre-existing; repo builds with ignoreBuildErrors:true). My files contribute 0 errors.

**Gotchas for a continuing agent:** tPaymentLink() is typed 1-arg — use t() from useTranslation('createPaymentLinkScreen') for new strings w/ defaultValue. Checkout i18n namespace is 'common' (donation.*). QA login for tests: hostbay@moxx.co / Katiekendra123@ (company_id 1, LIVE prod DB — always name test links "QA … DELETE ME" and delete them; never call createCryptoPayment/addPayment). Login API token path = data.accessToken. Frontend rebuild required after changes (standalone): next build + supervisorctl restart frontend. Preview URL: https://coin-checkout-5.preview.emergentagent.com

### 2026-07-10 — Session 16: Fresh container re-provisioned ✅
- Fresh container (no node_modules, no .env). Re-provisioned per documented procedure: SEQUENTIAL yarn installs /app (81s) then /app/backend (31s); 3 .env files from user continuation env (all app URLs → https://coin-checkout-5.preview.emergentagent.com, preview host first in CORS, fresh NEXTAUTH_SECRET, NEXT_PUBLIC_ENABLE_GITHUB_AUTH typo fix, OPENAI_API_KEY + SUPPORT_CHAT_MODEL=gpt-5.4); SAFETY overrides NODE_ENV=production / WORKER_ROLE=secondary / ENABLE_BACKGROUND_JOBS=false (verified in logs); next build standalone; public/ 42/42 intact after build. All health checks green (internal + external 200s, Google+GitHub SSO buttons, bad-creds 401, Railway PG + Redis + Tatum connected 40 rates).

### 2026-07-10 — Session 15: Customers redesign + Settings full redesign + landing WalletConnect learnings
- **Customers page redesign** (Components/Page/Customers/index.tsx rewrite, logic preserved): synthetic backend records humanized at display layer — classifyCustomer() on email pattern (legacy-api-…@dynopay.internal → "API payments", recovered-… → "Recovered payment", internal → hide fake email as italic "No customer details provided", API chip w/ tooltip hint). Dashboard-style stat cards (uppercase eyebrow + icon, big tabular-nums value), full-width layout (old maxWidth-centering gap removed), polished table (code-icon avatar for API records, right-aligned amounts, chevron), restyled detail dialog (avatar header, API-hint banner, info grid, dark balance card, outlined credit/debit buttons) + wallet modal. New i18n keys customers.apiCustomerName/recoveredCustomerName/noCustomerDetails/sourceApi/apiRecordHint/countLabel_one/_other ×6 locales. fmtAmount() helper fixes old string-into-formatNumberWithComma TS errors.
- **Settings full redesign** (pages/settings/index.tsx rewrite): now a REAL settings page — left rail (Profile & Security / Company / Payments / Webhooks / API Keys / Notifications, dark-pill active state, mobile horizontal chips) + inline right-column editing. ?section= URL sync; legacy ?tab=business|technical|personal mapped. Embeds: ProfilePage (with USER_PROFILE_FETCH + merged tokenData), ApiKeysPage (+create-key button when no key), NotificationPage, and CompanySettingsDialog in NEW inline mode. i18n settingsPage.* ×6 locales.
- **CompanySettingsDialog** gained `inline` + `visibleSections` props (Components/UI/CompanySettingsDialog/index.tsx): body extracted from PopupModal; sections filterable (company/crypto/webhook/payment); first visible section auto-expands; Cancel hidden inline; Delete Company only when company section visible. Settings uses: Company=[company], Payments=[crypto,payment], Webhooks=[webhook]. Submit logic 100% unchanged (full payload always sent).
- **UserMenu bug fix**: top-right "Settings" menu item routed to /profile (same as Profile item) → now /settings.
- **company.tsx latent crash fixed**: empty-state Add button referenced undefined setInitialValue/companyInitial/userState → now plain setAddOpen(true).
- **Landing (WalletConnect-inspired, user chose a+b)**: (a) HeroClean animated count-up stats row under CTA — 1,000+ Businesses / 15+ Chains / <1 min Avg settlement (CountUp rAF ease-out, prefers-reduced-motion safe, tabular-nums; marketing claims per user decision — real platform stats were $17,966/283tx/13 users, deemed too small). i18n heroStat* ×6 in landing.json. (b) NEW SectionPanel wrapper in Home/index.tsx — rounded 28px soft panels (light #F5F6F8 / dark rgba-white) grouping Compliance+ChainsRail, FeeCalculator, TestimonialsV2 for WalletConnect panel rhythm; section internals untouched.

- **Responsive sweep (mobile 390 / tablet 768 / desktop 1920, light+dark, done by main agent per user)**: landing hero stats verified single-row at all widths (measured via getBoundingClientRect — early "wrap" was a screenshot-scaling artifact), panels round correctly on mobile; customers stat-cards stack + table column-hiding + detail dialog OK on mobile/tablet; settings rail becomes horizontal scroll chips on mobile, all sections embed w/o overflow (scrollWidth==innerWidth at 390). FIXED during sweep: Components/UI/InfoBanner hardcoded #E8EBFB light-lavender bg made dark-mode text (#FAFAFA) unreadable (visible in Settings→Payments "set up USDT/USDC wallet" banner) → now theme-aware (dark: rgba(122,139,255,0.14) tint + border) — improves every InfoBanner usage app-wide.

### 2026-07-10 — Session 15: Fresh container re-provisioned ✅
- Fresh container (no node_modules, no .env). Re-provisioned per documented procedure: SEQUENTIAL yarn installs /app then /app/backend; 3 .env files from user continuation env (all app URLs → https://coin-checkout-5.preview.emergentagent.com, preview host first in CORS, fresh NEXTAUTH_SECRET, NEXT_PUBLIC_ENABLE_GITHUB_AUTH typo fix, OPENAI_API_KEY + SUPPORT_CHAT_MODEL=gpt-5.4); SAFETY overrides NODE_ENV=production / WORKER_ROLE=secondary / ENABLE_BACKGROUND_JOBS=false (verified in logs); next build standalone; public/ 42/42 intact. All health checks green (internal + external 200s, Google+GitHub SSO buttons, bad-creds 401, Railway PG + Redis + Tatum connected).

### 2026-07-10 — Session 14c: Notifications "Settings" tab crash fix ✅ VERIFIED (frontend agent)
- Prod bug: Settings tab on /notifications → ErrorBoundary. Root cause: NotificationItem (Settings-tab toggle rows) referenced bare `theme` with no `useTheme()` (top import had been renamed to staticTheme); shipped due to next.config `ignoreBuildErrors: true`. Fixed with `const theme = useTheme()` + removed unused import.
- Repo sweep (tsc "Cannot find name 'theme'"): fixed one more latent case — UserMenu/styled.tsx PopWrapper styled-factory missing ({ theme }) (component currently unused). No other instances.
- Known pre-existing cosmetic (NOT fixed): /_next/image 400 for /images/user_image.png avatar fallback.

### 2026-07-10 — Session 14b: Checkout cleanup + crypto page redesign ✅ VERIFIED (frontend agent 6/6, 1 minor test-selector note only)
- Removed checkout's decorative FloatingChatButton (pages/pay/index.tsx) and the dead "Dynopay Wallet" header button (Pay3Components/header.tsx, desktop + mobile drawer).
- Redesigned cryptoTransfer.tsx (VISUAL ONLY, logic intact): dropdown → coin TILE GRID (crypto-tile-<VALUE> testids, green #10B981 selected state), segmented network pills, fixed 196px QR card, mono address + amount (tabular-nums), Space Grotesk → var(--font-sans) everywhere (30×), consistent 10–14px radii. Verified live with user's real payment link (USDT→TRC20→QR/amount/countdown), light + dark.
- User-reported "Something went wrong" on prod payment link: NOT reproducible (prod + preview load fine; DO logs clean) — timing matched the 04:23–04:35Z rolling deploy (stale chunks). ErrorBoundary auto-reload regex extended to webpack mismatch signatures ("reading 'call'", "Unexpected token '<'").

### 2026-07-10 — Session 14: Emily chat parity + landing reorg + docs Try-It-Live + loader fade + public/ ROOT CAUSE ✅ VERIFIED (backend agent 11/11, frontend agent 11/13 + main agent completed the remaining 2)
- **ROOT CAUSE of recurring public/ deletion FOUND & FIXED**: Next.js cleanDistDir (lib/recursive-delete) follows directory symlinks; the shim's `ln -sfn /app/public .next/standalone/public` made every `next build` wipe /app/public → auto-commits recorded deletions → DO kaniko failures. Shim now COPIES public/ instead. DO deploy b2643132 (cd81f6c) ACTIVE; dynopay.com healthy.
- **Support chat → "Emily"** (Emergent parity, GIF skipped per user): renamed w/ green "Active" presence dot; per-message timestamps; built-in emoji picker (3 groups, no new deps); image/PDF attachments (paperclip → POST /api/support/chat/upload, multer 5MB, uuid names, served at /api/static/support-chat/) with thumbnails/chips in bubbles; Emily SEES image attachments via OpenAI vision (base64 image_url); history + escalation email include attachments; live Railway PG got 3 additive nullable columns on tbl_support_chat_message.
- **Landing reorg**: ProductShowcase moved directly under hero; "Watch 90s demo" button + DemoVideoModal removed from HeroClean (single CTA); TryItNow section removed from landing (component kept in tree).
- **URL fixes**: showcase slide 3 browser bar api.dynopay.com → dynopay.com/api; showcase cURL → real POST https://dynopay.com/api/user/createPayment with x-api-key.
- **Documentation**: new "Try It Live" section (#try-it, in sidebar) w/ sandbox curl + sample response (migrated from TryItNow); expanded endpoint cards now show full production URL https://dynopay.com/api/user/...; base URL already in hero pill + Overview.
- **RouteTransitionLoader**: added 240ms fade-out ("leaving" state), MIN_VISIBLE 500→350ms, prefers-reduced-motion. Verified via CDP-throttled probe (fade-in ~280ms, smooth fade-out, no hard cut) + in-app logged-in probe (dashboard/wallet/transactions/pay-links: never stuck, query-only changes show nothing, zero console errors).

### 2026-07-10 — Session 13c: "13 chains" copy + "Chat with us" login-redirect ✅ VERIFIED (frontend agent 5/5)
- Hero copy "Accept 13 chains" → "Accept 15+ chains" in landing.json ×6 locales + DemoVideoModal/HeroV2/ComparisonTable hardcoded copies (zero "13 chain" strings remain).
- FinalCTA "Chat with us" was <a href="/help-support"> (auth-gated → visitors bounced to login). Now a button (testid final-cta-chat) dispatching CustomEvent "dynopay:open-support-chat"; SupportChatWidget listens and opens in place. Verified: URL stays on /, panel opens, no chat message sent.

### 2026-07-10 — Session 13b: auth logos / font FOUT round 2 / ProductShowcase ✅ VERIFIED (frontend agent 13/15, all user issues resolved)
- **Auth logo fix**: AuthBrandPanel + login.tsx + register.tsx + reset-password.tsx + NewHeader now use dynopay-blackLogo.svg (light) / dynopay-whiteLogo.svg (dark) — old blue dynopay-logo.png removed from these. Register 600–1200px "no logo" gap fixed with CSS-responsive logo+controls row mirroring login (top-right controls bar now lg-only).
- **Font FOUT round 2**: prod dynopay.com still on pre-fix commit e35c0cb0 (deploys failing) — explains user's "still smaller then bigger" on prod. PLUS 20 remaining font-display:swap @font-face in styles/globals.css (Manrope + Urbanist/Outfit aliases) flipped to optional → built CSS now 0×swap / 22×optional; nav width verified stable.
- **NEW ProductShowcase** (Components/Page/Home/ProductShowcase.tsx, on landing between SupportedChainsRail and FeeCalculator): Emergent-style rounded gradient panel, coin chips flanking "Built for crypto commerce", browser mockup, 3-slide carousel (Checkout w/ animated Customer cursor + status pill → Forwarded ✓; Settlement w/ $12,480 count-up + new tx row + toast + You cursor; Developers w/ typewriter cURL + 201 Created + webhook 200 OK pill), arrows + elongated active dot, 9s auto-advance, pause-on-hover, reduced-motion safe, i18n showcase.* ×6 locales. Verified light+dark.
- Minor (non-blocking, not fixed): showcase-status-pill testid briefly duplicated during crossfade; 3 resource 404s on landing.
- ⚠️ PROD ACTION (user): push via "Save to GitHub" → DO autodeploy (includes session 13 deploy fix + all of the above).

### 2026-07-10 — Session 13: Fresh container re-provisioned + route-transition logo loader + DO deploy fix round 2
- Re-provisioned on fresh container (preview https://coin-checkout-5.preview.emergentagent.com); NOTE: run the two yarn installs SEQUENTIALLY (parallel installs corrupt the shared yarn cache with ENOENT .yarn-metadata.json). Safety overrides re-applied + verified; next build standalone; all health checks green.
- **NEW FEATURE — RouteTransitionLoader** (`/app/Components/Common/RouteTransitionLoader/index.tsx`, mounted in `_app.tsx`): Emergent-style full-screen pulsing DynoPay logo during page transitions. Router events, skips shallow/query-only changes, 250ms show-delay + 500ms min-visible anti-flicker, theme-aware frosted backdrop + correct logo variant per mode, z-index 2000, testid route-transition-loader. Verified both modes via Playwright.
- **DO DEPLOY FIX (round 2)**: auto-commit 3567cad2 (2026-07-10 02:22Z) deleted all 42 public/ files from git AGAIN (2nd time; kaniko lstat error killed every build since; last ACTIVE deploy f7e7c380 01:34Z). Restored public/ from 3567cad2^; **HARDENED Dockerfile**: new Stage 1b `srcguard` copies full context and falls back to new tracked mirror `assets/public-runtime/` (keep in sync: `cp -r public/. assets/public-runtime/`) when public/ is missing; frontend-builder uses `COPY --from=srcguard /src/public/ ./public/`. Backend tsc clean, local next build OK, DO spec has OPENAI_API_KEY already.
- ⚠️ PROD ACTION (user): push via "Save to GitHub" → DO autodeploy; deploy fix + loader live on dynopay.com only after redeploy.

### 2026-07-10 — Session 12: Fresh container re-provisioned + 4-issue fix batch ✅ VERIFIED (backend agent ALL PASS, frontend agent 5/5)
- Re-provisioned per documented procedure on fresh container; preview URL now https://coin-checkout-5.preview.emergentagent.com; safety overrides re-applied (NODE_ENV=production, WORKER_ROLE=secondary, ENABLE_BACKGROUND_JOBS=false); next build standalone; all health checks green.
- **Issue 3 (BACKEND — admin fee USDT "not activated")**: `/app/backend/services/tronEnergyService.ts::isRecipientActivatedForToken` — TronGrid `/v1/accounts/{addr}/tokens/trc20` now 404 (endpoint removed) AND TronScan fallback now 401 (key required) → EVERY USDT-TRC20 activation check failed → "assuming NEW recipient" default → 130k instead of 65k energy budgeted on every transfer/sweep (incl. to the admin fee USDT wallet TTve…, on-chain since Jul 2022). FIX: TronGrid `GET /v1/accounts/{addr}` (trc20 array parse via new `hasTrc20TokenBalance()`) + Tatum `GET /v3/tron/account/{addr}` fallback (TATUM_KEY). Verified: Binance hot wallet → true, admin wallet → false (real parse), calculateOptimalFeeLimit isNewRecipient=false → 65k path, old endpoint 404 confirmed. NOTE: admin USDT wallet currently holds 0 USDT on-chain (7.2 TRX + an unknown TVW3Wy… token), so activation for it correctly reads false until it holds USDT again — the FIX is that checks now return real data instead of always-false.
- **Issue 1a (FOUT size-jump)**: `geist/font/sans|mono` package exports hardcode font-display:swap → header text painted in smaller fallback then "grew". FIX: _app.tsx now declares Geist via next/font/local (src ../node_modules/geist/dist/fonts/...Variable.woff2) with `display: "optional"` — no mid-paint swap. Same CSS vars (--font-sans etc.) preserved.
- **Issue 1b (text too small)**: HomeHeader nav buttons 15px/400 → 16px/500 (lineHeight 24), StyledSignInButton 15→16, MobileNavItem 15.88→16.5/500, Get-started button 15→16, SystemStatusPill 11.5→12.5/500.
- **Issue 1c (flags/dropdown)**: LanguageSwitcher flag <Image>s now `unoptimized` (served directly from /_next/static/media — immune to prod sharp/optimizer failures; list flags 16→18px). Germany + Netherlands PNGs were 40×30 rectangles mismatching the circular set — regenerated as 64×64 circular tricolors (PIL, in /app/assets/Images/Icons/flags/). Dropdown polish: width 196, radius 10, neutral light hover/selected (was pale blue #E8F0FF), dark borders rgba-white (was navy #2A3D42 tints), item radius 8.
- **Issue 2 (blue logo)**: new near-black mark `/app/assets/Icons/home/dynopay-blackLogo.svg` (#4F46E5→#0A0A0B) used by HomeHeader in light mode (dark mode keeps white logo). Original blue SVG untouched at assets/Images/auth/dynopay-logo.svg.
- **Issue 4 (SOC2/GDPR unreadable)**: ComplianceLogoStrip — removed `filter: grayscale(1)` + opacity .85, label 13→14/600, sub 10.5→12 + text.secondary, header 11→12/600 text.secondary, stronger borders. PLUS theme-level tertiary contrast raise (`text.disabled`): homeTheme+theme.ts light #A1A1AA→#73737C (~4.6:1), dark #52525B→#86868F (~5:1); appTheme+authTheme same (dark #5B5B63→#86868F) — fixes the same dim text across FeeCalculator footnotes, HeroV2 microcopy, etc.
- ⚠️ PROD ACTION (user): push via "Save to GitHub" → DO autodeploy; fixes live on dynopay.com only after redeploy.


### 2026-07-10 — Session 11: Fresh container re-provisioned ✅
- Fresh container (no node_modules, no .env). Re-provisioned per documented procedure: `yarn install` /app + /app/backend; wrote /app/backend/.env, /app/.env, /app/frontend/.env with app URLs → https://coin-checkout-5.preview.emergentagent.com, preview host first in CORS, fresh NEXTAUTH_SECRET, GitHub creds from colon-syntax (Client ID Ov23liBuaGCFqNpp2QzW), EXT_PUBLIC typo → NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true. Ran `next build` (standalone) — required by the frontend shim (`node .next/standalone/server.js`). SAFETY overrides: NODE_ENV=production, WORKER_ROLE=secondary, ENABLE_BACKGROUND_JOBS=false (all cron/sweeps/webhook-worker skipped — verified in logs). Health: Railway PG + Redis + Tatum OK (40 rates), internal+external /api/ /health /auth/login = 200, Google+GitHub SSO buttons render, bad-creds 401.

### 2026-07-09 — Session 9c: Fee-wallet balance bug fix + Prod-mode frontend + Geist typography refresh ✅
Three P0/P1 tasks in this session:

**1. Fee-wallet balance staleness/zero fix** (P0 — user report: "TRX fee wallet balance may not be updating properly. sometimes it says zero"):
- Root cause in `/app/backend/controller/adminController.ts::getFeeWalletBalance` (lines 436-485):
  1. Called `tatumApi.getAddressBalance()` WITHOUT `skipCache=true` → returned Redis-cached value (10-min TTL)
  2. No try/catch → any Tatum error (network flap, `account.not.found`) propagated
  3. No NaN/null guard before `adminFeeModel.update({ amount })` → the internal fallback `'0'` from tatumApi.ts:2307 (for TRX `account.not.found`) permanently overwrote `tbl_admin_fee_wallet.amount` with 0
- Fix mirrors already-correct pattern from `paymentController.ts::checkFeeBalance` (line 1370-1415): `skipCache=true` + try/catch that keeps DB value on error + `Number.isFinite()` guard on write.
- Verified live via `/app/backend/scripts/quick_verify_fee_wallet.js`: ETH `0.01283…` ✓ in sync, TRX `133.73` ✓ in sync. Endpoint returns 403 unauth'd = routing intact.

**2. Frontend switched from `next dev` → production `next start`** (user request due to Playwright/MCP timeouts on dev-mode cold compiles):
- `/app/frontend/package.json` `start` → `next start -p 3000 -H 0.0.0.0` (was `next dev`).
- `/etc/supervisor/conf.d/supervisord.conf` `[program:frontend]` env → `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`, `NODE_OPTIONS=--max-old-space-size=4096`.
- `yarn build` completed (18/18 static pages, standalone output emitted); `supervisorctl reread + update + restart frontend` → RUNNING pid 609.
- **Perf gains (external URL)**: `/auth/login` 14,590ms → **318ms** (46× faster); `/` 8,462ms → **753ms** (11× faster); internal `/auth/login` 12,437ms → **40ms** (~200× faster).
- Note: NO impact on DigitalOcean prod which was already using `next build && node .next/standalone/server.js` in Dockerfile.

**3. Geist Sans + Geist Mono typography refresh** (user: "fonts on the entire application… more clean like other major platforms and readable, especially in dark and light mode"). Design agent chose Option 1: Geist for entire app (marketing + auth + in-app).
- Installed `geist@1.7.2` (Vercel's OSS typeface). Loaded via `next/font/local` in `/app/pages/_app.tsx` — CSS vars `--font-sans` / `--font-mono` / `--font-display` injected via `<style>` in `<Head>`.
- `/app/next.config.mjs`: added `"geist"` to `transpilePackages` to resolve `ERR_UNSUPPORTED_DIR_IMPORT` on `next/font/local` at static-generation time (known Next.js Pages Router + geist@1.x issue).
- `/app/styles/theme.ts`: `fontWeightRegular: 500 → 400` (the crucial "muddiness" fix); light text tokens `#242428/#676768/#ACACAC → #18181B/#71717A/#A1A1AA`; dark tokens `#E8E8EC/#A0A1A5/#606060 → #FAFAFA/#A1A1AA/#52525B` (WCAG AAA verified). Same swap applied to lightTheme + darkTheme (checkout).
- `/app/styles/theme2.ts` + `theme.ts` + `homeTheme.ts` + `homeBento.ts`: `fontFamily: "'Manrope', sans-serif"` → `"var(--font-sans), 'Manrope', sans-serif"` (replace_all across all typography scale variants).
- `/app/styles/globals.css`: html/body → `font-family: var(--font-sans, "Manrope"), ...`; added `font-feature-settings: "cv11", "ss01"` (Geist stylistic set: distinct 0, better a); dark body `#E8E8EC → #FAFAFA`; new helper classes `.tabular-nums`/`.amount`/`.balance`/`.mono`/`.address`/`.txid` with `font-variant-numeric: tabular-nums`; CSS custom props `--text-primary/secondary/tertiary` exposed on both `[data-theme]` roots.
- **Bulk inline-style sweep**: 34 files under `/app/Components + /app/pages` had hard-coded `fontFamily: "OutfitMedium/OutfitBold/OutfitRegular"` and `"'Unbounded', ..., system-ui, sans-serif"` — all replaced with `"var(--font-sans), system-ui, sans-serif"` via `sed`. Also `AuthBrandPanel.tsx` FONT_DISPLAY constant + `documentation.tsx` conditional font.
- `/app/pages/_document.tsx`: removed Google Fonts preconnect + Unbounded/JetBrains Mono `<link>` + all 4 Manrope woff preloads (Geist supersedes; legacy woffs kept in /public/fonts as pure fallback).
- **Verified via Playwright audit**: `body { font-family: __GeistSans_8adcd2, __GeistSans_Fallback_8adcd2, ... }`, `body-weight: 400`, `h1-weight: 600`, `--font-sans: __GeistSans_8adcd2, ...` — Geist confirmed rendering across body + h1 + hero in production build.

### 2026-07-09 — Session 9b: "Select All" wallet fix on Create Payment Link ⏳ CODE APPLIED, RUNTIME UNVERIFIED
User (hostbay@moxx.co): "select all only captures 5 unless I click show all first, despite 13 wallets saved." Root cause: `selectAll` action mapped over sliced `cryptoItems` (top 5 shown in collapsed grid). Fix: `/app/Components/UI/pay-link/CryptoSelection.tsx` `selectAll` now iterates full `allCryptoItems` (15 supported) filtered by `walletNotSetUp`, and calls `setShowAllCoins(true)` to auto-expand. `/app/Components/Page/CreatePaymentLink/index.tsx` passes `allCryptoItems={ALL_CRYPTO_ITEMS}` (line 1069). Testing agent + browser automation both timed out on MCP transport (platform infra issue; user emailed support@emergent.sh). Manual verification pending.

### 2026-07-09 — Session 9: Fresh container re-provisioned ✅
- Fresh container (no node_modules, no .env). Re-provisioned per documented procedure: `yarn install` /app + /app/backend; wrote /app/backend/.env, /app/.env, /app/frontend/.env with app URLs → https://coin-checkout-5.preview.emergentagent.com, preview host first in CORS, fresh NEXTAUTH_SECRET, GitHub creds from colon-syntax (Client ID Ov23liBuaGCFqNpp2QzW), EXT_PUBLIC typo → NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true. SAFETY overrides: NODE_ENV=production, WORKER_ROLE=secondary, ENABLE_BACKGROUND_JOBS=false (all cron/sweeps/webhook-worker skipped — verified in logs). Health: Railway PG + Redis + Tatum OK, internal+external /api/ /auth/login = 200, Google+GitHub SSO buttons render, bad-creds 401.

### 2026-07-09 — Session 8b: Typography standardization to Manrope ✅ VERIFIED
User: "our in-app fonts are not so good, including auth pages — recommend something better?" → selected Option A (Manrope primary, keep app UI cohesive).
- **Self-hosted Manrope** (`.woff` L/R/M/SB/B/EB) at `/app/public/fonts/Manrope-*.woff` (verified served: `curl /fonts/Manrope-Regular.woff` → 200 both internal + external preview).
- **Non-destructive alias approach in `/app/styles/globals.css`**: legacy family names (`UrbanistLight/Regular/Medium/SemiBold/Semibold/Bold/ExtraBold` + `OutfitLight/Regular/Medium/SemiBold/Bold/ExtraBold`) declared as `@font-face` pointing at the matching Manrope weight file. ~1000 existing `fontFamily: "UrbanistX"` refs in `sx`/inline styles now render Manrope with **zero component changes**. Global `body { font-family: "Manrope", -apple-system, ... }` primary.
- **Theme files cleaned**: `/app/styles/theme.ts`, `appTheme.ts`, `theme2.ts` — legacy `Urbanist`/`Poppins` typography.fontFamily replaced with `Manrope`.
- **Preload updated**: `/app/pages/_document.tsx` preloads Manrope Regular/Medium/SemiBold/Bold (was Urbanist).
- **Verified**: `/auth/login` computed body `font-family = "Manrope, -apple-system, ..."`; rendered HTML shows `font-family:'Manrope',sans-serif` inline + `<link rel=preload href="/fonts/Manrope-*.woff">`; visual screenshot confirms cohesive Manrope across headline, form, buttons, metrics (no layout breakage). Note: original Option A also mentioned optional Unbounded (auth hero) + JetBrains Mono (amounts/OTP) accents — NOT applied yet, pending user opt-in.

### 2026-07-09 — Session 8: Fresh container re-provisioned ✅
- Fresh container (no node_modules, no .env). Re-provisioned per documented procedure: `yarn install` /app + /app/backend; wrote /app/backend/.env, /app/.env, /app/frontend/.env with app URLs → https://coin-checkout-5.preview.emergentagent.com, preview host first in CORS, fresh NEXTAUTH_SECRET, GitHub creds from colon-syntax (NEW Client ID Ov23liBuaGCFqNpp2QzW). SAFETY overrides: NODE_ENV=production, WORKER_ROLE=secondary, ENABLE_BACKGROUND_JOBS=false (all cron/sweeps/webhook-worker skipped — verified in logs). Health: Railway PG + Redis + Tatum OK, internal+external /api/ /auth/login = 200, SSO buttons render, bad-creds 401.

### 2026-07-09 — Session 7b: GitHub auth button redesign ✅ (visually verified light+dark; frontend agent NOT run — presentational only)
User: GitHub logo on auth pages "looks disconnected or small" (was an 88×48 icon-only pill under the big Google pill).
- `Components/Common/SocialAuthButtons.tsx::GithubAuthButton` → full-width labeled pill matching GoogleAuthButton geometry (100%×48, radius 24, same typography/hover), new optional `label` prop (falls back to ariaLabel); GitHub mark inside 28px circle mirroring the G-logo circle (light mode: dark #131314 circle + white mark on #f7f7f7 outlined pill; dark mode: white circle + dark mark on rgba(255,255,255,0.06) pill). SocialAuthButtons wrapper gained `githubLabel` passthrough.
- login.tsx + register.tsx pass `githubLabel={t("continueWithGithub")}` (key already existed ×6 locales). OAuth handlers untouched. testids unchanged (github-login-btn / github-signup-btn). tsc error set identical to baseline (106 pre-existing, 0 new).
- Verified via screenshots: login light (386×48 "Continue with GitHub" under Google) + register dark — cohesive stacked pill group.

### 2026-07-08 — Session 7: 3-bug batch (crypto rounding / empty volume chart / transparent nav) ✅ VERIFIED (backend agent 4/4, frontend agent 3/3)
User reported 3 bugs (screenshots from prod dynopay.com; user had already pushed — all 3 reproduced in current code):
- **Issue 1 — long crypto amounts in notifications** ("received 0.00033163515000000004 BTC"): backend built messages with raw JS floats. NEW `formatCryptoAmount(amount, currency)` in backend/utils/currencyUtils.ts (8 decimals crypto / 2 stables via /USDT|USDC|BUSD|DAI|USD|EUR|GBP|BRL/, trims trailing zeros, toFixed → no sci-notation) applied at: cryptoSettlement.ts payment-received notification, pendingPaymentService.ts pending+partial×2, cryptoCheckout.ts incomplete-payment msgs×2, emailService.ts first-payment subject+row + `${cryptoAmount} ${cryptoCurrency}` rows×5. Frontend: `roundLongDecimalsInText()` in utils/currencyFormat.ts (regex \d+\.\d{9,} → toFixed(8) trimmed) applied in NotificationPage message render so HISTORICAL stored messages display rounded (DB untouched; RecentTransactionsWidget already rounded).
- **Issue 2 — Transaction Volume chart "There is no data to show" for hostbay**: ROOT CAUSE = RootSaga `debounce(400, DASHBOARD_INIT, DashboardSaga)`; on dashboard mount DASHBOARD_CHART_FETCH + DASHBOARD_FETCH_ALL (dispatched by 4 useDashboardData consumers) land in the same window → chart request NEVER fired (confirmed: 0 network calls); empty chartData → dummy "Feb 5–11" fallback mapped onto current week → all-zero → empty-state. Diagnosis: prod BACKEND returned correct data via direct API (read-only login) — bug purely FE dispatch. FIX: new `DASHBOARD_CHART_INIT` wrapper + `DashboardChartAction` (Actions/DashboardAction.ts, re-exported in Actions/index.ts), extracted `fetchChartSeries` + exported `DashboardChartSaga` (DashboardSaga.ts), `takeLatest(DASHBOARD_CHART_INIT, DashboardChartSaga)` in RootSaga (main channel stays debounced), reducer DASHBOARD_CHART_INIT → chartLoading:true, useDashboardData.fetchChartData dispatches DashboardChartAction. tsc baseline preserved (104 pre-existing errors, 0 new; backend tsc clean).
- **Issue 3 — transparent floating bottom nav** (mobile + all viewports < lg incl. tablets/small windows via Containers/Client): NavigationBar pill used translucent `primary.light` (rgba(10,10,10,0.06) light / rgba(204,255,0,0.14) dark) as background → content bled through. FIX in MobileNavigationBar/styled.tsx: `backgroundColor: background.paper` + tint layered via `backgroundImage: linear-gradient(0deg, primary.light, primary.light)` — identical look, fully opaque. Desktop Header/UserMenu/CompanySelector/NewSidebar audited: already opaque paper (primary.light there = hover/active tints only — fine).
- **Verified**: backend agent — formatCryptoAmount 10/10 unit, chart 7d/company 1 → 200 w/ 7/8 non-zero buckets ($368.28 Jul 2), notifications list 200, /api/ + csrf 200, wrong-pw 401, READ-ONLY respected. Frontend agent — chart fires 200 + renders (no empty-state), /notifications zero \d+\.\d{9,} matches, mobile pill computed rgb(255,255,255)+gradient & no bleed-through.
- ⚠️ **PROD ACTION (user)**: push via Save to GitHub → DO rebuild; all 3 bugs live on dynopay.com until redeployed. No DigitalOcean API key needed (deploy pipeline fine; bugs were in code).

### 2026-07 — Fresh container re-provisioned (session 7) ✅
- Fresh container: no node_modules, no .env files. Re-provisioned from user-supplied `<continuation_request>` .env: `yarn install` in /app + /app/backend; wrote /app/backend/.env, /app/.env, /app/frontend/.env with all app URLs → https://coin-checkout-5.preview.emergentagent.com, preview host first in CORS, fresh NEXTAUTH_SECRET, GitHub creds converted from colon-syntax. SAFETY overrides: NODE_ENV=production, WORKER_ROLE=secondary, ENABLE_BACKGROUND_JOBS=false (user env said true — deliberately overridden; all cron/sweeps/webhook-worker/emails skipped — verified in logs). Health: Railway PostgreSQL + Redis + Tatum connected, internal :8001 + :3000 = 200, external preview /api/ + / + /auth/login = 200 (Google+GitHub SSO buttons render), bad-creds login → 401. Binance geo-blocked → CoinGecko fallback (expected).

### 2026-07-08 — Session 5d: Password login skips OTP + $500 fee-free welcome popup ✅ VERIFIED (backend 7/7, frontend 3/3 + re-test 7/7)
User reported: (1) existing users (e.g. hostbay) logging in WITH password were still asked for email OTP; (2) wanted a celebratory popup so new merchants know about the $500 fee-free allowance the moment they onboard.
- **Login fix (backend only)**: userController.ts — extracted `finalizeLogin(userData, req, res, logPrefix)` helper (2FA requires_2fa check [dormant, preserved], device/IP parse, geo, tbl_login_activities record, login-notification email, last_login_ip, createSession, "Login Successful!" response). POST /api/user/login now calls it DIRECTLY after correct password (no more login_otp Redis + sendLoginOTPEmail). verifyLoginOTP refactored onto the same helper — passwordless email/SMS OTP login paths unchanged. Frontend saga ALREADY handled the direct response shape (data.userData+accessToken → USER_LOGIN) — zero FE changes. Lockout/failed-attempt machinery intact (verified 401 on wrong password).
- **Fee-free popup**: NEW Components/Modals/FeeFreeWelcomeModal.tsx mounted in pages/dashboard.tsx. Shows once when GET /api/company/fee-free-status → is_fee_free && fee_free_remaining_usd>0. Brand design: $500 black/lime badge w/ glow, framer-motion confetti (18 looping pieces), CTA → /create-pay-link, dismiss, footnote. i18n fees.json ffWelcome{Badge,Title,Body,Cta,Dismiss,Footnote} ×6 locales. testids fee-free-welcome-modal/-cta/-dismiss.
- **GOTCHAS fixed after 1st frontend run**: (a) storage key was Redux userState.email-based → empty right after reload → key mismatch → popup re-showed; NOW identity decoded synchronously from JWT `token` in localStorage (email||uid), flag `ff_welcome_shown:<email>` written AT SHOW TIME (once-semantics without clicks) + on dismiss/CTA. (b) CTA closed modal before router.push (unmount race) → now marks flag + navigates without closing.
- **Verified**: backend agent 7/7 (direct login w/ userData+accessToken & NO requires_login_otp; wrong-pw 401; missing-pw 400; verifyLoginOTP bogus-session 400; fee-free-status 200 remaining=500; /api/ 200; github-signin fake 401). Frontend agent: password login → dashboard with NO OTP dialog PASS; popup shows for qa.onboard w/ $500+confetti; reload no-reshow; key-removal reshow; CTA → /create-pay-link; hostbay (remaining $0) never sees popup.

### 2026-07-08 — Session 5c: Round-2 fixes (shimmer visibility + wallet edit/add currency selector) ✅ VERIFIED (frontend agent 3/3 PASS)
User reported: (1) shimmer "nothing looks different", (2) editing a BTC wallet showed only RLUSD options, (3) add-wallet similar.
- **Shimmer**: boosted visibility in AsciiShimmer.tsx (maxA 0.26 light / 0.30 dark, font 13px, wider edge density, higher alpha floors). Verified on EXTERNAL preview URL: 8.8k–18.7k painted pixels. NOTE: user may have checked prod dynopay.com which has NOT been redeployed.
- **ROOT CAUSE wallet dropdowns**: useWalletData().cryptocurrencies = ALLCRYPTOCURRENCIES minus already-added wallets. Merchant w/ 13/15 wallets → dropdown legitimately only RLUSD+RLUSD-ERC20. EDIT dialog reused this filtered list → wallet's own currency (BTC) excluded.
- **FIX**: CryptocurrencySelector new props `locked` (edit mode: no dropdown ever renders `{isOpen && !locked}`, lock icon, cursor default, data-locked attr) + `showAllWithDisabled` (add mode: lists ALL 15 currencies; already-added disabled w/ "Added" badge — key walletScreen:alreadyAdded ×6 locales). AddWalletModal passes locked={editMode} showAllWithDisabled={!editMode}; content wrapped in [data-testid="edit-wallet-dialog"/"add-wallet-dialog"] for scoped tests (PopupModal `keepMounted` keeps BOTH modal DOMs mounted on /wallet — first agent run force-clicked the hidden add-modal trigger → false FAIL).
- **QA FIXTURE**: tbl_user_wallet wallet_id=15 inserted (user_id=3 qa.onboard, company_id=2, BTC, 1JH5Tn…) so qa.onboard has 1 wallet — enables add/edit dialog testing (hostbay has all 15 → Add button hidden).
- **Verified 3/3 by frontend agent (scoped, no force-clicks)**: edit dialog locked (BTC shown, dropdown never opens), add dialog 15 options w/ BTC disabled+Added badge & ETH selectable, homepage shimmer 18.7k painted px. Lock icon "not visible" note = SVG offsetWidth quirk; visually confirmed rendered.

### 2026-07-08 — Session 5b: GitHub OAuth sign-in ✅ VERIFIED (backend 4/4; frontend agent NOT yet run)
User supplied GitHub OAuth App creds (Client ID Ov23liyOOHYelH9Y6Vp0; secret in /app/backend/.env only). Full flow implemented:
- **DB (production Railway PG — shared by preview+prod)**: `ALTER TYPE enum_tbl_user_login_type ADD VALUE 'GITHUB'` executed (additive/safe); userModel enum list updated. GitHub identity stored in existing `external_id` column PREFIXED `github:<id>` (column shared w/ Facebook raw ids — prefix avoids collision; NO schema change needed).
- **Backend**: `userController.ts::githubSignIn` (POST /api/user/github-signin {code, redirectUri?}) mirrors googleSignIn: exchanges code at github.com/login/oauth/access_token server-side (secret never in browser), fetches /user + /user/emails (handles private-email accounts; requires a VERIFIED GitHub email else 400), upserts by email OR external_id, sets email_verified=true + login_type GITHUB on create, provisions FIAT+CRYPTO wallets, welcome email + admin notification, returns same session shape as google-signin. Route in userRouter.ts w/ moderateRateLimiter. Endpoint is CSRF-protected (GET /api/csrf-token → x-csrf-token header + dynopay_csrf cookie).
- **Frontend**: `pages/auth/github/callback.tsx` (validates `state` vs sessionStorage gh_oauth_state, POSTs code+redirectUri, dispatches USER_LOGIN → /dashboard; error/denial → toast + /auth/login). `handleGithubLogin` in login.tsx + register.tsx redirects to github authorize w/ scope "read:user user:email". GithubAuthButton (icon pill under Google pill) shows when NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true. i18n: continueWithGithub ×6 + authGithubCallback page titles ×6 + _app.tsx route mapping.
- **Env**: backend/.env GITHUB_CLIENT_ID/SECRET; /app/.env NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true + NEXT_PUBLIC_GITHUB_CLIENT_ID. **Dockerfile + Dockerfile.frontend**: added ARG/ENV for NEXT_PUBLIC_ENABLE_GITHUB_AUTH + NEXT_PUBLIC_GITHUB_CLIENT_ID (same silent-drop gotcha as the Google flag).
- **Verified**: backend agent 4/4 (400 no-code / 401 fake-code / 403 no-CSRF / regression google-signin 401 + /api/ 200). Browser: GitHub icon button renders on login, click → github.com authorize w/ correct client_id, /auth/github/callback w/o code bounces to login.
- ⚠️ **PROD ACTIONS NEEDED (user)**: (1) push via Save to GitHub so DO rebuilds; (2) add GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET (RUN_AND_BUILD_TIME) + NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true + NEXT_PUBLIC_GITHUB_CLIENT_ID to DO env; (3) OAuth app callback must be exactly https://dynopay.com/auth/github/callback. Preview end-to-end can't complete unless a 2nd dev OAuth app w/ preview callback is created.

### 2026-07-08 — Session 5: Admin token fix + email redesign + Emergent-style auth buttons + ASCII hero shimmer + page titles ✅ (backend verified 3/3; frontend agent NOT yet run)
User approved 6 items (order 5→1→4→2→6→3). Items 1,2,4,5,6 DONE; item 3 (GitHub auth) WAITING on user's GitHub OAuth Client ID + Secret (callback https://dynopay.com/auth/github/callback; optional 2nd dev app for preview callback).
- **Item 5 (bug)**: Admin token invisible on API Keys page. ROOT CAUSE: legacy `tbl_api.adminToken` NULL on newer rows; real value in `admin_token`; UI read only `apiRow.adminToken`. FIX: backend `apiController.ts::getApi` formattedData normalizes `adminToken: api.admin_token || api.adminToken || null`; frontend `ApiKeysPage.tsx` falls back to `admin_token`. Verified via API (128-char token returned).
- **Item 1 (emails)**: Master template `backend/utils/emailTemplate.ts` redesigned to brand black #050505 + neon lime #CCFF00 (per design_guidelines.json): 5px lime accent bar, black header/footer, lime footer tagline, black CTA pill w/ lime text (inverts in dark mode via `.btn` override), dark OTP block w/ lime digits, softer rounded boxes, full new `prefers-color-scheme: dark` palette (zinc #18181b card). Swept legacy navy/indigo (#0d1f5c/#4F46E5 → #0a0a0a) in emailService.ts + helper/sendEmail.ts. FIXED pre-existing bug: buttonBlock emitted stray `<tr>` outside any table (broke card layout) — now wrapped in own `<table>`. QA script: `backend/scripts/render_email_previews.ts` renders 3 samples to /tmp/email_preview/ (screenshot-verified light+dark). All ~40 emails inherit; dark mode is client-controlled via media query (user asked — device controls it).
- **Item 4 (auth buttons)**: NEW `Components/Common/SocialAuthButtons.tsx` (GoogleAuthButton pill — dark #131314 w/ G-logo in white circle, light-inverted in dark theme; GithubAuthButton icon pill gated by NEXT_PUBLIC_ENABLE_GITHUB_AUTH). login.tsx: replaced tiny circular G icon + "Register / Login with" text; removed GoogleIcon/ImageCenter imports; added `handleGithubLogin` (OAuth redirect w/ state in sessionStorage `gh_oauth_state`, redirect_uri `{origin}/auth/github/callback`). register.tsx: replaced outlined CustomButton; ALSO ported GIS token-client flow from login (was NextAuth-only signIn which the K8s proxy intercepts) + same GitHub handler. Both sections now gate on google||github flag. testids: google-login-btn/github-login-btn/google-signup-btn/github-signup-btn.
- **Item 2 (hero animation)**: NEW `Components/Page/Home/AsciiShimmer.tsx` — canvas ASCII/char-matrix shimmer like app.emergent.sh/landing (chars dense at L/R edges, center clear, ~11fps mutate, eases alpha; pauses off-screen/hidden tab; static render for prefers-reduced-motion or <600px; DPR cap 1.5). Mounted in `Components/Page/Home/index.tsx` wrapping HeroClean (NOT HeroV2 — HeroV2 is dead code, edits reverted). Screenshot-verified light+dark.
- **Item 6 (page titles)**: _app.tsx routeKeyMap covers all routes now — added `/auth/secure-account` → authSecureAccount; added `authSecureAccount_title/_desc` to pageTitles.json ×6 locales; fixed nl `wallet_title` → "Crypto-wallets | DynoPay". Note: blogTitle/blogDescription keys are DEAD (unused); blog posts + SEO landing pages set own titles from content. check-i18n.mjs parity PASS.
- **Backend testing agent 3/3 PASS**: (A) getApi adminToken non-empty & equals admin_token; (B) email render script exit 0, brand colors present, old colors absent, tables balanced, CTA in own table; (C) regression /api/, /api/csrf-token, /api/dashboard, /api/dashboard/fee-tiers, /api/pay/calculateFees (1.5%) all 200.

### 2026-07-08 — Fresh container re-provisioned (session 5) ✅
- Fresh container: no node_modules, no .env files → frontend FATAL. Re-provisioned from user-supplied `<continuation_request>` .env: `yarn install` in /app + /app/backend; wrote /app/backend/.env, /app/.env, /app/frontend/.env with all app URLs → https://coin-checkout-5.preview.emergentagent.com, preview host in CORS, fresh NEXTAUTH_SECRET. SAFETY overrides: NODE_ENV=production, WORKER_ROLE=secondary, ENABLE_BACKGROUND_JOBS=false (user env said true — deliberately overridden; all cron/sweeps/emails skipped — verified in logs). Health: Railway PostgreSQL + Redis connected, internal /api/ /health /api/csrf-token = 200, external preview /api/ + / + /auth/login = 200. Binance geo-blocked → CoinGecko fallback (expected).

### 2026-07-08 — Copy accuracy ("Keep it" → "Straight to your wallet") + hardcoded-English i18n sweep ✅ (smoke-verified, frontend agent NOT yet run)
User: "Keep it" hero implied custody — funds are actually forwarded instantly to the merchant's saved wallet unless auto-convert is on. Also asked: translate ALL hardcoded English end-to-end. Approved option (a).
**Copy rewrite (14 keys × 6 locales = 84 values + 2 TSX):** landing.json (heroTitle/heroHighlight/heroSubtitle/heroCleanTitle/heroCleanSubtitle/goLiveCard2Description/feature3Description/feature5Description/coreValue1Description/whyChoose2Description/faq2A), auth.json (brandHeadlineLine2 + brandSubtitle — the latter wrongly said "We instantly turn it into stable USDT" i.e. always-on conversion), pageTitles.json default_desc, _app.tsx JSON-LD, HeroV2.tsx dead-code fallbacks. New EN hero: "Accept crypto. Straight to your wallet — or auto-converted to stablecoins." All locales mirror it.
**i18n sweep (~65 strings, 3 groups, ×6 locales):**
- Group A checkout: Components/Page/Payment/{BankAccount,BankTransfer,Crypto,GooglePay,MobileMoney,QRCode,USSD}Component.tsx had ZERO i18n → wired useTranslation("common") + ~21 new common.json keys (pleaseWait, transferRate, completedPayment, ussdDialInstruction w/ {{bank}}, paymentSuccessful, paymentFailed, paymentFailedBody, returnHome…). Also pages/payment/{index,success,failed}.tsx, Pay3Components/success.tsx, PaymentLinkSuccessModal (cross-ns t("common:scanQrPayWallet")).
- Group B in-app: Wallet empty-dialog (walletScreen: noActiveWallets*), NotificationPage (notifications ns), EmailVerificationBanner/DeleteWalletModal/DashboardSetupPrompt/SaveChangeModel/AreaChart(Chart cmp)/FeeFreeWidget/EmptyDataModel → common keys; CompanySelector (dashboardLayout:switchedToCompany), CompanyDetailsSection+company.tsx (companyDialog: noResultsFound/addCompanyBtn/noCompaniesYet/createFirstCompanyBody), PaymentLinksTopBar (paymentLinks:allStatuses), CreatePaymentLink (youReceive), Footer (common:poweredByDynopay). ErrorBoundary (class!) + LiveBrandContent (module-level JSX) use direct `i18n.t("common:…")` via `import i18n from "@/i18n"`.
- Group C public: TryItNow/DemoVideoModal/ExitIntentModal/HomeFooter/SEOLandingPage/blog UI → landing keys (liveCheckoutLabel, startFree, exitIntentTitle, viewApiDocs, footerByCountry/Industry, readTheGuide, createFreeAccount, blogPostNotFound/ReadyCta/Subtitle); help-support/[slug] (helpAndSupport: articleNotFound/backToHelpSupport/feedbackThanks/wasArticleHelpful); system-status (apiStatus: noRecentIncidents/autoRefresh60); pay/demo.tsx (common demo keys).
**Deliberately left English (57 strings):** admin/* + AdminHeader + QA.tsx (internal operator tools), documentation.tsx (dev API docs), KB article body (getting-started slug), pay/success-demo internal toggles, "Dynopay Payments Ltd." (legal name).
**Verified:** all locale JSONs valid; check-i18n.mjs parity PASS; pages 200 (/,/payment/*,/wallet,/company,/notifications,/blog,/system-status,/pay/demo,/auth/login,/referrals); PT+EN screenshot smoke: new hero copy renders both langs, /payment/failed fully PT, auth brand panel PT non-custodial copy. Frontend testing agent NOT yet run (needs user permission).

### 2026-07-08 — PROD bug fix: Google auth button missing on DigitalOcean ✅ VERIFIED (4/4 by testing agent)
User: dynopay.com (DO App Platform, app id f86b27dc-feb0-4a44-a4e9-ebd2053e0468, repo databasedyno/DynoRedesign@New-Onboarding, dockerfile_path=/Dockerfile, deploy_on_push=true) doesn't show Google button despite NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true in DO env. Investigated via user-supplied DO API token.
- ROOT CAUSE: DO spec HAS the env (scope RUN_AND_BUILD_TIME, passed as docker build-arg) but the Dockerfile frontend-builder stage never declared `ARG NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` — Docker silently drops undeclared build args → `yarn build` inlined undefined → flag false in prod bundle → button hidden (login.tsx ~1818 / register.tsx ~420 gate on === "true").
- FIX: added `ARG NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=` + `ENV ...=${...}` before `RUN yarn build` in BOTH /app/Dockerfile and /app/Dockerfile.frontend.
- Verified 4/4: Dockerfiles static ✅; preview shows button on login+register and click invokes GIS initTokenClient with client_id 163670787265-… ✅; prod dynopay.com/auth/login confirmed button ABSENT (pre-fix build) ✅; preview /api/ + /api/csrf-token 200 ✅.
- ⚠️ PENDING USER ACTION: push to GitHub (Save to GitHub → New-Onboarding) so DO rebuilds — agents must not git-push.
- 🔎 BONUS FINDING (not yet fixed): DO env NEXTAUTH_SECRET is the literal string "openssl rand -base64 32" (the command, not a secret). Harmless for primary GIS flow (/api/user/google-signin) but breaks NextAuth fallback (/api/auth/*). Offer to fix via DO API (triggers redeploy).

### 2026-07-08 — Language detection: IP wins over browser language for first-time visitors ✅ VERIFIED (4/4)
User (US IP) saw Portuguese — root-caused: browser-language previously took effect before async IP geo-detect, and a sticky `lang_manual` choice bypasses geo forever. User picked option (b): IP-based detection should WIN for first-time visitors.
- `i18n.js::applyDetectedLanguage()` restructured: RETURNING visitors (saved `lang`) → apply saved lang instantly, geo refines in background (non-manual only). FIRST-TIME visitors → stay on SSR English, AWAIT `/api/geo-detect`, apply country locale; fall back to browser/timezone (`clientDetectedLang`) ONLY if geo lookup fails.
- `detectAndApplyGeoLocale()` now returns boolean (lookup success), persists `lang` even when no switch needed.
- **Critical gotcha fixed during testing**: `i18n.init()` (LanguageDetector `caches:["localStorage"]` + `languageChanged` listener) writes `lang=en` into localStorage DURING init — a live localStorage read inside `applyDetectedLanguage` made every visitor look like a returning "en" user (broke browser-fallback AND wiped manual pt). Fix: new module-load-time snapshot `savedLangAtBoot` (captured before init) used instead of live read.
- Verified via browser automation (pt-BR navigator override, US egress IP): (1) first-time pt-browser+US-IP → English, ZERO pt flash; (2) first-time + geo blocked → falls back to Portuguese; (3) returning cached lang=pt non-manual → pt then geo-refined to en; (4) manual pt → stays pt, flags preserved.

### 2026-07-08 — Fresh container re-provisioned (session 4) ✅
- Fresh container: no node_modules, no .env files → frontend FATAL. Re-provisioned from user-supplied credentials: `yarn install` in /app + /app/backend; wrote /app/backend/.env, /app/.env, /app/frontend/.env with all app URLs → https://coin-checkout-5.preview.emergentagent.com, preview host in CORS, fresh NEXTAUTH_SECRET. SAFETY overrides: NODE_ENV=production, WORKER_ROLE=secondary, ENABLE_BACKGROUND_JOBS=false (all cron/sweeps/emails skipped — verified in logs). Health: Railway PostgreSQL + Redis connected, internal /api/ /health /api/csrf-token = 200, external preview /api/ + / + /auth/login = 200.

### 2026-07-07 — Volume-based fee tier system + marketing copy alignment ✅ VERIFIED (7/7 backend)
User flagged: (a) marketing said "0.5% flat" but backend actually charged 1.5%, (b) dashboard "Fee Tier Progress" widget only ever showed "Standard". User approved: 4 volume tiers (Starter 1.5%, Growth 1.0%, Scale 0.7%, Enterprise 0.5%) with auto-upgrade + auto-downgrade + upgrade emails.

**New backend files:**
- `backend/utils/volumeTierUtils.ts` — single source of truth. Reads `VOLUME_TIER_<NAME>_{MIN,MAX,PERCENT}` env vars (defaults hard-coded). Exports `getVolumeTiers()`, `getTierForVolume(usdVolume)`, `getTierByName(name)`, `getPlatformFeePercent(userTier)`. Legacy `standard`/`trial`/`null`/typo tier names all safely map to Starter (1.5%) — no accidental discount.
- `backend/services/volumeTierReconciliation.ts` — nightly cron. For every non-trial user, joins `tbl_user_transaction`, computes lifetime USD volume, calls `getTierForVolume()`, updates `tbl_user.fee_tier` if changed. Silent on downgrades; fires `sendVolumeTierUpgradeEmail` on upgrades.

**Modified backend:**
- `backend/.env` — 12 new env vars `VOLUME_TIER_{STARTER,GROWTH,SCALE,ENTERPRISE}_{MIN,MAX,PERCENT}` = 0/10000/1.5, 10000/100000/1.0, 100000/500000/0.7, 500000/-/0.5. Legacy `TRANSACTION_FEE_PERCENT=1.5` retained as fallback.
- `backend/services/feeService.ts` — `getBlockchainConfig()`, `calculateTransactionFees()`, `calculateTransactionFeesWithDiscount()` now accept optional `userId`, look up user's `fee_tier`, use `getPlatformFeePercent(tier)`. Falls back to `TRANSACTION_FEE_PERCENT` (1.5%) if user unknown.
- `backend/controller/payment/feeController.ts::calculateCheckoutFees` — accepts optional `paymentLinkId` / `linkId` in body; resolves merchant `user_id` via `payment_link` table; uses their tier %. Falls back to 1.5% if merchant unknown (preserves prior behavior on `/fees` marketing calculator).
- `backend/controller/dashboardController.ts::getFeeTiers` — replaced hardcoded 5-tier array with `getFeeTiersArray()` from `volumeTierUtils`. Response now includes per-tier `percent` field + `current_tier_percent` + `next_tier_percent` + `current_tier_key` + `next_tier_key`. Auto-computes user's tier from real all-time USD volume.
- `backend/services/emailService.ts` — fixed hardcoded `"Platform Fee (1.5%)"` in auto-conversion payout email → now computes effective % from `(platformFeeUsd / grossSaleUsd) × 100`. Added new `sendVolumeTierUpgradeEmail(email, {name, previousTier, previousPercent, newTier, newPercent, totalVolumeUsd, language})` — renders a "you saved X%" comparison block. Fired only on upgrades, never on downgrades.
- `backend/server.ts` — new `cron.schedule("0 3 * * *", ...)` for tier reconciliation. Guarded by existing `ENABLE_BACKGROUND_JOBS` + `WORKER_ROLE=secondary` checks + `acquireLock("cron:volumeTierReconciliation")`.

**Modified frontend:**
- `Redux/Sagas/DashboardSaga.ts` + `Redux/Reducers/dashboardReducer.ts` — pass through `currentTierPercent`, `nextTierPercent`, `currentTierKey`, `nextTierKey`, `tiers`.
- `Components/Page/Dashboard/DashboardRightSection.tsx` — "Current Tier" badge now shows `Starter · 1.5%` (name + rate) with `data-testid="current-tier-percent"`. Below it, when a lower next-tier exists, renders `[data-testid="next-tier-hint"]` line "Reach Growth tier for 1.0% fees (save 0.50%)".
- `Components/Page/Home/FeeCalculator.tsx` — REPLACED hardcoded `DYNOPAY_PERCENT = 0.5` with `DYNOPAY_TIERS` ladder matching backend. Cost calc uses `dynopayTierFor(monthlyVolume)`: a merchant at $500/mo sees 1.5% (Starter), $50K/mo sees 0.7% (Scale). Subtitle now reads e.g. `"1.0% (Growth) · 133 tx/mo"`.

**Marketing copy alignment (all 6 locales en/pt/fr/es/de/nl):**
- `landing.json::heroCleanSubtitle` "0.5% flat" → "Fees from 0.5%"
- `landing.json::faq3A` — FAQ answer rewritten to explain tiered fees start at 1.5%, drop to 0.5%
- `fees.json::feeFreeBannerDescription` — "just 1.5%" → "start at 1.5%, drop as low as 0.5%"
- `dashboardLayout.json::lowerFeesAndPrioritySupport` — "Lower fees (0.5%)" → "Fees drop as your volume grows — as low as 0.5%"
- `dashboardLayout.json::nextTierHint` (NEW) — "Reach {next} tier for {pct} fees (save {savings})"
- `Components/Page/Home/HeroV2.tsx` — hero copy "0.5% flat" → "Fees from 0.5%"
- `Components/Page/Home/ComparisonTable.tsx` — "0.5% flat" → "0.5%–1.5% by volume"
- `Components/Page/Home/FeeSection.tsx` — DynoPay row fee "1.5%" → "0.5%–1.5%" · "By volume · first $500 free"
- `Components/Modals/DemoVideoModal.tsx` — "0.5% flat" → "Fees from 0.5% (drops with volume)"

**Verified** by backend testing agent (7/7 PASS): (1) `/api/pay/calculateFees` returns 1.5% default with correct math ($1000×1.5%=$15) both USD+EUR; (2) `/api/dashboard/fee-tiers` returns EXACT 4-tier structure with correct min/max/percent per tier; hostbay ($18,888.74 real volume) correctly shown as **Growth · 1.0%** with next tier Scale · 0.7% — this is the auto-computed tier from volume, not the DB's legacy `standard` value; (3) unit tests on `getTierForVolume` — all 10 boundary cases correct; `getPlatformFeePercent` fallbacks — all 9 cases (null/undefined/empty/trial/standard/typo → 1.5% safe default; growth→1.0%, scale→0.7%, enterprise→0.5%) correct; (4) `sendVolumeTierUpgradeEmail` exported; (5) `reconcileVolumeTiers` exported (subagent fixed import `{emailService}` → default `emailService`); (6) regression — all `/api/` + `/api/csrf-token` + `/api/dashboard` + `/api/dashboard/recent-transactions` + `/api/pay/calculateFees` return 200; (7) grep confirmed no hardcoded "1.5%" in the payout receipt template. Frontend testing NOT run yet (requires user permission per test protocol).



### 2026-07-07 — Google OAuth enabled + security fix (server-side client secret) ✅ VERIFIED (6/6)
User provided Google OAuth credentials (`163670787265-g39k8mfhfc4rgv4jpgt6k6n62phif72o.apps.googleusercontent.com` / secret `GOCSPX-…`) and asked to enable Google auth.
- **Pre-flight credential validation** (main agent, before any code change):
  - `GET accounts.google.com/o/oauth2/v2/auth?client_id=<CID>&…` returned the "Sign in with Google" screen → client_id VALID.
  - `POST oauth2.googleapis.com/token` with client_id+secret+fake auth code → `{"error":"invalid_grant","error_description":"Malformed auth code."}` (would have been `invalid_client` if secret were wrong) → client_secret VALID.
- **Env changes** — `/app/backend/.env` and `/app/.env`: `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<the id>`, `GOOGLE_CLIENT_ID=<same>`, `GOOGLE_CLIENT_SECRET=<the secret>` (server-side only — NEVER `NEXT_PUBLIC_*`).
- **Security fix** — `pages/api/auth/[...nextauth].ts` used to read `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET` (would have exposed the client secret to every browser at runtime). Changed to `process.env.GOOGLE_CLIENT_SECRET`. Also updated `clientId` fallback to prefer server-side `GOOGLE_CLIENT_ID`.
- **Wiring** — Client-side Google Identity Services (GIS): `pages/auth/login.tsx::handleGoogleLogin` → `window.google.accounts.oauth2.initTokenClient({client_id, scope: "openid email profile", callback})` → `requestAccessToken()` → on success POSTs `{accessToken}` to `/api/user/google-signin`. Backend `backend/controller/userController.ts::googleSignIn` verifies the access token by calling `oauth2/v3/userinfo`, upserts the user by email/`google_id`, provisions default fiat+crypto wallets on new-user path, returns a session (mirrors OTP-login response shape). GIS script preloaded in `pages/_document.tsx` line 52.
- **Verified** by frontend testing agent (6/6 PASS): (1) Google button visible on `/auth/login`, (2) Google button visible on `/auth/register`, (3) GIS `window.google.accounts.oauth2.initTokenClient` loaded, (4) button click invokes `initTokenClient` with the exact client_id `163670787265-…` and scope `openid email profile`, (5) `POST /api/user/google-signin` returns 401 "Invalid Google access token" for fake accessToken / 401 "Invalid Google ID token" for fake idToken / 400 "Google ID token or access token is required" when body empty, (6) click generates the correct Google OAuth popup URL `https://accounts.google.com/o/oauth2/v2/auth?client_id=…&scope=openid%20email%20profile&origin=<preview>`. Safety: no real Google credentials entered, no real OAuth completion, only fake tokens sent to backend.
- **⚠️ User action required for preview end-to-end**: if you want the popup to complete real Google login on the preview URL (not just dynopay.com production), add `https://coin-checkout-5.preview.emergentagent.com` to **"Authorized JavaScript origins"** in Google Cloud Console → OAuth 2.0 Client IDs → this client's edit page. (For NextAuth fallback, also add `/api/auth/callback/google` to "Authorized redirect URIs".) The dynopay.com production origin is presumably already whitelisted and will work as-is.



### 2026-07-07 — Brand refresh (`#0004FF → #4F46E5`) + email harmony + JetBrains-Mono OTP + sidebar one-tap referral share ✅ VERIFIED
User approved `BRAND_REFRESH_BRIEF.md` recommended defaults 1a/2a/3a and asked to add native-language one-tap Share to WhatsApp/Telegram/X inside the newly-visible sidebar referral card.
- **Logo/theme color (1a)** — master `assets/Images/auth/dynopay-logo.svg` `#0004FF → #4F46E5` (14 path fills); re-rendered blue PNGs at original dimensions via cairosvg (`dynopay-logo.png` 429×152, `dynopay-mobile-logo.png` 88×96, `backend/assets/dynopay-logo.png` 1888×656, `backend/assets/dynopay-logo2.png` 69×78) + white variants (`dynopay-white-logo.png` in auth/backend-public/backend-assets 268×90); every `assets/Icons/*.svg` + `assets/Images/*.svg` sed'd; `styles/theme.ts` primary/secondary main + primary.dark (`#0003CC→#4338CA`) + primary.light (`#E5EDFF→#EEF2FF`); `pages/help-support/[slug].tsx` and 14 landing/UI TSX files. Zero functional `#0004FF` remaining. Dashboard black+lime bento theme intentionally preserved (has explicit component-level overrides — theme token change doesn't leak).
- **Email harmony (2a)** — `backend/utils/emailTemplate.ts`: CTA button `#f47323→#4F46E5`, OTP block `#f0f4ff→#EEF2FF` bg + `#0d1f5c→#4F46E5` border/text + font-family `SF Mono/Fira Code → JetBrains Mono, SF Mono, Menlo, Consolas, Liberation Mono, monospace`; dark-mode OTP `#3b82f6→#818cf8` (indigo-400) + `#93c5fd→#c7d2fe` (indigo-200). Header bar navy `#0d1f5c` retained (approved).
- **OTP typography web (3a)** — `Components/UI/OtpInputPanel/index.tsx` `MuiInputBase-input` → `fontFamily: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`, `fontVariantNumeric: 'tabular-nums'`, `letterSpacing: 1px`, `fontWeight: 600`, size bumped `22/24px`. Font already preloaded in `_document.tsx` weights 500;600.
- **Sidebar one-tap referral share (NEW)** — `Components/Layout/ReferralAndKnowledge/index.tsx` rewritten: under the copy-code row, added a `[data-testid="referral-share-row"]` with 3 inline-SVG icon buttons (WhatsApp/Telegram/X). Each opens `wa.me/?text=`, `t.me/share/url?url=&text=`, or `twitter.com/intent/tweet?url=&text=` in a popup, pre-filled with the **localized** invite (from `referrals.shareMessage` + the merchant's real `referral_link` returned by `/api/referral/my-code`). Tooltips + aria-labels use localized labels. Icons colored via `currentColor` (theme-adaptive).
- **i18n** — added `shareOnWhatsApp/shareOnTelegram/shareOnX/shareInvite` to `langs/locales/{en,pt,fr,es,de,nl}/referrals.json`. Localized the "Your Referral Code" heading in `MobileReferralBanner`.
- **Verified** by frontend testing agent (all parts green): 0 × `#0004FF` in rendered DOM; logo SVG has 14 × `#4F46E5`; email template has all 5 expected color/font strings; OTP web input uses JetBrains Mono at 22/24px with tabular-nums; sidebar share row present on `/dashboard` for hostbay, all 3 popup URLs correct (`https://wa.me/?text=…`, `https://t.me/share/url?url=…&text=…`, `https://twitter.com/intent/tweet?url=…&text=…`), URLs contain the merchant's real referral link + localized invite; German i18n verified — tooltips render "Auf WhatsApp teilen", "Auf Telegram teilen", "Auf X teilen"; zero console errors. Live-prod-safe (JWT-read-only, no email/OTP triggered).



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
- Wrote `/app/backend/.env` from the user-supplied values (single-quoted so `GOOGLE_CLIENT_KEY` PEM with literal `\n` stays verbatim). Overrode URLs to this preview origin `https://coin-checkout-5.preview.emergentagent.com` (`FRONTEND_URL` / `SERVER_URL` / `NEXTAUTH_URL` / `NEXT_PUBLIC_BASE_URL` / `CHECKOUT_URL` + added `NEXT_PUBLIC_SERVER_URL` and `NEXT_PUBLIC_API_DOCS_URL`). Appended preview origin to `CORS_ALLOWED_ORIGINS`. Replaced the placeholder `NEXTAUTH_SECRET="openssl rand -base64 32"` with a real generated base64 secret. Kept **WORKER_ROLE=secondary** (cron/sweeps/settlement OFF — verified "background jobs disabled — secondary instance"). Added the `EMERGENT_LLM_KEY` used by the SEO generator.
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
- Wrote `/app/backend/.env` from prod values with overrides: URLs (SERVER_URL/FRONTEND_URL/CHECKOUT_URL/NEXTAUTH_URL/NEXT_PUBLIC_BASE_URL + added NEXT_PUBLIC_SERVER_URL/NEXT_PUBLIC_API_DOCS_URL) → preview origin `https://coin-checkout-5.preview.emergentagent.com`; preview origin appended to CORS_ALLOWED_ORIGINS; **WORKER_ROLE=secondary** (cron/sweeps/settlement OFF — verified in logs "background jobs disabled — secondary instance"). Values single-quoted so the GOOGLE_CLIENT_KEY PEM (literal `\n`) stays verbatim. Prod NEXTAUTH_SECRET was the literal placeholder "openssl rand -base64 32" → replaced with a real generated base64 secret (in both backend .env and .env.local).
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
- Wrote `/app/backend/.env` from the user-provided values. Overrode URLs to this preview origin `https://coin-checkout-5.preview.emergentagent.com` (FRONTEND_URL / SERVER_URL / NEXTAUTH_URL / NEXT_PUBLIC_BASE_URL / CHECKOUT_URL), appended the origin to `CORS_ALLOWED_ORIGINS`, generated a real `NEXTAUTH_SECRET` (user pasted a placeholder), and kept `WORKER_ROLE=secondary` so cron/sweeps/settlement stay OFF (gate: `isCronEnabled = enableBackgroundJobs && workerRole !== 'secondary'`). GOOGLE_CLIENT_KEY preserved with `\\n` escaping verbatim.
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

---

## Session 18 (2026-07-10) — Donation UX copy + landing use-case (frontend-only)
- Create flow copy is now donation-aware (was always "Payment Link"): submit button
  ("Create donation"), success modal title/subtitle ("Donation created" / "Share it to
  start collecting donations"), success toast ("Donation created successfully"), in-app
  page header + browser tab title ("Create Donation | DynoPay"). New i18n keys added to
  createPaymentLinkScreen.json across all 6 locales (en/es/fr/de/nl/pt).
- Landing page: rendered the 4-card Use-Cases section + added a 5th "Donations &
  Crowdfunding" card (new assets/Images/UseCase/use-case-5.svg + useCase5* keys), added
  FAQ entry faq7 (donations/crowdfunding), and appended a donation clause to the hero
  subtitle — all 6 locales. UseCaseSection now rendered in Home/index.tsx after CoreValueProps.
- Files: ActionButtons.tsx, CreatePaymentLink/index.tsx, PaymentLinkSuccessModal.tsx,
  Redux/Sagas/PaymentLinkSaga.ts, create-pay-link.tsx, utils/types (create-pay-link, paymentLink),
  Home/{index,UseCase,FAQ}.tsx, langs/locales/*/{createPaymentLinkScreen,landing}.json.
- Verified by frontend testing agent (button toggle EN/DE/PT, landing card, regression) + main agent.
- Test credentials unchanged. No prod DB schema writes. No third-party integrations added.

---

## Session 19 (2026-07-10) — Full landing page redesign: "Swiss & High-Contrast" (Stripe-caliber)
- User: "Use Cases section looks really poor… get a high quality breathtaking landing page… compete with stripe.com and have even better". Approved full transformation, designer's-choice identity.
- design_agent produced /app/design_guidelines.json: Unbounded (display) + IBM Plex Sans/Mono, volt #CCFF00 accent, obsidian #050505 bands, flat 1px borders, sharp 6px volt hover shadows, bento grids.
- New sections (all in Components/Page/Home/): HeroSwiss (left-aligned type + live settlement terminal + grid/tracing-beam bg), ChainsMarquee (mono marquee of 13 chains), StatWall ($0 / 0.5% / <5min / 13), UseCasesBento (5 product-UI mockup cards — checkout, code, pay-link, tx table, donation campaign — NO stock photos), SwissSectionHead + swiss.ts (tokens).
- Rewritten: FeeCalculator (vertical bar chart, logic unchanged), CoreValueProps, TestimonialsV2 (editorial + pexels avatars), FAQ (borderline rows, aria-expanded), FinalCTA (obsidian band "The old rails are slow. DynoPay is instant."), ComplianceLogoStrip (inverted obsidian strip), index.tsx (new order).
- Deleted (now unused): HeroClean.tsx, AsciiShimmer.tsx, UseCase.tsx, SupportedChainsRail.tsx, Components/UI/UseCaseBanner/.
- Infra: Google Fonts link in _document.tsx; --font-hero/--font-body/--font-tech vars + swiss-* keyframes in globals.css; styled.tsx aurora removed; ProductShowcase reframed (neutral canvas, Unbounded title).
- i18n: 10 new keys (heroSwissTitle1/2, heroSwissCtaSecondary, statWall*, finalCtaSwiss*) added to all 6 locales.
- Fixed during session: MUI height:1 = 100% bug on tracing beams; light-mode faint token bumped 0.38→0.62 for WCAG AA.
- Testing: iteration_24.json — PASS. 43/43 testids in light+dark, 12/12 flows (CTAs thread ?ref= into register), 0 console errors, mobile 390px clean, regression (/fees, /auth/*) clean.
- NOTE: production build workflow — after frontend changes run `yarn build` then `sudo supervisorctl restart frontend` (no hot reload).
- Test credentials unchanged. No backend/DB changes. No new integrations.

---

## Session 19b (2026-07-10) — Swiss brand extension: Auth → Fees → Checkout → Dashboard → Docs/Blog
- Approved rollout: Auth pages → /fees → public checkout/pay → dashboard (accent-level) → docs/blog → emails (emails already on-brand from earlier session, no change needed).
- Auth (/auth/*, reset-password shells): volt-only mesh (indigo removed), Swiss 54px grid backdrop, FormPanel/CardWrapper radius 18/16, AuthBrandPanel + TitleDescription → Unbounded/IBM Plex fonts. Files: Containers/Login/styled.tsx, Components/UI/AuthLayout/{AuthBrandPanel,TitleDescription}.
- /fees: full Swiss rewrite (pages/fees.tsx) — mono bracket hero, numbered sections 01-05 via SwissSectionHead, Swiss comparison table, obsidian CTA. testids: fees-step-card-*, fees-comparison-table, fees-howto-step-*, fees-cta-section.
- Checkout: Pay3Layout grid backdrop + indigo glow removed; ProgressBar de-purpled (neutral inactive dots, mono uppercase labels); assets/Icons/Logo.tsx default indigo→ink/white; CopyIcon.tsx #444CE7→currentColor; pay/demo accent bar volt; payment/success+failed Swiss cards w/ mono tx ids.
- Dashboard: appTheme already volt; page titles → Unbounded (Containers/Client/styled.tsx PageHeaderTitle 24px, Layout/Header/index.tsx toolbar titles 20px).
- Docs/Blog: SectionTitle restyled (mono [ ] eyebrow, Unbounded heading, volt highlight — propagates to docs/help-support/SEO pages); documentation.tsx + blog/* OutfitSemiBold→Unbounded, JetBrains Mono→var(--font-tech); docs Copy button now shows Copied even if clipboard API rejects; blog category chips mono.
- Added data-testid="login-method-password" to login method radio (tester request).
- Testing: iteration_25.json — login E2E PASS (3-step: email → Password radio → password), fees calculator recompute PASS, all pages dark+light PASS, mobile no-overflow PASS. Post-report fixes (indigo remnants, page-title fonts) self-verified via screenshot.
- KNOWN PRE-EXISTING (not brand-related, left as-is): /reset-password redirects to /auth/login w/o token; /pay w/o token falls through to landing; [next-auth] CLIENT_FETCH_ERROR console noise on every route (NEXTAUTH_URL/preview-host mismatch); bankTransferCompo.tsx still uses #5865F2 indigo (bank-transfer sub-flow); 7 cosmetic tsc errors predate this session.
- Build workflow reminder: yarn build && sudo supervisorctl restart frontend.
