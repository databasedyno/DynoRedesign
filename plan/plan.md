# DynoPay Architecture Review — Backend & Frontend

Objective assessment against common development standards, with recommendations ranked by impact.

> **ACTIVE PROPOSAL: Part D — Frontend Fix Execution Plan** (backend work deferred by user decision, 2026-06). Parts A–C are the approved review and timings that Part D executes.

---

# PART A — BACKEND (approved in previous revision, unchanged)

## A1. What the backend is today

- A single Node.js/TypeScript Express monolith (`server.ts`, ~1,675 lines) serving the dashboard API, the merchant API, webhooks, and diagnostics.
- PostgreSQL (Railway) via Sequelize; Redis for locks, queues (BullMQ), and — critically — live payment state.
- Background work (sweeps, settlement, reconciliation, ~25 cron jobs) runs **inside the same web process**, gated by env flags (`ENABLE_BACKGROUND_JOBS`, `WORKER_ROLE`) plus Redis leader election and per-job locks.
- A Python ASGI proxy (`server.py`) fronts the Node process in the preview pod only; production runs compiled Node directly.

### What is genuinely good (worth keeping)
- Leader election + per-job Redis locks for multi-instance safety.
- BullMQ webhook queue with a dead-letter queue and admin retry endpoints.
- Circuit breaker around Tatum, HMAC webhook signatures, helmet/CORS/sanitization stack, env validation at boot.
- Double-entry ledger, payment state machine, incident playbook docs, file-size ratchet (`check-file-size.mjs`).
- Graceful shutdown that stops accepting traffic before tearing down workers.

## A2. Backend findings

### Finding A — Shared production DB/Redis across environments (highest risk)
Preview/dev instances connect to the **live production Postgres and Redis**, held back only by env flags ("SAFE MODE", `WORKER_ROLE=secondary`). Code comments document past incidents this caused: webhook URLs overwritten by dev URLs, duplicate emails, cron jobs competing to move real funds.
*Standard practice:* one isolated database + Redis per environment. Safety from isolation, not flags.

### Finding B — Redis as the source of truth for in-flight payments
Live payment state lives in Redis keys (`crypto-{address}`, `customer-{ref}`, `processed-tx-*`). The 20+ one-off recovery/rescue scripts in `scripts/` are the direct cost of this design.
*Standard practice:* Postgres as system of record (state machine + journal tables already exist); Redis for cache/locks/queues only.

### Finding C — Background jobs inside the API process
~25 cron jobs (fund sweeps, settlements, reconciliation) run in the HTTP process. A proper split exists (`worker.ts`) but isn't deployed as a separate service.
*Standard practice:* separate `web` and `worker` services from the same image.

### Finding D — `server.ts` is a god file
Bootstrap, CORS logic, cron definitions, ~20 diagnostics endpoints with inline raw SQL in one 1,675-line file; several files exceed 2,000 lines (`paymentLinkController.ts` 2,712; `tatumApi.ts` 4,136).
*Standard practice:* server wires middleware/routers only; crons in a job registry; diagnostics in the existing router.

### Finding E — Three parallel migration mechanisms
`database/migrate.ts` + raw `.sql` + ad-hoc TS migrations + ~15 one-off `add_*.js` scripts + `sync({alter:true})` in dev + `bootMigrations` in prod.
*Standard practice:* one versioned migration pipeline run as a deploy step.

### Finding F — In-memory state that breaks under multiple instances
Unsigned-webhook rate limiting in a per-process `Map`; hardcoded Tatum IP `Set` containing CIDR ranges that `Set.has()` can never match.
*Standard practice:* Redis-backed counters; CIDR matching from config.

### Finding G — Repo and test hygiene slows development
Two test layouts + loose test files at root; Python scripts testing Node code; production data backup JSON committed; `/api/v1` alias with no real versioning.
*Standard practice:* one CI-run test layout; ops scripts out of the app repo; real or no versioning.

### Finding H — Observability relies on email digests
No APM/tracing/metrics; detection time bounded by a 15-minute digest email.
*Standard practice:* Sentry-class real-time capture + metrics for queue depth, cron durations, settlement latency.

### Finding I — Python proxy (preview-only, minor)
Buffers whole bodies, cannot stream — SSE doesn't work through the preview pod. Acceptable shim; documented so it isn't mistaken for a backend bug.

---

# PART B — FRONTEND (new)

## B1. What the frontend is today

