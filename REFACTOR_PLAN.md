# DynoPay — Codebase Efficiency Refactor Plan

Status legend: ⬜ not started · 🟡 in progress · ✅ done

This document tracks the end-to-end "reuse what already exists / remove what's
dead" refactor. Findings are backed by grep counts taken across
`Components/`, `pages/`, `helpers/`, `utils/`, `hooks/`, and `backend/`.

> ⚠️ The backend is wired to **LIVE production** infra. Backend phases are done
> **incrementally, new-code-first** (add helper → migrate a few routes → verify),
> never big-bang. Background jobs stay DISABLED in this environment.

---

## Findings (evidence)

### Frontend
- **25 dead legacy landing components** — only `Home/v3/*` + `LivePriceStrip`
  render; the rest are imported nowhere (Hero, HeroV2, HeroSwiss, Features, FAQ,
  FinalCTA, Testimonials, TestimonialsV2, AudienceDoors, CoreValueProps,
  WhyChooseDynoPay, UseCasesBento, ProductShowcase, TryItNow, StatWall,
  FeeSection, FeeStrip, CreatorShowcase, CrowdfundingShowcase, DeveloperShowcase,
  ChainsMarquee, ComplianceLogoStrip, IndustryLogoWall, LiveActivityStrip,
  SocialProof, TrustBadges). Plus their orphaned `landing.json` keys (×6 langs).
- **`helpers/copyToClipboard.ts` bypassed by 36 files** calling `navigator.clipboard`
  directly (fire-and-forget → false "Copied!" toasts). No `useCopyToClipboard` hook.
- **`utils/currencyFormat.ts` under-used** — 32 files format money inline
  (`toLocaleString`/`Intl.NumberFormat`).
- **Brand accent `#4F46E5` hardcoded 66×** — no theme token.
- **Creator `GRADIENTS` map duplicated 3×** — `buildCoverBackground()` already
  exported by `CreatorThemePicker` but re-declared in `CreatorProfile` + `CreatorLivePreview`.
- **11 raw `fetch()`** bypass the shared axios instance (used by 69 files).
- **No `useDebounce`** — 32 files use ad-hoc `setTimeout`.
- **Overlapping hooks** — `useIsMobile`/`useDevice`/`useWindow`; `useUsdRates`/`useLocalPrice`/`usePaymentRates`/`useDisplayFx`.
- **No data-fetch cache** — 185 components fetch via manual `useEffect`+axios,
  0 SWR/React-Query, only 1 `AbortController` → redundant requests + race bugs.
- **122 inline endpoint path strings**, no central `api/endpoints.ts`.
- **No form library** despite `yup` installed — forms hand-rolled with `useState`.
- **Minimal code-splitting** (2 `dynamic()`); heavy views statically bundled.
- **Ad-hoc loaders** — 45 inline `<CircularProgress>`, 1 skeleton.
- 5 raw `<img>` vs 73 `next/image`.

### Backend
- **No central config** — `process.env` read 741× across 113 files.
- **No `asyncHandler` + no response helper** — ~603 hand-written `try{}` blocks,
  155 hand-built `{success,...}` envelopes.
- **122 ad-hoc `axios` calls**, 1 `axios.create`; retry hand-rolled in 15 files,
  timeouts inline in 77.
- **Tatum touched in 33 files** despite `apis/tatumApi.ts`.
- **Webhook signature verification duplicated across ~8 files**.
- **Dead integrations** — `BLOCK_BEE_API_KEY`, `INFOBIP_API_KEY` set but 0 code refs (HTX used once).
- **Duplicated currency helpers** — `getCurrencySymbol` ×3, `formatCurrency` ×2.
- **14 inline Joi schemas**, no shared schema primitives.

### Already done well (do not touch)
`services/chains/*`, `utils/redisInstance.ts`, shared logger (71 files),
`emailService`/`mailTransporter`, the `apis/` wrappers, the `hooks/` folder.

---

## Phases

### Phase 1 — Dead-code removal (frontend) — ✅ done (2026-08-06)
- Deleted **25 unused `Home/*` components** (~7,700 LOC).
- Pruned **201 orphaned `landing.json` top-level keys** across all 6 languages
  (647 → 349 strings/lang, ~46% smaller). Analyzer: `scripts/phase1_prune_landing.py`.
- Total: **~9,000 lines removed** across 32 files.
- Verified: all 6 JSON parse; landing renders every live section; **zero raw-key
  leaks**; lint clean. No runtime behavior change.

