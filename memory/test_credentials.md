# Test Credentials

## App: DynoPay (multi-chain crypto payments platform)
- Architecture: Next.js frontend (root /app, port 3000) + Node/TS Express backend
  (port 3300) fronted by a Python/uvicorn proxy on port 8001 (backend/server.py).
- Browser API calls are RELATIVE (`/api/...`) because `NEXT_PUBLIC_BASE_URL` is empty
  in /app/.env.local -> Emergent ingress routes /api -> 8001 -> Node backend.
- Preview URL: https://944a7bb4-c087-41c1-92d7-9f945707acec.preview.emergentagent.com
  (env files recreated 2026-08-11 from user-provided creds; NEXTAUTH_URL set to this
   preview URL; NEXTAUTH_SECRET regenerated since the provided value was a placeholder.
   Frontend deps installed at /app; backend deps at /app/backend.)

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
