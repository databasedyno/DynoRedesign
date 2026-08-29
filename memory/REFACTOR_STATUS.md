# REFACTOR STATUS

_Last updated: 2026-08-28_

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

## DONE — COPY_AUDIT Phase 2 + Phase 3 copy work (2026-08-28, pod 6fe4ee0c)
Full detail in `memory/COPY_AUDIT.md` + `memory/CHANGELOG.md`. Highlights:
- **i18n migrations:** about.tsx / ExitIntentModal / blog CTA + blog index Head → landing.json
  keys (6 locales, check-i18n green); email gaps closed (volumeTierUpgrade + referee reminder/
  invite → 42 keys × 6 in emails.json). Latent bugs fixed: reminder subjects hardcoded "50%" /
  "3 days" → parameterized.
- **Voice passes:** documentation.tsx (4 dev-tone fixes), 46 email-string fixes (casing,
  puffery, sentence-case subjects), _app.tsx JSON-LD speed-claim fixes, last "DynoPay" casing
  bugs in frontend catalogs (18 strings).
- **New /press page:** press.* keys × 6, downloadable logos in `public/press/`, Company
  mega-menu entry. All NEW files are frontend or scripts → R2 backend budget not applicable.
- **Verified:** backend testing agent 5/5 + 8/8 (read-only on live prod DB, SAFE MODE);
  `tsc --noEmit` clean; screenshots for /about EN+DE, /press EN+DE, /blog DE.

## Next Actions (current, prioritized)
### Carried over (pre-2026-08-28, still open)
- [ ] **P0 Deploy**: Save to GitHub to push the styled.tsx fix → confirm DO build goes ACTIVE.
      (2026-08-28 work is also working-tree-only until the next Save to GitHub.)
- [ ] **P1 Receipt/Invoice PDF locale**: render downloaded PDF dates+labels in merchant's language.
- [ ] **P1 Relative-time coverage**: ensure all "X ago" timestamps use shared translated strings.
- [ ] **P1 Locale QA screens**: PT (and other langs) side-by-side screenshots of key pages.
- [ ] **P2 Deep read-only page sweep**: safe click-through of logged-in pages for console errors.
- [ ] **P2 tsc-in-preview guard**: consider a pre-Save `tsc --noEmit` gate so a dev-only type
      error can never reach a DO build again (this exact class of failure).

### New (from 2026-08-28 finish handoff — not started)
- [ ] **P1 Real Testimonials** (BLOCKED on user input): landing-page section with real customer
      quotes — user must paste actual quotes first, nothing fabricated (COPY_AUDIT rule).
- [ ] **P1 Non-EN email subject sweep**: polish de/es/fr/nl/pt email subject lines for casing/
      tone per-language norms (EN already sentence-cased in Phase 2).
- [ ] **P2 Press OG image**: branded social-preview image for /press (og:image + twitter:card),
      drop into `public/og/`, reference from press.tsx Head.
- [ ] **P2 Locale parity fix**: de/es/fr/nl/pt `emails.json` miss EN key
      `merchant.locked.suspendedLine` (pre-existing; falls back to EN today) — translate ×5.


# ============================================================================
# 2026-06 — CHECKOUT REFACTOR (all phases) — pod fork continuation
# ============================================================================

## Background
Three large "god-components" own the checkout surfaces and each grew its own data + helper layer:
- `Components/Page/Pay3Components/cryptoTransfer.tsx` (2,563 lines) — the crypto **checkout** widget
  (data layer: `axiosBaseApi` + Redux `useDispatch`; endpoints configuredCurrencies / getCurrencyRates /
  addPayment / verifyCryptoPayment).
- `Components/Page/Creator/InlineTipCheckout.tsx` (1,234 lines) — inline creator tip / donation / link
  **checkout** (data layer: raw `fetch()` with explicit Bearer, deliberately never touches localStorage).
