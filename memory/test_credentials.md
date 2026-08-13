# Test Credentials

## App: DynoPay (multi-chain crypto payments platform)
- Architecture: Next.js frontend (root /app, port 3000) + Node/TS Express backend
  (port 3300) fronted by a Python/uvicorn proxy on port 8001 (backend/server.py).
- Browser API calls are RELATIVE (`/api/...`) because `NEXT_PUBLIC_BASE_URL` is empty
  in /app/.env.local -> Emergent ingress routes /api -> 8001 -> Node backend.
- Preview URL (CURRENT, verified 2026-08-13): https://secure-transactions-11.preview.emergentagent.com
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
   https://9ca62dbc-41f5-4f88-804e-a2045e17bcb3.preview.emergentagent.com but that host does NOT
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
