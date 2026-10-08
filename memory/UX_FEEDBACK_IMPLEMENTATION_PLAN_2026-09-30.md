# UX Feedback Implementation Plan — end to end
_Source: `memory/UX_FEEDBACK_PATTERNS_2026-09.md` (Brevo reference, owner 2026-09-30)._
_Pod: https://secure-vault-app-58.preview.emergentagent.com — SAFE MODE, LIVE prod DB, Next.js PRODUCTION build._
_Status legend: ✅ done & self-verified · 🟡 partial · ⛔ not started._

## Environment / build workflow (important)
- Frontend runs a **production Next build** on the pod (dev mode 502s on Cloudflare cold-compile).
  During active dev I flip `FRONTEND_MODE=dev` in `/app/.env.local` for hot reload, then flip back to
  `production` and rebuild before testing.
- Rebuild recipe: `cd /app && NEXT_DIST_DIR=.next-prod-new node_modules/.bin/next build` (bg, ~2–3 min)
  → `mv .next-prod .next-prod-old && mv .next-prod-new .next-prod` → `sudo supervisorctl restart frontend`.
- Backend = Python launcher → Node (ts-node) on :3300, proxied at :8001. Mongo local.
- Auth for manual/agent testing: merchant `onarrival21@gmail.com` / `Katiekendra123@`
  (2FA TOTP: `node /app/backend/scripts/print_totp.cjs 1`). Admin `moxxcompany@gmail.com` / same pw.

---

## BATCH A — Action-feedback toast with visible countdown  (P1)  ✅ DONE
**Goal:** replace the silent 4s toast with a trustworthy countdown toast: shrinking bar, pause-on-hover,
explicit dismiss, optional action, stacking, a11y — keeping the existing Redux `TOAST_SHOW` API.

**Design decision:** `Toast` stays a *presentational controlled* component (still used by 7 local-state
callers). A new Redux-connected `ToastHost` renders the queue/stack and is mounted once per layout.
Countdown/auto-hide are gated on `onClose` so legacy controlled callers don't show a false bar.

**Files changed:**
- `Components/UI/Toast/index.tsx` — rewrite (rAF countdown synced to auto-hide, pause on hover/focus,
  X button, action slot, swipe-down dismiss on phone, `role=status|alert`+`aria-live`,
  phone full-width + lift above `--dp-sticky-cta`, `hostMode`).
- `Components/UI/Toast/ToastHost.tsx` — new; reads `state.toastReducer.queue`, renders the stack
  (newest at bottom, older fade), splits bottom vs top-center, dispatches `TOAST_HIDE_ONE`.
- `hooks/useToast.ts` — new; `showToast({message, severity, durationMs, action, loading, placement})`,
  `hideToast(id?)`.
- `Redux/Reducers/toastReducer.ts` — queue (max 3), 1s dedupe, loading→result replace.
- `Redux/Actions/ToastAction.ts` — `+TOAST_HIDE_ONE`.  `Redux/Sagas/ToastSaga.ts` — `IToastItem` type.
- `utils/types.ts` — `IToastAction`, `IToastItem`, `toastReducer.queue`, extended `IToastProps`.
- `Containers/{Admin,Client,Login,Payment}/index.tsx` — render `<ToastHost/>` instead of single `<Toast/>`.

**Durations:** success 4s · info 5s · warning 6s · error 8s · loading = none. `payload.durationMs` overrides.
**Test IDs:** `app-toast`, `app-toast-countdown`, `app-toast-close`, `app-toast-action`, `data-severity`, `data-paused`.
**Acceptance:** bar shrinks L→R and unmounts at 0; hover pauses (`data-paused=1`) and resumes; error ≥8s;
loading has no bar/never auto-hides; phone = full-width bottom above sticky CTA; SR announces once.

---

## BATCH B — "N more tabs…" overflow tab with search  (P1)  ✅ DONE (component device-adaptive + roll-out)
**Goal:** one shared tab strip that collapses overflow into a searchable "N more tabs…" pill; active tab
always visible; phone-first fallback.

**Files changed:**
- `Components/UI/OverflowTabs/index.tsx` — new. API `items[{id,label,icon?,badge?,dirty?}] value onChange
  minVisible=1 searchThreshold=5 ariaLabel`. ResizeObserver + hidden ghost-row measurement; active always
  kept on strip; overflow pill; MUI `Popover` dropdown w/ search (shown when hidden≥threshold), keyboard
  nav (↑/↓/Enter/Esc), dirty dots, empty state; `<480px & >3 tabs` ⇒ 1 visible + pill.
- `pages/settings/index.tsx` — phone rail now renders `<OverflowTabs>` (9 sections) + 2 compact pointer
  rows (Developers/Referrals); desktop grouped rail unchanged (now `display:{xs:none,md:flex}`).

**Test IDs:** `overflow-tabs`, `overflow-tab-<id>`, `overflow-tabs-more` (`data-count`), `overflow-tabs-menu`,
`overflow-tabs-search`, `overflow-tabs-item-<id>`, `overflow-tabs-empty`.
**Acceptance:** at 390px `/settings` shows ≤2 pills + "N more tabs…"; dropdown lists the rest; search "tax"
→ 1 row; select navigates + updates `?section=`; wide container shows all, pill absent; live re-flow, no flicker.

