# ============================================================================
# NEXT ACTIONS BACKLOG — 2026-08-25 (pod f054383c)
# Source: OTP AutoFill fix session + Checkout/Payment load-test session.
# Status legend:  [ ] todo   [~] in progress   [x] done
# ============================================================================

## A. From the CHECKOUT / PAYMENT LOAD TEST (2026-08-25)
# Context: ran real settlement/sweep/reservation code under 1000 concurrency
# against an ISOLATED staging clone (schema-only) with LOADTEST_NO_BROADCAST=true.
# Correctness invariants ALL held (no double-settle, ledger balanced, no
# over-reserve, no double-sweep — testing-agent verified). One real capacity
# bottleneck was found AND FIXED. Everything below is FOLLOW-UP, not blockers.

### A0. [x] DONE & VERIFIED — network-fees aggregate cache (checkout capacity fix)
#   `services/blockchainFeeService.ts::getAllBlockchainFees()` fanned out to 15
#   per-chain lookups on EVERY request → GET /api/pay/network-fees p95 ≈ 13.4s at
#   1000 VUs. Added a 60s aggregate Redis cache (per-chain values already cached
#   5 min, so 60s aggregate is strictly fresh).
#   Result: 1000-VU throughput 972 → 3,567 req/s (3.7×); network-fees p95
#   13,400ms → 687ms (~20×); 0 server 5xx. Testing agent confirmed 8.7× on the
#   prod-preview backend (478ms cold → 55ms warm). Live in prod (safe).

### A1. [ ] Reservation burst headroom (per-merchant throughput ceiling)
#   FINDING (not a bug): `reserveAddress` serializes per merchant on Redis lock
#   `reserve-address:<uid>:<walletType>` with acquireLock(retries=3, delay=100ms).
#   Under a burst of MANY simultaneous checkouts for the SAME merchant, losers
#   get a graceful "Address reservation busy … please try again" (at 10 concurrent
#   /merchant in the test, ~80% hit backpressure). Correct & safe (client retries),
#   but a single merchant's flash-sale would see retries.
#   FIX OPTIONS (pick one): (a) grow the PRE_RESERVED pre-warm pool per merchant so
#   the LOCK-FREE fast path (optimistic `UPDATE … WHERE status='PRE_RESERVED'`)
#   absorbs the burst; (b) raise withLock retry/backoff for reservation only;
#   (c) a short per-merchant address queue. Ref: services/merchantPool/
#   merchantPoolReservation.ts (fast path L60-175, standard flow L~175-230,
#   backpressure throw L~227); pre-warm: replenishPreReservedPool.
#   ACCEPTANCE: 1000 concurrent same-merchant checkouts → <5% backpressure, still
#   zero over-reservation (re-run scripts/loadtest_money_path.ts).

### A2. [ ] network-fees stale-while-revalidate
#   Current 60s aggregate cache still has ONE slow request per 60s window when it
#   expires (herd mostly hits per-chain caches, so it's cheap, but not zero).
#   Add SWR: serve the last good payload instantly and refresh in the background
#   (single-flight guard so only one refresher runs). File: services/
#   blockchainFeeService.ts::getAllBlockchainFees (key `all_blockchain_fees_v1`).

### A3. [ ] Live load / money-path health dashboard (admin)
#   Admin page surfacing real-time settlement throughput, ledger balance
#   (DR==CR per currency), pending sweeps, and provider health (Tatum/FX/Redis).
#   Reuse: ledgerService.getBalances(), /health, existing monitoringService.

### A4. [ ] Reusable staging load-test kit
#   Turn this session's one-off into a committed, documented workflow:
#     1. pg_dump --schema-only (prod, PG18 client) → restore into an isolated
#        staging PG; point a second backend at staging PG+Redis with
#        ENABLE_BACKGROUND_JOBS=true, WORKER_ROLE=primary, LOADTEST_NO_BROADCAST=true.
#     2. Correctness: backend/scripts/loadtest_money_path.ts
#        (flags: --settle-payments --settle-concurrency --reserve
#         --reserve-merchants --sweep --sweep-concurrency).
#     3. Capacity: backend/scripts/loadtest_http.js
#        (flags: --base --concurrency --duration --warmup).
#   Wrap as scripts/staging-loadtest.sh with the safety pre-checks that
#   loadtest_money_path.ts already enforces (refuses unless
#   LOADTEST_NO_BROADCAST=true AND DB host is not prod 'roundhouse').

### A-REF. Load-test infrastructure that already landed (reuse, don't rebuild)
#   - utils/loadtestGuard.ts — isLoadtestNoBroadcast()/syntheticTxId(); gates the
#     irreversible broadcast+KMS ONLY when LOADTEST_NO_BROADCAST=true (UNSET in
#     dev/preview/prod → strict no-op). Gated seams:
#       controller/payment/settlement/settleTransaction.ts (settlement)
#       services/merchantPool/merchantPoolSweep.ts (balance read + KMS + fee/
#         profitability + broadcast)
#       apis/tatumApi.ts (createSubscription / createSubscriptionBlockBeeStyle)
#   - backend/scripts/loadtest_money_path.ts (correctness harness)
#   - backend/scripts/loadtest_http.js (HTTP capacity driver)

## B. From the OTP AUTOFILL FIX (2026-08-25)
### B0. [x] DONE & VERIFIED — iOS/Android OTP AutoFill fills all 6 boxes
#   Components/UI/OtpInputPanel/index.tsx: removed DOM maxLength=1 (WebKit
#   truncated AutoFill insert to the first digit); multi-digit insert now
#   distributed atomically; select-on-focus; Android GBoard keys allowed.
#   Harness: pages/qa/otp-harness.tsx. Testing agent 8/8 PASS.

### B1. [ ] SMS AutoFill hint (nice-to-have, user-suggested)
#   Make text-message OTP codes show the one-tap suggestion reliably by adding a
#   domain-bound code format (e.g. "@dynopay.com #123456") to the OTP SMS body.
#   Files: OTP SMS send path (Telnyx/Infobip) in services/*sms*/otp senders.

### B2. [ ] Font-flash polish & landing speed report (carried from prior sessions)
#   (Pre-existing backlog items — see CHANGELOG; not started.)

# ============================================================================


