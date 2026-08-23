# Test Credentials

## ✅ CURRENT POD — env rebuilt from user's pasted prod creds (setup task)
- Preview URL: https://ee67d377-f5d6-454b-be62-03c867b6e891.preview.emergentagent.com
- Login: **hostbay@moxx.co / Katiekendra123@** (password login returns a JWT directly — NO OTP)
- NEXTAUTH_SECRET (/app/.env, freshly generated): X9cbR51OgEZYvSRd+qE9S2zyKsuGKKihbtuPbYDc6kU=
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
