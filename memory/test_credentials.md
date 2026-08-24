# Test Credentials

## CURRENT POD — env rebuilt from user's pasted prod creds (setup task, 2026-08-24)
- Preview URL: https://checkout-preview-25.preview.emergentagent.com
- DB (ACTIVE): **STAGING** = postgresql://postgres:***@sakura.proxy.rlwy.net:42975/railway
  (empty schema clone of prod — 70 tables, NO data — used for safe e2e testing of the refactor items).
  Prod values are preserved (commented) in /app/backend/.env for an easy switch-back.
- PROD DB (not active): roundhouse.proxy.rlwy.net:23599 (LIVE — do not point tests here).
- Login: **hostbay@moxx.co / Katiekendra123@** exists ONLY on PROD, NOT on staging. Staging has no
  users yet — seed a verified test account (direct SQL) before login-dependent testing.
- NEXTAUTH_SECRET (this pod, 2026-08-24): JnFpwkMIhpvwxW0LIehBaajQODO5yjs2TsAZ+40ZPUU=
- PG18 client tools (pg_dump/psql) installed via PGDG for schema clone.
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
