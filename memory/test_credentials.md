# DynoPay — Emergent Preview Setup Notes (2026-08-24, prod-connected)

## Status: RUNNING (fresh pod — previous local-DB setup notes were stale/gone)
- Preview URL: https://3ba82ad8-edfd-44c9-9bb4-d237dfc2edf8.preview.emergentagent.com
- Backend (Node/Express via `server.py` uvicorn proxy :8001 -> Node :3300) connected to
  the user's LIVE Railway PostgreSQL + Redis (user explicitly chose prod DB = option 1a).
- Frontend (Next.js dev) :3000, wired via NEXT_PUBLIC_BASE_URL=preview + `/api/`.

## SAFETY CONSTRAINTS (agreed with user this session)
- Connected to the user's **PRODUCTION Railway DB** (real merchant/payment data, 71 tables).
  DO NOT run write-heavy automated tests that create users/payments/etc against it.
- Background jobs DISABLED: ENABLE_BACKGROUND_JOBS=false + WORKER_ROLE=secondary
  => no crypto sweeps, no reconciliation, no BullMQ worker, no cron (verified in boot logs).
- SSH tunnel + Binance SOCKS proxy disabled (Binance geo-blocked 451 here; rates use
  Tatum/CoinGecko fallbacks — working, 40 rates refreshed).
- NODE_ENV=production => schema handled by idempotent versioned migrations (0 applied, 1 present),
  NOT sequelize alter:true. No schema changes made to prod.

## Login / test credentials
- No seed/test accounts created (would write to the production DB).
- Admin email on record: moxxcompany@gmail.com (password NOT provided — real prod account).
- Email/password login: POST /api/user/login (Node backend) — works with the user's real prod creds.
- OAuth (Google/GitHub) buttons render, but /api/auth/* is STUBBED by the uvicorn proxy in preview,
  so social sign-in cannot complete here. Use email/password.

## Env files (created this session; gitignored)
- /app/backend/.env  — all provided creds verbatim; DATABASE_URL added (SSL, rejectUnauthorized=false);
  URLs -> preview; SAFE MODE; SSH/Binance-proxy commented out; GOOGLE_CLIENT_KEY as single-\n PEM.
- /app/.env          — Next.js: NEXT_PUBLIC_* + NextAuth + INTERNAL_API_URL/INTERNAL_BACKEND_URL=http://localhost:3300.

## Architecture
- Frontend: Next.js 14 in /app (port 3000), supervisor `frontend` -> scripts/start-frontend.sh (next dev).
- Backend: Node/TS Express server.ts on :3300, behind Python uvicorn proxy server.py :8001 (supervisor `backend`).
  Proxy forwards /api/* to Node; stubs /api/auth/* (NextAuth) with empty JSON.
- SSR pages fetch backend via `${INTERNAL_API_URL}/api/...` (= http://localhost:3300).

## Verified (read-only)
- PG: 71 tables, SSL OK. Redis: PONG.
- GET /health (healthy), /api/public/tickers, /api/public/fx-rates, /api/geo-detect -> all 200 with live data.
- Frontend /auth/login renders full UI (logo, email/phone login, Google/GitHub, crypto badges).
