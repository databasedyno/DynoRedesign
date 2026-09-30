# UX Feedback Implementation Plan — end to end
_Source: `memory/UX_FEEDBACK_PATTERNS_2026-09.md` (Brevo reference, owner 2026-09-30)._
_Pod: https://24db019e-11e4-4072-b487-9ed96c683c02.preview.emergentagent.com — SAFE MODE, LIVE prod DB, Next.js PRODUCTION build._
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

## BATCH B — "N more tabs…" overflow tab with search  (P1)  🟡 component ✅, roll-out partial
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

**Roll-out remaining (⛔):** `pages/developer-keys.tsx` (4 tabs — low value), `pages/storefront/index.tsx`,
`Components/Page/Admin/Transactions/index.tsx`, `pages/safedeal/wallet.tsx`, `pages/invoices.tsx`,
`Components/UI/pay-link/CampaignManager.tsx`.

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

## BATCH D — Small polish + i18n  🟡 i18n ✅, save-toast copy ⛔
- ✅ **i18n** added to all 6 locales (`langs/locales/{de,en,es,fr,nl,pt}/common.json`):
  `tabs.moreCount`, `tabs.searchPlaceholder`, `tabs.noMatch`, `toast.dismiss`, `toast.undo`,
  `settingsPage.sectionsAria`.
- ✅ **Restored the toast X** (was commented out) — part of Batch A.
- ⛔ **Name the section in save toasts** ("Payments settings saved" not "Saved"). Lives in nested
  `Components/UI/CompanySettingsDialog` sub-forms (TaxSettingsSection already names itself).
- Keep `InfoBanner`/`CustomAlert` inline (rule: banner = state, toast = event) — no change needed.

---

## Testing approach
1. **Batch A + B (now):** frontend testing agent against `/__toasttest` (temp page, all toast variants +
   an OverflowTabs demo — no auth, no DB writes) and the real `/auth/login` error toast.
2. **Batch B settings + Batch C:** need 2FA login; run after those land.
3. `/__toasttest` is TEMPORARY and will be deleted + rebuilt before handoff.

## Order of remaining execution (proposed)
B roll-out (storefront/admin/safedeal/invoices/campaign) → D save-toast copy → C shared pieces →
C per-wizard (register → GetStarted → KYC → SafeDeal → first-runs), each with a testing pass.
