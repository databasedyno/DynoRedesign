# Test Credentials

## CURRENT POD — env rebuilt from user's pasted prod creds (setup task, 2026-08-24)
- Preview URL: https://crypto-checkout-init.preview.emergentagent.com
- Login: **hostbay@moxx.co / Katiekendra123@** (password login returns a JWT directly — NO OTP)
  (carried from prior sessions — LIVE prod account; NOT re-verified this setup pass to avoid prod writes)
- NEXTAUTH_SECRET (freshly generated this pod, 2026-08-24): JnFpwkMIhpvwxW0LIehBaajQODO5yjs2TsAZ+40ZPUU=
- Env files rebuilt: /app/backend/.env (full creds + DATABASE_URL for SSL + PORT=3300) and /app/.env
  (frontend NEXT_PUBLIC_* pointed at the preview URL). STOREFRONT_PER_COMPANY=true (migration 010 already
  applied to the live DB per prior sessions). Verified: /health db+redis connected, tatum operational,
  external /api/status/health 200, login page SSR renders ("Log in · Dynopay").
- SAFE MODE (LIVE Railway PROD DB): backend NODE_ENV=production but
  ENABLE_BACKGROUND_JOBS=false + WORKER_ROLE=secondary
  → cron/sweeps/fund-movement + BullMQ webhook worker + reconciliation DISABLED.
  Frontend runs `next dev`. DO NOT create/mutate data or trigger real payments.
- Google/GitHub OAuth (NextAuth) will NOT work in preview: (a) redirect URIs are
  registered for dynopay.com, (b) K8s ingress routes /api/auth/* to the backend
  proxy which stubs it. Use email/password login above.

## Architecture (Emergent adaptation)
- Frontend: Next.js 14 in /app (port 3000) via supervisor `frontend` -> scripts/start-frontend.sh (next dev)
- Backend: Node/TS Express (server.ts) on internal port 3300, fronted by Python
  uvicorn proxy server.py on port 8001 (supervisor `backend`). Proxy forwards /api/* to Node.
- DB: Railway PostgreSQL (roundhouse.proxy.rlwy.net:23599 db=railway) via Sequelize + DATABASE_URL (SSL).
- Redis: Railway (nozomi.proxy.rlwy.net:15794).
- Env files: /app/backend/.env (backend + proxy) and /app/.env (Next.js frontend).

## Verified healthy (2026-08-23)
- /health: db=connected, redis=connected, tatum operational, background_jobs.eligible=false
- Login page renders; /api/* ingress → proxy → Node confirmed (JSON responses).
- Binance WS geo-blocked (451) → graceful CoinGecko fallback (expected in this region).