- `Components/Page/CreatePaymentLink/index.tsx` (~2,082 lines) — a merchant **creation FORM** (NOT a
  checkout display; only truly-common helpers overlap).
`CleanCheckoutV2.tsx` was already modularised in a prior session into the shared `checkout/*` modules:
`checkoutTypes.ts` (Meta / CryptoInfo / Phase / PaymentUri), `checkoutConstants.ts` (MONO / LIME / INK /
ON_BRAND / PREF_* / CRYPTO_INFO), `checkoutHelpers.ts` (formatCryptoAmount / buildPaymentUri /
copyToClipboard / read+writeCheckoutPref), `checkoutApi.ts` (checkoutApi / fetchReceiptBlob),
`checkoutPrimitives.tsx` (CheckoutStatusTimeline / PanelShell).

User steer (ask_human, this fork): **implement Phase A only**; document all phases here after.
Overriding rule for every phase: **ZERO behaviour change on the revenue path** — only swap logic that is
*functionally identical* to the shared version; never force divergent implementations together.

## Phase A — Extract shared PURE logic — ✅ DONE (2026-06)
Goal: point the god-components at the shared `checkout/*` modules for logic they *identically* re-implement.

What was actually de-duped (after a line-by-line equivalence check):
- **InlineTipCheckout.tsx** — removed its local `MONO`, `LIME (= BRAND_ACCENT)`, `INK` constants and its
  local `Phase` union + `CryptoInfo` interface; now imports `{ MONO, LIME, INK }` from
  `checkout/checkoutConstants` and `type { Phase, CryptoInfo }` from `checkout/checkoutTypes`. The shared
  values/shapes are byte-for-byte equivalent (Phase = same 9 members, union order irrelevant; CryptoInfo =
  same 7 fields/types). Also dropped the now-unused `BRAND_ACCENT` import. ~30 lines of duplication removed;
  all 26 `MONO/LIME/INK` references + all `Phase`/`CryptoInfo` usages compile unchanged.

What was deliberately **NOT** touched (would have changed behaviour — Phase A must not):
- **cryptoTransfer.tsx `walletUri`** intentionally DIVERGES from shared `buildPaymentUri`: it also emits
  `ethereum:?value=<wei>` (via a local pure `toWei` string-math helper) and `tron:` deep-links, and encodes
  the *raw* amount string; the shared helper deliberately returns `null` for EVM/TRON/token chains and runs
  the amount through `formatCryptoAmount`. Merging them would drop ETH/TRX deep-links → left as-is.
- **cryptoTransfer.tsx `formatAmount`** already delegates to the *richer* shared `formatCryptoAmount` in
  `utils/currencyFormat.ts` (handles fiat + chain-suffixed codes) — a different, more capable single source
  than the checkout copy. Swapping to the checkout one would lose capability → left as-is.
