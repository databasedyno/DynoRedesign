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

### Phase 3 — Frontend data-fetching consolidation — ⬜
- Route reads through existing hooks; add `AbortController`; introduce SWR for
  rates/wallet/company; migrate representative screens.

### Phase 4 — Backend HTTP resilience + integrations — ⬜
- Resilient client + `withRetry` util; consolidate Tatum call sites to `tatumApi`;
  shared `verifyWebhookSignature`; remove dead BlockBee/Infobip config.

### Phase 5 — Backend response layer + config — ⬜
- `asyncHandler` + `sendSuccess/sendError`; typed `config` module; dedup backend
  currency helpers; migrate merchant-API routes first, verify, then expand.

### Phase 6 — Polish — ⬜
- Shared `<Loader/>` + skeletons; `next/dynamic` for heavy views;
  react-hook-form + existing yup; last raw `<img>` → `next/image`.
