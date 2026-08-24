# DynoPay — Emergent Preview Setup Notes (prod-connected, SAFE MODE)

## Status: RUNNING — connected to the user's LIVE Railway PostgreSQL + Redis
- Preview URL: https://merchant-portal-239.preview.emergentagent.com
- Architecture: Next.js (`:3000`) + Node/Express backend (`server.ts` on `:3300`) behind a
  Python/uvicorn proxy (`server.py` on `:8001`, the `/api/*` ingress target). Proxy forwards
  `/api/*` to Node and stubs `/api/auth/*` (NextAuth) with empty JSON.

## SAFETY CONSTRAINTS (user chose option 1a: real prod DB, jobs OFF)
- Connected to PRODUCTION Railway PG (real merchant/payment data, 71 tables). Verified boot:
  migrations "0 applied, 3 present" => NO schema changes made to prod.
- Background jobs DISABLED: `ENABLE_BACKGROUND_JOBS=false` + `WORKER_ROLE=secondary`
  => no crypto sweeps, settlement, reconciliation, BullMQ webhook worker, or cron
  (confirmed by boot log "Skipping ... (background jobs disabled)" + health eligible=false).
- Redis ISOLATED to DB index /1 (`REDIS_PUBLIC_URL=...:15794/1`) so the preview can never
  touch/delete production's DB-0 cron locks or pollute its cache (protects `cleanupStaleLocks`).
- OUTBOUND EMAIL KILL-SWITCH: `DISABLE_OUTBOUND_EMAIL=true` — added a guard in
  `backend/utils/mailTransporter.ts` that suppresses ALL Brevo email from this pod
  (prevents "New Visitor" admin spam + any accidental real merchant/customer emails).
- SSH tunnel + Binance SOCKS proxy DISABLED (Binance geo-blocked 451 here). FX rates fall
  back to Tatum/CoinGecko — working (40 rates refreshed, real BTC/ETH/etc prices).
- NODE_ENV=production (idempotent versioned migrations, SSL to Railway; NOT alter:true).

## ⚠️ FOR TESTING AGENTS
- This is wired to the user's PRODUCTION database. DO NOT run write-heavy automated tests
  that create users / payments / wallets / payment-links. Prefer READ-ONLY verification.
- Do NOT call deep_testing agents against this without the main agent's explicit scoping.

## Login / test credentials (verified against prod DB in a prior session)
- Merchant login: `hostbay@moxx.co` / `Katiekendra123@`
  (user_id=1, company_id=1 — main QA merchant with real data, ~$18k volume).
  POST /api/user/login -> 200 (note: login may update last_login).
- Admin email on record: moxxcompany@gmail.com (password NOT provided).

## Env files (created this session; gitignored)
- /app/backend/.env — all provided prod creds + DATABASE_URL (SSL, rejectUnauthorized=false);
  URLs -> preview; SAFE MODE gates; Redis /1; DISABLE_OUTBOUND_EMAIL; SSH/Binance-proxy commented.
- /app/.env — Next.js: NEXT_PUBLIC_BASE_URL=preview, INTERNAL_API_URL=http://localhost:3300,
  NEXTAUTH_*, NEXT_PUBLIC feature flags. FRONTEND_MODE=dev (hot reload).

## Verified this session (read-only)
- GET /health -> healthy (database=connected, redis=connected, background_jobs.eligible=false,
  tatum operational, binance_websocket geo-blocked as expected).
- GET /api/public/tickers, /api/public/fx-rates -> 200 with live rates.
- Frontend /, /auth/login, /dashboard, /pay -> 200; login page renders full UI, no console errors.