- **Both components' clipboard** already use the global `@/helpers/copyToClipboard` (not the checkout copy).
- **Meta** shapes differ per surface (InlineTip's is narrower + has campaign fields) → left local.
- **CreatePaymentLink** is a creation form → out of scope for checkout-display de-dup.
Net honest finding: the prior refactor had already routed cryptoTransfer's big shared helpers through global
utils, so the only *safe, identical* remaining duplication lived in InlineTipCheckout (done).

Verified: `tsc --noEmit` EXIT 0 (proves shared Phase/CryptoInfo/constants are compatible across every usage);
live render smoke test on `/devhub` → opened the "Support me" widget → InlineTipCheckout mounts and reaches
the `currency_select` phase ("Pick a crypto to pay $10.00", full coin grid via shared CRYPTO_INFO, receipt
field), no error boundary, no console crash. No money-path/API/UI change.

## Phase B — Unify the API call sites — ✅ DONE (2026-06)
Goal: route all checkout surfaces through ONE module (`checkout/checkoutApi.ts`) so every pay call lives in
one place — while preserving each surface's auth model EXACTLY.
- The module now holds BOTH transports:
  - `checkoutApi()` / `fetchReceiptBlob()` — the fetch/Bearer client that NEVER reads localStorage (the
    anonymous-customer auth model). Used by `CleanCheckoutV2` (already) and now `InlineTipCheckout`.
  - NEW `payAxios` — thin wrappers over the app-wide `axiosBaseApi` (interceptors + localStorage token, the
    merchant-session auth model). Used by the legacy `cryptoTransfer`.
- `InlineTipCheckout.tsx`: deleted its LOCAL `api()` fetch wrapper (which was byte-identical to `checkoutApi`)
  and now imports `{ checkoutApi as api }` — so all 8 call sites are unchanged and the two fetch surfaces
  share one client. Exact parity (same URL base, headers, envelope, no-localStorage rule).
- `cryptoTransfer.tsx`: replaced its 5 `axiosBaseApi.get/post(API_ENDPOINTS.pay.*)` sites with
  `payAxios.{getConfiguredCurrencies|getCurrencyRates|addPayment|verifyCryptoPayment}(...)`. The wrappers are
  literal pass-throughs returning the raw `AxiosResponse` and throwing on non-2xx exactly like axios, so every
  `response.data?.data` and `catch (e){ e.response.status/.data.message }` behaves identically. Removed the now
  -unused `axiosBaseApi` + `API_ENDPOINTS` imports (only a dead commented block still references them).
- Auth models preserved EXACTLY: fetch/Bearer/no-localStorage for the public surfaces; axios/interceptor for
  cryptoTransfer. No endpoint, payload, response-shape, or error-handling change.

Verified: `tsc --noEmit` EXIT 0. Live smoke on the TWO ACTIVE surfaces:
- InlineTipCheckout (`/devhub` → "Support me") reaches `currency_select` ("Pick a crypto to pay $10.00", full
  coin grid, receipt field) — its `api('/pay/getData')` through the shared client succeeded; no error boundary.
- CleanCheckoutV2 (`/pay/demo` mirror, which imports the extended `checkoutApi.ts`) renders the full waiting
  state with a live rate + QR ("Pay 0.40707496 LTC on Litecoin") — proving `payAxios` + the axios import did
  NOT break the anonymous checkout chunk. No error boundary.
- ⚠️ cryptoTransfer is the DORMANT fallback (only mounts when `NEXT_PUBLIC_CLEAN_CHECKOUT_V2=false`, a
  build-time env with no runtime/query override) so it could NOT be e2e-rendered in preview. Its rewrite is
  behaviour-preserving by construction (pass-through wrappers) + tsc-clean; verify in prod if the flag is ever
  flipped.

## Phase C — Single server-state (SWR) data layer — ✅ IMPLEMENTED on CleanCheckoutV2, FLAG-GATED (2026-06 fork)
User steer (ask_human): "a" — complete Phase C properly, flag-gated, then user does a live real-payment test
before it becomes default.

FINDING ON RESUME: a prior turn had added ONLY the scaffolding to `CleanCheckoutV2.tsx` — `import useSWR` +
the `SWR_ON` flag resolver — but NO actual `useSWR()` call and NO shared handlers. So the flag did nothing and
the legacy paths still ran for everything (tsc passed only because unused import/var are tolerated). Completed
the real wiring this turn.

WHAT SHIPPED (Components/Page/Pay3Components/CleanCheckoutV2.tsx — flag default OFF):
- Extracted TWO shared result handlers so BOTH paths process identically:
  - `applyMeta(r)` — the /pay/getData meta normalisation + setMeta + setPhase (currency_select | error).
  - `applyVerifyResult(r)` — the /pay/verifyCryptoPayment status machine (remaining_seconds, detected/pending,
    underpaid+partial, confirmed/overpaid → confirmedAmount + onSuccess, expired). Clears pollRef/timerRef on
    terminal states exactly as before.
- Legacy path (flag OFF): the original meta useEffect and the setInterval(10s) verify poll, each now guarded
  with `if (SWR_ON) return` and calling the shared handler. Byte-for-byte the old behaviour.
- SWR path (flag ON): `metaSwr = useSWR(SWR_ON ? ['checkout/getData', d] : null, …getData, {no focus/reconnect/
  stale revalidate, no retry})` and `verifySwr = useSWR(active ? ['checkout/verify', address, token] : null,
  …verify, { refreshInterval: 10_000, refreshWhenHidden: true, revalidateOnFocus: false, shouldRetryOnError:
  false })`. The verify key nulls out the moment phase leaves awaiting/underpaid (or address/token missing) so
  SWR stops automatically on confirmed/expired — no manual clearInterval. `refreshWhenHidden:true` matches the
  legacy setInterval (which polled even on a hidden tab — needed for the "switch tabs + notify" UX). The
  checkoutApi fetcher never throws (returns {ok:false} on network error) so SWR only ever sees resolved values
  → steady interval-driven polling, error branches handled inside applyVerifyResult.
- FLAG: `SWR_ON` = `NEXT_PUBLIC_CHECKOUT_SWR===true` OR `?swr=1` in the URL. Default OFF (env not set).
- SCOPE: only the meta load + verify polling migrated (as agreed). `reservePayment` (the multi-step address
  reservation) stays imperative — it's a one-shot user-triggered mutation, not a good SWR fit and out of scope.

VERIFIED (testing_agent iteration_95 = 100% frontend, on a FRESH live link created in-pod
d=6dd51132387bb90115c71f895b66f19a734e625c54b433ca so its Redis session exists here):
- Legacy vs SWR render BYTE-IDENTICAL: clean-checkout-h1='Pay The Dev Store', clean-checkout-amount='$20.00 USD',
  network-select='Litecoin', currency-select='LTC', instruction='Pay 0.4078054 LTC on Litecoin', pay-status-strip
  WAITING. Only the reserved address differs (expected — a fresh pool address per load, not a code diff).
- SWR verify-poll cadence: 3 POSTs to /api/pay/verifyCryptoPayment in a 25s window, intervals [10.0s, 10.28s] —
  exactly refreshInterval=10000. No double-fetch/poll when flag on (legacy effects correctly short-circuit).
- ZERO console errors, no error boundary, no clean-checkout-error on either path. frontend tsc EXIT 0.

⚠️ NOT YET DEFAULT: confirmed/underpaid/expired STATE TRANSITIONS need a REAL on-chain confirmation, which
cannot be exercised in preview. The flag stays OFF until the user runs a live real-payment test on the flagged
URL: PREVIEW_URL/pay?d=6dd51132387bb90115c71f895b66f19a734e625c54b433ca&swr=1 (link_id 277, $20, no expiry —
left LIVE on the prod DB specifically for this test).

REMAINING (Phase C extension): ✅ InlineTipCheckout DONE (same flag-gated SWR migration — testing_agent
iteration_96 = 100%: legacy vs ?swr=1 byte-identical status pill, 3 verify POSTs at [10.00s, 10.26s],
zero console errors). Only the DORMANT cryptoTransfer (redux-saga, flag-off, can't be e2e'd in preview)
is left — low priority.

## Phase C extension — SWR on InlineTipCheckout — ✅ DONE (2026-06 fork) — testing_agent iteration_96 = 100%
Applied the EXACT same flag-gated pattern to Components/Page/Creator/InlineTipCheckout.tsx (creator tips +
store checkout): extracted `applyMeta`/`applyVerifyResult` shared handlers; legacy meta useEffect + setInterval
poll each guarded `if (SWR_ON) return`; added `metaSwr=useSWR(['checkout/getData', d])` and
`verifySwr=useSWR(['checkout/verify', address, token], { refreshInterval:10_000, refreshWhenHidden:true,
revalidateOnFocus:false, shouldRetryOnError:false })`. Same `?swr=1` / NEXT_PUBLIC_CHECKOUT_SWR flag, default OFF.
Verified on the /devhub support widget (POST /api/pay/tip → live contribution session): legacy vs SWR render
identically (inline-tip-status-pill byte-identical; only reserved inline-tip-address differs per load — expected),
SWR poll fired 3 verify POSTs at [10.00s, 10.26s] = refreshInterval, zero console errors, no error boundary,
frontend tsc EXIT 0.

# ============================================================================
# 2026-06 — TATUM INTEGRATION BOUNDARY (P1) — controllers off apis/tatumApi — DONE
# ============================================================================
User steer (ask_human): "yes" to option (a) — the SAFE seam swap (not the high-risk full domain-verb rewrite).
GOAL (from handoff P1): "20+ controllers still directly import tatumApi instead of routing through proper
integration boundaries (BlockchainService/PaymentService)."

FINDING: `integrations/tatum/TatumClient.ts` (`export const tatumClient = tatumApi`) and
`services/blockchain/blockchainService.ts` (exposes `tatumClient` via `.client`) are PASS-THROUGH re-export seams
with no domain verbs — so option (a) = repoint controller imports at the seam (runtime-identical, same object).
Also discovered 13 of the 24 controllers had DEAD tatumApi imports (imported, never called).

WHAT SHIPPED (24 controllers, ZERO logic change):
- 11 files that USE it → `import { tatumClient } from "<rel>/integrations/tatum/TatumClient"` + call sites
  `tatumApi.*` → `tatumClient.*` (replace_all): adminController, paymentController,
  payment/settlement/{settleTransaction,chainVerification}, wallet/{cryptoVerify,tempAddress,feesEstimates,
  withdrawals,walletOtp,walletMutations,walletDeleteFlow}.
- 13 files with DEAD imports → import line REMOVED entirely (also resolves the direct import for them):
  payment/settlement/{receipt,verifyPayment}, wallet/{addressBook,analytics,exchange,exchangeConfirm,funding,
  fundingMethods,reusableWallets,transactionsDetail,transactionsList,walletShared,walletRead}.
- RESULT: `grep apis/tatumApi backend/controller/` = NONE; `grep tatumApi. backend/controller/` = NONE. The only
  remaining raw `apis/tatumApi` importers are the integration/infra layer (services/chains/*, services/blockchain,
  services/merchantPool/*, services/keyCustody, utils/tatumAuth, webhooks, apis) — the boundary's implementation,
  correctly left as-is — plus one-off backend/scripts/* + tests (out of scope).

VERIFIED: backend tsc EXIT 0; backend restarted (ts-node, no hot reload) → /health healthy (db+redis connected,
tatum_api operational CLOSED — proves TatumClient resolves at runtime); live curl on 3 migrated endpoints:
POST /api/pay/getData (paymentController) → full meta; GET /api/wallet/network-fees (feesEstimates →
tatumClient.batchFeeEstimation) → live fees; GET /api/wallet/reusable-wallets (dead import removed) → 200.
Behaviour-preserving by construction (tatumClient === default tatumApi). NOT DONE (deferred, high risk):
real domain verbs on BlockchainService + call-site rewrites — money-path, not preview-testable.

## Files touched
- Phase A: `Components/Page/Creator/InlineTipCheckout.tsx` (constants/types de-dup).
- Phase B: `Components/Page/Pay3Components/checkout/checkoutApi.ts` (added `payAxios` transport),
  `Components/Page/Pay3Components/cryptoTransfer.tsx` (5 calls → `payAxios`),
  `Components/Page/Creator/InlineTipCheckout.tsx` (local `api()` → shared `checkoutApi`).
  Shared `checkout/*` type/constant/helper modules otherwise unchanged.
