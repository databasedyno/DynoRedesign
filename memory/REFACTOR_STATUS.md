# REFACTOR STATUS

_Last updated: 2026-08-26_

## Context
The husky `pre-commit` hook (`backend/scripts/check-file-size.mjs`, R2 budget from
`memory/ENGINEERING_STRATEGY_REVIEW_2026-08.md`) blocks any commit / Save-to-GitHub when a
**NEW** backend `.ts` file exceeds **500 lines**. Legacy files listed in
`backend/scripts/file-size-baseline.json` are grandfathered and only WARN when they grow.

## DONE — Save-to-GitHub blocker fix (2026-06)
- **Problem:** `backend/controller/customerDirectoryController.ts` = 583 lines → hook exit 1 → GitHub save blocked.
- **Fix (strangler pattern — split, do NOT grandfather):**
  - Extracted the data layer into `backend/controller/customerDirectoryService.ts` (398 lines):
    types, constants, helpers, `resolveCompanyScope`, `TX_QUERY`, `buildDirectory` (all exported).
  - Controller reduced to the two route handlers + imports (204 lines).
- **Behavior:** identical — pure code move, no route/logic/API-shape change; `apiRouter.ts` default import unchanged.
- **Verified:** `tsc --noEmit` clean · full `.husky/pre-commit` green (preflight-tsc OK, file-size OK, secrets OK) →
  EXIT 0 · both endpoints work read-only on live prod DB (`hostbay@moxx.co`):
  `GET /api/userApi/customers/directory` (total 9, aggregates present),
  `GET /api/userApi/customers/directory/detail?key=anon:api` (payments_total 533).

## DONE — Buyer Payment-Receipt email capture + Confirmation browser alert (2026-08-26)
Feature request: (1) buyers get an emailed receipt right after payment confirms; (2) a browser
notification when the payment confirms so they can switch tabs. User choices: email field on the
currency-select step of BOTH main crypto checkout + creator tip; browser alert on all 3 checkout
surfaces (store checkout already collects email → field hidden there).
- **Finding:** the receipt-email backend ALREADY fires on settlement (`sendCustomerPaymentConfirmationEmail`
  + `sendOrderReceiptEmail`); the gap was that the public checkout never captured a buyer email, so
  anonymous payers on a shared link got nothing.
- **New backend:** `POST /api/pay/setCustomerEmail` — `paymentLinkController.setCustomerEmail` (route in
  `paymentRouter.ts`, paymentRateLimiter + customerAuthMiddleware). Validates email (400 invalid / 404 no
  session) and merges it into the SAME Redis checkout session `customer-<ref>` that settlement reads
  (`customerData?.email`). No money-path change — contact info only.
- **New frontend (shared):** `hooks/usePaymentNotification.ts` (Notifications API wrapper, no VAPID/SW) +
  `Components/Page/Pay3Components/checkoutExtras.tsx` (`ReceiptEmailField` + `NotifyMeInline`).
- **Wired:** `CleanCheckoutV2.tsx` (email field + notify opt-in + fire-on-confirm),
  `InlineTipCheckout.tsx` (same, new `collectReceiptEmail` prop; covers tips AND store checkout),
  `pages/[handle]/checkout.tsx` (`collectReceiptEmail={false}`). i18n keys added to all 6 landing.json locales.
- **File-size note:** all edits landed in GRANDFATHERED legacy files (paymentLinkController +11,
  paymentController +3); the two NEW files are FRONTEND (hooks/, Components/) so the R2 backend budget does
  not apply. No new backend file → no 500-line blocker introduced.
- **Verified:** frontend+backend `tsc` EXIT 0 · backend curl e2e (login → QA link → getData →
  setCustomerEmail 200 → invalid 400 → QA link deleted) · testing_agent iteration_89 = 100% (field renders
  desktop+mobile, valid save → 200 + confirmation, invalid → error, 0 console errors). CANNOT e2e in preview:
  live email delivery (`DISABLE_OUTBOUND_EMAIL=true`) + notification firing on `confirmed` (needs real
  on-chain confirmation) — both code+compile verified, fire in production.

