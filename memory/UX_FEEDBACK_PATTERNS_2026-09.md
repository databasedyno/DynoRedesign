# UX recommendations — action feedback toast, overflow tabs, single-question forms
_Reference: Brevo web app screenshots supplied by the owner (2026-09-30)._

## STATUS (updated 2026-10-01 — pod c2bbc664)
- **Batch A — Toast with countdown bar: ✅ DONE** (component `Components/UI/Toast/index.tsx` was already rewritten earlier with countdown/pause/dismiss/stack/a11y). **Snackbar→toast migration: ✅ DONE this session** — all 15 raw MUI `<Snackbar>` sites migrated to the single global toast (`useToast()` hook / `dispatch(TOAST_SHOW)`):
  OverPayment, UnderPayment, TransferExpectedCard, DisplayCurrencySelector, CompanySelector (brand-switch → top-center info toast), SafeDeal DealPage, SafeDeal Home, ProductEditor (setToast shim → showToast), ActiveSessions (shim), ShopHero, Customers (notify → showToast), CampaignShareTray, pay-links/products/[productId]/orders, pay/index, pay/demo.
  ToastHost was **added** to `Components/SafeDeal/SafeDealShell.tsx` and `Containers/Home/index.tsx` so toasts render on SafeDeal + marketing/shop pages (which previously had no host). Gates: `tsc --noEmit` 0 errors, ESLint 0. `grep -rn "Snackbar" Components pages` → only a code comment remains.
- **Batch B — OverflowTabs rollout: ✅ DONE this session** for the 4 remaining strips: `pages/invoices.tsx` (receipts/tax/collected), `Components/Page/Admin/Transactions` (customer/platform, testid prefix `tx-tab`), `Components/Page/Admin/Escrow` (disputes/all/withdrawals/safedeal, prefix `escrow-admin-tab`; removed now-unused `./tabSx` import), `Components/UI/pay-link/CampaignManager` (tiers/updates/supporters, prefix `cm-tab`). All preserve historical testids via `itemTestIdPrefix`. Gates tsc 0 / ESLint 0.
  - **SafeDeal wallet (`Components/SafeDeal/Home/SafeDealHome.tsx` `TabBar`) INTENTIONALLY KEPT** as its custom gold-branded pill bar — converting to the generic OverflowTabs would strip SafeDeal brand colours (violates REBRAND_TASKS "do not touch SafeDeal colours") and it only has 4 tabs that already scroll. Leave as-is unless the owner asks for the collapse behaviour there.
- **Batch C — Single-question form screens: ⏳ STILL PENDING.** Component `Components/UI/SingleQuestionForm/index.tsx` exists and is used in `Components/Page/GetStarted/StepAboutYou.tsx` + `pages/auth/register.tsx`. NOT yet adopted in: KYC (`pages/kyc/*`), SafeDeal `NewDeal.tsx` step 0, storefront first-run, tax settings first-run. These are real form refactors (not mechanical) on a LIVE app — scope each carefully before converting.
- **NOT yet run:** frontend testing_agent for the migrated toasts + tab strips (awaiting user go). The frontend was rebuilt (`.next-prod`) + `supervisorctl restart frontend` so the changes are live in preview.

_Original recommendation detail kept below for reference._


## What the owner liked in the reference
1. **Bottom action toast with a countdown bar** — full-width green banner docked to the bottom of the viewport; a thin green progress bar across its top edge shrinks from 100 % → 0 % and the toast disappears when it empties. Check icon + message + explicit X.
2. **"5 more tabs…" overflow tab** — when tabs don't fit, the visible ones stay and the rest collapse into one pill ("5 more tabs…") that opens a dropdown with a **search box** on top and the hidden tabs listed below.
3. **One-question form screens** — big centered question ("What is your organization address?"), one-line why-we-ask helper, labels ABOVE fields with red `*`, related short fields side-by-side (Postal code | City), country/state as selects, active field gets a 2 px accent ring.

---

## A. Action-feedback toast with visible countdown (P1 — highest usability win)

### Today
- `Components/UI/Toast/index.tsx` (Redux `TOAST_SHOW` / `TOAST_HIDE`, 222 dispatch sites) — fixed card bottom-right (desktop) / bottom-right 16 px (phone), auto-hides after a hard-coded 4 s with **no visual countdown**, close button is commented out, no pause-on-hover, no stacking (a second toast replaces the first), no `role="status"` / `aria-live`.
- 15 files still use raw MUI `<Snackbar>` (CampaignShareTray, ActiveSessions, Customers, ProductEditor, ShopHero, OverPayment, UnderPayment, CompanySelector, DisplayCurrencySelector, TransferExpectedCard, SafeDealHome, DealPage, orders page, pay/index, pay/demo) → two different toast looks in one app.