# ============================================================================
# UPDATE — 2026-08-24 (prod-connected pod): Items 1, 4, 5 progressed
# ============================================================================
# ITEM #1 — DONE & verified.
#   The 4 models that still self-synced at import (buyButton, publishableKey,
#   serviceHealth, customerTransaction) were moved into the versioned boot
#   migration runner (new migration `0002_boot_model_tables_extra`); their
#   import-time `.sync()` side-effects were removed. Boot now provisions ALL
#   boot tables through versioned, recorded migrations (create-only in prod).
#   Verified: `yarn build` (tsc) = 0 errors; prod boot applied 0002 idempotently
#   ("1 applied, 1 present"; subsequent boots "0 applied, 2 present").
#
# ITEM #4 — DONE & verified (all convertible literal reads migrated).
#   * server.ts: 23 reads -> config.str/config.raw (exact semantics preserved,
#     incl. the compound isProduction/enableBackgroundJobs logic).
#   * 342 reads across 99 files -> config.raw / aliased raw("X") via a new
#     `raw()` helper on config (byte-identical `process.env[key]` passthrough,
#     type-identical string|undefined) — surrounding `|| default` / coercion
#     kept intact. Import auto-added per file (alias chosen to avoid collisions).
#   * Intentionally LEFT: apis/tatumApi.ts (per prior decision), utils/config.ts
#     + utils/envValidator.ts (the config surface + single validation gate),
#     dynamic bracket reads in volumeTier/feeConfig/adminUtils, and worker.ts
#     (which WRITES process.env.* before importing the server).
#   Verified: full `tsc` build = 0 errors; clean prod boot; read-only endpoints
#   (/health, /api/public/tickers, /api/public/fx-rates, /api/geo-detect,
#   /api/csrf-token, root) all 200.
#
# ITEM #5 — WAVE done & verified (frontend testing agent: 100% pass).
#   Standardized 5 read-only data hooks/section onto the shared useApiSWR:
#     hooks/useOnboardingStatus.ts, hooks/useFeeFreeStatus.ts,
#     hooks/usePublishableKeys.ts, hooks/useBuyButtons.ts,
#     Components/Page/API/WebhookConsoleSection.tsx (2 inline useSWR calls).
#   (tuple SWR keys -> string key + `select` to preserve exact URL/shape;
#    exported ONBOARDING_KEY/FEE_FREE_KEY fetchers kept for prefetchDashboard.)
#   Verified: frontend `tsc --noEmit` = 0; eslint clean; browser test PASS on
#   login, Developers/API (Publishable Keys + Buy Buttons + Webhook console),
#   dashboard (fee-free widget + onboarding banner), invoices/customers/
#   notifications/settings — no crashes/overlays/infinite spinners.
#   STILL BESPOKE by design (mutation/payment/crypto/stateful — leave as-is):
#     CreatorPageSettings, ActiveSessions, useReusableWallets, usePaymentRates,
#     HelpAndSupport (imperative search), admin/* pages (use adminBaseApi, need a
#     separate admin SWR fetcher), QuickActionsDock, and all payment/crypto
#     components. Remaining read-only screens can be converted in further waves.
# ============================================================================


# DynoPay — Refactor & Deployment Status (2026-08-24)

---
## UPDATE 2026-08-24 (v2 pod) — Items #1, #4, #5 progressed

Environment this session: LOCAL isolated Postgres 15 + Redis (no live data) in SAFE MODE
(`ENABLE_BACKGROUND_JOBS=false`, NODE_ENV=production). Seeded login: testmerchant@dynopay.dev.

- **Item #1 — DONE & verified.** Added a versioned migration runner
  (`backend/utils/migrationRunner.ts` + `backend/migrations/bootMigrations.ts`, a
  `schema_migrations` table). `server.ts` (~L1376) now: production applies the boot table
  creation ONCE (recorded/auditable, no 17-way DDL introspection each restart); development
  keeps `alter:true` auto-sync. Verified: tsc build exit 0; boot healthy; first boot `1 applied`,
  restart `0 applied, 1 already present` (idempotent). Backend testing agent: 5/5 PASS.
- **Item #4 — Wave 2 done.** Migrated ALL raw `process.env` reads in
  `services/merchantPool/merchantPoolConfig.ts` (33) and `services/merchantPoolValidator.ts` (21)
  → typed `config` (config.str/config.num), semantics preserved. tsc exit 0; merchant-pool
  validation passes at boot. Remaining (~625 reads) still to migrate in later waves
  (server.ts 23, diagnosticsRouter 18, feeWalletMonitor 13, paymentController 12, …;
  `apis/tatumApi.ts` intentionally left).
- **Item #5 — Wave 1 done (3 screens).** Converted bespoke per-file SWR fetchers to the shared
  `useApiSWR`: `Components/Page/Profile/LoginActivity.tsx`,
  `Components/Page/Dashboard/ReferralCodeCard.tsx`, `pages/referrals.tsx` (5 SWR calls).
  Frontend `tsc --noEmit` = 0 errors; ESLint clean; routes compile. **Pending frontend-agent
  verification.** Remaining ~27 files across waves (some — e.g. ActiveSessions, ConversionBanner,
  CreatorPageSettings — need care: array-shaped mutate / stateful forms).

---


Handoff document covering the work done this session: the **DigitalOcean deployment fix**
and progress on the **5 leftover refactor recommendations** from the prior agent.

- **Environment used:** Emergent preview pod, backend on `ts-node --transpile-only` (port 3300 behind a
  Python proxy on 8001), Next.js frontend (port 3000). Preview URL:
  `https://dynopay-setup-4.preview.emergentagent.com`
- **Database during this session:** pointed at a **STAGING** Railway Postgres (an empty schema clone of
  prod — 70 tables, no data) for safe testing. Prod values are preserved (commented) in
  `backend/.env` for a one-line switch-back. **SAFE MODE** throughout (`ENABLE_BACKGROUND_JOBS=false`,
  `WORKER_ROLE=secondary`) — no fund-movement/sweeps/settlement jobs ran.
- **Verification tooling:** `yarn build` (tsc), `tsc --noEmit`, standalone ts-node unit tests, and the
  automated backend testing agent.

---

## 0. DigitalOcean deployment blocker — ✅ FIXED & VERIFIED

**App:** `dynopay` (DO App Platform, region ams), builds from `/Dockerfile` on
`github.com/databasedyno/DynoRedesign@Improvement`, `deploy_on_push: true`, live at dynopay.com.

**Symptom:** latest deploys (commits `860cbff`, `bfebb50`) failed at the **BUILD** step
(`BuildJobExitNonZero`); an older successful build stayed live.

**Root cause (from the DO build log):** the backend build step `yarn build` runs `tsc` (a *full*
type-check, not transpile-only) and aborted with a single error:

```
server.ts(254,9): error TS2769: No overload matches this call.
  Argument of type 'RequestHandler<...>' is not assignable to parameter of type 'PathParams'.
error Command failed with exit code 2  →  build failed
```

`@types/compression` pulls a different `@types/express-serve-static-core` than `@types/express@4`, so
`compression()`'s returned `RequestHandler` didn't match `app.use()` and TS fell back to the
`app.use(path)` overload. Because the running pod uses `ts-node --transpile-only`, runtime never saw
the error — but the Docker build's real `tsc` did, blocking **every** deploy since the `compression()`
middleware was introduced.

**Fix:** `backend/server.ts` (~line 254) — cast the middleware to this app's express type:

```ts
app.use(compression({ /* ...filter... */ }) as unknown as express.RequestHandler);
```

Compile-time only; runtime behaviour is unchanged.

