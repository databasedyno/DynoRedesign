# LayoutFix — End-to-End Layout Audit

**Date:** 2026-09-01
**Environment:** Preview (prod-connected, SAFE MODE) — `https://e952fc3d-...preview.emergentagent.com`
**Viewports checked:** Mobile `390×844` and Desktop `1920×800`, light theme
**Scope:** Public marketing pages + authenticated merchant portal (logged in as `onarrival21@gmail.com` / company_id=1 "Hostbay").

Overall the app is in good shape — layout, spacing, typography and light/dark all render cleanly. The items below are the concrete findings, worst first. All fixes are **frontend/CSS only — no backend or DB risk.**

---

## Pages verified clean
- **Public:** landing (`/`), fees (`/fees`), about (`/about`), documentation (`/documentation`), system status (`/system-status`), signup (`/signup` → `/auth/register`), creator marketing (`/for/creators`), login (`/auth/login`), footer.
- **Authenticated:** dashboard, notifications (inbox + settings tabs), transactions, developer-keys, wallet.

---

## Issues

### 1. Mobile language bar clips its flag row (all public pages) — **BUG, high priority**
- **Where:** `Components/UI/LanguageOnboardingBar/index.tsx` (mounted globally in `pages/_app.tsx`).
- **Symptom:** The persistent bottom "Choose your language" bar shows all 6 languages fine on desktop, but at 390px only **"English" + a half-clipped flag** are visible — the other 5 (Português, Français, Español, Deutsch, Nederlands) overflow off the right edge with **no scroll affordance**. The user has no way to know more options exist.
- **Secondary problems on the same bar:**
  - Sits underneath the floating chat widget (bottom-right) → they overlap on mobile.
  - **Duplicates** language switching already available in the footer *and* the header globe (3 switchers doing the same thing).
  - Consumes a full row of vertical space on every marketing page.
- **Evidence:** landing/fees/about/docs/status/signup mobile screenshots — bar reads `Choose your language | English | [flag cut] | ✕`.
- **Suggested fix (pick one):**
  - a) Make the flag row horizontally scrollable with a right-edge fade/gradient so it's discoverable; keep the chat widget clear of it. **(minimal)**
  - b) Collapse the bar into a single compact dropdown/pill on mobile (`< md`) instead of listing every flag inline.
  - c) Suppress the sticky bar on mobile entirely (header globe + footer already cover it) and only show it `>= md`.

---

### 2. Scroll-tab rows clip the last tab (authenticated, mobile) — **minor bug**
- **Where:**
  - `Components/Page/Transactions/TransactionsTopBar.tsx` — tabs `All · Payment links · API · ♥ (favorites)`; the ♥ tab is sliced in half at the right edge.
  - `pages/developer-keys.tsx` (~line 156, tab shell `overflowX: "auto"`, `data-testid="developers-tabs"`) — tabs `Keys · Webhooks · Events log · Docs`; the last tab is sliced.
- **Symptom:** Rows are horizontally scrollable, but with a hard-clipped icon and **no fade/chevron** they look broken rather than scrollable.
- **Suggested fix:** Add a right-edge fade mask (or a subtle chevron/`…`) on these `overflow-x:auto` tab strips at `< md`, and ensure trailing padding so the last pill isn't cut mid-glyph. Same pattern applies to any other horizontal pill-tab strip (e.g. CreatePaymentLink).

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
1. **Issue 1** — mobile language bar (most visible; affects every public/marketing visitor).
2. **Issue 2** — tab-row clipping (quick CSS fade fix, applies to 2–3 components).
3. **Issue 3** — landing length (optional, larger effort / product decision).

_All changes above are CSS/JSX-only; no API, schema, or SAFE-MODE impact._