- Next.js 14 **Pages Router** app living at the **repo root** (`/app`), TypeScript strict, MUI v5 + Emotion, deployed standalone on DigitalOcean behind nginx.
- State/data via **three overlapping layers**: Redux + redux-saga (`Redux/Actions|Reducers|Sagas`), SWR hooks (`hooks/useApiSWR` and ~35 domain hooks), and four React contexts (Cart, CompanyData, WalletData, Theme).
- Hand-rolled i18n: 6 languages × 21 namespaces loaded by a ~350-line `i18n.js` with per-language switch statements; `next-i18next` is installed but unused.
- Auth split two ways: backend-owned JWT (email/password + GitHub OAuth) plus a thin NextAuth route used only for Google sign-in.

### What is genuinely good (worth keeping)
- TypeScript strict mode enforced in `next build` (a documented cleanup arc drove 286 errors to 0) plus a fast separate `tsc --noEmit` CI check.
- ESLint **errors** gate builds; custom lint tooling: contrast checker, i18n key checker, secrets scanner, husky hooks, Playwright device-matrix tests.
- Hydration-safe i18n design (SSR always English, saved language applied post-hydration) with the reasoning documented in code — a real bug class solved properly.
- Perf-conscious `next.config.mjs`: `optimizePackageImports` for MUI/recharts, build-memory guardrails for DO's build box, console stripping, SSR theme via `Sec-CH-Prefers-Color-Scheme` (no dark-mode flash).
- Middleware that 404s QA/demo "fake payment" pages in production — the right guard for a payments brand.
- Serious SEO machinery: generated SEO pages, sitemap, OG images, hreflang tests.

## B2. Frontend findings

### Finding J — Three state layers doing one job (biggest drag on speed)
Redux+redux-saga is the legacy layer, SWR is the modern one, and contexts patch the gaps. Migration scripts in `/scripts` (`migrate_swr_reads*.py`) show an SWR migration that started and stalled. Every new feature must choose among three patterns, and every bug hunt must check three caches.
*Standard practice:* one server-state library (SWR, already winning) for all API data + minimal client state (context or a small Redux slice for auth/UI). Finish the migration page-by-page, then delete the saga layer — sagas add a generator-based indirection that no current feature needs.

### Finding K — The repo root is the frontend, and it is polluted
The Next app shares its root with `backend/`, ~80 loose test scripts (mostly Python scripts that test the Node backend), committed screenshots (`dark_dashboard.png`, `s10_login.png`, …), debug dumps (`debug_output.txt`, `page_errors.txt`), and a dozen log-analysis reports. `/app/frontend` is a vestigial stub with only a package.json. `tsconfig.json` has to hand-exclude stray root files; ESLint has to hand-list source dirs.
*Standard practice:* explicit workspace layout (`frontend/`, `backend/`, `ops/`), test artifacts and screenshots gitignored, one-off analysis docs in `/docs` or `/memory` only. This is the same hygiene issue as backend Finding G — it is one repo problem, best fixed once.

### Finding L — Hand-rolled i18n loader with 12× duplication
`i18n.js` hardcodes every namespace for every language **twice** (sync `require` + async `import`) — ~300 lines that must be edited in 12 places to add one namespace. Webpack resolves template-literal dynamic imports (`import(\`./langs/locales/${lang}/${ns}.json\`)`) with identical chunk-splitting, collapsing this to ~15 lines. Separately, ~30 one-off i18n patch scripts (`i18n_add_keys.js`, `fill_missing_i18n.py`, `translate_missing_i18n.py`, …) show translation keys are maintained by ad-hoc scripting rather than a single manifest + CI check (the checker `check-i18n.mjs` exists — it should be the only mechanism). `next-i18next` is a dead dependency either way: remove it or adopt it.

### Finding M — Duplicate utility and theme layers
`helpers/` and `utils/` overlap (e.g. `helpers/fireConfetti.ts` vs `utils/confettiBurst.ts`; `dateTimeFormatter`/`displayDate` vs `formatDate`); themes are spread over `styles/theme.ts`, `theme2.ts`, `appTheme.ts`, `authTheme.ts`, `homeTheme.ts`, `constants/theme.ts`, and `utils/theme/`; the API layer has two axios clients (`axiosConfig.ts`, `axiosAdmin.ts`) plus `swrFetcher` plus `api/endpoints.ts`.
*Standard practice:* one `lib/` (or keep `utils/`) organized by domain, one theme module with named variants, one API client with an admin-token interceptor. Mostly mechanical; pays off in every future change.

### Finding N — Server-grade dependencies in the frontend package
`pg`, `ioredis`, `bcryptjs`, `jsonwebtoken`, `sharp`, and the Node `i18n` package sit in the frontend's dependencies. The only Next API route is a 38-line NextAuth Google config that uses none of them — they serve root-level ops scripts or nothing. Cost: heavier installs and Docker layers, larger security-audit surface on the public-facing app.
*Standard practice:* prune to what pages/API routes actually import; ops scripts get their own package.