**Roll-out (✅ done, 2026-09-30 session 2):**
- **Component now device-adaptive at ALL viewports** (desktop / tablet / phone): the strip already
  collapses by measured container width via ResizeObserver + ghost-row measurement (the `<480px`
  rule is just the phone "active-pill-only" fallback). Added two props so surfaces keep their historical
  QA selectors: `itemTestIdPrefix` (per-tab `${prefix}-${id}`, default "overflow-tab") and
  `containerTestId` (default "overflow-tabs").
- `pages/developer-keys.tsx` → **converted to `<OverflowTabs>`** (containerTestId="developers-tabs",
  itemTestIdPrefix="developers-tab" — old `developers-tab-*` testids preserved). Removed the bespoke
  edge-fade scroller (`useEdgeFade`, `CB_TOKENS`, `indigo`, `theme/isDark` cleaned up).
- `pages/storefront/index.tsx` → **converted to `<OverflowTabs>`** (containerTestId="storefront-tabs",
  itemTestIdPrefix="storefront-tab"; translated labels preserved). Company-hint chip left untouched.
- `pages/invoices.tsx`, `Components/UI/pay-link/CampaignManager.tsx`,
  `Components/Page/Admin/Transactions/index.tsx` → these are 2–3-tab MUI `<Tabs>` (some branded /
  with long labels). Rather than restyle to generic pills (visual regression, ~no overflow gain on
  2–3 tabs), **hardened to `variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile`** so
  nothing clips on tablet/phone while keeping each surface's look.
- `pages/safedeal/wallet.tsx` → the real tabs live in `Components/SafeDeal/Home/SafeDealHome.tsx`
  (gold-branded pill strip + a "deals" badge, 4 tabs, already `overflowX:auto`). **Left as-is** —
  branded + already responsive; converting would drop the SafeDeal styling for little gain.

---

## BATCH C — Single-question form screens  (P2)  ⛔ NOT STARTED
**Goal:** one big centered question per screen, label-above inputs w/ red `*`, side-by-side short fields,
dependent Country→State selects, 2px accent focus ring, blur validation (no toast for field errors),
sticky footer with one primary + "Back".
**Targets:** `Components/Page/GetStarted/*` wizard, `pages/auth/register.tsx`, KYC (`pages/kyc/*`),
SafeDeal `NewDeal.tsx` step 0, storefront first-run, tax first-run.
**Plan:** extract a shared focus-ring `sx` into `Components/UI/_shared`; build a `FormQuestion` layout
(title/help/fields/footer); reuse `AuthLayout/TitleDescription`. Apply per-wizard.
**Test IDs:** `form-question-title`, `form-question-help`, `field-<name>`, `field-<name>-error`,
`form-continue`, `form-back`.
**Risk:** touches signup/KYC/checkout — requires 2FA-logged-in verification; do with review.

---

## BATCH D — Small polish + i18n  ✅ DONE
- ✅ **i18n** added to all 6 locales (`langs/locales/{de,en,es,fr,nl,pt}/common.json`):
  `tabs.moreCount`, `tabs.searchPlaceholder`, `tabs.noMatch`, `toast.dismiss`, `toast.undo`,
  `settingsPage.sectionsAria`.
- ✅ **Restored the toast X** (was commented out) — part of Batch A.
- ✅ **Name the section in save toasts** (2026-09-30 session 2). `CompanySettingsDialog` now passes a
  section-named `successMessage` to `updateCompany` ("Payment settings saved" / "Business details saved" /
  "Webhook settings saved" / "Auto-convert settings saved" when scoped to one section; "Settings saved"
  otherwise). Added optional `successMessage` param to `contexts/CompanyDataContext.tsx::updateCompany`
  (back-compat: other callers still get the backend message). New `savedToast.*` keys added to all 6
  `companySettings.json` locales. TaxSettingsSection already named itself.
- Keep `InfoBanner`/`CustomAlert` inline (rule: banner = state, toast = event) — no change needed.

---

## Testing approach
1. **Batch A + B (now):** frontend testing agent against `/__toasttest` (temp page, all toast variants +
   an OverflowTabs demo — no auth, no DB writes) and the real `/auth/login` error toast.
2. **Batch B settings + Batch C:** need 2FA login; run after those land.
3. `/__toasttest` is TEMPORARY and will be deleted + rebuilt before handoff.

## Remaining execution (updated 2026-09-30 session 2)
**Only BATCH C is left.** B + D are done (see above). C is deferred as a REVIEWED, incremental pass
because it rewrites live signup / KYC / checkout forms on a production PSP (doc's own caveat: "do with
review", needs 2FA-logged-in verification). Recommended order when resumed:
C shared pieces (focus-ring `sx` in `Components/UI/_shared` + a `FormQuestion` layout) →
apply per-wizard low-risk first (storefront first-run → tax first-run → GetStarted) →
then the sensitive gates (register → KYC → SafeDeal NewDeal step 0), each with its own build + testing pass.

## Verification (session 2)
- ESLint clean on all changed FE files; full `next build` type-check passed; prod build swapped in and
  serving (`/`, `/developer-keys`, `/storefront`, `/invoices` → 200).
- Build/deploy on the pod: build to a NEW dist dir and **wait for the process to fully exit** before
  `mv`-swapping into `.next-prod` — `prerender-manifest.json` is written late ("Finalizing"/"Collecting
  build traces"); swapping mid-build yields an incomplete dir and `next start` crash-loops on
  `ENOENT prerender-manifest.json`. Keep the previous `.next-prod-old` as an instant rollback.
