# Dynopay Test Credentials (LIVE Railway Postgres — shared with production)

## Merchant test account (VERIFIED THIS SESSION via POST /api/user/login → HTTP 200)
- Email: **hostbay@moxx.co**
- Password: **Katiekendra123@**
- user_id: 1 · name: hostbay · login_type: EMAIL

## Admin
- ADMIN_EMAIL env: **moxxcompany@gmail.com** (password unknown, out of band)

## Preview URL (THIS container — updated 2026-08-05)
- https://dynopay-staging-4.preview.emergentagent.com
- Frontend calls backend via RELATIVE /api (NEXT_PUBLIC_BASE_URL is EMPTY in /app/.env.local) so it works on any preview hostname.
- Backend .env SERVER_URL/FRONTEND_URL/CHECKOUT_URL/NEXTAUTH_URL point at the b2c3... preview URL.
- Login flow: /auth/login -> input[type=email] "hostbay@moxx.co" -> click "Continue" -> input[type=password] "Katiekendra123@" -> [data-testid="signin-submit-btn"]. Token stored in localStorage (persists across full navigations).

## NEXTAUTH_SECRET (this session)
- QXNb8gfMKSrgp1OrTXRk7+BZXvkiDulln8WSTz6r1bQ=

## Safety overrides applied (LIVE prod PG+Redis)
- ENABLE_BACKGROUND_JOBS=false · WORKER_ROLE=secondary · NODE_ENV=production
- /health confirms: background_jobs.eligible=false, is_leader=false, database=connected, redis=connected, tatum operational=true.
- Binance geo-blocked from container region (expected); CoinGecko fallback active for prices.

## OAuth (registered for dynopay.com — WILL NOT complete on preview URL)
- Google Client ID: 163670787265-g39k8mfhfc4rgv4jpgt6k6n62phif72o.apps.googleusercontent.com
- GitHub Client ID: Ov23liBuaGCFqNpp2QzW
- Use email/password login (hostbay@moxx.co / Katiekendra123@) for any testing that requires a signed-in merchant.
