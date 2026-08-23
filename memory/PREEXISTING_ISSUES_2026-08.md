# DynoPay — Pre-existing Issues Audit (2026-08-23)

Snapshot of issues that existed BEFORE this session's work (creator-page fix + perf).
Data: `tsc --noEmit` (0 errors), ESLint with `next/core-web-vitals` on frontend app dirs
(16 errors / 94 warnings / 63 files), prod DO logs, and code review.

Legend: P0 correctness/bug · P1 perf/security · P2 quality · P3 ops/config

---

## P0 — Correctness / latent bugs
1. **Conditional React hooks** — `Components/UI/CheckoutStatusStrip.tsx:158-159`
   (`react-hooks/rules-of-hooks`, 2 ERRORS). Hooks called after a conditional →
   can crash / corrupt hook order on the CHECKOUT status UI. Fix: move hooks above
   any early return / condition.
2. **Client-side `jsonwebtoken`** — `hooks/useTokenData.ts:3,7` imports the full Node
   `jsonwebtoken` lib just to `jwt.decode()` a token in the browser. It needs a
   `Buffer` polyfill that was only present transitively (via `telegram`); pruning
   `telegram` this session broke the build until `buffer` was added explicitly.
   Proper fix: use `jwt-decode` (tiny) or manual base64 decode; drop `jsonwebtoken`
   (and then `buffer`) from the client bundle.
3. **Bot-protection self-DoS risk** — `backend/middleware/botProtection.ts`.
   In-memory, PER-INSTANCE IP map (inconsistent across DO instances, wiped every
   deploy); a `.php` scanner auto-blocks an IP for 1h and, because the block also
   catches internal/edge-egress IPs, it silently `403`s legit traffic. This is what
   made `dynopay.me/hostbay` "unavailable" (SSR self-fetch 403'd). Also returns a
   bodyless `403` (hard to diagnose). Fix: never block internal/private ranges,
   scope tracking to the true client IP only, consider Redis-backed shared state.
4. **Silent SSR error swallowing** — every public `getServerSideProps`
   (`[handle]`, `[handle]/shop`, `[handle]/p/[slug]`, `pay`, `order`) does
   `catch { return { notFound:true } }` with NO logging. Real failures (like #3)
   are invisible in logs. Fix: `console.error` the status/exception before notFound.
5. **SSR fetched the PUBLIC url from inside the container** (all 5 pages) — FIXED
   this session (now uses internal loopback `INTERNAL_BACKEND_URL`).

## P1 — Performance / data-efficiency  (see PERF_ANALYSIS_2026-08.md)
6. **No CDN cache headers on public pages** — FIXED this session for creator/shop/
   product. `pay` (query-keyed) and `order` (live status) left uncached by design.
7. **Heavy client libs not code-split**: `country-state-city` (large dataset,
   authed settings/company/onboarding — 6+ import sites), `canvas-confetti`,
   `flutterwave-react-v3`, `react-credit-cards-2` (checkout/register). `recharts`
   on the creator page — FIXED (lazy-loaded). `telegram` unused — REMOVED.
8. **9 raw `<img>` instead of `next/image`** (`@next/next/no-img-element`):
   CryptoComponent.tsx:360, QRCodeComponent.tsx:218, ProductEditor:656,
   CompanyDetailsSection:437/877/985, PaymentLinkSuccessModal:306, NoData:29,
   ProductImage:46 (fallback — intentional). Unoptimized image bytes.

## P2 — Code quality / tooling
9. **No ESLint config committed** — `yarn lint` runs `eslint .` but there is NO
   `.eslintrc*` / flat config, so the eslint step ERRORS ("couldn't find a
   configuration file"). Add `.eslintrc.json` `{ "extends": "next/core-web-vitals" }`.
10. **`eslint.ignoreDuringBuilds: true`** in next.config → lint never gates the
    build, so quality drifts silently. (Related to #9.)
11. **~94 ESLint warnings**: 84× `react-hooks/exhaustive-deps` (stale-closure risk),
    plus `react/no-unstable-nested-components` (e.g. `CreatorProfile.tsx:244`
    `LinkCard` defined in render → remounts subtree each render).
12. **14× `react/no-unescaped-entities`** (ERRORS): ApiKeysPage:899/937,
    InvoicePreviewDrawer:264, ProductEditor:1015, etc. Cosmetic but flagged as errors.

## P3 — Ops / config hygiene
13. **Production env has typos/dupes** (from the pasted prod env): `EXT_PUBLIC_ENABLE_GITHUB_AUTH`
    (typo, should be `NEXT_PUBLIC_…`), duplicated `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` /
    `…GITHUB_AUTH` / `NEXT_PUBLIC_GITHUB_CLIENT_ID`, and `NEXTAUTH_SECRET` shipped as
    the literal placeholder `"openssl rand -base64 32"` at least once. Clean these in
    the DO app env.
14. **`INTERNAL_API_URL` unset in prod** — the whole class of SSR self-fetch bugs
    stems from prod having only `INTERNAL_BACKEND_URL`. Code now falls back to it, but
    setting `INTERNAL_API_URL=http://localhost:8001` in DO env is a belt-and-braces.

## Suggested fix order
P0 #1 (hooks crash) → P0 #3/#4 (bot-block + SSR logging, prevents silent prod 404s) →
P0 #2 (client jwt) → P2 #9 (restore lint) → P1 #7/#8 (bundle/img) → P3 cleanups.
