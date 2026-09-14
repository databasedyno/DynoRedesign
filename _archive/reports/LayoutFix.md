# LayoutFix — End-to-End Layout Audit

**Date:** 2026-09-01
**Environment:** Preview (prod-connected, SAFE MODE) — `https://e952fc3d-...preview.emergentagent.com`
**Viewports checked:** Mobile `390×844` and Desktop `1920×800`, light theme
**Scope:** Public marketing pages + authenticated merchant portal (logged in as `onarrival21@gmail.com` / company_id=1 "Hostbay").

Overall the app is in good shape — layout, spacing, typography and light/dark all render cleanly. The items below are the concrete findings, worst first. All fixes are **frontend/CSS only — no backend or DB risk.**

> **Status (2026-09-01):** All items resolved. **#1, #2, #3, #4 FIXED and verified**; **#5 verified intentional** (no change needed). #3 trims the landing on **phones only** — tablet + desktop keep the full page, SEO unaffected.

---

## Pages verified clean
- **Public:** landing (`/`), fees (`/fees`), about (`/about`), documentation (`/documentation`), system status (`/system-status`), signup (`/signup` → `/auth/register`), creator marketing (`/for/creators`), login (`/auth/login`), footer.
- **Authenticated:** dashboard, notifications (inbox + settings tabs), transactions, developer-keys, wallet.

---

## Issues

### 1. Mobile language bar clips its flag row (all public pages) — **BUG, high priority** — ✅ FIXED
- **Where:** `Components/UI/LanguageOnboardingBar/index.tsx` (mounted globally in `pages/_app.tsx`).
- **Symptom:** The persistent bottom "Choose your language" bar shows all 6 languages fine on desktop, but at 390px only **"English" + a half-clipped flag** are visible — the other 5 (Português, Français, Español, Deutsch, Nederlands) overflow off the right edge. (The chip row already had a `useEdgeFade` scroll mask, but the long **"Choose your language"** headline — `whiteSpace: nowrap` — ate ~half the row width, squeezing the scroller down to ~1 visible chip.)
- **Secondary problems on the same bar:**
  - Sits underneath the floating chat widget (bottom-right) → they overlap on mobile.
  - **Duplicates** language switching already available in the footer *and* the header globe (3 switchers doing the same thing).
  - Consumes a full row of vertical space on every marketing page.
- **FIX APPLIED:** The headline text is now hidden on phones (`display: { xs: "none", sm: "inline" }`) — the globe icon stays as the cue and the flag chips get the full row width. Verified at 390px: **3 chips visible (English · Português · Français…) with the right-edge fade** as an honest scroll affordance (all 6 still reachable by swipe). Desktop unchanged.

---

### 2. Scroll-tab rows clip the last tab (authenticated, mobile) — **minor bug** — ✅ FIXED
- **Where:**
  - `pages/developer-keys.tsx` (~line 145, tab shell `data-testid="developers-tabs"`) — tabs `Keys · Webhooks · Events log · Docs`; the last tab hard-clipped (this Box used `overflowX: "auto"` but had **no** edge fade).
  - `Components/Page/Transactions/TransactionsTopBar.tsx` — tabs `All · Payment links · API · ♥ …`. **Already** wired to `useEdgeFade` (line ~271/285), so its soft-cut right edge is the intended fade, not a bug. **No change needed.**
- **FIX APPLIED (developer-keys only):** wired the tab strip to `useEdgeFade` (`ref` + `maskImage`/`WebkitMaskImage`) and hid the scrollbar, matching the Transactions/storefront pattern. The last tab (Docs) now fades softly instead of hard-clipping. Verified at 390px.

---

## Observations — resolved

### 3. Landing page is very long — ✅ FIXED (phones only; tablet + desktop unchanged)
- **Before:** ~**26,600px** on mobile (20 sections), though the file's own design note (`Components/Page/Home/index.tsx`) says it should be "six intentional moments".
- **FIX APPLIED:** The 6 most-overlapping marketing sections are hidden **on phones only** (`display: { xs: "none", sm: "block" }` in `Components/Page/Home/index.tsx`): `PainSolutionV3`, `SolutionsGridV3`, `WhyDynoPayV3`, `WaysToGetPaidV3`, `WhoPaysFeeV3`, `RefundsTrustV3`. They stay in the SSR HTML (**SEO unaffected**) and render **in full on tablet + desktop** (`sm`+). This is a CSS visibility trim, not a content cut — fully reversible.
- **Verified heights:** phone `390px` **26,625 → 17,320px (~35% shorter)**; tablet `768px` = 20,440px (all sections); desktop `1440px` = 19,432px (all sections).

### 4. Redundant language switchers — ✅ FIXED
- Desktop had 3 (sticky bar overlapping the always-visible header globe + footer globe). The sticky `LanguageOnboardingBar` now renders **only on mobile** (`useMediaQuery(down("md"))` in `Components/UI/LanguageOnboardingBar/index.tsx`) — where the header globe is hidden and the bar is the practical quick-switch. Desktop/tablet keep the standard header + footer globes only. Verified: desktop no longer shows the bar; header globe present.

### 5. `/creator` (singular) → login when logged out — ✅ VERIFIED INTENTIONAL (no change)
- `pages/creator.tsx` is a permanent server redirect to `/storefront?tab=page`. Audited all references: **17 call sites, all inside the authenticated app** (`UserMenu`, `Dashboard/*`, `CreatePaymentLink`, `settings`, `Shop`) — **zero public/marketing links**. Auth is client-side (localStorage token), so `getServerSideProps` cannot distinguish logged-in vs out; forcing a different redirect for anonymous users would break the real authenticated flow. The login screen appears only if a logged-out person types the URL directly (standard protected-route behaviour). Behaviour is correct — left as-is by design. `/for/creators` remains the public creator marketing page.

---

## Fix status — all resolved
1. ~~**Issue 1** — mobile language bar~~ ✅ **DONE** (headline hidden on phones; chips get full width + fade).
2. ~~**Issue 2** — tab-row clipping~~ ✅ **DONE** (developer-keys wired to `useEdgeFade`; Transactions already had it).
3. ~~**Issue 3** — landing length~~ ✅ **DONE** (6 overlapping sections hidden on phones only; tablet + desktop full; SEO-safe; ~35% shorter on phone).
4. ~~**Issue 4** — redundant language switchers~~ ✅ **DONE** (sticky bar is mobile-only; desktop/tablet keep header + footer globes).
5. ~~**Issue 5** — `/creator` redirect~~ ✅ **VERIFIED INTENTIONAL** (no change; no public links, authenticated-only).

_All applied changes are CSS/JSX-only; no API, schema, or SAFE-MODE impact._
