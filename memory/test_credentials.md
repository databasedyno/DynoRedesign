# Dynopay Test Credentials (LIVE Railway Postgres — shared with production)

## Merchant test account (VERIFIED THIS SESSION via POST /api/user/login → HTTP 200)
- Email: **hostbay@moxx.co**
- Password: **Katiekendra123@**
- user_id: 1 · name: hostbay · login_type: EMAIL

## Admin
- ADMIN_EMAIL env: **moxxcompany@gmail.com** (password unknown, out of band)

## Preview URL (THIS container)
- https://payment-processor-76.preview.emergentagent.com
- Same URL is NEXT_PUBLIC_BASE_URL, NEXTAUTH_URL, FRONTEND_URL, SERVER_URL, CHECKOUT_URL, and FIRST in CORS_ALLOWED_ORIGINS.

## NEXTAUTH_SECRET (this session)
- Z9N964DWzyHiWETzQLF5nI4Rtjsoc9DfHgOKa4gUkDg=

## Safety overrides applied (LIVE prod PG+Redis)
- ENABLE_BACKGROUND_JOBS=false · WORKER_ROLE=secondary · NODE_ENV=production
- /health confirms: background_jobs.eligible=false, is_leader=false, database=connected, redis=connected, tatum operational=true.
- Binance geo-blocked from container region (expected); CoinGecko fallback active for prices.

## OAuth (registered for dynopay.com — WILL NOT complete on preview URL)
- Google Client ID: 163670787265-g39k8mfhfc4rgv4jpgt6k6n62phif72o.apps.googleusercontent.com
- GitHub Client ID: Ov23liBuaGCFqNpp2QzW
- Use email/password login (hostbay@moxx.co / Katiekendra123@) for any testing that requires a signed-in merchant.
