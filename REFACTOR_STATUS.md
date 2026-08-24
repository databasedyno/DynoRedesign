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
  `https://crypto-checkout-init-1.preview.emergentagent.com`
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
