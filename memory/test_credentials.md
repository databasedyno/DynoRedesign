# Test Credentials

## App: DynoPay (crypto payments platform)
- Architecture: Next.js frontend (root /app, port 3000) + Node/TS Express backend
  (port 3300) fronted by a Python/uvicorn proxy on port 8001 (server.py).
- Data store: REAL production Railway PostgreSQL + Redis (from user-provided creds).
  NOTE: This preview is connected to the user's LIVE production database.

## Auth (real merchant test account — LIVE prod DB)
- Login (2-step): **hostbay@moxx.co** / **Katiekendra123@**
  Flow: /auth/login → enter email → "Continue" → enter password →
  click [data-testid="signin-submit-btn"]
- Company on this account: "hostbay" (lifetime volume ~$25,139.50).

## STRICT SAFETY (live prod DB)
- Do NOT touch the real "hostbay" company's wallets (real balances/addresses),
  settings, transactions, customers, or payment links.
- Do NOT create/publish real payment links or move any money.
- For company create/delete tests, ONLY use a throwaway company named
  "ZZ SWR TEST <random>" and delete it afterwards.

## Known preview limitations
- Google/GitHub OAuth: buttons render, but completing the flow requires the
  preview origin to be an authorized origin/redirect URI in the Google/GitHub
  consoles (registered for dynopay.com only). Email/password login works.
- Binance is geo-blocked from this region (HTTP 451) -> prices use CoinGecko
  fallback (works). Binance SOCKS proxy needs an SSH tunnel + `sshpass` (not installed).
- Background jobs / crypto sweeps / cron are DISABLED (WORKER_ROLE=secondary) -> safe.