## NOTE — "Save to GitHub didn't commit" (2026-08-26 investigation)
User suspected a >500-line file blocked the GitHub save. **Confirmed NOT the cause:** the R2 file-size check
is warn-only for legacy files and exits 0 (only NEW backend `.ts` > 500 lines block). Ran the full commit
gates on the receipt/notify changes: file-size PASS (exit 0), `tsc` clean, secrets guard OK (17 staged files,
no live key patterns — the lone `GOCSPX-…` hit in PRD.md is a redacted placeholder). Most likely real cause
is platform/GitHub-side (push protection GH013 scanning history, expired GitHub auth, or repo perms) — routed
to support_agent; asked user for the exact Save-to-GitHub error to confirm.

## NEXT ACTION ITEMS (from finish handoff — not started)
Priority order; each is independently shippable.

- [ ] **P0 — Frontend Verification (Customers page):** Run the frontend testing agent on the
      re-imagined Customers page to confirm all UI states, the detail drawer (bottom sheet on mobile),
      search + sort + CSV export, segment chips, and the "Request payment" → `/create-pay-link?email=<x>`
      prefill. Verify at 390 / 768 / 1024 / 1920 in dark + light. (Was awaiting user approval.)
- [x] **P1 — Status Page Polish (90-day uptime bars):** ALREADY IMPLEMENTED (verified 2026-08-27
      pod d004a6e0). Backend `getUptimeChart` (`GET /api/status/uptime`) returns a full 90-day
      series (missing days filled `no_data`); `Components/UI/APIStatus/Bars.tsx` renders 90 SVG bars
      + legend + uptime %; `/system-status` shows it. Testing agent PASS (90 rects, legend, no errors).
- [x] **P2 — Checkout Currency Memory:** ALREADY IMPLEMENTED (verified by code inspection 2026-08-27).
      `CleanCheckoutV2.tsx` persists the buyer's chosen network + payment currency to localStorage
      (`checkout_pref_network` / `checkout_pref_currency`) and restores them on return. NOT e2e-tested
      on prod (selecting a currency would create a real reservation).
