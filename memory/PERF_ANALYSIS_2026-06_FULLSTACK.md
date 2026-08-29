# DynoPay — Full-Stack Performance Analysis (2026-06 fork, pod eddcc06a)

> STATUS 2026-06 (pod eddcc06a): ALL 10 APPROVED FIXES SHIPPED & VALIDATED — B1,B2,B3,B4,F1,F2,F3(wired),F4(dedupe only),F5,F6.
> See memory/CHANGELOG.md top entry for exact files. Login 1.3-1.5s->~0.97s; wallet cold 1.2s->0.65s; dashboard waterfall
> collapsed; SWR localStorage persistence live. testing_agent 100% (7/7) — /app/test_reports/iteration_99.json.
> NOT done: F4 deferral of below-the-fold calls (reusable-wallets/creator-profile/getPaymentLinks/action-counts) — deferred
> as higher-risk on the live dashboard; can be picked up separately.


Analysis-only pass (user choice). Evidence measured live on this pod against the prod Railway DB.
Prior perf work already shipped (do NOT redo): bundle −288 kB/page (i18n EN-only), checkout single-fetch,
status probe 600→42ms, CDN cache on creator/shop/product SSR, recharts/KpiStrip dynamic on dashboard,
authMiddleware Redis user-exists cache, loopback SSR fetch.

## Measured baselines (this pod)
- One network round trip: Postgres `SELECT 1` = **41ms**, Redis `PING` = **39ms** (both Railway-remote).
- POST /api/user/login: **1.28–1.50s** (repeatable).
- Warm authed GETs (direct :3300): profile 83ms · dashboard 331ms · wallet/getWallet 293ms.
- Cold (first-hit) external: dashboard **1.25s** · wallet/getWallet **1.20s** · fee-tiers 757ms · chart 658ms.
- External ingress adds ~180ms vs direct (preview Cloudflare; prod path differs).
- Real-browser dashboard load (Playwright, logged in): **21 API calls in 3 sequential waves**;
  the core dashboard data (stats/chart/fee-tiers/recent-tx) fires LAST at t+6.1s (dev mode):
    wave1 t+3.2s: getCompany, onboarding-status, fee-free-status
    wave2 t+4.3s: profile, wallet/getWallet(1.46s), tickers
    wave3 t+6.1s: dashboard, chart, fee-tiers, recent-tx, action-counts, display-currency,
                  referral/my-code, getPaymentLinks, reusable-wallets, creator/profile, unread-count
  Duplicates: user/profile ×2, public/tickers ×2.
- Last recorded prod build (gzip first-load): / 336 kB · /pay 374 kB · /auth/login 436 kB · **/dashboard 642 kB**.

## BACKEND findings (ranked)

### B1 — Login blocks on geo-IP + bookkeeping (HIGH impact / LOW effort / LOW risk)
controller/user/userShared.ts finalizeLogin(): response path awaits, in order:
is2FARequired → **external HTTP to ip-api.com (timeout 3000ms)** → loginActivityModel.create (DB write)
→ Redis email-throttle checks. None of it needs to precede the token response.
FIX: respond right after 2FA check + token mint; run geo-IP/activity/notification in setImmediate.
EXPECTED: login 1.3–1.5s → ~0.4–0.6s (and immune to ip-api outages, which today hold login hostage up to 3s).

### B2 — Fixed per-request tax on every authed endpoint (HIGH / MED / LOW-MED)
Every /dashboard, /company, /wallet request pays sequential round-trips BEFORE the Redis response-cache
is even consulted:
1. emailVerifiedMiddleware: UNCACHED userModel.findOne on EVERY request (~41ms) — right after
   authMiddleware just resolved the same user from its Redis cache.
2. Controllers call validateCompanyOwnership (DB) + getUserDisplayCurrency (DB) BEFORE `getRedisItem(cacheKey)`
   (dashboardController L128–143, walletRead L87–94).
So a FULLY-CACHED dashboard hit still costs ~4–5 round trips ≈ 200ms.
FIX: (a) fold email/email_verified into the existing auth:user:<id> Redis entry (invalidate on verify);
(b) move the response-cache check to the top (cache key already contains company_id+currency inputs → embed
user display-currency in the key only after first resolution, or cache displayCurrency+ownership in Redis 60s).
EXPECTED: warm authed GETs 300ms → ~80–120ms across the whole app.

### B3 — Redis cache writes cost 4 awaited round trips (MED / LOW / LOW)
utils/redisInstance.ts: setRedisItem(object) = SET + DEL (2 RTs), then setRedisTTL = EXPIRE ×2 (2 RTs),
all awaited on the response path at every cache miss (dashboard L329-330 et al.). getRedisItem miss = 2 RTs
(GET + hGetAll fallback).
FIX: use the existing setRedisItemWithTTL (single SET EX) at all call sites and fire-and-forget the write
(`void setRedisItemWithTTL(...)`). ~160ms saved per cache-miss response.