### Recommendation (keep the Redux API, change only the component)
1. **Countdown bar** — add a 3 px bar pinned to the toast's top edge, colour = severity colour (`theme.palette.border.success` / `.error` / amber / gold for loading). Width animates `100% → 0%` over the duration with a CSS keyframe (`@keyframes toastCountdown { from {transform: scaleX(1)} to {transform: scaleX(0)} }`, `transform-origin: left`, `animation-duration: var(--toast-ms)`). Drive auto-hide from the SAME duration so the visual and the timer can never drift. `prefers-reduced-motion` → hide the bar and keep the timer.
2. **Duration by severity** — success 4 s, warning 6 s, error 8 s (errors must be readable), `loading` = no timer, no bar. Allow `payload.durationMs` override.
3. **Pause on hover / focus** — `animation-play-state: paused` + clear/restart the timer on `mouseenter`/`focusin`; resume on leave. This is what makes the shrinking bar feel trustworthy.
4. **Explicit dismiss** — restore the X `IconButton` (44 px hit-area on touch, `data-testid="app-toast-close"`). Swipe-down to dismiss on phone (pointer events, 40 px threshold).
5. **Placement** — phone: docked bottom, full width (`left:0; right:0; bottom: env(safe-area-inset-bottom)`), square bottom corners, rounded 16 px top corners (like the reference). Desktop: keep bottom-right card 380 px max. Respect the sticky-CTA footprint: when `<html data-dp-sticky-cta>` is set (see `hooks/useStickyCtaFootprint.ts`) lift the toast above the sticky bar (`bottom: var(--dp-sticky-cta-h, 0)`), otherwise it hides the primary button on checkout / SafeDeal deal pages.
6. **Optional action slot** — `payload.action?: {label, onClick}` → renders a text button ("Undo", "View", "Open deal") to the left of X. Use it for: payment link created → "Open", payout address deleted → "Undo" (10 s), settings saved → none.
7. **Stack, don't replace** — reducer keeps a queue (max 3, newest at the bottom, older ones shift up 8 px + fade). Identical message within 1 s is de-duplicated (many sagas dispatch twice).
8. **A11y** — root `role="status"` + `aria-live="polite"` for success/loading, `role="alert"` + `aria-live="assertive"` for error; message text is the only live region content (no icon alt noise).
9. **Migrate the 15 `<Snackbar>` sites** to `dispatch({type: TOAST_SHOW, …})` so there is one feedback surface (check `Components/UI/OverPayment/UnderPayment` first — they are on the public checkout and most visible).

### Files
- `Components/UI/Toast/index.tsx` (rewrite, <200 lines) · `Redux/Reducers/toastReducer.ts` (queue + durationMs + action) · `Redux/Actions/ToastAction.ts` (types) · `utils/types` (`IToastProps` add `durationMs`, `action`, `id`).
- New hook `hooks/useToast.ts` = `showToast({message, severity, durationMs, action})` thin wrapper so new code stops importing Redux constants.

### Test IDs
`app-toast` (exists), `app-toast-countdown`, `app-toast-close`, `app-toast-action`, `data-severity`, `data-paused="1"` while hovered.

### Acceptance
- Bar visibly shrinks left→right and the toast unmounts exactly when it hits 0 (±100 ms).
- Hovering stops the bar; leaving resumes from where it stopped.
- Error toast stays ≥ 8 s; loading toast has no bar and never auto-hides.
- On a 390 px phone the toast is full-width at the bottom and never covers a sticky CTA (`/pay?…` awaiting state, `/deal/:token`).
- Screen reader announces the message once.

---

## B. "N more tabs…" overflow tab with search (P1)

### Today
- `pages/settings/index.tsx` phone layout: the rail becomes a horizontally-scrolling chip row (`settings-rail`, edge fade via `useEdgeFade`) with 9 sections → users don't discover the off-screen ones (Tax, Team, Notifications, Language).
- `pages/developer-keys.tsx` (`developers-tab-*`), `pages/storefront/index.tsx` (segmented tabs), `Components/Page/Admin/Transactions/index.tsx`, `pages/safedeal/wallet.tsx`, `pages/invoices.tsx`, `Components/UI/pay-link/CampaignManager.tsx` each roll their own tab strip. No shared component.

