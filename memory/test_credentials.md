# ============================================================================
# 2026-08-25 RE-SETUP (current pod) — prod-connected, SAFE MODE — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://d26a4423-b492-4d0d-91e4-68950f0ae45d.preview.emergentagent.com
# - Env files REBUILT from a fresh full cred paste by the user (no vault passphrase
#   this session; env.vault.enc NOT used). /app/.env + /app/backend/.env written by
#   hand, then `bash scripts/pod-bootstrap.sh` synced URLs + enforced SAFE MODE.
# - SAFE MODE (same as prior sessions, per user's earlier "option 1a" choice):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary  (no sweeps/settlement/
#       payouts/webhook worker/cron — no on-chain money movement)
#     REDIS_PUBLIC_URL -> .../15794/1  (isolated Redis DB index 1)
#     DISABLE_OUTBOUND_EMAIL=true     (no Brevo email to real merchants)
#     DATABASE_URL set explicitly (URL branch of dbInstance.ts = SSL; Railway)
#     Binance SOCKS proxy + SSH tunnel commented out (geo-blocked; FX -> Tatum/CoinGecko)
#     NEXTAUTH_SECRET freshly generated (paste contained a placeholder)
# - VERIFIED this session:
#     GET :8001/health -> healthy (database=connected, redis=connected,
#       background_jobs.eligible=false = SAFE MODE, tatum operational, binance geo-blocked)
#     GET /api/public/tickers -> live prices (BTC ~$79k)
#     POST /api/user/login (hostbay@moxx.co / Katiekendra123@) -> 200 "Login Successful!"
#       (user_id=1, company_id=1)
#     External /auth/login renders full UI (screenshot-verified)
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================


# ============================================================================
# 2026-08-24 RE-SETUP (this session) — prod-connected, SAFE MODE — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://dynopay-credentials.preview.emergentagent.com
# - Env files were REBUILT DIRECTLY from a fresh full cred paste by the user
#   (NOT restored from env.vault.enc — no passphrase was provided this session).
# - /app/backend/.env and /app/.env written by hand; SAFE MODE enforced:
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary  (no sweeps/settlement/
#     payouts/webhook worker/cron — no on-chain money movement)
#     REDIS_PUBLIC_URL -> .../15794/1   (isolated to Redis DB index 1)
#     DISABLE_OUTBOUND_EMAIL=true       (no Brevo email to real merchants)
#     DATABASE_URL set explicitly (URL branch of dbInstance.ts = SSL on; Railway needs it)
#     Binance SOCKS proxy + SSH tunnel commented out (geo-blocked here; FX -> Tatum/CoinGecko)
#     All public URLs rewritten to this preview host; CORS appended with it.
# - VERIFIED this session:
#     GET :8001/health -> healthy (database=connected, redis=connected,
#       background_jobs.eligible=false = SAFE MODE, tatum operational, binance geo-blocked).
#     external /  -> 200; external /api/public/tickers -> live prices.
#     POST /api/user/login (hostbay@moxx.co) -> 200 "Login Successful!" (user_id=1, company_id=1).
#     Boot migrations: "0 applied, 4 present" => NO schema changes to prod.
# - Login (verified 200 this session): hostbay@moxx.co / Katiekendra123@
# - Admin email on record: moxxcompany@gmail.com (password NOT provided).
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================


# DynoPay — Emergent Preview Setup Notes (prod-connected, SAFE MODE)

## Status: RUNNING — connected to the user's LIVE Railway PostgreSQL + Redis
- Preview URL: https://dynopay-credentials.preview.emergentagent.com
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