### Phase 2 — Shared frontend primitives — ✅ done (2026-08-06)
- Added `constants/theme.ts` (`BRAND_ACCENT` + dark/light/hover variants + `brandAlpha()`),
  `constants/currencies.ts` (`SUPPORTED_FIAT_CURRENCIES`), `constants/creatorTheme.ts`
  (single source for `ACCENT_PRESETS` / `GRADIENT_PRESETS` / `GRADIENT_STOPS` / `buildCoverBackground`),
  `api/endpoints.ts` (`API_ENDPOINTS.creator.*`).
- Added hooks `useCopyToClipboard` (wraps the robust helper → accurate success/error)
  and `useDebounce`.
- Killed the 3× `GRADIENTS` duplication: `CreatorThemePicker` now re-exports from
  `constants/creatorTheme`; `CreatorProfile` + `CreatorLivePreview` consume `GRADIENT_STOPS`.
- Migrated an initial call-site batch: creator files (`CreatorProfile`, `CreatorLivePreview`,
  `CreatorThemePicker`, `CreatorPageSettings`) off hardcoded `#4F46E5` → `BRAND_ACCENT`,
  off inline endpoint strings → `API_ENDPOINTS`, off ad-hoc debounce/clipboard → the new hooks,
  and off the inline `SUPPORT_CURRENCIES` list → `SUPPORTED_FIAT_CURRENCIES`.
- Verified: `/creator` editor renders (accent/gradient live-preview mirror correct),
  `/[handle]` + `/creator` compile clean, backend `tsc` = 0 errors.
- Remaining call sites (36× clipboard, 66× accent, 122× endpoints, formatters) are left for
  incremental follow-up batches — the primitives now exist to migrate them safely.

### Phase 2b — Handle availability in landing hero — ✅ done (2026-08-06)
- New PUBLIC read-only endpoint `GET /api/user/creator/check-handle-public` (moderateRateLimiter,
  mirrors `checkHandle` minus the authed-user exclusion; never writes → safe on live DB).
- `HeroPlayground` shows a live "available ✓ / taken ✗" indicator + hint as the visitor types,
  debounced via `useDebounce`, honouring any prior reservation token. Verified live
  (free handle → green ✓ "is available"; `hostbay` → red ✗ "already taken").

### Phase 2c — Wider Primitive Rollout — ✅ done (2026-08-06)
- **Clipboard wave — ✅ done & verified.** 41 ad-hoc `navigator.clipboard(.|?.)writeText`
  calls across 29 files routed through the robust `copyToClipboard` helper
  (`scripts/rollout_clipboard.py`). Excluded `pay/demo.tsx` + `CleanCheckoutV2.tsx`
  (own local `copyToClipboard`). tsc: no new errors; landing/dashboard verified.
- **Accent wave — ✅ done & verified.** 139 hardcoded `"#4F46E5"` swapped to the
  `BRAND_ACCENT` token across 55 frontend files (`scripts/rollout_accent.py`,
  context-aware: JSX attr → `{BRAND_ACCENT}`, value pos → `BRAND_ACCENT`).
  Guarded by a tsc baseline-diff (6 errors before/after — all pre-existing; zero new).
  Verified: landing + `/auth/register` + `/dashboard` render, global `styles/theme.ts`
  (23 swaps) intact.
- **Template-accent cleanup — ✅ done & verified.** The residual bare-hex accents inside
  styled-component/gradient template literals converted to `${BRAND_ACCENT}` (~24 across
  ~15 files). Only doc-comments now reference the literal. tsc: zero new errors.
- **Endpoints wave — ✅ done & verified.** 120 inline API paths (79 static + 41 dynamic)
  across 41 files migrated to the central `API_ENDPOINTS` map (`scripts/rollout_endpoints.py`
  + `scripts/extract_endpoints.py`). BYTE-IDENTICAL by construction: static consts hold the
  exact original string (call-site-aware — router paths untouched); dynamic builder fns
  interpolate their args VERBATIM (any `encodeURIComponent(...)` stays at the call site).
  Builder params typed `PathId = string | number | string[]` to match template-literal
  coercion. tsc: 6 errors before/after (zero new). Runtime verified: login (auth), dashboard,
  and referrals (5 migrated `/referral/*` endpoints returning live data) all work.
- **Currency-formatter wave — ✅ done & verified (2026-08-06).** Consolidated the
  separator-only money-format sites (7 sites: Payment-link ×2, Transactions ×2,
  TransactionsTable ×2, NotificationPage ×1) from inline
  `x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`
  → `formatWithSeparators(x, undefined, 2)`. BYTE-IDENTICAL (same ICU path). Verified
  on /transactions (USD Value column renders $130.67, $10.01, … no NaN) + /pay-links
  + /notifications compile clean. DELIBERATELY NOT blanket-migrated: the remaining
  ~22 money-format sites use context-specific currency symbols/locales (`formatCurrency`
  would change symbol/decimal output) — those are left as-is to avoid money-display
  regressions on the live gateway.