- [x] **Spark — Referral Earnings Card:** DONE (2026-08-27 pod d004a6e0). Enhanced
      `Components/Page/Dashboard/ReferralCodeCard.tsx` to also read `GET /api/referral/earnings`
      (unwrap) and render a "Pending rewards" row = `summary.pending_earnings` as `$X.XX` (the
      merchant's pending 50% referral rewards) with a tooltip hint; i18n keys `pendingRewards` /
      `pendingRewardsHint` added to all 6 locales. No backend change. Gate: tsc 0 · eslint 0 ·
      check-i18n PASS · frontend testing agent PASS (referral-card-pending + amount + tooltip,
      desktop+mobile+light).

## Watchlist — legacy files that grew past baseline (WARN-only, non-blocking)
These do NOT block commits, but each is a candidate to refactor down and remove from
`file-size-baseline.json` (never let them regress once reduced). Extract a module instead of extending:
- `controller/dashboardController.ts` — 1441 (baseline 1334)  ← largest drift
- `services/webhookProcessor.ts` / `webhooks/index.ts` — grew (~736 vs 717)
- `controller/product/productController.ts` — 873 (baseline 784)
- `controller/product/cartController.ts` — 890 (baseline 832)
- `controller/payment/settlement/settleTransaction.ts` — 1110 (baseline 1082)
- plus small +1..+11 drifts across apis/tatumApi.ts, adminController, apiController, companyController,
  invoiceController, kycController, cryptoCheckout, feeController, chainVerification, paymentController,
  paymentLinkController (2723 vs baseline 2712, +11 from setCustomerEmail),
  publishableKeyController, referralController.
- Rule: only files NOT in the baseline block; the above are all grandfathered.

## How to re-check locally
```
cd /app/backend && node scripts/check-file-size.mjs        # exits 1 on a NEW >500-line file
cd /app && git add -A && sh .husky/pre-commit              # full hook (tsc + size + secrets + contrast)
```

# ============================================================================
# 2026-08-27 — NEXT ACTIONS + DIGITALOCEAN DEPLOY FIX (pod f431e319)
# ============================================================================

## DigitalOcean deployment — ROOT CAUSE FOUND + FIXED (pending GitHub push)
- DO App Platform app "dynopay" (id f86b27dc-feb0-4a44-a4e9-ebd2053e0468, region ams,
  ingress https://dynopay-bcibf.ondigitalocean.app). Single Docker service "dynoredesign"
  built from GitHub databasedyno/DynoRedesign @ branch `Improvement`, /Dockerfile → `yarn build`.
- Two consecutive deploys FAILED (`BuildJobExitNonZero`):
    a56bdb19 (commit f110178) and 13f98059 (commit 5db543c).
- BUILD LOG root cause: `next build` type-check failed (next.config has
  typescript.ignoreBuildErrors:false):
    ./Components/Page/API/ApiKeysPage.tsx:311  `<ApiKeyCardSubTitle component="div">`
    Type error: Property 'component' does not exist on styled(Typography) props.
  The `component="div"` (added to fix invalid <div>-in-<p> DOM nesting) type-errors because
  `ApiKeyCardSubTitle = styled(Typography)(...)` didn't declare a `component` prop. Preview
  (`next dev`) doesn't strict type-check, so it slipped through until DO's `yarn build`.
- FIX (Components/Page/API/styled.tsx): `import type { ElementType } from "react"` +
  `styled(Typography)<{ component?: ElementType }>(...)` so TS accepts the polymorphic prop
  (runtime already honored it). VERIFIED: `tsc --noEmit` = 0 errors project-wide.
- ESLint note: next.config eslint.ignoreDuringBuilds:false (errors block builds). `next lint`
  CLI flags Components/UI/Sparkline.tsx (react-hooks/rules-of-hooks) but that file AND
  .eslintrc.json are BYTE-IDENTICAL to the last GREEN build (312681d, 6/6 steps) → Next's
  build-time lint does NOT treat it as blocking. So no lint blocker remains.
- ⚠️ REMAINING ACTION: the fix is in the working tree only. Push it to GitHub via the
  "Save to GitHub" feature → DO auto-deploys the new commit on `Improvement` → build should
  go GREEN. Do NOT re-trigger a DO deploy of 5db543c (still has the bug).

## Next Actions (current, prioritized)
- [ ] **P0 Deploy**: Save to GitHub to push the styled.tsx fix → confirm DO build goes ACTIVE.
- [ ] **P1 Receipt/Invoice PDF locale**: render downloaded PDF dates+labels in merchant's language.
- [ ] **P1 Relative-time coverage**: ensure all "X ago" timestamps use shared translated strings.
- [ ] **P1 Locale QA screens**: PT (and other langs) side-by-side screenshots of key pages.
- [ ] **P2 Deep read-only page sweep**: safe click-through of logged-in pages for console errors.
- [ ] **P2 tsc-in-preview guard**: consider a pre-Save `tsc --noEmit` gate so a dev-only type
      error can never reach a DO build again (this exact class of failure).

# ============================================================================
# 2026-06 — APPROVED ARCHITECTURE REVIEW (Parts A–C) + FRONTEND FIX PROGRAM (Part D)
# ============================================================================
User approved the full review; execution decision: "Frontend fixes only" (backend Parts A/C deferred).

## PART A — Backend findings (approved, DEFERRED — no work authorized)
- A: Shared prod DB/Redis across environments (highest risk) → isolate per env
- B: Redis as source of truth for in-flight payments → Postgres system-of-record
- C: ~25 cron jobs inside API process → separate worker service (worker.ts exists)
- D: server.ts god file (1,675 ln); paymentLinkController 2,712; tatumApi 4,136
- E: three parallel migration mechanisms → one versioned pipeline
- F: in-memory rate-limit Map + broken CIDR Set.has() → Redis counters + CIDR lib
- G: repo/test hygiene (shared with frontend K)
- H: observability = 15-min email digests → Sentry-class capture
- I: Python preview proxy buffers bodies (no SSE) — documented, acceptable

## PART B — Frontend findings (approved, ACTIVE via Part D)
- J: three state layers (Redux+saga / SWR / contexts) → finish SWR, delete saga
- K: repo root polluted (~80 loose test scripts, screenshots, dumps) → ops/, gitignore
- L: i18n.js 350-line per-language switch ×2 → template-literal import loop; check-i18n.mjs only key mechanism
- M: duplicate helpers/utils, 6+ theme files, 2 axios clients → consolidate
- N: server-grade deps in frontend (pg, ioredis, bcryptjs, jsonwebtoken, next-i18next, i18n) → prune
- O: two auth heads (backend JWT + NextAuth-for-Google) → DEFERRED, own approval
- P: reactStrictMode:false + ~500 ESLint warnings → strict mode + warning ratchet
- Q: Pages Router stays — App Router migration explicitly NOT recommended

## PART C — Effort timings (approved estimates)
Backend: P0-1 staging env 2–3d · P0-2 DB-first payment state 3–5w phased · P1-1 worker split 1–2d ·
P1-2 migrations 1–2w · P1-3 rate-limit/CIDR 1d · P2-1 server.ts decomp 3–5d · P2-2 hygiene 1–2d ·
P2-3 Sentry 1d · P3-1 versioning 0.5d. Subtotal ~7–10d + P0-2.
Frontend: FP1-1 SWR/saga 10–15d waves · FP1-2 dep prune 0.5–1d · FP2-1 root hygiene 1–2d ·
FP2-2 i18n loader 1d · FP2-3 consolidation 3–5d · FP2-4 auth unification 3–4d (DEFERRED) ·
FP3-1 strict mode + ratchet 2–3d · FP3-2 App Router 0 (not recommended). Subtotal ~21–31d.
Full program ~8–10 calendar weeks single-engineer.

## PART D — FRONTEND FIX EXECUTION (ACTIVE) — phase tracker
Ground rules: live prod DB in SAFE MODE → read-only verification only; each phase gates on
tsc + eslint + next build + testing agent; ship per-phase via Save to GitHub; money-path untouched;
no git history rewrite.
- [x] Phase 1 — Quick wins: dep prune (FP1-2) · i18n loader rewrite (FP2-2) · root hygiene (FP2-1)
      DONE 2026-06 (pod 09016278): gate all green (tsc 0 · eslint 0 errors · next build EXIT 0 ·
      check-i18n PASS · pre-commit EXIT 0 · testing_agent iteration_91 = 100%). Also fixed pre-existing
      Sparkline.tsx conditional-useMemo build blocker surfaced by the gate. Ship via Save to GitHub.
- [ ] Phase 2 — One data layer: finish SWR migration in waves, delete redux-saga last (FP1-1)
      Wave order (each independently shippable, gates on tsc+eslint+build+testing agent):
        W1 Transaction · W2 Api (keys) · W3 Dashboard · W4 PaymentLink · W5 User (661-line saga,
        auth/profile — riskiest, last) · W6 Toast + delete redux-saga + store.ts cleanup.
      - [x] W1 Transaction → SWR (2026-08-27, pod f07bb4cb): new `hooks/useTransactions.ts`
            (`useTransactions()` keyed on `useSelectedCompanyId()` — mirrors WalletDataContext;
            company switch flips the SWR key → auto-refetch; `exportTransactions()` imperative
            CSV; sidebar hover = `preload([TRANSACTIONS_KEY, id])`). Removed the manual
            `TRANSACTION_FETCH` dispatch from CompanySelector + NewSidebar and the DEAD
            `TRANSACTION_DETAIL_FETCH` path (details modal renders from the row). Deleted
            TransactionAction/transactionReducer/TransactionSaga + barrel/RootSaga/rootReducer
            entries. Gate: tsc 0 · eslint 0 (5 changed files) · /transactions dev-compile 200.
            PENDING: frontend testing-agent verification (awaiting user go).
      - [x] W2 Api keys → SWR (2026-08-27, pod f07bb4cb): new `hooks/useApiKeys.ts`
            (`useApiKeys()` keyed on company → list + `refetch` + `deleteApiKey` /
            `regenerateApiKey` / `toggleApiStatus` mutations that toast + `mutate()`,
            mirroring CompanyDataContext). Rewired ApiKeysPage (list/loading/mutations +
            ApiKeyCard currency-save now calls `onUpdated=refetch`), CreatePaymentLink
            (`hasActiveApiKey`), developer-keys (`canCreateAnother`); removed the API_FETCH
            dispatch from CompanySelector. Dropped DEAD paths: API_INSERT/addApi (create modal
            is a stub — keys auto-provision server-side) + API_UPDATE saga (currency save was
            already a direct axios PUT). Deleted ApiAction/apiReducer/ApiSaga + barrel/RootSaga/
            rootReducer entries. Gate: tsc 0 · eslint 0 new (1 pre-existing warning in
            DynopayCryptoElement, untouched) · /developer-keys + /create-pay-link dev-compile 200.
            PENDING: frontend testing-agent verification (batch with W1).
      - [x] W3 Dashboard → SWR (2026-08-27, pod f07bb4cb): rewrote `hooks/useDashboardData.ts`
            internally on SWR (same return shape, so its ~9 consumer components + Payouts need
            ZERO changes). 4 read resources keyed on company (stats / fee-tiers / recent-tx /
            chart); SWR's built-in dedupe replaces the old module-level _lastDashboardAll guard.
            Chart params (period/custom range) live in a tiny module store + useSyncExternalStore
            so every mounted instance shares ONE chart key (preserves old global-chartData
            semantics); `fetchChartData` sets params. Added `revalidateDashboardData()` (global
            SWR mutate by "dashboard:" key prefix) for the refresh triggers. Rewired: CompanySelector
            (dropped DASHBOARD_FETCH_ALL + DASHBOARD_CHART_FETCH — SWR refetches on company-key
            change), Display/UserDisplayCurrencySelector (→ revalidateDashboardData after currency
            change), OnboardingFlow (reads `stats` via the hook; dropped the redundant manual
            fetch effect; kept `dashboardFetched=false` to preserve the always-false legacy
            behaviour). Profile fetch (USER_PROFILE_FETCH) stays on redux until Wave 5. Deleted
            DashboardAction/dashboardReducer/DashboardSaga + barrel/RootSaga/rootReducer entries;
            RootSaga no longer imports takeLatest/debounce. Gate: tsc 0 · eslint 0 new · /dashboard
            + /payouts dev-compile 200. PENDING: frontend testing-agent verification (batch W1–W3).
      ✅ VERIFIED — frontend testing agent 2026-08-27 (pod f07bb4cb): W1+W2+W3 ALL PASS.
         Dashboard KPIs real ($7,560/14 payments, not $0), chart range-switch works, fee-tier +
         recent activity populate; transactions list loads + company-switch refetch (SMADAV 4 ↔
         The Dev Store 643); API keys list loads (view-only); /create-pay-link no false banner.
         KEY: NO duplicate simultaneous network calls — SWR dedupe confirmed. Behaviour unchanged.
      - [x] W4 PaymentLinks → SWR (2026-08-27, pod f07bb4cb): new `hooks/usePaymentLinks.ts` —
            SWR list keyed on company + createLoading/feePreview/createError*/fetched STATE that
            mirrors the old reducer field names (so CreatePaymentLink's effect-driven flow —
            new-link detection, createLoading transition, createErrorNonce inline errors — is
            UNCHANGED) + imperative methods createPaymentLink/updatePaymentLink/deletePaymentLink/
            fetchFeePreview that mirror the saga+reducer EXACTLY (optimistic `mutate(...,{revalidate:
            false})`: create prepends the response, update maps, delete filters). Kept the
            `mapBackendErrorToField` helper (moved PaymentLinkErrorField type into the hook).
            Rewired: CreatePaymentLink (selector→hook, 3 dispatches→methods), PaymentLinksTable
            (delete), Payment-link/index (list+loading), QuickCreateLinkPanel (refresh→refetch),
            OnboardingFlow (hasLink + fetched via hook, dropped manual fetch effect), CompanySelector
            (removed the LAST dispatch — now fully redux-free). Deleted PaymentLinkAction/
            paymentLinkReducer/PaymentLinkSaga + barrel/RootSaga/rootReducer entries.
            ⚠️ WRITE paths (create/edit/delete) are code-verified only — cannot be exercised on the
            live prod DB (would pollute a real merchant). READ/list/company-switch/fee-preview are
            testable. Gate: tsc 0 · eslint 0 · /pay-links + /create-pay-link + /dashboard compile 200.
            PENDING: read-only frontend testing-agent verification.
      redux-saga now powers ONLY: User (W5) + Toast (W6). RootReducer = { userReducer, toastReducer }.
      - [x] W5 User → SWR/useUser (2026-08-27, dynopay-setup-8): DONE + testing_agent iteration_91 = 100%
            (RENDER-ONLY, no auth submitted on the live prod DB). Deleted Redux/Actions/UserAction.ts,
            Redux/Reducers/userReducer.ts, Redux/Sagas/UserSaga.ts. Migrated all 6 consumers to
            hooks/useUser.ts (module store + useSyncExternalStore) + hooks/useProfile.ts (SWR, token-gated):
            pages/auth/login.tsx (big login state machine), pages/reset-password.tsx,
            Components/UI/EmailVerificationBanner, Components/UI/AddWalletModal, pages/admin/profile.tsx
            (dead-import removal), DashboardRightSection (was already on useProfile). Added useUser.applyEmailCheck.
            Cleaned Redux/Reducers/index.ts + RootSaga.ts + Actions/index.ts + utils/types.ts (rootReducer =
            { toastReducer }). KEPT Redux/Sagas/helpers/mapBackendErrorToField.ts (used by CompanyDataContext +
            usePaymentLinks). Gate: tsc 0 · Next compile clean · testing_agent 8/8. redux-saga now powers ONLY Toast.
            ALSO verified this session: the /api/track/visitor sendBeacon fix (no net::ERR_ABORTED on home→login nav).
      - [x] W6 Toast → module store + DELETE redux (2026-08-27, dynopay-setup-8): DONE + testing_agent
            iteration_92 = 100% (17 routes, RENDER-ONLY, zero console/redux errors). NEW helpers/toastStore.ts
            (useSyncExternalStore) replaces toastReducer/ToastSaga; 43 files migrated dispatch(TOAST_SHOW)→
            showToast + all useDispatch/useSelector removed; Toast renderer reads the store (keeps optional props
            for legacy local-toast screens); Containers render <Toast/>; _app.tsx Provider removed. DELETED
            /app/store.ts + entire /app/Redux/ folder; relocated mapBackendErrorToField → helpers/. Uninstalled
            @reduxjs/toolkit + react-redux + redux-saga. tsc 0 · Next compile clean. **redux-saga fully retired —
            the app now runs on ONE state layer (SWR + module stores + context).**
- [x] Phase 2 — One data layer: COMPLETE (W1 Transaction · W2 Api · W3 Dashboard · W4 PaymentLink · W5 User ·
      W6 Toast). redux + redux-saga + store.ts all removed.
- [~] Phase 3 — One of everything: helpers/utils + themes + axios clients (FP2-3) — IN PROGRESS
      - [x] Wave 1 (helpers/utils dedupe, 2026-08-27 pod d004a6e0): removed 2 dead/superseded
            modules — `helpers/navAccent.ts` (nav-accent source-of-truth no longer imported) and
            `utils/geoLocale.ts` (old IP→locale detection, superseded by backend `/api/geo-detect`
            + `utils/geoDefaults.ts`). Both had 0 references repo-wide. Gate: tsc 0 · key routes 200 ·
            frontend testing agent 6/6 PASS (dashboard sidebar + nav accents intact, no console errors).
      - [x] Wave 2 (theme tokens, 2026-08-27 pod d004a6e0): removed 3 dead legacy DUPLICATE
            theme-token modules — `Components/Page/Home/swiss.ts` + its dead-only consumer
            `SwissSectionHead.tsx`, and `styles/homeBento.ts` (all 0 external refs; superseded by
            `v3/theme.v3.ts` + `styles/homeTheme.ts` + `constants/theme.ts`). Tidied one stale doc
            comment in homeTheme.ts. Gate: tsc 0 · / /fees /dashboard 200 · frontend testing agent
            PASS (home dark+light, /fees, dashboard all correctly themed, no console errors). NOTE:
            token files with DIFFERENT values (HomeHeader local VOLT #22C55E, v3 OBSIDIAN vs old
            swiss OBSIDIAN) were intentionally NOT merged — only the fully-dead legacy files removed.
      - [ ] Wave 3 (axios clients): consolidate axiosConfig.ts + axiosAdmin.ts (RISKIEST — auth
            interceptors differ; do last, behind full gates).
- [ ] Phase 4 — Guards on: reactStrictMode + ESLint warning ratchet (FP3-1)
- DEFERRED: FP2-4 auth unification (needs own approval) · App Router (never) · all backend items
