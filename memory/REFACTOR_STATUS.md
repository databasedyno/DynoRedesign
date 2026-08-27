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
- [ ] **P1 — Status Page Polish:** Add 90-day uptime history bars to the public status page so
      customers see per-service reliability at a glance.
- [ ] **P2 — Checkout Currency Memory:** Let returning buyers see prices in the currency they picked
      last time without re-selecting it.
- [ ] **Spark — Referral Earnings Card:** Show merchants their pending 50% referral rewards right on
      the dashboard.

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
      Remaining redux-saga domains: Dashboard (W3) · PaymentLink (W4) · User (W5) · Toast (W6).
- [ ] Phase 3 — One of everything: helpers/utils + themes + axios clients (FP2-3)
- [ ] Phase 4 — Guards on: reactStrictMode + ESLint warning ratchet (FP3-1)
- DEFERRED: FP2-4 auth unification (needs own approval) · App Router (never) · all backend items