Note on the other Phase-2 Findings items (raw `fetch()`, `useDebounce` adoption,
overlapping-hook consolidation): assessed and INTENTIONALLY deferred out of 2c —
most raw `fetch()` are SSR (`getServerSideProps`), external/public endpoints with
`no-store`/credential semantics, or code-samples shown in the UI (not safe to force
onto the browser axios instance); `setTimeout` sites are mostly non-debounce delays;
hook consolidation is architectural. These belong to Phase 3/6, not the 2c primitive rollout.

### Phase 3 — Frontend data-fetching consolidation — ✅ done (screens batch 2026-08-08)
- ✅ SWR introduced for **wallet + company** (`contexts/WalletDataContext`,
  `contexts/CompanyDataContext`, global `SWRConfig` in `_app.tsx`) — redux sagas/reducers
  retired; ~50 consumers rewired; verified (login→dashboard→wallet, company switch/create/delete).
- ✅ **rates** unified onto SWR (`hooks/usePaymentRates.ts`, 30s dedupe) — verified no infinite refetch.
- ✅ **Fee-free + reusable-wallets deduped (2026-08-06)** — new shared SWR hooks
  `hooks/useFeeFreeStatus.ts` (collapses the 3 fee-free consumers → 1 call) and
  `hooks/useReusableWallets.ts` (keyed by target company, gated on a resolved id → 1 call).
- ✅ **AbortController wired (2026-08-06)** — `utils/abortRegistry.ts` (`nextSignal`/`isAbortError`);
  signals added to the wallet fetcher (WalletDataContext), payment-rates fetcher, and reusable-wallets
  fetcher so a company switch / amount change cancels the stale in-flight request.
- ✅ **Dashboard prefetch (2026-08-06)** — `utils/prefetchDashboard.ts` SWR-`preload`s company list +
  onboarding-status + fee-free-status in the post-login window (`pages/auth/login.tsx`) so the dashboard
  paints with data ready.
