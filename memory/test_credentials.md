# Test Credentials

## CURRENT POD — env rebuilt from user's pasted prod creds (setup task, 2026-08-23)
- Preview URL: https://8003c600-df40-4c11-9010-2e92617a7b68.preview.emergentagent.com
- Login: **hostbay@moxx.co / Katiekendra123@** (password login returns a JWT directly — NO OTP)
- NEXTAUTH_SECRET (freshly generated this pod): Rk4W/gKXz7atJ62RyaH+mF65A+9bFNWrhl7SUCtnTLU=
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
