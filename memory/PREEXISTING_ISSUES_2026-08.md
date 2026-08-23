# DynoPay — Pre-existing Issues Audit (2026-08-23)

Snapshot of issues that existed BEFORE this session's work (creator-page fix + perf).
Data: `tsc --noEmit` (0 errors), ESLint with `next/core-web-vitals` on frontend app dirs
(16 errors / 94 warnings / 63 files), prod DO logs, and code review.

Legend: P0 correctness/bug · P1 perf/security · P2 quality · P3 ops/config


## ✅ UPDATE 2026-08-23b (follow-up session)
- **P2 `@next/next/no-img-element` (9 warnings) — RESOLVED.** Previous session only
  silenced 6 of them and left one comment MISPLACED in `ProductEditor` (sat before the
  `<Box>`, not the `<img>`), so 9 warnings actually remained. All 9 now have correctly-placed
  `eslint-disable-next-line` comments (QRCodeComponent, CryptoComponent, PaymentLinkSuccessModal,
  ProductEditor cover, CompanyDetailsSection ×3 flag icons, ProductImage fallback) or, for
  NoData (static local illustration), a disable + removal of the unused `next/image` import.
  These are all legit `<img>` uses (data-URL QR codes, remote flagcdn icons, arbitrary
  user-upload URLs) where next/image adds no value / would break. Verified: `yarn next lint`
  → `no-img-element` count = 0, **zero ESLint errors**; all 11 key routes 200; clean compile.
- **P0 #2 `jsonwebtoken` on client — already RESOLVED in prior session** (working tree):
  `hooks/useTokenData.ts` now uses `@/utils/decodeJwt` (dependency-free base64url decode),
  no `jsonwebtoken` import. `buffer` still needed transitively by `axios` (toFormData) — keep it.
- **GOTCHA (stale `.next/cache`):** After a mid-install compile (before `buffer` was added /
  before the JWT refactor), the dev server cached `ENOENT buffer/index.js` + a `jsonwebtoken→
  useTokenData` import trace. These recur on restart because Next reuses `.next/cache`. Fix =
  `rm -rf .next/cache && sudo supervisorctl restart frontend`. NOT a real bug (file exists, reads fine).

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

---
## STATUS (2026-08-23, updated) — "fix all" pass
FIXED & verified:
- P0 #1 hooks (CheckoutStatusStrip) — early return moved below hooks. tsc/lint clean.
- P0 #2 client jwt — useTokenData now dependency-free base64 decode; `buffer` made an
  explicit dep (4 other files still use client jsonwebtoken — see DEFERRED).
- P0 #3 bot-protection internal-IP allowlist — VERIFIED by backend testing agent
  (legit auth traffic 2xx, scanner paths 403, health ok).
- P0 #4 SSR error logging — added to all 5 public pages.
- P0 #5 SSR loopback fetch — done earlier this session.
- P2 #9 eslint config added (`.eslintrc.json` next/core-web-vitals) → `yarn lint` works.
- P2 #10 build lint gate ON (next.config ignoreDuringBuilds:false + dirs); 0 errors.
- P2 #12 all 14 no-unescaped-entities fixed (typographic quotes).
- P1 #6 edge cache on creator/shop/product (done earlier).
- P1 #7 partial: recharts lazy (creator), canvas-confetti lazy (Transactions/AutoClaim),
  removed UNUSED deps telegram + flutterwave-react-v3.
- Bonus: helpers/shortcutUsage.ts anonymous default export named.

DEFERRED (documented — risk/value or authed non-hot-path):
- P1 #7 country-state-city split: needs careful refactor across 6+ CreateCompanyModal
  import sites + settings/company sections (KYC/company flows) — real regression risk.
- react-credit-cards-2 lazy-load: active card-entry form; low value, focus/layout risk.
- Other client-side jsonwebtoken usages (admin/profile, pay/index, adminAuth, Menus):
  work correctly with explicit `buffer`; refactor to shared decode util is a nicety.
- P1 #8 9× no-img-element (WARNINGS): per-component next/image sizing needed.
- 85× react-hooks/exhaustive-deps (WARNINGS): mass-fix is a known regression footgun;
  fix per-hook with intent. Non-blocking (build passes).
- P3 #13/#14 prod DO env typos/dupes + set INTERNAL_API_URL: user to update in DO panel.

