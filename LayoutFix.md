# LayoutFix — End-to-End Layout Audit

**Date:** 2026-09-01
**Environment:** Preview (prod-connected, SAFE MODE) — `https://e952fc3d-...preview.emergentagent.com`
**Viewports checked:** Mobile `390×844` and Desktop `1920×800`, light theme
**Scope:** Public marketing pages + authenticated merchant portal (logged in as `onarrival21@gmail.com` / company_id=1 "Hostbay").

Overall the app is in good shape — layout, spacing, typography and light/dark all render cleanly. The items below are the concrete findings, worst first. All fixes are **frontend/CSS only — no backend or DB risk.**

> **Status (2026-09-01):** Issues **#1 and #2 are FIXED and verified** on mobile. #3 and #4 are product decisions left as-is (see notes). #5 confirmed intentional (not a bug).

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

## Observations (decision needed — not defects)

### 3. Landing page is very long
- **Measured height:** ~**26,600px** on mobile, ~**19,500px** on desktop.
- Not a layout bug, but a heavy scroll. Consider trimming/merging sections or lazy-loading lower sections for perceived speed.

### 4. Redundant language switchers
- The sticky bottom `LanguageOnboardingBar`, the footer language selector, and the header globe all switch language. Consolidating (see Issue 1 fix c) removes the redundancy.

### 5. `/creator` (singular) → login when logged out — **NOT a bug (intentional)**
- `pages/creator.tsx` is a permanent server redirect to `/storefront?tab=page` (storefront "Page" tab). It showed the login screen in the audit only because it was hit while unauthenticated, and `/storefront` requires auth. Behaviour is correct; documented here so it isn't re-flagged. `/for/creators` remains the public creator marketing page.

---

## Suggested fix order
1. ~~**Issue 1** — mobile language bar~~ ✅ **DONE** (headline hidden on phones; chips get full width + fade).
2. ~~**Issue 2** — tab-row clipping~~ ✅ **DONE** (developer-keys wired to `useEdgeFade`; Transactions already had it).
3. **Issue 3** — landing length: **left as-is** (deliberate marketing page; trimming/lazy-loading is a product call — say the word and I'll do it).
4. **Issue 4** — redundant language switchers: the Issue-1 fix reduces the mobile squeeze; fully removing the footer selector or header globe is a product decision, **left as-is**.

_All applied changes are CSS/JSX-only; no API, schema, or SAFE-MODE impact._