### Finding O — Two auth heads
The backend owns email/password JWT and GitHub OAuth; NextAuth exists solely for Google — and the preview proxy must special-case `/api/auth/*` to keep the two from colliding. Two session models for one product.
*Standard practice:* one auth boundary — either the backend owns all OAuth (it already does GitHub, so adding Google there retires NextAuth, `next-auth`, and the proxy special-case), or NextAuth fronts all social login and exchanges to a backend JWT. First option is the smaller change.

### Finding P — Disabled guards accumulating quiet debt
- `reactStrictMode: false` — hides unsafe effect/lifecycle patterns that will surface in any future React/Next upgrade.
- ~500 acknowledged ESLint **warnings** (including `exhaustive-deps`, a real-bug class in a hooks-heavy app) are permanently allowed.
*Standard practice:* re-enable strict mode behind a fix-forward pass; ratchet warnings the same way the backend ratchets file sizes — count can only go down.

### Finding Q — Pages Router: explicitly fine (a non-recommendation)
Pages Router on Next 14 is supported and appropriate for a dashboard-heavy app. An App Router/RSC migration would be high-effort, high-risk, low-payoff here and is **not** recommended. Noted so "what could be done differently" is not read as "rewrite the router."

## B3. Frontend recommendations (prioritized)

| # | Recommendation | Effort | Impact |
|---|---|---|---|
| FP1-1 | Finish the SWR migration and delete the redux-saga layer; contexts/small slices for the rest | Medium | One data pattern; faster features, fewer stale-state bugs |
| FP1-2 | Prune server-grade deps (`pg`, `ioredis`, `bcryptjs`, `jsonwebtoken`, `next-i18next`, Node `i18n`) from the frontend package | Low | Smaller attack surface and builds |
| FP2-1 | Repo hygiene (shared with backend G): move loose test scripts/artifacts out of root, gitignore screenshots/dumps, real `frontend/` workspace or document root-as-frontend | Low | Onboarding, tooling speed, no accidental build inclusion |
| FP2-2 | Replace the i18n switch statements with a template-literal dynamic-import loop; make `check-i18n.mjs` + one manifest the only key mechanism; delete the 30 patch scripts | Low | Adding a language/namespace becomes zero-touch |
| FP2-3 | Consolidate helpers/utils, theme files, and API clients | Medium | Removes daily "which one do I use" tax |
| FP2-4 | Move Google OAuth to the backend; retire NextAuth and the proxy special-case | Medium | One auth model, one session store |
| FP3-1 | Re-enable `reactStrictMode`; add an ESLint-warning ratchet | Medium | Future-proofing for React/Next upgrades |
| FP3-2 | Do NOT migrate to App Router now | — | Avoids a high-risk rewrite with little payoff |

### Suggested sequencing if acted on
1. **FP1-2 + FP2-1 + FP2-2 first** — low-risk cleanups, each independently shippable.
2. **FP1-1 SWR consolidation** page-by-page (each page independently testable; sagas deleted only when their last consumer is gone).
3. **FP2-3 consolidation**, then **FP2-4 auth unification** (touches login — needs its own test pass).
4. **FP3-1 strict mode + ratchet** once the above has reduced churn.

---

# PART C — EFFORT TIMINGS (to be documented in /app/memory/REFACTOR_STATUS.md on approval)

Estimates assume one engineer familiar with this codebase, including verification (tsc/tests/testing agent). None of these items are started.

## Backend recommendations — effort timings

