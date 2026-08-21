# Test Credentials

## ✅ LATEST SETUP (2026-08-21, 13th pod) — env rebuilt from user's pasted creds
- CURRENT preview URL (verified: /health + all public routes 200 + full 2-step login -> /dashboard live data):
  https://2037a613-5890-4bbc-8c88-40e59718bf71.preview.emergentagent.com
- Path used: wrote `/app/backend/.env` + `/app/.env` from the paste, then
  `bash scripts/pod-bootstrap.sh --skip-env` → POD READY in 27s.
  Omitted from the paste: PORT (server.py forces Node onto 3300), BINANCE_PROXY_URL,
  SSH_TUNNEL_* (no tunnel). SAFE MODE kept ON (`ENABLE_BACKGROUND_JOBS=false`,
  `WORKER_ROLE=secondary`) — paste said true, kept OFF per standing rule (LIVE Railway prod DB).
  Kept `ENABLE_LEDGER=true` with `LEDGER_DUAL_WRITE=false` + `LEDGER_INVARIANT_CRON=false`.
  Added `KYC_EXEMPT_COMPANY_IDS=1` + `KYC_EXEMPT_USER_IDS=1` (hostbay exempt).
  NOTE: paste's VERIFF_API_KEY/SECRET were the literal `install-bundle` placeholders (NOT the
  real Veriff creds from prior sessions) — wrote them as pasted; KYC webhook won't verify until real creds restored.
- NEXTAUTH_SECRET regenerated this pod (paste value was the literal placeholder
  "openssl rand -base64 32"): `srCUmDvQJavRITfNDw/4mO2cIbOqD9CaWE9YesuF7G4=`
- Verified: /health healthy (db=connected, redis=connected, tatum operational,
  background_jobs.eligible=false), SAFE MODE log lines present ("BACKGROUND JOBS DISABLED",
  "Skipping BullMQ webhook worker … background jobs disabled — secondary instance",
  "Skipping startup reconciliation"), "Refreshed 40 rates via Tatum in 3022ms", Binance 451
  geo-block (known/harmless, CoinGecko fallback works). Routes /, /auth/login, /pay, /api/status,
  /hostbay, /hostbay/shop all 200. Full 2-step login **hostbay@moxx.co / Katiekendra123@** →
  /dashboard live data (7D $1,202.74 / 20 payments, monthly $27,008.35, Growth tier, code
  DYNO-9XVPUY, 13 wallets, recent ETH tx 0.03039103 ≈ $75.63 Paid). Vault NOT re-sealed.
- 🆕 STORAGE FIX (this pod): wired DigitalOcean Spaces for durable PRODUCT digital-asset storage (was
  ephemeral local disk). Added SPACES_REGION/SPACES_BUCKET/SPACES_ENDPOINT/SPACES_CDN_ENDPOINT/
  SPACES_ACCESS_KEY/SPACES_SECRET_KEY to `backend/.env` (values provided by user in chat — NOT written
  here; they trip the secrets guard. Re-add them on every new pod, and set them in the DO prod app env
  for prod durability). Bucket=dynopay-uploads-6708cc37, region=ams3. Code: objectStorage.ts private
  upload/get/delete helpers; productController.uploadAsset → Spaces PRIVATE object (storage_backend='spaces');
  orderController.downloadAsset streams the private object through the gated route; gcsAssetService startup
  log now recognizes Spaces (warning suppressed). NEW admin endpoint GET /api/diagnostics/storage-selftest
  (safe PUT/GET/DELETE round-trip under _selftest/). Verified by testing agent: roundtrip_ok=true, no regressions.


## ✅ LATEST SETUP (2026-08-21, 12th pod) — env rebuilt from user's pasted creds
- CURRENT preview URL (verified: /health + all public routes 200, login page renders):
  https://merchant-settlement-2.preview.emergentagent.com
- Path used: wrote `/app/backend/.env` + `/app/.env` from the paste, then
  `bash scripts/pod-bootstrap.sh --skip-env` → POD READY in 31s.
  Omitted from the paste: PORT (server.py forces Node onto 3300), BINANCE_PROXY_URL,
  SSH_TUNNEL_* (no tunnel). SAFE MODE kept ON (`ENABLE_BACKGROUND_JOBS=false`,
  `WORKER_ROLE=secondary`) — paste said true, kept OFF per standing rule (LIVE Railway prod DB).
  Kept `ENABLE_LEDGER=true` with `LEDGER_DUAL_WRITE=false` + `LEDGER_INVARIANT_CRON=false`.
  Added `KYC_EXEMPT_COMPANY_IDS=1` + `KYC_EXEMPT_USER_IDS=1` (hostbay exempt).
