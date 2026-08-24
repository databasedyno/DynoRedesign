# Test Credentials

## CURRENT POD — rebuilt from user's pasted PROD creds (setup task, 2026-08-24 v2)
- Preview URL: https://41df08a6-652d-4266-94d9-f3812166d81a.preview.emergentagent.com

### DB / Redis — LOCAL, ISOLATED (no live data, zero risk)
- The user pasted LIVE prod creds (roundhouse.proxy.rlwy.net) with real crypto wallets +
  payment keys. To avoid any risk to live funds/data, this pod runs a **LOCAL** Postgres +
  Redis instead of prod:
  - Postgres 15 (apt), SSL on (snakeoil cert). DATABASE_URL=
    postgresql://postgres:dynolocal_pw_2026@127.0.0.1:5432/railway  (db `railway`, 59 tables)
    Schema built via `database/migrate.ts` (sequelize sync of 56 models) + SQL migrations 001/002/003/010.
  - Redis 7 (apt) on 127.0.0.1:6379.
  - Both are supervised: /etc/supervisor/conf.d/local-db.conf -> scripts/start-local-db.sh
    (postgres in foreground; redis daemonized). `supervisorctl status local-db` => RUNNING.
- **SAFE MODE** enforced in /app/backend/.env: ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary
  => no cron/sweeps/settlement/fund-movement, no BullMQ worker. NODE_ENV=production.
- Prod DB (roundhouse) is REACHABLE but intentionally NOT used. To switch to prod, set
  DATABASE_URL/HOST/DB_PORT/USER_NAME/PASSWORD to the pasted prod values (NOT recommended).

### Login (seeded on LOCAL db — scripts/seed_test_user.ts, no emails sent)
- **testmerchant@dynopay.dev / TestMerchant123!**  (user_id=1, email_verified=true, status=active)
- Verified working: POST /api/user/login => "Login Successful!".
- Note: fresh user has NO company yet (registerUser doesn't create one) and tbl_admin_wallet
  is empty so 0 user wallets — dashboard may show onboarding; wallet screen may be empty.

### Env files (gitignored, rebuilt this pod)
- /app/.env (Next.js): URLs->preview, FRONTEND_MODE=dev, INTERNAL_API_URL=http://localhost:8001,
  NEXTAUTH_SECRET=JnFpwkMIhpvwxW0LIehBaajQODO5yjs2TsAZ+40ZPUU=, OAuth client ids/secrets.
- /app/backend/.env: all pasted prod keys VERBATIM except DB/Redis (local), SAFE MODE, URLs->preview,
  CORS incl preview host. GOOGLE_CLIENT_KEY rewritten to single-\n (dotenv expands to real PEM).

### Architecture (Emergent adaptation)
- Frontend: Next.js 14 in /app (port 3000) via supervisor `frontend` -> scripts/start-frontend.sh (next dev)
- Backend: Node/TS Express (server.ts) internal port 3300, behind Python uvicorn proxy server.py :8001
  (supervisor `backend`). Proxy forwards /api/* to Node; stubs /api/auth/* (NextAuth) with empty JSON.
- Router mounts: main router at /api and /api/v1. Login: /api/user/login.

### Verified healthy (2026-08-24 v2)
- /health: status=healthy, database=connected, redis=connected, tatum operational,
  background_jobs.eligible=false (SAFE MODE). Frontend / => 200 local + external.
- OAuth (Google/GitHub) will NOT complete in preview (redirect URIs are for dynopay.com,
  and /api/auth/* is stubbed by the proxy). Use email/password login above.