| ID | Recommendation | Estimate | Notes on estimate |
|----|----------------|----------|-------------------|
| P0-1 | Isolated staging DB + Redis (previews never touch prod) | **2–3 days** | Schema-only Railway staging clone was already done once (2026-08-24 session) — repeatable; add Redis + env wiring + docs. Ties into the existing A4 staging load-test kit item. |
| P0-2 | Postgres as source of truth for in-flight payments (Redis → cache/lock/queue only) | **3–5 weeks, phased** | Highest-risk item. Per-chain behind a feature flag, validated on staging (needs P0-1 first). Replaces the `crypto-{address}` Redis state machine; retires the recovery-script class. |
| P1-1 | Deploy `worker.ts` as separate DO service; API instances → `WORKER_ROLE=secondary` | **1–2 days** | Code already exists (`yarn start:worker`); work = DO app-spec change, env split, boot verification, 24h observation. |
| P1-2 | Single versioned migration pipeline; remove `sync({alter})` + one-off `add_*.js` scripts | **1–2 weeks** | `migrationRunner.ts` + `bootMigrations` already exist (Item #1 core done) — remaining work is folding the ad-hoc SQL/TS/JS migrations in and banning dev alter-sync. |
| P1-3 | Redis-backed rate limiting + CIDR matching for Tatum IP allowlist | **1 day** | Small, isolated: `routes/index.ts` unsigned-webhook Map → Redis counter; `Set` → CIDR lib + config. |
| P2-1 | Decompose `server.ts` (cron registry, diagnostics → diagnosticsRouter, CORS module) | **3–5 days** | Mechanical extraction; ~1,675 lines → target <300. Each extraction boot-verifiable. Respects the 500-line R2 budget for new files. |
| P2-2 | Repo/test hygiene: one test layout, CI gate (jest + tsc), purge prod-data backups, archive one-off ops scripts | **1–2 days** | Shared with frontend FP2-1 (one repo problem). Includes removing `backfill_invoice_fees_backup_*.json`. |
| P2-3 | Real-time error capture (Sentry-class) alongside email digests | **1 day** | `errorMonitoringService.captureError` is the single funnel — add a forwarder, keep digests. |
| P3-1 | API versioning decision (freeze `/api/v1` or drop the alias) | **0.5 day** | Decision + one-line mount change + doc note. |

**Backend subtotal: ~7–10 working days for everything except P0-2; P0-2 adds 3–5 weeks phased.**

## Frontend recommendations — effort timings

| ID | Recommendation | Estimate | Notes on estimate |
|----|----------------|----------|-------------------|
| FP1-1 | Finish SWR migration, delete redux-saga layer | **10–15 days, in waves** | Measured velocity from the Item #5 logs in REFACTOR_STATUS: 3–5 files per wave-session (13+ files done so far, ~27 files + saga-backed screens remain). Sagas deleted only when their last consumer is gone; each wave testing-agent verified. |
| FP1-2 | Prune server-grade deps (`pg`, `ioredis`, `bcryptjs`, `jsonwebtoken`, `next-i18next`, Node `i18n`) | **0.5–1 day** | Verify zero imports in shipped code, remove, full build + smoke. |
| FP2-1 | Repo root hygiene: move ~80 loose test scripts, gitignore screenshots/dumps | **1–2 days** | Shared task with backend P2-2. No app-code changes; tsconfig/eslint excludes get simpler. |
| FP2-2 | i18n loader rewrite (350-line switch → template-literal import loop) + manifest-only key pipeline; delete ~30 patch scripts | **1 day** | Webpack chunk-splitting must be verified equivalent (bundle inspect). `check-i18n.mjs` becomes the single gate. |
| FP2-3 | Consolidate helpers/utils, 6+ theme files, dual axios clients | **3–5 days** | Mechanical but wide blast radius — do after FP1-1 waves to avoid churn collisions. |
| FP2-4 | Move Google OAuth to backend; retire NextAuth + proxy special-case | **3–4 days** | Backend already owns GitHub OAuth (pattern exists). Includes full auth-flow test pass + preview proxy cleanup in `server.py`. |
| FP3-1 | Re-enable `reactStrictMode` + ESLint warning ratchet | **2–3 days initial** | Strict mode will surface double-effect bugs — needs a fix-forward pass; ratchet script mirrors the `check-file-size.mjs` pattern. Ongoing cost ~0. |
| FP3-2 | App Router migration | **0 (not recommended)** | Explicit non-recommendation — high risk, low payoff for this app. |

**Frontend subtotal: ~21–31 working days, dominated by the SWR/saga consolidation.**

## Combined sequencing timeline (if the whole program is approved)

| Phase | Contents | Elapsed estimate |
|-------|----------|------------------|
| Week 1 | P1-1 worker split · P1-3 Redis rate limits · FP1-2 dep pruning · FP2-2 i18n loader · P3-1 versioning decision | ~5 days |
| Week 2 | P0-1 staging env · P2-2/FP2-1 repo hygiene · P2-3 Sentry | ~4 days |
| Weeks 3–4 | P1-2 migration consolidation · P2-1 server.ts decomposition (staging now exists) | ~8 days |
| Weeks 3–7 (parallel track) | FP1-1 SWR waves · then FP2-3 consolidation · FP2-4 auth unification · FP3-1 strict mode | ~15–22 days |
| Weeks 6–10 | P0-2 DB-first payment state, per-chain behind flag, staging-validated | 3–5 weeks |

Total program: **~8–10 calendar weeks** single-engineer. The first two weeks alone deliver the highest safety-per-day (worker isolation, staging, correct rate limiting, smaller attack surface).

---

# PART D — FRONTEND FIX EXECUTION PLAN (active proposal)

Executes the frontend recommendations (Part B) in four independently shippable phases. Every phase is behavior-preserving: users see the same product; what changes is reliability, bundle weight, and how fast future work ships. Backend items are untouched.

## Ground rules (apply to every phase)
- The preview runs against the **live production database in SAFE MODE** — all verification uses read-only flows only: no checkout submissions, no OTP triggers, no data writes beyond what a normal page view does.
- Each phase ends green on the full gate (`tsc --noEmit`, ESLint, `next build`, testing-agent pass on affected screens) before the next begins.
- Shipping is per-phase via **Save to GitHub** → DigitalOcean auto-deploy; any phase can be held back or rolled back without affecting the others.
- The existing pre-commit gates (file-size budget, secrets scan, contrast check) stay authoritative.

## Phase 1 — Quick wins (~2–3 days)
1. **Dependency pruning (FP1-2):** remove `pg`, `ioredis`, `bcryptjs`, `jsonwebtoken`, `next-i18next`, and the Node `i18n` package from the frontend after confirming nothing shipped imports them. Smaller installs, smaller security surface.
2. **i18n loader rewrite (FP2-2):** replace the 350-line per-language switch in `i18n.js` with a template-literal dynamic-import loop (identical chunk splitting, verified by bundle inspection). Adding a language or namespace becomes zero-touch. The ~30 one-off i18n patch scripts are archived; `check-i18n.mjs` becomes the only key mechanism.
3. **Repo hygiene (FP2-1):** move the ~80 loose root test scripts into `ops/`, gitignore and remove committed screenshots/debug dumps from the tree (git history is NOT rewritten — that would require a force-push and is out of scope). Root becomes navigable; tsconfig/eslint excludes simplify.

**Done means:** production build byte-equivalent in behavior, all six languages still switch correctly (spot-checked per language), repo root contains only app code + docs.

## Phase 2 — One data layer (~10–15 days, in shippable waves)
Finish the SWR migration (FP1-1): remaining read-only screens move to the shared `useApiSWR` in waves of 3–5 files, matching the velocity already proven in past sessions. Saga-backed flows are migrated last; **redux-saga is deleted only when its final consumer is gone**. Anything genuinely client-state (auth token, UI toggles) stays in a small Redux slice or context — the goal is one way to fetch server data, not zero Redux.
Mutation-heavy payment/crypto components that previous sessions deliberately kept bespoke **stay bespoke** — this phase does not touch money-path forms.

**Done means:** no `axios`-in-`useEffect` reads remain outside the documented bespoke list; `redux-saga` is out of package.json; every migrated screen testing-agent verified.

## Phase 3 — One of everything (~3–5 days)
Consolidation (FP2-3): merge `helpers/` + `utils/` duplicate utilities (confetti, date formatting, clipboard), unify the six theme files into one theme module with named variants, and collapse the two axios clients into one with an admin-token interceptor. Done after Phase 2 so file churn never collides with SWR waves.

**Done means:** one import path per utility, dark/light and admin screens visually unchanged (screenshot-compared).

## Phase 4 — Guards back on (~2–3 days)
FP3-1: re-enable `reactStrictMode` with a fix-forward pass on any double-effect issues it surfaces, and add an ESLint-warning ratchet (same pattern as the backend's file-size baseline: the warning count can only go down).

**Done means:** strict mode on in production config; warning baseline committed and enforced by pre-commit.

## Explicitly deferred (needs its own approval later)
- **FP2-4 auth unification** (move Google OAuth to backend, retire NextAuth): touches live login, so it is excluded from this program and proposed separately.
- **App Router migration:** permanently not recommended.
- All backend items (Parts A/C).

## Total: ~18–26 working days across 4 phases, each independently valuable and shippable.

## Decisions locked in this plan (challenge any of these)
1. Ship to production **after each phase**, not as one big batch — smaller blast radius per deploy.
2. Auth stays exactly as-is (deferral above).
3. Money-path/checkout components are untouched throughout.
4. Git history is not rewritten during repo cleanup.
5. At build start, the approved review + timings (Parts A–C) are copied into `/app/memory/REFACTOR_STATUS.md` as a dated entry, per the earlier request.

---

## Assumptions
- Reviews cover `/app` (frontend) and `/app/backend` as they exist today; DO/Railway infrastructure config out of scope except where the code depends on it.
- No code changes under this plan; each recommendation would be scoped, approved, and tested individually if picked up.
- Frontend production topology assumed from config: DO App Platform standalone Next build behind nginx, with the Emergent preview pod as a secondary environment.