### B4 — walletRead.getWallet cold path is sequential (MED / LOW-MED / MED*)
findAll wallets → findAll companies → convertToMultiple → convertToFiat → raw temp-address query, back to
back (≈1.2–1.5s cold). Independent queries → Promise.all. (*money-display code — needs careful testing.)

### B5 — Prod infra note (for the user, not code)
Every request does 3–8 DB/Redis round trips; per-RT latency IS the response time. If prod DO app and Railway
PG/Redis are in different regions, co-locating them is the single biggest infra lever. Worth measuring
`SELECT 1` RTT from the prod pod (diagnostics endpoint already exists).

## FRONTEND findings (ranked)

### F1 — Dashboard 3-wave request waterfall (HIGH / MED / LOW-MED)
useDashboardData gates DASHBOARD_FETCH_ALL + chart on `companiesFetched && selectedCompanyId` — but
selectedCompanyId comes from localStorage `last_company_id` (CompanyDataContext L149–160) which is known
at mount, before /company/getCompany returns. Wave 3 (the numbers the merchant came to see) fires ~3s after
first paint.
FIX: fire dashboard-all + chart + wallet immediately with the localStorage company id (reconcile in the
rare case the id is no longer valid), keeping getCompany in parallel. Collapses 3 waves → 1.
EXPECTED: time-to-data −1.5–3s on every dashboard visit.

### F2 — No cross-visit cache → skeletons every visit (HIGH / LOW-MED / LOW)
Dashboard state lives in redux (in-memory only); every visit re-fetches everything and shows skeletons,
even though the backend caches the same payload in Redis for 120s. Stripe/Coinbase paint instantly with
stale data + background revalidate.
FIX: persist last dashboard/companies/wallet payloads (localStorage, keyed by user+company, short TTL) and
hydrate synchronously on mount; revalidate in background. Companies/wallet already use SWR → add a
localStorage cache provider; dashboard redux state can be seeded the same way.
EXPECTED: repeat dashboard visits FEEL instant (0ms to meaningful content).

### F3 — Dashboard first-load JS is still 642 kB gz (HIGH / MED / LOW)
Largest page by far (shared 293 kB + ~350 kB page-owned) despite recharts being dynamic. Known heavies in
the tree: framer-motion (EmptyHero, VolumeHero, QuickActionsDock, HeroMetrics), full dashboard chrome
(sidebar/header/menus), MUI. Needs @next/bundle-analyzer to name the exact chunks before cutting.
EXPECTED: realistic target ≈ 400–450 kB → ~1s faster hydrate on mid-tier mobile (also pulls wave-1 forward).

### F4 — 21 API calls on dashboard load; several are below-the-fold or duplicate (MED / LOW-MED / LOW)
Duplicates: user/profile ×2 (useDashboardData + useAccountProfile), public/tickers ×2 (useUsdRates mounted
twice). Deferrable: reusable-wallets, creator/profile, getPaymentLinks, action-counts — fetch on visibility
or interaction, not mount. Target ≈ 9–10 calls.

### F5 — Two-step login UX pays extra round trips (LOW-MED / LOW / LOW)
checkEmail (221ms) → then password screen → login (1.2s+, see B1). With B1 fixed this flow is fine; optional:
prefetch /dashboard route chunk while the user types their password (router.prefetch), so the post-login
navigation is instant.

### F6 — Font payload: 5 families, ~11 weight files (MED on landing LCP / LOW / LOW)
Geist variable + Unbounded (5 weights!) + IBM Plex Sans (3) + IBM Plex Mono (2) + Manrope (globals.css).
All display:swap (correct — do not revisit that decision), but the byte cost delays the styled hero on cold
mobile. FIX: cut Unbounded to the 1–2 weights the hero actually uses; audit whether Plex Mono AND Geist Mono
are both needed.

### F7 — Landing SSR HTML is 264 kB raw (LOW / LOW / LOW)
Compresses fine over the wire (~45–60 kB), mostly inlined i18n + MUI styles. Watch, don't act.

## Suggested implementation order (if/when approved)
1. B1 login defer (biggest single-endpoint UX win, trivial risk)
2. B2 middleware/cache reorder (speeds up EVERY authed call)
3. F1 waterfall collapse + F4 dedupe/defer (dashboard time-to-data)
4. B3 Redis write batching (small, piggyback on B2)
5. F2 stale-while-revalidate persistence (perceived-instant dashboard)
6. F3 bundle analyzer + diet, F6 font diet (landing/dashboard cold loads)
7. B4 wallet parallelization (test carefully — money display)
