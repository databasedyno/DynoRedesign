# Test Credentials

## ✅ CURRENT POD (2026-08-23, 17th pod) — env rebuilt from user's pasted creds
- CURRENT preview URL: https://a2374b7c-034c-4f4f-bccb-149e2bb32bde.preview.emergentagent.com
- Login (2-step): **hostbay@moxx.co / Katiekendra123@** (hostbay = user_id 1 / company_id 1, KYC-exempt)
- Public creator page under test: **/hostbay** (also /hostbay/shop). creator_page_enabled=true in live DB.
- NEXTAUTH_SECRET regenerated (paste value was the literal placeholder "openssl rand -base64 32"):
  **U6gmRI2hsHnHXJNBvZkWJ/3JMcax4wiqnK4W3xo/fbs=** (in BOTH /app/.env and /app/backend/.env)
- SAFE MODE (LIVE Railway prod DB): ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary.
- SSR fetch base: INTERNAL_API_URL=http://localhost:8001 (preview). NEXT_PUBLIC_CREATOR_BASE_URL=preview URL.
- Verified healthy: /health db=connected redis=connected tatum operational background_jobs.eligible=false.
  Do NOT touch hostbay's real data. No payments. No fund movement. Keep any test data MINIMAL.

## This session's changes to verify (frontend SSR)
- pages/[handle].tsx, [handle]/shop.tsx, [handle]/p/[slug].tsx, pay/index.tsx, order/[publicRef].tsx:
  SSR fetch base now prefers internal loopback (INTERNAL_BACKEND_URL) to fix a prod bot-protection 403;
  client `siteUrl` decoupled from the internal base.
- Creator pages ([handle], shop, p/slug): production-only host gate → redirect off-domain to dynopay.me
  (INACTIVE on preview since NODE_ENV=development, so preview should RENDER, not redirect).
- Edge cache headers on creator/shop/product success responses.
- CreatorProfile.tsx: AnalyticsWidget (recharts) now lazy-loaded via next/dynamic (ssr:false).
- Removed unused `telegram` dependency.
