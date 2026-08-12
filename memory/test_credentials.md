# Test Credentials

## App: DynoPay (multi-chain crypto payments platform)
- Architecture: Next.js frontend (root /app, port 3000) + Node/TS Express backend
  (port 3300) fronted by a Python/uvicorn proxy on port 8001 (backend/server.py).
- Browser API calls are RELATIVE (`/api/...`) because `NEXT_PUBLIC_BASE_URL` is empty
  in /app/.env.local -> Emergent ingress routes /api -> 8001 -> Node backend.
- Preview URL: https://payment-hub-709.preview.emergentagent.com
  (env files recreated AGAIN 2026-08-12 (2nd time) from user-provided creds on ANOTHER NEW pod;
   node_modules (root + backend) and BOTH env files were missing and were reinstalled/rewritten.
   NEXTAUTH_URL & SERVER_URL/FRONTEND_URL/CHECKOUT_URL set to this preview URL; NEXTAUTH_SECRET
   regenerated (hxhd+5MRHvfUxAXwXktobmphNShNoRGu58I64+T9bkU=) since the provided value was the
   literal placeholder "openssl rand -base64 32".
   NOTE: supervisor's APP_URL advertises https://78eb253f-a375-4fb3-854f-ed364e0d5be9.preview...
   but that host does NOT route (curl times out). payment-hub-709 is the live host (/ and
   /dashboard -> 200), so all URLs use payment-hub-709.
   Root deps `yarn install` at /app; backend deps at /app/backend + pip requirements.
   SAFE MODE: WORKER_ROLE=secondary AND ENABLE_BACKGROUND_JOBS=false -> cron/sweeps/webhook
   worker DISABLED so NO real fund movement happens on the live prod DB.
   DB uses DATABASE_URL (SSL, rejectUnauthorized=false) for the Railway proxy.
   BINANCE_PROXY_URL omitted (no SSH tunnel) -> prices use Tatum/CoinGecko fallback (verified
   working: "[BackgroundCache] Refreshed 40 rates via Tatum"; Binance WS logs HTTP 451, harmless).)

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
- Binance geo-blocked from this region (HTTP 451) -> prices use CoinGecko fallback (works).
- Binance SOCKS proxy needs an SSH tunnel + `sshpass` (not installed) -> disabled (non-fatal).