- ✅ **Instant Company Switch (2026-08-06)** — `CompanySelector` hover-prefetches the hovered company's
  wallet SWR cache via `preload([WALLET_KEY, id], walletPrefetchFetcher)` (a non-aborting fetcher so it
  never cancels the active company's fetch) → clicking switches instantly.
- ✅ **Account/settings screens → SWR (2026-08-06)** — migrated `Profile/ActiveSessions` (user/sessions,
  optimistic revoke via `mutate`), `Profile/LoginActivity` (paginated SWR key `[url, page]`, `keepPreviousData`),
  and `pages/referrals.tsx` (5 referral endpoints → 5 independent SWR keys). Verified rendering + single call each.
- ✅ **Notifications + merchant lists → SWR (2026-08-06)** — `NotificationPage` list on SWR (bell badge stays
  in sync via the shared unread-count cache; mark-read/mark-all via `mutate`); `Customers`, `pages/invoices.tsx`
  (invoices list), and `pages/pay-links/products/index.tsx` (products list + categories) migrated to SWR
  (`keepPreviousData` for paginated/searched lists; mutations refetch via `mutate`). All verified rendering live.
- ✅ **Prefetch on row hover (2026-08-06)** — `helpers/invoicePdfCache.ts` (`prefetchInvoicePdf`/`getInvoicePdf`);
  invoice rows `onMouseEnter` warm the PDF blob so `InvoicePreviewDrawer` opens instantly (verified: 1 prefetch
  call on hover, drawer reads the shared cache). (Transaction detail already ships full row data → no fetch to warm.)
- ✅ **Screens batch — API / Webhooks / Products / Creator (2026-08-08).** Migrated the
  remaining read-oriented `useEffect`+axios fetches on the named screens to SWR:
  - New shared hook `hooks/usePublishableKeys.ts` — collapses the **3** publishable-key
    readers (Publishable Keys section, Buy Buttons section, API embed-snippet card) onto
    ONE company-keyed SWR cache (deduped + cached across tab switches). Per-call-site
    behaviour preserved via an `{ enabled }` gate (list sections stay empty when no company;
    the embed card still fetches all keys when none is selected).
  - New shared hook `hooks/useBuyButtons.ts` — Buy Buttons list, company-keyed.
  - `WebhookConsoleSection` — read-only **stats + logs** lists → SWR (logs keyed by
    company + status filter so changing the filter refetches; `refreshAll` revalidates both).
    The editable webhook-URL/secret **settings form seed is intentionally kept manual**
    (SWR would fight the edited fields).
  - `pages/pay-links/products/[productId]/orders.tsx` — orders list → SWR (product-keyed;
    the two-step refund flow revalidates via `loadOrders()`).
  - `CreatorPageSettings` — merchant **analytics** read → SWR (handle-keyed; auto-refetches
    on handle change exactly like the old effect).
  All swaps are behaviour-preserving (same endpoints/response shape), mutation handlers kept
  working via `mutate` aliases. Verified: `tsc --noEmit` = 108 errors before/after (all
  pre-existing; **zero new**, zero in the touched files), ESLint clean on all touched files,
  and `/developer-keys` + `/creator` + `/pay-links/products/[productId]/orders` all compile
  and return 200 under `next dev`.
- ✅ **Settings** — assessed: `pages/settings/index.tsx` already sources everything from the
  SWR-backed `useCompanyStore` / `useTokenData` / redux; it has **no manual `useEffect`+axios**
  fetch to migrate. (The API-keys list it embeds is still redux-saga-backed — already cached;
  a redux→SWR move is a separate arc, out of scope for the "manual useEffect+axios" cleanup.)
- ⬜ **Intentionally deferred** (SWR adds risk with little dedup benefit — same rationale used
  elsewhere in this plan): editable **form seeds** that mutate their own local state
  (Tax settings, webhook settings form, Creator profile form, `ProductEditor` edit-mode load
  — the last also does optimistic `setProduct` after publish/archive that SWR would clobber);
  the **debounced handle-availability** live check (real-time, not cacheable); and
  **Help & Support** (dual-source API + hardcoded fallback with a manual/debounced search that
  rewrites the same `articles` list). These stay on manual fetch by design.

### Phase 4 — Backend HTTP resilience + integrations — 🟡 partially done (resilient client shipped 2026-08-08)
- ✅ **Resilient Tatum/blockchain HTTP client + `withRetry` util (2026-08-08).** New
  `backend/utils/tatumHttp.ts`: a shared axios instance that auto-retries TRANSIENT failures
  (network errors, ECONNRESET/ETIMEDOUT, HTTP 429/500/502/503/504) with exponential backoff +
  jitter and `Retry-After` support, plus a generic `withRetry()` wrapper for non-axios (SDK) work.
  **Safety:** retries ONLY idempotent requests (GET/HEAD/OPTIONS, or a non-GET explicitly flagged
  `idempotent:true`); writes/POSTs (broadcasts, transfers, address creation) are NEVER retried, and
  the bounded 30s read-timeout is applied only to auto-retryable reads (writes keep the caller's
  timeout so a broadcast is never aborted mid-flight). No API-key injection (callers attach their
  own headers) → safe to reuse for non-Tatum reads too.
  Routed through it (transparent — success path unchanged, only adds retry on transient errors):
  `apis/tatumApi.ts` (the 60+-call gateway), `services/blockchainFeeService.ts`,
  `services/reconciliation.ts`, `helper/currencyConvert.ts`, `services/tronEnergyService.ts`.
  EXCLUDED by design: `services/merchantPool/directEvmTransfer.ts` (sweep broadcaster — sensitive),
  `services/migrateWebhookUrls.ts` (write-only + disabled under WORKER_ROLE=secondary),
  `routes/diagnosticsRouter.ts` (admin-only inline requires), one-off `scripts/*`.
  Verified: backend `tsc --noEmit` = 0 errors; boots clean; `/health` tatum_api operational (circuit
  CLOSED); backend testing agent confirmed NO regression — public tickers + `getCurrencyRates`
  (both Tatum-backed via tatumHttp) return valid data, no tatumHttp errors in logs, caching + circuit
  breaker healthy (all tests read-only/safe on the live system).
- ⬜ Remaining: opt specific known-safe read-POSTs (JSON-RPC reads, fee estimates) into retry via
  `idempotent:true`; consolidate any remaining bypassing call sites (diagnosticsRouter inline
  requires); shared `verifyWebhookSignature` (dedupe ~8 files); remove dead BlockBee/Infobip config.

### Phase 5 — Backend response layer + config — ⬜
- `asyncHandler` + `sendSuccess/sendError`; typed `config` module; dedup backend
  currency helpers; migrate merchant-API routes first, verify, then expand.

### Phase 6 — Polish — 🟡 partially done
- ✅ **Shared skeleton loader (2026-08-06)** — new `Components/UI/SkeletonList` (configurable rows/height);
  rolled out to `NotificationPage` inbox + `pages/pay-links/products` list (replaced `CircularProgress`/
  `LinearProgress` spinners). Customers/Referrals/Transactions already used skeletons.
- ✅ **Faster Checkout Open (2026-08-06)** — `pages/pay/index.tsx` now `next/dynamic` code-splits the
  heavy checkout renderers (`CleanCheckoutV2` ~72KB, `cryptoTransfer` ~94KB, `donationCampaign` ~42KB,
  `bankTransferCompo` ~17KB) with a shared spinner fallback, so /pay ships a smaller initial bundle and
  only loads the renderer the payment needs. (Dashboard chart `AreaChart` was already `dynamic`.)
- ⬜ Remaining: shared `<Loader/>` + skeletons across ~45 inline spinners; react-hook-form + existing yup;
  last raw `<img>` → `next/image`.

---

## Next Up — prioritized backlog (added 2026-08-06)

Recommended near-term picks, each mapped to its phase. All frontend-only unless noted;
app runs against a LIVE production DB, so each should ship in small, individually-verified batches.

1. **Abort Stale Requests** (Phase 3) — ✅ done (2026-08-06)
   `utils/abortRegistry.ts` (`nextSignal(family)` + `isAbortError`) wired into the wallet fetcher,
   payment-rates fetcher, and reusable-wallets fetcher so navigating away / switching company /
   typing a new amount cancels the stale in-flight request. Verified: no AbortError leaks in console.

2. **Loader Polish** (Phase 6) — ⬜
   Roll out the shared `<Loader/>` + skeleton components across the remaining ~45 inline
   spinners for consistent loading UX (the wallet-list skeleton shipped 2026-08-06 is the pattern to follow).

3. **Currency Symbols** (Phase 2 follow-up / careful) — ⬜
   Unify the remaining ~22 money displays that render currency SYMBOLS onto `formatCurrency`,
   screen-by-screen with visual byte-check (NOT a blanket codemod — symbol/decimal/locale
   output differs, so each screen must be eyeballed before/after). Separator-only sites were
   already migrated to `formatWithSeparators` in Phase 2c.

4. **Faster First Paint** (Phase 6) — ⬜
   Code-split the heaviest checkout + dashboard screens with `next/dynamic` (e.g.
   `CleanCheckoutV2`, dashboard chart/v2026) so those routes open quicker.

---

## Next Up — batch added 2026-08-06 (post transactions perf + usd_value backfill)

Follow-ups surfaced while fixing the transactions slow-load and backfilling legacy
`usd_value`. All frontend-only unless noted; LIVE prod DB → ship in small verified batches.

5. **Row Hover Everywhere** (Phase 3 / perf) — ⬜
   Extend the invoice-row hover-prefetch pattern (`helpers/invoicePdfCache.ts` +
   `onMouseEnter`) to transaction and customer rows so every detail drawer/modal opens
   instantly. For transactions the row already carries full data (no fetch); for customers
   warm the detail endpoint on hover.

6. **Remaining Screens → SWR** (Phase 3) — ✅ done (2026-08-08)
   Migrated the read-oriented fetches on the last manual `useEffect`+axios screens
   (API keys embed card + Publishable Keys + Buy Buttons, Webhooks stats/logs, Creator
   analytics, Product orders) to SWR — see the Phase 3 "Screens batch" entry above.
   Settings needed no change (already store/hook-backed). Editable form seeds, the debounced
   handle check, and Help & Support are intentionally left on manual fetch (documented above).
   (Notifications, Customers, Invoices, Products, Profile sessions/activity, Referrals were
   migrated 2026-08-06.)

7. **Pending Value Estimate** (product / perf-safe) — ⬜
   Optional: show a subtle "≈ $X (est.)" on pending crypto transaction rows, computed lazily
   in the browser (or from the already-cached dashboard rates) — restores an at-a-glance USD
   figure WITHOUT reintroducing the per-row server-side live conversion that made the list slow.
   Must stay client-side and clearly marked as an estimate (never written to `usd_value`).

8. **Confirmed-Value Snapshot Cron** (Phase 4 / backend) — ⬜
   Optional accuracy improvement: snapshot the crypto→USD rate at receipt time (or on
   confirmation) so historical `usd_value` reflects the value AT payment time rather than
   current-rate. Settlement already writes the real `usd_value` on confirmation, so this is a
   nice-to-have for reporting fidelity, not a correctness bug. Would remove any future need for
   live conversion in list queries entirely.
