# Test Credentials

## ⚠️ FRONTEND RUNS A PRODUCTION BUILD SINCE 2026-08-14 (bug fix: slow dev-mode nav)
- /app/frontend/package.json "start" = `next start` (prod). Dev mode = "start-dev" script.
- After ANY frontend code change: `cd /app && yarn build` then `sudo supervisorctl restart frontend`.

## LATEST SETUP (2026-08-14, 6th NEW pod) — env rebuilt from user's pasted creds
- CURRENT preview URL (verified: full login -> /dashboard with live data):
  https://d2a4a2b3-200b-4a29-955b-9330451ab80e.preview.emergentagent.com
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
  https://payment-gateway-dev-12.preview.emergentagent.com
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
  https://payment-gateway-dev-12.preview.emergentagent.com
  (supervisor APP_URL — routes fine this time; https://payment-gateway-dev-12.preview.emergentagent.com ALSO routes)
- Same recipe as below applied 1:1 (sequential yarn installs root->backend; both env files
  rewritten; NEXTAUTH_SECRET regenerated: kCrvCwvNJxDraw2xuBUqKje5J2+NjwkXCge3gWvqBaE=).
- Verified on this pod: /health healthy (db+redis connected, background_jobs.eligible=false),
  SAFE MODE log lines present (BACKGROUND JOBS DISABLED, Skipping BullMQ webhook worker),
  external landing//auth/login//api/status all 200 on BOTH hosts, SSR /pay + /hostbay/shop +
  /hostbay all 200 (INTERNAL_API_URL=http://localhost:8001 in /app/.env.local),
  "Refreshed 40 rates via Tatum", Binance geo-blocked (known, harmless).

## PREVIOUS SETUP (2026-08-13, 3rd pod) — env rebuilt from user's pasted creds
- Preview URL then: https://payment-gateway-dev-12.preview.emergentagent.com
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
- Preview URL (CURRENT, verified 2026-08-13): https://payment-gateway-dev-12.preview.emergentagent.com
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
   https://payment-gateway-dev-12.preview.emergentagent.com but that host does NOT
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