- NEXTAUTH_SECRET regenerated this pod (paste value was the literal placeholder
  "openssl rand -base64 32"): `29Y9d2M79+KEky1avXJTemlvSwzVa1cTCbRNvyhe+VE=`
- Verified: /health healthy (db=connected, redis=connected, tatum operational,
  background_jobs.eligible=false), SAFE MODE log lines present ("BACKGROUND JOBS DISABLED",
  "Skipping BullMQ webhook worker … secondary instance"), "Refreshed 40 rates via Tatum",
  Binance 451 geo-block (known/harmless, CoinGecko fallback works). Routes /, /auth/login,
  /pay, /api/status all 200. Login account unchanged: **hostbay@moxx.co / Katiekendra123@**.
  NO app code changed; vault NOT re-sealed (creds unchanged from prior pods).



## 🆕 2026-08-21 — KYC/AML (Veriff) ACTIVATED in preview (audit #4)
- Real Veriff creds now in `backend/.env`: `VERIFF_API_KEY` + `VERIFF_API_SECRET` (Station API v1,
  base https://stationapi.veriff.com). ⚠️ Re-seal the vault after this change:
  `bash scripts/env-vault.sh seal '<pass>'` (NOT done automatically — git write).
- hostbay is EXEMPT from KYC enforcement: `KYC_EXEMPT_COMPANY_IDS=1`, `KYC_EXEMPT_USER_IDS=1`
  (hostbay = user_id 1 / company_id 1). Threshold/grace unchanged ($10k / 90 days) for everyone else.
- Code hardening shipped (all TS clean, frontend lint clean):
  - `services/veriffService.ts`: raw-body HMAC (`signRaw`/`verifyWebhookRaw`) + `verifyAuthClient`;
    `parseWebhookPayload` now reads `verification.status` (was `.decision`).
  - `controller/kycController.ts` `handleVeriffWebhook`: verifies raw-body HMAC + `x-auth-client`,
    idempotent, 200-acks unknown sessions. Session `callback` → `${FRONTEND_URL}/kyc/complete`.
  - `server.ts`: `express.json({ verify })` captures `req.rawBody`. `csrfMiddleware.ts`: `/api/kyc/webhook` exempt.
  - NEW `pages/kyc/complete.tsx` (Veriff redirect target). `api/endpoints.ts` kyc block expanded.
- VERIFIED (no DB writes): webhook 4/4 via curl (valid→200 ack unknown session; tampered sig→401;
  wrong client→401; no headers→401 not 403). Live Veriff session-create → HTTP 201 (creds valid).
- WEBHOOK TEST RECIPE (safe): sign raw body with shared secret →
  `openssl dgst -sha256 -hmac "$SECRET" body.json`; POST /api/kyc/webhook with
  `x-auth-client: <VERIFF_API_KEY>` + `x-hmac-signature: <sig>`. Unknown verification id = 200 no-write.
- PROD ROLLOUT (pending, needs coordination): (1) user Save-to-GitHub → `Improvement` branch;
  (2) update DO app `dynopay` env (VERIFF_API_KEY/SECRET to real + KYC_EXEMPT_COMPANY_IDS=1 + KYC_EXEMPT_USER_IDS=1)
  → redeploy; (3) user sets Veriff Station "Webhook decisions URL" = https://dynopay.com/api/kyc/webhook.
  DO NOT flip DO env BEFORE the code is pushed (current Improvement HEAD lacks the raw-body webhook fix).


## ✅ LATEST SETUP (2026-08-21, 11th pod) — env rebuilt from user's pasted creds
- CURRENT preview URL (verified: full 2-step login -> /dashboard live data):
  https://merchant-settlement-2.preview.emergentagent.com
- Path used: wrote /app/backend/.env + /app/.env from the paste (PORT / BINANCE_PROXY_URL /
  SSH_TUNNEL_* omitted; SAFE MODE ENABLE_BACKGROUND_JOBS=false + WORKER_ROLE=secondary — paste
  said true, kept OFF per standing rule; ENABLE_LEDGER=true kept, dual-write/cron OFF), then
  `bash scripts/pod-bootstrap.sh --skip-env` (URL-sync=already-correct, deps self-healed on boot,
  restart+verify all green in 26s). NEXTAUTH_SECRET regenerated fresh this pod.
- Verified: /health healthy (db+redis connected, tatum operational, background_jobs.eligible=false),
  "Refreshed 40 rates via Tatum", Binance 451 geo-block (known/harmless, fallback OK),
  external / /auth/login /pay /api/status /hostbay /hostbay/shop all 200, login
  hostbay@moxx.co / Katiekendra123@ -> /dashboard (7D $1,235.62 / 21 payments, monthly $26,934.38,
  Growth tier, code DYNO-9XVPUY, 13 wallets). NO app code changed; vault NOT re-sealed (creds unchanged).


## 🆕 2026-08-21 (later session) — webhook events + ledger rollout notes
- `backend/.env` now has **`ENABLE_LEDGER=true`** in the preview (vault re-sealed after the change).
  Ledger tables + 7 accounts exist on the LIVE Railway DB and 407 settlements are backfilled
  (1612 entries). `LEDGER_DUAL_WRITE` / `LEDGER_INVARIANT_CRON` deliberately still OFF.
- New opt-in webhook events live: `payment.created`, `payment.expired`, `payment.overpaid`.
  Opt-in per company via `tbl_company.webhook_events` (JSONB, migration 003 applied to the live DB).
  **Company 1 (hostbay) is intentionally left with `webhook_events = []`** — no new events are being
  sent to the merchant's real endpoint. Toggle from Developers → Webhooks.
  data-testids: `webhook-event-payment-created|-expired|-overpaid`, `webhook-events-save`.
- Manual sweep trigger (cron is leader-gated so previews never fire it):
  `POST /api/diagnostics/sweep-expired-payments` (admin auth), body `{lookback_minutes, limit}`.
- ⚠️ **yarn install must use `--production=false`** — `NODE_ENV=production` in `backend/.env` is loaded
  into the launcher process, so a plain install silently skips devDependencies (jest/ts-jest/@types
  disappear and the whole test suite + tsc types break). All install paths now pass the flag.
- Test runner: `bash scripts/run-tests.sh` (NOT `sh` — the script needs bash for `pipefail`).
  Batch 4 added (ledger + webhookEvents suites were previously orphaned). Full suite = 546 tests.

## 🚀 SETUP IS NOW ONE COMMAND (added 2026-08-21) — READ /app/memory/POD_SETUP.md
```bash
bash /app/scripts/pod-bootstrap.sh --pass '<vault passphrase — ASK THE USER>'
```
- Restores `/app/.env` + `/app/backend/.env` from the git-tracked encrypted vault
  `/app/env.vault.enc`, rewrites all URL keys to THIS pod, enforces SAFE MODE,
  installs deps (root→backend, flock-serialised), restarts, verifies. ~20s warm / ~2min cold.
- **The passphrase is deliberately NOT in the repo** (that would defeat the encryption since
  the ciphertext is tracked). Ask the user. If they lost it: have them paste credentials as
  before, write both .env files, then re-seal → `bash scripts/env-vault.sh seal '<new pass>'`.
- Deps now SELF-HEAL: `scripts/start-frontend.sh` and `backend/server.py` run yarn install
  themselves (with a `--check-files` repair pass) when node_modules is missing, so a cold pod
  boots itself instead of crash-looping. Frontend also prewarms /, /auth/login, /dashboard, /pay.
- ALWAYS re-seal the vault after changing any credential: `bash scripts/env-vault.sh seal '<pass>'`.

## LATEST SETUP (2026-08-21, 10th NEW pod) — env rebuilt from user's pasted creds
- CURRENT preview URL (verified: full 2-step login -> /dashboard with live data):
  https://merchant-settlement-2.preview.emergentagent.com
  (supervisor APP_URL routes correctly — no host gotcha)
- Same recipe 1:1 as 9th pod: sequential `yarn install` root->backend (plain, NOT frozen;
  ~80s+35s warm cache), /app/backend/.env + /app/.env rewritten from user's pasted creds,
  SAFE MODE (WORKER_ROLE=secondary + ENABLE_BACKGROUND_JOBS=false — user paste said true,
  kept OFF per standing rule), PORT/BINANCE_PROXY_URL/SSH_TUNNEL_* omitted.
- FRONTEND STAYS IN DEV MODE: /app/.env FRONTEND_MODE=dev -> start-frontend.sh runs `next dev`
  (hot reload ON — no build, no restart after frontend edits). NEXT_PUBLIC_BASE_URL EMPTY,
  INTERNAL_API_URL=http://localhost:8001.
- NEXTAUTH_SECRET regenerated: EX/qecGBzz197MRV5Ogjx9FuWwjWvsXqfieb0WdP5L4=
- Verified on this pod: /health healthy (db+redis connected, background_jobs.eligible=false),
  SAFE MODE skip-lines present (Skipping BullMQ webhook worker), "Refreshed 40 rates via Tatum",
  Binance geo-blocked 451 (known, harmless), external / /auth/login /pay /api/status
  /hostbay /hostbay/shop all 200, FULL 2-step login hostbay@moxx.co / Katiekendra123@ ->
  /dashboard live data (7D $1,235.62 / 21 payments, monthly $26,934.38, Growth tier,
  code DYNO-9XVPUY, 13 wallets).
- GOTCHA this pod: the FIRST SSR hit to /hostbay + /hostbay/shop 404'd because the Node
  backend was still mid-boot when the SSR fetch ran (getServerSideProps catch -> notFound).
  Transient — retry after backend fully up returned 200. Not a code bug.

## ⚠️ HOW TO RUN BACKEND JEST (2026-08-20) — NEVER background it
- `cd /app/backend && bash scripts/run-tests.sh` — FOREGROUND batched runner (4 batches, ~30s total,
  511 tests). `--batch N` for one batch; `--integration` is OPT-IN ONLY (hits LIVE prod server — avoid).
- NEVER `yarn test &` / nohup / disown: detached node children inherit the tool's output pipe → the
  agent tool call hangs and dies. /tmp is WIPED on pod restart → cache/logs live at
  /app/backend/.jest-cache + /app/backend/test-run.log (both gitignored).
- ts-jest runs transpile-only via tsconfig.jest.json (isolatedModules) — types are enforced by the
  husky preflight tsc, not by jest.
- Jest gotcha fixed twice here: jest.doMock('../models') gets cached/shadowed vs the global
  moduleNameMapper mock — prime __tests__/__mocks__/models.ts jest.fn()s with mockResolvedValueOnce instead.
- The secrets guard flags even FAKE example keys quoted in tracked files (incl. test_result.md test
  reports) — always write them as e.g. GOCSPX-REDACTED-fake-test-value.

## ⚠️ NEW GUARDS IN PRE-COMMIT (2026-08-20) — affects every future session
- scripts/check-secrets.mjs BLOCKS commits whose STAGED files contain live credential patterns
  (OpenAI sk-*, GOCSPX-, xkeysib-, FLWSECK-, Telegram tokens, KEY019*, Tatum t-*, private keys, ghp_, AKIA).
  NEVER paste real keys into tracked files (docs, test scripts, test_result.md) — use REDACTED_* placeholders
  or gitignored .env. backend/dynopay.json is untracked+gitignored on purpose (GCP key, kept on disk).
- backend/scripts/check-file-size.mjs BLOCKS new backend .ts files >500 lines (R2 budget; 55 legacy files
  grandfathered in backend/scripts/file-size-baseline.json).
- R2 refactor landed: emailService/userController/walletController/cryptoSettlement are now thin FACADES over
  services/email/, controller/user/, controller/wallet/, controller/payment/settlement/ — edit the domain
  modules, keep facades' export shapes intact.

## ⚠️ FRONTEND RUNS IN DEV MODE SINCE 2026-08-20 (per user + support decision — do NOT run `next build` in the preview)
- Supervisor `yarn start` (in /app/frontend bridge) → `bash /app/scripts/start-frontend.sh` → mode from
  FRONTEND_MODE (env or /app/.env). Preview /app/.env sets FRONTEND_MODE=dev → `next dev` (HOT RELOAD ON).
- After frontend code changes: NOTHING to do — hot reload picks them up. No yarn build, no restart.
- First page hit after a restart compiles on demand (~10-30s, body briefly hidden by Next's dev FOUC style) — normal.
- PRODUCTION (DigitalOcean/Railway) is UNAFFECTED: it uses Dockerfile.frontend (`next build`, output=standalone,
  `node server.js` per railway-frontend.json / start-all.sh) and never reads the bridge or start-frontend.sh.
  Setting FRONTEND_MODE=production makes start-frontend.sh behave like the old prod preview (auto-builds if needed).
- /app/.env also sets NEXT_PUBLIC_BASE_URL EMPTY (browser axios uses relative "/api/") and
  INTERNAL_API_URL=http://localhost:8001 for SSR — the proven preview convention.

## LATEST SETUP (2026-08-15, 8th NEW pod) — env rebuilt from user's pasted creds
- CURRENT preview URL (verified: full login -> /dashboard with live data):
  https://merchant-settlement-2.preview.emergentagent.com
  (supervisor APP_URL routes correctly — no host gotcha)
- Same recipe 1:1: sequential `yarn install` root->backend->frontend-bridge (plain, NOT frozen),
  /app/backend/.env + /app/.env.local rewritten from user's pasted creds, SAFE MODE
  (WORKER_ROLE=secondary + ENABLE_BACKGROUND_JOBS=false), PORT/BINANCE_PROXY_URL/SSH_TUNNEL_* omitted.
- NEXTAUTH_SECRET regenerated: Cp2sfK21tORtE6XW1nP00xjIA4mKSXOLUixNvrQjI2A=
- Build: `setsid nohup env NODE_OPTIONS="--max-old-space-size=6144" ./node_modules/.bin/next build`
  in background — completed in <2 min this pod (warm cache made installs fast too, ~60s total).
- Verified on this pod: /health healthy (db+redis connected, background_jobs.eligible=false),
  SAFE MODE skip-lines present, external / /auth/login /api/status /pay /hostbay /hostbay/shop all 200,
  "Refreshed 40 rates via Tatum", Binance geo-blocked 451 (known, harmless),
  FULL 2-step login hostbay@moxx.co / Katiekendra123@ -> /dashboard renders live data
  (7D $2,503.94 / 24 payments — one NEW payment today, monthly $25,984.89, Growth tier,
  code DYNO-9XVPUY, 13 wallets).
- NOTE: user's continuation request referenced /app/memory/REMAINING_FIXES.md — that file does NOT
  exist anywhere (filesystem or git history). The real pending-work docs are memory/NEXT_STEPS.md
  (P1-P3 backlog, 2026-08-14) + memory/ENGINEERING_STRATEGY_REVIEW_2026-08.md (90-day sequence).

## PREVIOUS SETUP (2026-08-14, 7th NEW pod) — env rebuilt from user's pasted creds
- CURRENT preview URL (verified: full login -> /dashboard with live data):
  https://merchant-settlement-2.preview.emergentagent.com
  (supervisor APP_URL routes correctly — no host gotcha)
- Same recipe applied 1:1: sequential `yarn install` root->backend (plain, NOT --frozen-lockfile),
  /app/backend/.env + /app/.env.local rewritten from user's pasted creds, SAFE MODE
  (WORKER_ROLE=secondary + ENABLE_BACKGROUND_JOBS=false), PORT/BINANCE_PROXY_URL/SSH_TUNNEL_* omitted.
- NEXTAUTH_SECRET regenerated: ePt+h07is2Dcj55XAJKcy7UoF3uGlDdPAcETTP596+U=
- Build with `NODE_OPTIONS="--max-old-space-size=6144"` (OOM gotcha confirmed again). GOTCHA THIS POD:
  `nohup setsid bash -c '...' &` background build got reaped once; relaunch that worked:
  `setsid nohup env NODE_OPTIONS=... ./node_modules/.bin/next build > /tmp/log 2>&1 < /dev/null & disown`
  (the launching bash call itself may then "time out" — harmless, build continues; poll the log).
- Verified on this pod: /health healthy (db+redis connected, background_jobs.eligible=false),
  SAFE MODE log lines present (Skipping BullMQ webhook worker — background jobs disabled),
  external / /auth/login /api/status /pay /hostbay /hostbay/shop all 200,
  "Refreshed 40 rates via Tatum", Binance geo-blocked 451 (known, harmless),
  FULL 2-step login hostbay@moxx.co / Katiekendra123@ -> /dashboard renders live data
  (7D $2,581.93 / 23 payments, monthly $25,698.76, Growth tier, code DYNO-9XVPUY, 13 wallets).

## PREVIOUS SETUP (2026-08-14, 6th NEW pod) — env rebuilt from user's pasted creds
- CURRENT preview URL (verified: full login -> /dashboard with live data):
  https://merchant-settlement-2.preview.emergentagent.com
  (supervisor APP_URL routes correctly — no host gotcha)
- Same recipe applied 1:1: sequential `yarn install` root->backend (plain, NOT --frozen-lockfile),
  /app/backend/.env + /app/.env.local rewritten from user's pasted creds, SAFE MODE
  (WORKER_ROLE=secondary + ENABLE_BACKGROUND_JOBS=false), PORT/BINANCE_PROXY_URL/SSH_TUNNEL_* omitted.
- NEXTAUTH_SECRET regenerated: iq+eVk+AJu++/whppJyyecUPzjy0VcN9pBGJ05KzCBw=
- NEW GOTCHA (this pod): `yarn build` OOMs in the type-check phase at the default ~1GB heap
  ("Ineffective mark-compacts near heap limit", worker SIGABRT). FIX:
  `cd /app && NODE_OPTIONS="--max-old-space-size=6144" yarn build` -> Done in 94.5s.
  Remember: frontend runs a PRODUCTION build; rebuild + `sudo supervisorctl restart frontend`
  after ANY frontend change.
- Also: background bash jobs spawned without setsid/nohup got reaped mid-build once — use
  `nohup setsid bash -c '...'` for long builds.
- Verified on this pod: /health healthy (db+redis connected, background_jobs.eligible=false),
  SAFE MODE log lines present (Skipping BullMQ webhook worker — background jobs disabled),
  external / /auth/login /api/status /pay /hostbay /hostbay/shop all 200,
  "Refreshed 40 rates via Tatum", Binance geo-blocked 451 (known, harmless),
  FULL 2-step login hostbay@moxx.co / Katiekendra123@ -> /dashboard renders live data
  (7D $2,581.93 / 23 payments, monthly $25,698.76, Growth tier, code DYNO-9XVPUY, 13 wallets).

## PREVIOUS SETUP (2026-08-14, 5th NEW pod) — env rebuilt from user's pasted creds
- CURRENT preview URL (verified: full login -> /dashboard with live data):
  https://merchant-settlement-2.preview.emergentagent.com
  (supervisor APP_URL routes correctly on this pod — no host gotcha this time)
- Same recipe as below applied 1:1. NOTE: `yarn install --frozen-lockfile` FAILS
  ("lockfile needs to be updated") — use plain `yarn install`, SEQUENTIAL root->backend.
- NEXTAUTH_SECRET regenerated: M3Gs2IHp1piGqnMJszncWzyWEoI3bMZNFsbdP+4eS+4=
- Verified on this pod: /health healthy (db+redis connected, background_jobs.eligible=false),
  SAFE MODE log lines present (BACKGROUND JOBS DISABLED, Skipping BullMQ webhook worker),
  external / /auth/login /api/status /pay /hostbay /hostbay/shop all 200,
  "Refreshed 40 rates via Tatum", Binance geo-blocked (known, harmless),
  FULL 2-step login hostbay@moxx.co / Katiekendra123@ -> /dashboard renders live data
  (7D $2,566.18 / 23 payments, monthly $25,659.2, Growth tier, code DYNO-9XVPUY).
- mcp_screenshot_tool GOTCHA: write scripts as TOP-LEVEL statements (no `async def run(page)`
  wrapper — the tool wraps the script itself; a nested def never executes).

## PREVIOUS SETUP (2026-08-13 late, 4th NEW pod) — env rebuilt AGAIN from user's pasted creds
- CURRENT preview URL (verified externally, login screenshot loads):
  https://merchant-settlement-2.preview.emergentagent.com
  (supervisor APP_URL — routes fine this time; https://merchant-settlement-2.preview.emergentagent.com ALSO routes)
- Same recipe as below applied 1:1 (sequential yarn installs root->backend; both env files
  rewritten; NEXTAUTH_SECRET regenerated: kCrvCwvNJxDraw2xuBUqKje5J2+NjwkXCge3gWvqBaE=).
- Verified on this pod: /health healthy (db+redis connected, background_jobs.eligible=false),
  SAFE MODE log lines present (BACKGROUND JOBS DISABLED, Skipping BullMQ webhook worker),
  external landing//auth/login//api/status all 200 on BOTH hosts, SSR /pay + /hostbay/shop +
  /hostbay all 200 (INTERNAL_API_URL=http://localhost:8001 in /app/.env.local),
  "Refreshed 40 rates via Tatum", Binance geo-blocked (known, harmless).

## PREVIOUS SETUP (2026-08-13, 3rd pod) — env rebuilt from user's pasted creds
- Preview URL then: https://merchant-settlement-2.preview.emergentagent.com
- Recipe applied (matches the documented one below):
  1. `yarn install` in /app then /app/backend (SEQUENTIAL; parallel corrupts the shared
     yarn cache -> ENOENT .yarn-metadata.json; fix = `rm -rf /usr/local/share/.cache/yarn`).
  2. /app/backend/.env (discrete DB vars DB_NAME/USER_NAME/PASSWORD/HOST/DB_PORT — Railway PG
     accepts SSL AND non-SSL, both probed OK; no DATABASE_URL needed). PORT NOT set. SAFE MODE:
     WORKER_ROLE=secondary + ENABLE_BACKGROUND_JOBS=false (verified: "BACKGROUND JOBS DISABLED").
     SERVER_URL/FRONTEND_URL/CHECKOUT_URL/CORS_ALLOWED_ORIGINS/NEXTAUTH_URL -> preview URL.
     NEXTAUTH_SECRET regenerated (pasted value was literal "openssl rand -base64 32").
  3. /app/.env.local: NEXT_PUBLIC_BASE_URL EMPTY (relative browser calls),
     INTERNAL_API_URL=http://localhost:8001 (SSR), NEXT_PUBLIC_SERVER_URL/CREATOR/API_DOCS -> preview URL.
  4. `sudo supervisorctl restart backend frontend`.
- Verified: /health healthy (db+redis connected, background_jobs.eligible=false), landing/login/
  SSR /pay all 200, /api/status 200, live Tatum rates ("Refreshed 40 rates via Tatum").
- sshpass NOT installed -> Binance SSH socks tunnel disabled (Binance HTTP 451 harmless, rates via Tatum).

---

## App: DynoPay (multi-chain crypto payments platform)
- Architecture: Next.js frontend (root /app, port 3000) + Node/TS Express backend
  (port 3300) fronted by a Python/uvicorn proxy on port 8001 (backend/server.py).
- Browser API calls are RELATIVE (`/api/...`) because `NEXT_PUBLIC_BASE_URL` is empty
  in /app/.env.local -> Emergent ingress routes /api -> 8001 -> Node backend.
- Preview URL (CURRENT, verified 2026-08-13): https://merchant-settlement-2.preview.emergentagent.com
  Env rebuilt for the 3rd time on 2026-08-13 on a NEW pod (root+backend node_modules AND both
  env files were missing again). Recipe that works:
   1. `cd /app && yarn install` THEN `cd /app/backend && yarn install`  (run them SEQUENTIALLY —
      running both in parallel corrupts the shared yarn cache: "Integrity check failed for
      get-proto"; fix = `rm -rf /usr/local/share/.cache/yarn/v6/npm-get-proto-*` and retry).
      Python deps (httpx/uvicorn/python-dotenv) were already present.
   2. Write /app/backend/.env + /app/.env.local from the user's pasted creds.
   3. NEXTAUTH_URL & SERVER_URL/FRONTEND_URL/CHECKOUT_URL/NEXT_PUBLIC_SERVER_URL -> preview URL.
      NEXTAUTH_SECRET regenerated (HDinAfFfmaODX6PN7TWTWo5EuZNk2AOMUACKV0bvlM0=) because the
      pasted value is the literal placeholder "openssl rand -base64 32".
   4. `sudo supervisorctl restart backend frontend`.
  HOST GOTCHA (3rd pod in a row): supervisor's APP_URL advertises
   https://merchant-settlement-2.preview.emergentagent.com but that host does NOT
   route (curl -> 000). Find the REAL host in /var/log/supervisor/frontend.err.log — Next.js logs
   a "cross origin request detected from <host>.cluster-XX.preview.emergentcf.cloud" warning; the
   `<host>` prefix + `.preview.emergentagent.com` is the live URL (here: secure-transactions-11).
  SAFE MODE: WORKER_ROLE=secondary AND ENABLE_BACKGROUND_JOBS=false -> cron/sweeps/webhook
   worker DISABLED so NO real fund movement happens on the live prod DB.
  DB uses DATABASE_URL (SSL, rejectUnauthorized=false) for the Railway proxy.
  BINANCE_PROXY_URL + SSH_TUNNEL_* omitted (no sshpass/tunnel) -> prices use Tatum/CoinGecko
   fallback (verified: "[BackgroundCache] Refreshed 40 rates via Tatum"; Binance HTTP 451 harmless).
  PORT is deliberately NOT in backend/.env (backend/server.py forces Node onto 3300 and proxies
   8001 -> 3300; setting PORT=8001 there risks a clash with uvicorn).

## Data store (LIVE PRODUCTION — user-provided creds, Aug 2026 setup)
- PostgreSQL: roundhouse.proxy.rlwy.net:23599, db=railway, user=postgres
- Redis: nozomi.proxy.rlwy.net:15794
- NOTE: This preview is connected to the user's LIVE production database.

## Env files (recreated from user credentials; gitignored, not committed)
- /app/backend/.env      -> all backend vars (DB, Redis, Tatum, wallets, OAuth, etc.)
- /app/.env.local        -> Next.js frontend vars (NEXT_PUBLIC_*, NextAuth, INTERNAL_API_URL)

## Auth (real merchant test account — LIVE prod DB)
- Confirmed present in this DB (checkEmail -> validEmail:true): **hostbay@moxx.co**
- Password (from prior session, likely still valid): **Katiekendra123@**
  Flow (2-step): /auth/login -> enter email -> "Continue" -> enter password ->
  click [data-testid="signin-submit-btn"]
- ADMIN_EMAIL from env (moxxcompany@gmail.com) is NOT a user account in this DB.

## STRICT SAFETY (live prod DB)
- Do NOT touch the real "hostbay" company's wallets, settings, transactions,
  customers, or payment links. Do NOT create/publish real payment links or move money.
- For company create/delete tests, ONLY use a throwaway company named
  "ZZ SWR TEST <random>" and delete it afterwards.
- WORKER_ROLE=secondary => background jobs / crypto sweeps / cron are DISABLED
  (verified at runtime: "Skipping BullMQ webhook worker (secondary instance)").
  DO NOT set WORKER_ROLE=primary in the preview — it would move REAL funds.

## Known preview limitations
- Google/GitHub OAuth: buttons render, but completing the flow requires the preview
  origin to be an authorized origin/redirect URI in the Google/GitHub consoles
  (registered for dynopay.com only). Email/password login works.
  (NextAuth's own /api/auth/* routes are also shadowed by the ingress, which sends every
  /api/* path to port 8001 (Node), not to Next.js.)
- Binance geo-blocked from this region (HTTP 451) -> prices use CoinGecko fallback (works).
- Binance SOCKS proxy needs an SSH tunnel + `sshpass` (not installed) -> disabled (non-fatal).
- Product asset storage: GCS/Spaces vars not provided -> backend logs "using local disk"
  (uploads work but are pod-local and lost on rebuild).
- FIXED 2026-08-13: SSR pages could not fetch the API in preview (NEXT_PUBLIC_BASE_URL must
  stay empty so browser calls are relative, but a relative URL can't be fetched server-side).
  `process.env.INTERNAL_API_URL` (=http://localhost:8001) is now the first choice in the
  getServerSideProps of pages/pay/index.tsx, pages/order/[publicRef].tsx,
  pages/[handle]/shop.tsx and pages/[handle]/p/[slug].tsx — same pattern pages/[handle].tsx
  already used. Unset in production, so prod behaviour is unchanged.

## Batch B testids + endpoints (shipped 2026-08-13/14)
- /developer-keys = "Developers": tabs `developers-tab-{keys,webhooks,events,docs}` (?tab= synced;
  Create-key header action only on Keys). WebhookConsoleSection view prop: settings|events|all.
- /settings rail: `settings-group-{account,business,payments}` + rows `settings-rail-{profile,
  notifications,company("Account details"),tax,payments,plan-fees,developers,referrals}` — API Keys and
  Webhooks rows are GONE; `?section=api-keys|webhooks` and `?tab=technical` redirect to /developer-keys.
- Checkout paid card: `clean-checkout-receipt-btn` (+ `clean-checkout-receipt-error`) → POST /api/pay/receipt
  (Bearer customer-session token; 200 application/pdf when PAYOUT_COMPLETE, 409 before, 404 unknown, 403 unauth).
  To test the 200 path WITHOUT paying: hset (HASHES, not set!) fake keys crypto-TESTRECEIPT<r> (status
  successful …, ref test-receipt-ref-<r>) + test-receipt-ref-<r> (company_id 1 …), JWT {ref} signed with
  ACCESS_TOKEN_SECRET, then DELETE the keys. To reach the confirmed CARD in UI: intercept **/pay/verifyCryptoPayment
  with {status:true,data:{status:"confirmed",paidAmount:0.005,paidAmountUsd:10,baseCurrency:"USD",remaining_seconds:0}}.
- USDC-ERC20 now has its OWN icon `assets/cryptocurrency/USDC-icon.svg` (blue) — if a "duplicate USDT" report
  reappears, check icon maps in hooks/useWalletData.ts first (that WAS the bug).

## IA Batch A testids + gotchas (for future test runs)
- Nav rows: `[data-testid^="sidebar-item-"]` → dashboard, payment-links, transactions, invoices
  ("Receipts & Tax"), customers, creator ("Checkout page" for business / "Storefront" for individual),
  wallets ("Payout wallets"), settings, api ("Developers").
- Header: `header-create-new` (+ `header-create-paylink`, `header-create-product`),
  `header-notifications-bell`, `header-notifications-badge`. Settings: `settings-rail-referrals`,
  `settings-rail-plan-fees`.
- GOTCHA: the individual persona has **6** rows, not 5 — `Settings` is always present.
- Gated rows (Receipts & Tax / Customers / Developers) only exist when the account has a settled
  transaction / a customer / an API key. To test the "brand-new account" nav WITHOUT writing to the prod
  DB, intercept `**/dashboard/action-counts*` with `nav_reveal` all-false and patch `account_type` in
  `**/company/getCompany*`, then clear `sessionStorage` keys starting `dyno_nav_reveal:` before reloading
  (they are sticky ON PURPOSE).

## Verified working on this pod (2026-08-13)- GET /api/status, /api/status/health, /api/kb/articles -> 200 (via ingress)
- /auth/login renders; full 2-step email+password login -> /dashboard with REAL live data
  (7D volume $1,567.78 / 23 payments, monthly $24,281.28, Growth tier, code DYNO-9XVPUY)
- /hostbay and /hostbay/shop -> 200 with SSR product data embedded ("Test Ebook Setup Guide")
- `node_modules/.bin/tsc --noEmit -p tsconfig.json` -> exit 0 (no type errors)
