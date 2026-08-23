# Test Credentials

## ✅ CURRENT POD (2026-08-23, 18th pod) — env rebuilt from user's pasted prod creds
- Preview URL: https://c1eb6151-3c7a-435a-8a42-15de110bfc9d.preview.emergentagent.com
- Login (2-step): **hostbay@moxx.co / Katiekendra123@** (hostbay = user_id 1 / company_id 1, KYC-exempt)
- NEXTAUTH_SECRET (both /app/.env and /app/backend/.env): 5741c38f420fb836107e98e507e2f1a7f4f7f5a66c4c46088579d397e054db7e
- SAFE MODE (LIVE Railway prod DB): backend NODE_ENV=production but ENABLE_BACKGROUND_JOBS=false + WORKER_ROLE=secondary
  → cron/sweeps/fund-movement + dev/test mutation endpoints are DISABLED. Frontend runs `next dev` (NODE_ENV=development
  so creator pages render, no prod host-gate redirect). DO NOT create/mutate data or trigger payments.
- Verified healthy: /health db=connected redis=connected tatum operational background_jobs.eligible=false.

### This pod's code changes to verify
- BACKEND (email): utils/emailTemplate.ts — logo now inversion-proof PNG (/api/static/dynopay-email-logo.png);
  social icons are real PNGs (/api/static/email/<net>.png) instead of unsupported SVG data-URIs. New assets under
  backend/public/ (gen script: backend/scripts/gen_email_assets.cjs). Fixes broken images in admin/user emails.
- FRONTEND (polish): TransactionsTable sticky first (ID) column on horizontal scroll (single scroll container +
  sticky header); InvoicePreviewDrawer loading overlay + reliable Esc-to-close; useEdgeFade hook adds swipe
  edge-fades to the settings rail (mobile) and the transaction source filter chips.

---

# Test Credentials

## ✅ CURRENT POD (2026-08-23, 17th pod) — env rebuilt from user's pasted creds
- CURRENT preview URL: https://dynopay-demo.preview.emergentagent.com
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