**Verification:**
- `cd backend && yarn build` (the exact DO build command) → **exit 0** (previously exit 2).
- Frontend `tsc --noEmit` at repo root → **0 errors** (the whole tree compiles).
- Backend testing agent → **4/4 PASS, no regression** (`/health` healthy, public `/api` endpoints
  respond without 5xx, gzip middleware active).

**To deploy:** use **"Save to GitHub"** (pushes to `Improvement`; `.env` is gitignored so no secrets
leave). `deploy_on_push` then rebuilds automatically and the build will now succeed. A DO redeploy was
*not* triggered from here because it would only rebuild the still-broken commit until the fix is pushed.

---

## 1. Status of the 5 original recommendations

| # | Recommendation | Status | Remaining |
|---|---|---|---|
| 3 | Single webhook-signature verifier (~8 places) | ✅ Done & verified | — |
| 2 | Consolidate Tatum usage behind one wrapper | ✅ Done & verified | — |
| 1 | Boot-time `model.sync()` → migrations | 🟡 Core done | Move the 17 already-safe `server.ts` boot syncs to versioned migrations (low urgency) |
| 4 | Centralize ~740 `process.env` reads into typed config | 🟡 Foundation + wave 1 | ~700 remaining reads migrate incrementally |
| 5 | Standardize frontend fetching (67 manual-axios screens → SWR) | 🟡 Foundation only | Convert the 67 screens (needs frontend-test approval + a staging login) |

**2 of 5 fully complete; the other 3 have their high-value / high-risk core done** with clearly-bounded
incremental work remaining.

---

### Item 3 — Single inbound webhook-signature verifier ✅ DONE

Consolidated the hand-rolled, duplicated inbound verification crypto into one tested module.

- **New:** `backend/utils/webhookSignature.ts` — `hmacHex`, `verifyHmacHex`, `verifyTatumSignature`
  (HMAC-SHA512 → `x-payload-hash`), `verifyVeriffSignature` (HMAC-SHA256 of raw bytes →
  `x-hmac-signature`, keeps the strict 64-hex guard), `verifyFlutterwaveHash` (plain shared-secret →
  `verif-hash`). All comparisons are constant-time (`utils/hmac.ts::timingSafeCompare`).
- **Refactored:** `routes/index.ts` (Tatum), `services/veriffService.ts` (`signRaw`/`verifyWebhookRaw`),
  `webhooks/index.ts` (Flutterwave). Behaviour byte-identical; only hardening is the previously-plain
  `!==` compares (Tatum, Flutterwave) are now timing-safe.
- **Verified:** `backend/tests/test_webhook_signature.ts` → **29/29** (proves each verifier matches the
  original accept/reject decision + rejects malformed/short/empty/wrong-secret). tsc clean, boot clean.

---

### Item 2 — Consolidate Tatum usage behind one auth/config source ✅ DONE

Most files already used the wrapper `apis/tatumApi.ts` or the resilient client `utils/tatumHttp.ts`.
The remaining inconsistency was ~8 files each reading `process.env.TATUM_KEY` and hardcoding
`https://api.tatum.io/...` with their own headers.

- **New:** `backend/utils/tatumAuth.ts` — single source: `TATUM_V3_URL`, `TATUM_V4_URL`,
  `isTatumTestnet`, `getTatumApiKey` (testnet-aware), `getTatumHeaders`, `getTatumWeb3Url`.
- **Migrated (7 files):** `helper/currencyConvert.ts`, `services/blockchainFeeService.ts`,
  `services/reconciliation.ts`, `services/tronEnergyService.ts`, `services/rpcHealthMonitor.ts`,
  `services/migrateWebhookUrls.ts`, `services/merchantPool/directEvmTransfer.ts`. All now use the shared
  config (+ the resilient `tatumHttp` transport several already used). Byte-identical in mainnet; a
  correctness fix in testnet.
- **Left untouched (deliberate):** the 4135-line monolith `apis/tatumApi.ts` keeps its richer
  `getTatumKey()` (adds a Google Secret Manager fallback). Both resolve to the same env key when present.
- **Verified:** `backend/tests/test_tatum_auth.ts` → **11/11**; tsc clean; boot log
  "Refreshed 40 rates via Tatum" proves the migrated rate path works end-to-end.

---

### Item 1 — Boot-time sync cleanup 🟡 CORE DONE

The real risk was **4 models calling `.sync({ alter: true })` unconditionally at import** — ALTERing the
LIVE prod schema on every backend restart:
`models/buyButtonModel.ts`, `models/customerModels/customerTransactionModel.ts`,
`models/serviceHealthModel.ts`, `models/publishableKeyModel.ts`.

- **Fix:** each now uses `.sync({ alter: process.env.NODE_ENV !== "production" })` — **create-only in
  production** (never ALTER on boot; tables still auto-created on a fresh DB), alter only in dev. Matches
  `server.ts`'s existing `isProduction ? {} : {alter:true}` pattern.
- **Verified on staging:** clean boot, all 4 tables' create-only sync ran as a no-op, no errors,
  tables intact.
- **Remaining (low urgency):** the 17 boot syncs in `server.ts` already run create-only in prod (safe);
  converting them to versioned migrations is the leftover, largely-cosmetic step.

---

### Item 4 — Typed config surface 🟡 FOUNDATION + WAVE 1

`utils/envValidator.ts` already hard-fails boot on missing required vars (the single validation gate);
`utils/config.ts` is the typed read surface. A big-bang rewrite of 700+ call sites is neither safe nor
verifiable, so reads are migrated in **boot-verifiable waves**.

- **Expanded** `backend/utils/config.ts` with grouped, typed entries (exact current defaults): `db.*`
  (url/name/user/password/host/port/pool/ssl), `redisUrl`, `enableBackgroundJobs`, `adminEmail`, plus
  existing env/urls/secrets/workerRole.
- **Wave 1 migrated (boot-verifiable):** `utils/dbInstance.ts` (all DB reads → `config.db.*`) and
  `utils/redisInstance.ts` (`config.redisUrl`). App reconnected to DB + Redis cleanly.
- **Verified:** `backend/tests/test_config.ts` → **18/18**; tsc clean; boot healthy.
- **Remaining:** ~700 raw `process.env` reads migrate incrementally (concentrated in
  `merchantPoolConfig.ts`, `server.ts`, controllers). New/touched code should read from `config`.

---

### Item 5 — Standardize frontend data fetching on SWR 🟡 FOUNDATION ONLY

The app has SWR v2, a global `<SWRConfig>` (options only, no global fetcher) and a strong `hooks/`
convention, but every hook/component re-defines its own `fetcher`.

- **New (additive, lint-clean, imported nowhere yet → zero behaviour change):**
  - `utils/swrFetcher.ts` — one shared fetcher over the authenticated `axiosBaseApi`
    (`swrFetcher` → `res.data`; `swrDataFetcher` → `res.data.data`); supports string + tuple keys.
  - `hooks/useApiSWR.ts` — reusable typed hook (`data/error/isLoading/isValidating/mutate`, `enabled`
    to defer, `unwrap` for the `{data:{}}` envelope).