### Recommendation — one shared `Components/UI/OverflowTabs/`
1. **API**: `<OverflowTabs items={[{id,label,icon?,badge?,dirty?}]} value onChange minVisible={1} searchThreshold={5} />`. Renders MUI-free custom pills styled like the settings rail (`railItemSx`) so it works in both themes.
2. **Measurement**: `ResizeObserver` on the strip; measure each label once in a hidden ghost row; fit as many tabs as the width allows (always keep the ACTIVE tab visible — if it would overflow, swap it with the last visible one); the rest go into the overflow pill labelled `t("tabs.moreCount", {count})` → "5 more tabs…". Pill gets the active style when the active tab is inside it and shows the active tab's label instead ("Invoices ▾") so the user always sees where they are.
3. **Dropdown**: MUI `Popover`/`Menu` anchored to the pill, width = min(320, viewport − 32). Search `TextField` at the top only when hidden count ≥ `searchThreshold` (the reference shows it at 5); filters by label, `autoFocus` on desktop only (avoid the phone keyboard jumping). Empty state "No tab matches". Arrow-key navigation + Enter select; Esc closes.
4. **Dirty / unsaved dots** carry into the dropdown rows (settings already computes `dirtyMap`).
5. **Phone-first fallback**: below 480 px, when more than 3 tabs, prefer `1 visible + "N more"` rather than a scrolling chip row — matches the reference and removes the swipe-discovery problem.
6. **Deep links unchanged**: keep `?section=` / `?tab=` query params exactly as today.

### Roll-out order
1. `pages/settings/index.tsx` phone rail (biggest problem, 9 sections).
2. `pages/developer-keys.tsx`, `pages/storefront/index.tsx`.
3. Admin transactions / escrow, SafeDeal wallet, invoices, CampaignManager.

### Test IDs
`overflow-tabs`, `overflow-tab-<id>`, `overflow-tabs-more` (pill, `data-count`), `overflow-tabs-menu`, `overflow-tabs-search`, `overflow-tabs-item-<id>`, `overflow-tabs-empty`.

### Acceptance
- At 390 px `/settings` shows ≤ 2 pills + "N more tabs…"; opening it lists every remaining section; searching "tax" leaves one row; selecting navigates and updates `?section=`.
- At 1440 px all tabs are visible and the pill is absent.
- Resizing the window live re-flows without flicker (measure in `useLayoutEffect`).
- Active tab is never hidden inside the pill without the pill showing its label.

---

## C. Single-question form screens (P2 — apply to wizards, not to dense settings)

### Where it fits
`Components/Page/GetStarted/*` wizard, `pages/auth/register.tsx`, KYC (`pages/kyc/*`), SafeDeal `NewDeal.tsx` step 0, storefront first-run, tax settings first-run.

### Rules (from the reference)
1. One question per screen as the H1 (`--font-hero`, 26–32 px), centered on phone, left-aligned on desktop; one-sentence helper explaining WHY ("Every email you send will include your organization address. It's an anti-spam rule…"). Reuse `Components/UI/AuthLayout/TitleDescription`.
2. Labels above inputs, 600 weight, red `*` for required (`aria-required`), never placeholder-as-label.
3. Group short related fields in a 2-column row (Postal code | City, First | Last, Expiry | CVC) — `grid-template-columns: minmax(0,1fr) minmax(0,1fr)`, collapse to 1 column below 360 px.
4. Country → State are dependent selects: state list loads after country, is disabled (not hidden) until then, and pre-selects from the geo default.
5. Focus ring: 2 px accent (`#FFD100` gold on ink / `#8B5E00` on light) with 2 px offset — see `Containers/Login/styled.tsx` auth focus ring, extract to a shared `sx` in `Components/UI/_shared`.
6. Inline validation on blur, success state doesn't shout (no green borders), error text under the field with the icon; never a toast for field errors.
7. Sticky footer with ONE primary button ("Continue") + text "Back"; disabled until required fields are valid; Enter submits.
8. Address autocomplete is out of scope; keep plain fields.

### Test IDs
`form-question-title`, `form-question-help`, `field-<name>`, `field-<name>-error`, `form-continue`, `form-back`.

---

## D. Small related polish (do with A)
- Success toasts on `settings` save should name the section: "Payments settings saved" not "Saved".
- Replace the commented `handleClose` with the real X; the current toast has NO way to dismiss for 4 s and covers the phone nav's "More" button.
- `Components/UI/InfoBanner` and `CustomAlert` are inline banners — keep them inline; the toast is for transient results only (rule: banner = state, toast = event).

## i18n
Add to all 6 locales (`langs/locales/*/common.json`): `tabs.moreCount` ("{{count}} more tabs…"), `tabs.searchPlaceholder`, `tabs.noMatch`, `toast.dismiss`, `toast.undo`.

## Effort
A ≈ 0.5 day (+0.5 day Snackbar migration) · B ≈ 1 day (component + settings) + 0.5 day roll-out · C ≈ per-wizard, 0.5 day each. Frontend runs a PRODUCTION Next build on the pod — after edits: `cd /app && NEXT_DIST_DIR=.next-prod-new node_modules/.bin/next build` then swap dirs + `supervisorctl restart frontend`.
