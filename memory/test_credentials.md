# Test Credentials

## App: DynoPay (crypto payments platform)
- Architecture: Next.js frontend (root /app, port 3000) + Node/TS Express backend
  (port 3300) fronted by a Python/uvicorn proxy on port 8001 (server.py).
- Data store: REAL production Railway PostgreSQL + Redis (from user-provided creds).
  NOTE: This preview is connected to the user's LIVE production database.

## Auth
- Login route: /auth/login  (email or phone; also Google/GitHub social buttons)
- Register route: /auth/register
- Admin login route: /admin/login
- Admin email (from env ADMIN_EMAIL): moxxcompany@gmail.com
- No test password available — accounts live in the user's production DB.
  Ask the user for a test account/password before running authenticated tests.

## Known preview limitations
- Google/GitHub OAuth: buttons render, but completing the flow requires the
  preview origin to be an authorized JS origin/redirect URI in the Google/GitHub
  consoles (currently registered for dynopay.com only). Email login works.
- Binance is geo-blocked from this region (HTTP 451) -> prices use CoinGecko
  fallback (works). Binance SOCKS proxy needs an SSH tunnel + `sshpass` (not installed).
- Background jobs / crypto sweeps / cron are DISABLED (WORKER_ROLE=secondary) -> safe.