- **Remaining (the bulk):** convert the ~67 manual `axios`-in-`useEffect` screens to `useApiSWR`, in
  verified waves. **Blocked on:** (a) approval to run the frontend testing agent, and (b) a seeded
  verified test login in the empty staging DB (or point back to prod for read-only verification).

---

## 2. Also surfaced (not yet actioned — your call)

- 🐞 **Flutterwave handler bug** (`webhooks/index.ts`): on a bad `verif-hash` it sends `res.status(401).end()`
  but does **not** `return`, so the handler keeps processing (and later throws "headers already sent").
  Exact behaviour was **preserved** during the Item-3 refactor and flagged for a separate fix.
- 🛡️ **CI `tsc` gate** — add a pre-merge type-check so a `tsc` error blocks the PR instead of silently
  failing at deploy time (would have caught the DO blocker).

---

## 3. File manifest (this session)

**New files**
```
backend/utils/webhookSignature.ts          (item 3)
backend/utils/tatumAuth.ts                  (item 2)
backend/tests/test_webhook_signature.ts     (item 3 — 29/29)
backend/tests/test_tatum_auth.ts            (item 2 — 11/11)
backend/tests/test_config.ts                (item 4 — 18/18)
utils/swrFetcher.ts                         (item 5 foundation, frontend)
hooks/useApiSWR.ts                          (item 5 foundation, frontend)
REFACTOR_STATUS.md                          (this document)
```

**Modified files**
```
backend/server.ts                                   (DO deploy fix — compression cast)
backend/routes/index.ts                             (item 3 — Tatum verifier)
backend/services/veriffService.ts                   (item 3 — Veriff verifier)
backend/webhooks/index.ts                           (item 3 — Flutterwave verifier)
backend/helper/currencyConvert.ts                   (item 2)
backend/services/blockchainFeeService.ts            (item 2)
backend/services/reconciliation.ts                  (item 2)
backend/services/tronEnergyService.ts               (item 2)
backend/services/rpcHealthMonitor.ts                (item 2)
backend/services/migrateWebhookUrls.ts              (item 2)
backend/services/merchantPool/directEvmTransfer.ts  (item 2)
backend/utils/config.ts                             (item 4 — expanded)
backend/utils/dbInstance.ts                         (item 4 — wave 1)
backend/utils/redisInstance.ts                      (item 4 — wave 1)
backend/models/buyButtonModel.ts                    (item 1)
backend/models/customerModels/customerTransactionModel.ts (item 1)
backend/models/serviceHealthModel.ts                (item 1)
backend/models/publishableKeyModel.ts               (item 1)
```

> `backend/.env` and `.env` were rebuilt for the pod but are **gitignored** (not part of any push).

---

## 4. How to verify locally

```bash
# Backend build (the exact DigitalOcean build step) — must exit 0
cd backend && yarn build

# Frontend type-check — must report 0 errors
cd /app && npx tsc --noEmit

# Unit tests (no DB / no network)
cd backend
node_modules/.bin/ts-node --transpile-only tests/test_webhook_signature.ts   # 29/29
node_modules/.bin/ts-node --transpile-only tests/test_tatum_auth.ts          # 11/11
node_modules/.bin/ts-node --transpile-only tests/test_config.ts              # 18/18
```

---

## 5. Suggested next steps

1. **Save to GitHub** → DO auto-rebuilds (`deploy_on_push`) and the deploy succeeds.
2. Optionally have me **watch/trigger the DO deployment** and confirm it goes ACTIVE.
3. Resume **Item 5** screen conversions in verified waves (needs frontend-test approval + a staging login).
4. Continue **Item 4** env-read migration in waves; and/or apply the small **Flutterwave `return`** fix.


---

## 6. NEXT ACTION ITEMS (2026-08-24 v2 — after P0 login fix + Item#5 wave 2 + Item#4 wave)

Context: SAFE MODE + LOCAL isolated Postgres/Redis. Login: testmerchant@dynopay.dev / TestMerchant123!.
Flutterwave webhook `return` fix is DE-SCOPED per user ("only focusing on crypto").

