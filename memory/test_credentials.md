# Test Credentials

## ✅ CURRENT POD (19th pod) — env rebuilt from user's pasted prod creds
- Preview URL: https://53d9804c-9f7d-492a-b011-1828bfde1a40.preview.emergentagent.com
- Login (2-step): **hostbay@moxx.co / Katiekendra123@** (KYC-exempt merchant)
- NEXTAUTH_SECRET (both /app/.env and /app/backend/.env):
  7b1e5221b7aea601d13104fecfcf22049a3f03318f9f3a110006799ce03a48a2
- SAFE MODE (LIVE Railway PROD DB): backend NODE_ENV=production but
  ENABLE_BACKGROUND_JOBS=false + WORKER_ROLE=secondary
  → cron/sweeps/fund-movement + dev/test mutation endpoints DISABLED.
  Frontend runs `next dev`. DO NOT create/mutate data or trigger payments.
- Verified healthy: /health db=connected redis=connected tatum operational
  background_jobs.eligible=false. /api/* ingress → backend confirmed (JSON responses).

### This pod's task
1) Set up app from pasted prod creds (DONE).
2) FRONTEND-ONLY fixes (safe vs live DB, no mutations):
   - Referral code resurfacing in-app
   - Help & Support shell/theme fix (was flipping to marketing/light shell)
   - Empty-states sweep (Invoices missing; Developer Keys, Referrals list, Storefront tabs)
