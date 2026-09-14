# DynoPay — Lightweight / Fast / Data-Efficient Analysis (2026-08)

Scope: how to keep the app light, fast, and data-efficient. Evidence gathered on
the live pod (prod DB) + prod DO logs + code/config review.

## What is ALREADY good (don't touch)
- `next.config.mjs`: `output: standalone`, `optimizePackageImports` (MUI, recharts,
  date-fns, iconify, react-i18next), `removeConsole` in prod, no browser source maps.
- `.dockerignore` already excludes tests/screenshots/*.py/*.png → lean build context.
- `ProductImage` uses `next/image` (AVIF/WebP + lazy) with a safe `<img>` fallback.
- `sitemap.xml` already CDN-cached (`s-maxage=3600, stale-while-revalidate=86400`).

## TOP OPPORTUNITIES (ranked by impact / effort)

### 1. CDN-cache the public SSR pages  ← biggest lever
Today `pages/[handle].tsx`, `[handle]/shop.tsx`, `[handle]/p/[slug].tsx`,
`pay/index.tsx`, `order/[publicRef].tsx` set NO `Cache-Control`. Every hit =
full SSR + 1–3 backend/DB round-trips, and Cloudflare can't cache it.
Fix: in each public getServerSideProps set on `ctx.res`:
`Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (tune per page).
Effect: Cloudflare serves most hits from edge → ~0 backend/DB load, big latency +
egress-data win. MUST stay OFF for authed/personalized pages (dashboard, wallet…).

### 2. Internal-loopback SSR fetch  ← DONE 2026-08 (this session)
Public SSR now fetches the backend via `INTERNAL_BACKEND_URL` (loopback) instead
of `https://dynopay.com`. Removes a redundant Cloudflare round-trip per render AND
fixed the bot-protection 403 that was 404-ing every creator/shop page in prod.

### 3. Code-split heavy client libs (route-bundle diet)
- `recharts` (heavy) is imported by `Components/Page/Creator/AnalyticsWidget.tsx`
  → ships on the PUBLIC creator page even though the widget is usually hidden.
  Lazy-load it: `const AnalyticsWidget = dynamic(() => import(...), { ssr:false })`.
- `country-state-city` (large dataset) statically imported by Settings / Company /
  Onboarding client components + `utils/geoDefaults.ts`. Dynamic-import on demand.
- `canvas-confetti`, `flutterwave-react-v3`, `react-credit-cards-2` are
  checkout/register-only — fine, but could be `next/dynamic` to trim first paint.

### 4. `telegram` (gramjs) appears UNUSED in the codebase
No import found in `pages/Components/utils/helpers/contexts/hooks/api/backend`.
It's a very large dep. Verify + remove from `package.json` if truly unused →
faster installs/build, smaller image. (Confirm before deleting.)

### 5. Backend / data efficiency
- Creator SSR does creator + analytics + shop = up to 3 calls per render.
  Item #1 (CDN cache) amortizes this; optionally add a short server-side cache
  (Redis, 30–60s) on `getCreatorProfile` since it's read-heavy and rarely changes.
- Binance WS is geo-blocked from this region (REST fallback). Prod worker
  (WORKER_ROLE=primary) is unaffected; preview runs SAFE MODE (jobs off) — correct.

### 6. Images / payload hygiene
- Ensure creator `photo`/`cover_image` and product images always render via
  `next/image` (some creator surfaces may still use `<img>`) → resized/WebP bytes.
- Consider `Accept-CH` client-hints already set; keep.

## Suggested order
1) Add CDN cache headers to the 4–5 public pages (fast, huge win).
2) Lazy-load recharts on the creator page + country-state-city in settings.
3) Verify/remove `telegram`.
4) Optional Redis cache on getCreatorProfile.