1. **Env Config Wave (Item #4)** — Move the next batch of backend `process.env` reads into the typed
   `utils/config.ts` surface: `server.ts` (~23 reads), `routes/diagnosticsRouter.ts` (~18),
   `controller/paymentController.ts` (~12). Migrate in boot-verifiable waves; new/touched code reads
   from `config`. (~610 raw reads remain overall.)

2. **More SWR Screens (Item #5)** — Migrate a few more read-only dashboard screens onto the shared
   `useApiSWR` hook. Keep the mutation-heavy / crypto / payment components bespoke (AddWalletModal,
   CampaignManager, ProductQuickSell, ConversionBanner, CreatorPageCard, HandleClaimNudge,
   SupportChatWidget, cryptoTransfer, pay-links/[slug], useReusableWallets, usePaymentRates).

3. **Test Company Seed** — Seed a company + a wallet for the test merchant so currency selectors
   (DisplayCurrencySelector / UserDisplayCurrencySelector are gated on a selected company) and payout
   flows can be regression-tested end-to-end by the frontend testing agent.

4. **Live Payment Toasts (enhancement)** — Show a real-time "payment received" toast on the dashboard
   the moment a crypto payment settles (on-brand delight for the crypto-checkout platform).

### Done this session (2026-08-24 v2)
- **P0 fix**: `backend/server.py` reverse-proxy gzip mismatch (forwarded `accept-encoding` + stripped
  `content-encoding` while shipping the compressed body + stale `content-length`) → browsers couldn't
  decode login. Fixed (stop forwarding `accept-encoding` on the internal hop; drop backend
  `content-length`). UI login now reaches /dashboard (testing agent iteration_77 PASS).
- **Item #5 wave 2 (5 files)**: `help-support/[slug]`, `system-status`, `DisplayCurrencySelector`,
  `UserDisplayCurrencySelector`, `useStorefrontProfile` → shared `useApiSWR`. (13 total migrated.)
- **Item #4 wave**: `services/feeWalletMonitor.ts` (13 env reads → typed `config`).
- **MEDIUM fix**: help-article cards → semantic Next `<Link>` (reliable/keyboard/right-click nav).


---

## 7. BALANCES & PAYOUTS SESSION (2026-08-24 fork, prod-connected) — DONE + NEXT ITEMS

Context: LIVE Railway prod DB, SAFE MODE. Login: hostbay@moxx.co / Katiekendra123@.
All work verified via `tsc` + curl (read-only) + logged-in screenshots; testing agent NOT used
(would risk mutating the live prod DB / leaving auto-convert toggled).

### Done this session (Balances & Payouts, `/payouts`)
- **Inline Auto-Convert control** — replaced the read-only chip + "Manage → Settings" button with a live
  Switch + settlement-coin picker wired to `PUT /company/auto-convert/:id` (reuses ConversionBanner
  logic). Verified via curl round-trip (enable → verify → disable → restored, no residue).
- **Pending Funds card** — new `GET /api/dashboard/pending-summary?company_id=` (fresh-pending rows +
  accurate USD total, same conversion logic as the CSV export). Card shows "≈ $X / N payments awaiting".
- **Auto-Convert Savings card** — new `GET /api/company/conversion-savings/:id` (aggregates
  tbl_stablecoin_conversion: month/all-time converted USD + count + in-progress). "$X THIS MONTH".
- **Payout History Export (CSV)** — Payouts export via `POST /wallet/transactions/export` with a range
  picker (7/30/90/365 days + **Custom range** date pickers), a **"Settled only"** checkbox
  (backend `settled_only` → `status IN ('successful','completed')`), correct `date_from`/`date_to`.
- **Fixed legacy Transactions export dates** — `Components/Page/Transactions/index.tsx` was sending
  `startDate`/`endDate` (backend ignores them); now sends `date_from`/`date_to` so the range applies.
- **Item #5 SWR wave** — migrated `hooks/useDisplayFx.ts` (GET user/display-currency) from a hand-rolled
  module cache to the shared `useApiSWR`. Remaining dashboard components (ConversionBanner,
  CreatorPageCard) stay bespoke by design (mutation/crypto).

### NEXT ACTION ITEMS (surfaced this session, not yet built)
1. **Remember Last Range** — persist the merchant's last-used payout export range/dates (e.g.
   localStorage) so it's pre-selected next visit.
2. **Custom Range in Transactions** — bring the same custom-date export UX to the main Transactions
   page so both surfaces match.
3. **Savings Sparkline** — small 6-month trend under "Auto-convert protection" (needs a monthly
   aggregate endpoint over tbl_stablecoin_conversion).
4. **Pending Auto-Refresh Toast** — notify on the Payouts page the moment a pending payment confirms and
   moves to settled (poll/SSE-driven).
5. **Payout Email Digest** — opt-in weekly email summarising settled payouts + anything still pending
   (a `payoutDigestService` already exists — extend it).

### Backlog (carried from prior forks)
- **Item #4 (typed config)** — ~610 raw `process.env` reads still to migrate to `utils/config.ts` in
  boot-verifiable waves (server.ts, diagnosticsRouter, paymentController, …; apis/tatumApi.ts left).
- **Item #5 (SWR)** — remaining read-only screens; mutation/crypto/payment components stay bespoke.
- **Item #1** — move the 17 already-safe `server.ts` boot syncs to versioned migrations (low urgency).
- Flutterwave webhook `return` bug (`webhooks/index.ts`) — DE-SCOPED (crypto-only focus).

### New/modified files this session
```
Backend (new endpoints/params):
  controller/dashboardController.ts            (+getPendingSummary, +convertToUSD import)
  routes/dashboardRouter.ts                    (+/pending-summary)
  controller/company/autoConvert.ts            (+getConversionSavings, +Op import)
  controller/companyController.ts              (barrel: +getConversionSavings)
  routes/companyRouter.ts                      (+/conversion-savings/:id)
  controller/wallet/transactionsDetail.ts      (+settled_only export flag)
Frontend:
  Components/Page/Payouts/index.tsx            (inline auto-convert, pending card, savings card,
                                                CSV export w/ presets+custom range+settled-only)
  Components/Page/Transactions/index.tsx       (export date_from/date_to fix)
  hooks/useDisplayFx.ts                         (Item #5 -> useApiSWR)
```

---

## 8. NEXT-ITEMS PROGRESS (2026-08-24 fork) — 3 of the §7 items now BUILT

- ✅ **Custom Range in Transactions** — the Transactions export already honoured the page's date-range
  picker (post the date_from/date_to fix); added a **"Settled only"** checkbox next to Export for full
  parity with the Payouts export (`TransactionsTopBar` + `settled_only` in the export payload).
- ✅ **Savings Sparkline** — `getConversionSavings` now returns `monthly[6]`; the Payouts
  "Auto-convert protection" card renders `Components/UI/Sparkline` (shown once conversions exist).
- ✅ **Payout Email Digest (opt-in)** — NEW `payout_digest_weekly` column via idempotent migration
  **0003_add_payout_digest_pref** (APPLIED ON LIVE PROD, additive/safe), wired through the notification
  preferences get/update, gated `payoutDigestService.sendPayoutDigestsToAll` on the opt-in, and added a
  "Weekly payout digest" toggle + "Send preview" button on `/payouts`. Cron send + preview email NOT
  e2e-tested here (background jobs disabled; preview sends a real Brevo email).

### Remaining §7 next-items (not yet built)
- **Remember Last Range** — persist the merchant's last-used payout export range/dates.
- **Pending Auto-Refresh Toast** — notify on /payouts the moment a pending payment confirms → settled.

### Backlog (carried)
- Item #4 typed config (~610 raw `process.env` reads), Item #5 remaining read-only SWR screens,
  Item #1 (17 server.ts boot syncs → migrations). Flutterwave webhook `return` bug DE-SCOPED.



---

## 9. DEPLOYMENT UNBLOCK + STOREFRONT POLISH (2026-08-24 fork) — file-size gate FIXED

Login: hostbay@moxx.co / Katiekendra123@ (LIVE prod DB, SAFE MODE).

### ✅ DONE — Pre-commit / deploy blocker (file-size R2 budget)
The `.husky/pre-commit` hook runs `backend/scripts/check-file-size.mjs`, which HARD-FAILS (exit 1)
any NEW backend `.ts` file > 500 lines that is not grandfathered in
`backend/scripts/file-size-baseline.json`. This was **blocking Save-to-GitHub / deploy**.

- **Offender:** `controller/company/autoConvert.ts` = **510 lines** (grew past 500 when the savings
  sparkline `monthly[6]` logic was added to `getConversionSavings` in §7/§8). Not in the baseline →
  the gate blocked the commit.
- **Fix (clean extraction, NOT grandfathering):** moved `getConversionSavings` into a new module
  `controller/company/conversionSavings.ts` (98 lines). `autoConvert.ts` is now **429 lines** (under
  budget) with its now-unused `Op`/`QueryTypes`/`sequelize` imports removed. The
  `companyController.ts` barrel now imports `getConversionSavings` from `./company/conversionSavings`
  and the rest from `./company/autoConvert`. Route `GET /api/company/conversion-savings/:id` unchanged.
- **Verified:** `node backend/scripts/check-file-size.mjs` → **EXIT 0** ("no new backend file exceeds
  500 lines, 57 legacy files grandfathered"); `cd backend && yarn build` (the exact DO/tsc build cmd) →
  **EXIT 0**; endpoint still resolves (`GET /api/company/conversion-savings/1` → 401 = wired, needs
  auth). Backend hot-reloaded clean.
- **NOTE (warn-only, non-blocking):** several grandfathered legacy files have grown 1–100+ lines past
  their baseline (dashboardController 1334→1441, productController 784→871, cartController 832→878,
  chainVerification 1697→1704, etc.). These only WARN (the hook does not block on legacy growth) — but
  if any needs editing later, prefer extracting a module over extending, or bump its baseline entry.

FILES: NEW `backend/controller/company/conversionSavings.ts`; MOD
`backend/controller/company/autoConvert.ts` (trimmed), `backend/controller/companyController.ts` (import).

### ⏳ PENDING (planned, awaiting user go-ahead) — Storefront tab testids + @handle in checklist
Last in-progress item from the handoff (frontend-only), plan confirmed but not yet applied:
1. **Stable tab-panel testids** — wrap each rendered Storefront tab in `pages/storefront/index.tsx`
   with `storefront-tabpanel-page` / `-products` / `-share` (tab BUTTONS already have testids; the
   content panels' root testids vary by inner state, so a stable wrapper is needed for automated tests).
2. **@handle inline in onboarding checklist** — in `Components/Page/Dashboard/v2026/ActivationChecklist.tsx`,
   when a handle exists, render the reserved `@handle` (e.g. `@hostbay`) as a subtle chip next to the
   "Open your storefront…" step so it feels claimed at a glance (uses `useStorefrontProfile`).
   → After applying: frontend `tsc`, one smoke screenshot, then the frontend testing agent (handoff
   flagged testing-agent required).

### Backlog (carried)
- **Remember Last Range** — persist the merchant's last-used payout export range/dates (localStorage).
- **Pending Auto-Refresh Toast** — already built in §"Payouts row rendering" fork; verify live when a
  real pending payment settles.
- Item #4 typed config (~610 raw `process.env` reads), Item #5 remaining read-only SWR screens,
  Item #1 (17 `server.ts` boot syncs → migrations). Flutterwave webhook `return` bug DE-SCOPED
  (crypto-only focus).

---

## 10. CRYPTO REFUND FLOW — Phase A+B BUILT (2026-08-24); Phase C pending prod validation

Refunds were previously DE-SCOPED; the user re-scoped them with a specific on-chain design.
The design spec is below. **UPDATE — Phase A + Phase B are now BUILT & verified** (backend + merchant UI,
behind `ENABLE_CRYPTO_REFUNDS`; the preview runs in `REFUND_DRY_RUN=true`). Phase C (on-chain
forwarding) is implemented as a HARD-GATED entrypoint only — pending production validation.

### Confirmed decisions (final, from the user)
- Same crypto asset + amount (NOT USD value). Single refund per payment, custom/partial amount ≤ paid.
- Merchant covers gas. Scope = product orders + standard payment links.

### What was BUILT (2026-08-24)
- Migration `0004_crypto_refund_flow` (APPLIED ON LIVE PROD, additive): `tbl_refund` + `tbl_product_order.refund_address`.
- `models/userModels/refundModel.ts` (tbl_refund).
- `services/refund/refundChains.ts` — chain metadata (all chains) + PURE helpers (amount cap, deposit plan,
  gas coverage native-vs-token, state machine). 43 unit tests pass (`tests/test_refund_logic.ts`).
- `services/refund/refundService.ts` — resolveOriginalPayment (order/link), estimateGasBuffer (live + static
  fallback), createRefund (single-refund guard, dry-run placeholder vs `reserveAddress`), get/list/cancel,
  and `forwardRefund` (Phase C — HARD-REFUSES unless jobs on & not dry-run).
- `controller/refund/refundController.ts` + `routes/refundRouter.ts` (gated by ENABLE_CRYPTO_REFUNDS → 404 when off).
  Endpoints: `GET /preview`, `POST /`, `GET /`, `GET /:id`, `POST /:id/cancel`, `POST /capture-address` (public, CSRF-exempt).
- Config flags: `ENABLE_CRYPTO_REFUNDS`, `REFUND_DRY_RUN`. Frontend flag `NEXT_PUBLIC_ENABLE_CRYPTO_REFUNDS`.
- Frontend: `Components/Page/Refund/CryptoRefundModal.tsx` (preview → partial amount → create invoice → status/cancel),
  wired into the product Orders page + the Payment Links table (desktop + mobile), gated by the frontend flag.
- Verified: tsc (backend+frontend) 0 errors; ESLint clean; e2e dry-run via API on a real paid order
  (capture-address → preview → create partial → single-refund guard) then FULLY CLEANED UP (0 rows left).

### Phase C (NOT wired — production only)
On a confirmed merchant deposit, reuse the sweep/forward rails (fee-wallet gas funding for token chains) to
send the refund to the customer, transition forwarding→completed, persist `forward_txid`, write ledger
(`refund_liability`), email the customer, fire a webhook. MOVES REAL FUNDS — enable
`ENABLE_CRYPTO_REFUNDS` + `ENABLE_BACKGROUND_JOBS`, set `REFUND_DRY_RUN` unset/false on the prod worker,
then validate with a small live amount before general availability.

---
### ORIGINAL SPEC (retained for reference)

### The flow (as described by the user)
1. **At checkout (customer):** the customer provides a **refund destination wallet address**. If a refund
   is ever needed, this is where their crypto goes. Tied to the CHAIN the customer paid on.
2. **Merchant refund:** the merchant opens the invoice/order → clicks **Refund** → DynoPay generates a
   **refund invoice** that shows a **DynoPay-controlled wallet address on the SAME chain the customer
   used**, with a crypto payment option. The merchant sends crypto to that DynoPay address; DynoPay then
   **forwards it to the customer's saved refund address**. The refund is **locked to the original chain** —
   the merchant cannot refund on a different chain.

### CONFIRMED decisions (from the user)
- **[1a] Custody path = DynoPay-mediated.** Merchant pays into a DynoPay-controlled address (customer's
  chain); DynoPay forwards to the customer's saved refund address. (Mirrors the normal checkout rails —
  reuse merchant-pool / temp-address + forwarding infra.)
- **[2b] Refund destination = typed address only.** Always require the customer to TYPE a refund wallet
  address at checkout. DROP the "refund to the same wallet I paid from" auto-detect (unreliable on
  UTXO chains like BTC; simpler & safest to require an explicit address).
- **[5] Scope = Storefront + Payment Links** (NOT the general Invoices feature). Exact storefront
  sub-surfaces — product orders vs tips/donations — being confirmed (see OPEN below).

### RECOMMENDED (proposed by agent, awaiting final user confirm)
- **[3] Amount:** refund in the **SAME crypto asset + amount** the customer originally paid (e.g. sent
  0.01 ETH → gets 0.01 ETH back), **NOT the USD value** (avoids FX disputes when price moves; matches
  "same chain the customer used"). Support **partial** refunds (editable amount, capped at original;
  full is the default). Option to ship v1 as full-only if the user prefers.
- **[4] Gas/network fee:** the **merchant covers it** — refund invoice total = refund amount +
  network-fee buffer, so the customer receives the FULL original crypto amount ("made whole"). Estimate
  fees via existing `services/blockchainFeeService.ts` / `services/tronEnergyService.ts`.

### OPEN questions (blocking final plan)
- Final sign-off on [3] (crypto-denominated + partial allowed) and [4] (merchant pays gas).
- Which storefront surface gets the Refund button FIRST: product orders, tips/donations, and/or
  payment links (all use crypto checkout).

### What ALREADY exists in the codebase (grounding — reuse, don't rebuild)
- `tbl_payment_link.refund_address` (STRING) — CleanCheckoutV2 "Phase 1"; set at checkout via
  `POST /pay/setRefundAddress` (`controller/payment/paymentLinkController.ts::setRefundAddress`).
  Currently STORED ONLY — "never used to send to unless the merchant explicitly triggers a refund flow."
  The checkout UI input lives in `Components/Page/Pay3Components/CleanCheckoutV2.tsx`
  (`refundAddress` state + `saveRefundAddress`, ~L321/707/1520).
- Product orders (`models/userModels/productOrderModel.ts`) have a refund STATUS flow
  (`refund_requested` → `refunded`) via `controller/product/orderController.ts::refundOrder`
  (`POST /api/products/orders/:orderId/refund`) — but crypto refunds are currently **OFF-CHAIN/manual**
  (merchant sends from their own wallet; system only tracks status + emails buyer via
  `sendOrderRefundedEmail`). This is the surface to UPGRADE to the on-chain refund-invoice flow.
- Payment state machine already has a terminal `REFUNDED` state (`services/paymentStateMachine.ts`);
  ledger has a `refund_liability` account (`services/ledger/ledgerAccountsBootstrap.ts`).

### Implementation notes / phases (for whoever builds it)
- **Phase A (checkout capture):** ensure the typed refund-address input is present on the in-scope
  checkout surfaces (payment links already have it; verify storefront/product + tip checkouts capture it),
  validated per-chain. Persist chain + address against the payment.
- **Phase B (refund invoice):** new merchant "Refund" action → creates a refund-invoice record
  (original payment ref, chain, asset, amount incl. fee buffer, customer refund_address) → allocates a
  DynoPay deposit address on the SAME chain (reuse merchant-pool/temp-address allocation) → renders a
  crypto payment page for the MERCHANT.
- **Phase C (forwarding + settlement):** on confirmed merchant deposit, forward the refund to the
  customer's refund_address (reuse the existing sweep/forward rails), mark payment `REFUNDED`, write the
  ledger entries, email the customer (`sendOrderRefundedEmail` already exists), fire a webhook.
- **SAFETY:** this MOVES REAL FUNDS on the LIVE prod DB — build behind a flag, unit-test the state
  machine + fee math, and DO NOT trigger live forwarding during development without explicit approval.



# ============================================================================
# CURRENT SESSION PLAN — 2026-06 (fork: dynopay-setup-4)
# Preview: https://dynopay-setup-4.preview.emergentagent.com
# Login: hostbay@moxx.co / Katiekendra123@ (LIVE prod DB, SAFE MODE)
# Status legend:  [ ] todo   [~] in progress   [x] done
# ============================================================================

## S1. Landing/marketing CTA audit — final blocker (from testing iteration_83)
# STATUS: DONE & VERIFIED (testing_agent iteration_84 = 100%).
#
# ### S1.1 [x] HIGH — support-chat FAB unclickable behind the language bar — FIXED
#   ROOT CAUSE (iter_83 rca): the SupportChatWidget FAB is fixed at bottom:24px
#   with zIndex 1451; the LanguageOnboardingBar (shown to logged-OUT visitors) is
#   fixed full-width at the bottom, height ~76px (--dp-lang-bar), zIndex 1500.
#   The FAB's lower half (incl. its centre) falls inside the bar, so real-user
#   clicks + Playwright normal clicks hit the language bar ("intercepts pointer
#   events") on /, /fees, /documentation at 1920x1080 AND 390x844. Works only
#   after the bar is dismissed. Handler wiring is fine (dispatch_event opens it).
#
#   FIX (mirror the pattern ScrollToTopButton already uses):
#   - Components/Common/SupportChatWidget/index.tsx:
#       * fabBottom → offset by the language bar var, e.g.
#         home:  { xs: calc(var(--dp-lang-bar,0px)+24px),  md: same }
#         client:{ xs: calc(var(--dp-lang-bar,0px)+108px), md: calc(var(--dp-lang-bar,0px)+24px) }
#       * support-chat-panel bottom: add the same var (currently a numeric-only
#         template literal that breaks if fabBottom becomes a calc() string).
#       * occlusion-detection JS (bottomPx): add the computed --dp-lang-bar px so
#         the FAB rect probe stays accurate while the bar is visible.
#   - Components/Layout/ScrollToTopButton.tsx: desktop bottom 96 → 
#     calc(var(--dp-lang-bar,0px)+96) so it stays clear of the lifted FAB when the
#     bar is visible (mobile already uses the var).
#   ACCEPTANCE: scroll >600px WITHOUT dismissing the language bar, NORMAL click on
#   [data-testid=support-chat-button] opens the panel on /, /fees, /documentation
#   at 1920x1080 and 390x844. Re-run frontend testing agent.
#
# ### S1.2 [x] MEDIUM — mobile FAB "occluding" state can hide with no re-entry — FIXED
#   iter_83: in one mobile run the FAB was in occluding state (translateX(96px),
#   aria-hidden, off-screen) leaving no way to open support chat while it persists.
#   FIX: mobile occlusion now only tucks the FAB WHILE actively scrolling
#   (isScrolling flag + 900ms idle timer); at rest the FAB always reveals.
#   VERIFIED iteration_84: mobile FAB returns on-screen ~2s after scroll stops and
#   a normal click opens the panel on / and /fees.
#
#   HARDENING (iter_84 review): FAB zIndex bumped 1451 → 1501 (above the bar's
#   1500) so a future bar-height change can't reintroduce the interception.
#
#   OPTIONAL COSMETIC (iter_84, NOT done — flagged to user): on mobile the
#   scroll-to-top arrow visually sits over the OPEN chat panel's send-button row.
#   Fix = hide/offset ScrollToTopButton while the mobile chat panel is open.

## S2. $500 fee-free allowance abuse — recommendation (product policy)
# USER Q: "what if a user makes a new account every time they hit $500? it hampers
# our fees." RECOMMENDATION (delivered to user; build scope pending their pick):
#   1. Allowance = per VERIFIED merchant/business, LIFETIME (not per account).
#      Copy: "first $500 of lifetime processed volume."
#   2. Tie to identity + payout signals (verified email+phone, payout wallet addr,
#      Veriff KYC once volume grows) — accounts sharing wallet/phone/tax-id share
#      ONE allowance.
#   3. Progressive unlock: first $100–$250 free immediately, remainder after
#      email+phone verification or first successful payment (low friction).
#   4. Flag suspected duplicates for review + apply shared cap — DON'T hard-block.
#   5. Terms + fee copy: duplicate/linked accounts get no fresh allowance.
#   BUILD OPTIONS offered: (a) advice only; (b) simplest guard = payout wallet +
#   verified email share the cap; (c) full (b)+phone+progressive+Veriff KYC.
#   → AWAITING user pick before implementing anything on the LIVE fee logic.

# ============================================================================
# S3. FEE MODEL CHANGE — "$500 fee-free trial" → "FIRST PAYMENT fee-free"
# 2026-06 (fork: dynopay-setup-4) — AWAITING USER SIGN-OFF (money math, LIVE DB)
# Status legend:  [ ] todo   [~] in progress   [x] done
# ============================================================================

## S3.0 [ ] Decision confirmed with user — REPLACE the $500 trial with first-payment-free
# USER DECISION (verbatim intent): "making the first payment fee free is fine.
# platform fee will not be deducted except blockchain cost for the first payment
# on the account level, not company."
#
# WHAT EXISTS TODAY (grounding — reuse, don't rebuild):
#   - backend/services/feeFreeService.ts — "first $500 of LIFETIME VOLUME fee-free",
#     already ACCOUNT-level (userModel.user_id), NOT per company. Columns on
#     userModel: cumulative_volume_usd, fee_free_remaining_usd, fee_tier
#     ('trial' → 'standard'). Env: FREE_TRIAL_VOLUME_USD (default 500).
#     Funcs: getFeeFreeStatus, calculateFeeFreeDiscount, recordTransactionVolume,
#     reverseTransactionVolume, resolveFeeFreeRemaining (clamps to 500 − lifetime).
#   - backend/services/feeService.ts::calculateTransactionFees (L185-238) applies
#     the fee-free discount: totalDeduction = fixed_fee + transactionFee(%);
#     feeFreeDiscount = totalDeduction * (fee_free_amount/amount) → waives BOTH the
#     % platform fee AND the fixed per-tx fee proportionally. (On-chain GAS is a
#     SEPARATE cost handled in sweep/forwarding — never part of totalDeduction, so
#     it is ALWAYS borne = matches "except blockchain cost".)
#   - Callers of record/reverse: controller/payment/settlement/{settleTransaction,
#     verifyPayment,chainVerification,receipt}.ts (fires at SETTLEMENT).
#   - Status API: GET /api/company/fee-free-status (companyController.getFeeFreeStatus).
#   - FRONTEND surfaces that show "$500 fee-free" (all read useFeeFreeStatus /
#     /company/fee-free-status): Components/Common/StickyPromoBar.tsx,
#     Components/Modals/ExitIntentModal.tsx ("Claim $500 fee-free"),
#     Components/Modals/FeeFreeWelcomeModal.tsx, Components/UI/FeeFreeBanner/index.tsx,
#     Components/UI/FeeFreeWidget (+ hooks/useFeeFreeStatus), plus fees/landing copy.
#
# TARGET MODEL:
#   - Entitlement = the merchant's FIRST payment only (account-level, per user_id;
#     one free payment total across ALL that user's companies).
#   - On that one payment, waive DynoPay's full platform deduction (fixed + %);
#     blockchain/gas cost still applies (unchanged, separate).
#   - After the first payment settles → account fee_tier trial → standard; all
#     later payments charged normally.
#
# SAFETY: touches LIVE prod fee/money math. Build behind unit tests
# (extend backend/__tests__/feeFreeEntitlement.test.ts), verify before it can
# affect real settlement. Do NOT abuse the FREE_TRIAL_VOLUME_USD env.

## S3.1 [ ] OPEN DECISIONS asked of user (answers pending; defaults if "go")
#   Q1 What is "the first payment"?
#       (a) first SUCCESSFULLY SETTLED payment [DEFAULT/recommended — abandoned
#           invoice won't burn the freebie; matches where recordTransactionVolume
#           fires today at settlement]
#       (b) first payment created/attempted
#   Q2 Cap on the free payment size?
#       (a) no cap — first payment fully platform-fee-free regardless of size [DEFAULT]
#       (b) waive only up to $X of the first payment (user supplies $X)
#   Q3 Existing merchants (signed up under old $500 trial, some already transacted):
#       (a) anyone who has ALREADY transacted = free payment already used (clean
#           cut-over) [DEFAULT]
#       (b) give EVERYONE one fresh free payment under the new rule
#   Q4 Copy/UI:
#       (a) rewrite ALL "$500 fee-free" surfaces to "first payment is on us / fee-free"
#           [DEFAULT]
#       (b) backend logic only for now; copy later
#   DEFAULTS IF USER SAYS "GO": 1a, 2a, 3a, 4a.

# ============================================================================
# S4. NEXT-ACTION BACKLOG (user-selected 2026-06) — not yet started
# ============================================================================

## S4.1 [ ] Fee-Free Guard (ALTERNATIVE to S3 — anti-abuse cap, if $500 model KEPT)
#   Build the simple anti-abuse cap so duplicate accounts sharing a payout wallet
#   OR verified email split ONE $500 allowance (instead of each getting a fresh $500).
#   NOTE: this is the "keep the $500 model but stop abuse" path. It is MUTUALLY
#   EXCLUSIVE with S3 (first-payment-free) — if the user proceeds with S3, S4.1 is
#   obsolete. Only build ONE of {S3, S4.1}. Confirm with user which path wins.
#   Sketch: on signup / first settlement, group accounts by (payout wallet addr,
#   verified email) → shared fee_free_remaining pool keyed by the group, not user_id.

## S4.2 [ ] Mobile Chat Polish
#   Hide/offset the scroll-to-top arrow (Components/Layout/ScrollToTopButton.tsx,
#   now data-testid=scroll-to-top-button) while the MOBILE support-chat panel is
#   OPEN so the arrow stops sitting on the panel's send-button row. (Cosmetic;
#   flagged by testing iteration_84 design_issues.) Approach: SupportChatWidget can
#   set a body attr / CSS var when open; ScrollToTopButton hides on mobile when set.

## S4.3 [ ] VAT Label Fix
#   Finish the last untranslated VAT string flagged on the STORE payment page during
#   the earlier i18n pass (iteration_81 follow-up). Check
#   Components/Page/Creator/InlineTipCheckout.tsx + pages/[handle]/checkout.tsx and
#   langs/locales/{en,es,pt,fr,de,nl}/landing.json for the hardcoded/ missing VAT key.

## S4.4 [ ] $10 Minimum Hint
#   Show a clear "$10 minimum" helper on tips, support and donation amount inputs so
#   buyers aren't surprised (iteration_81 follow-up — backend min already enforced at
#   10). Surfaces: Components/Page/Creator/SupportWidget.tsx,
#   Components/Page/Creator/CreatorPageSettings.tsx, pages/[handle]/checkout.tsx.

