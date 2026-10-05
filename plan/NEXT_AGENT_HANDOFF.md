# NEXT-AGENT HANDOFF — Create-Flows enhancements (4 items)

Date: 2026-10-05. App: DynoPay (Next.js + TS FE / ts-node TS backend :8001 / Mongo + SQL tbl_* + Redis).
Vault passphrase: `Katiekendra123@` (restore: `bash scripts/env-vault.sh open 'Katiekendra123@'` or `bash scripts/pod-bootstrap.sh --pass 'Katiekendra123@'`).

## ENVIRONMENT / WORKFLOW (read first)
- Frontend is currently in **DEV mode** (`FRONTEND_MODE=dev` in `/app/.env.local`) → hot reload, no rebuild needed to see FE changes. The platform/preview normally runs PRODUCTION; before final handoff either leave dev (fine; `.env.local` is gitignored) or rebuild prod: `cd /app && NEXT_DIST_DIR=.next-prod-new node_modules/.bin/next build` (~2.5 min, background) → `mv .next-prod .next-prod-old && mv .next-prod-new .next-prod && sudo supervisorctl restart frontend`. Deploy uses the Dockerfile regardless.
- Backend is ts-node → **`sudo supervisorctl restart backend`** after backend edits.
- **SAFE MODE on the LIVE prod DB** (bg jobs off, outbound email off). Company 1 "The Dev Store" (owner `onarrival21@gmail.com`) is the OWNER'S OWN test brand → real saves on it are OK. Avoid mutating OTHER merchants.
- Quick merchant login (no OTP): JWT at `/app/memory/tmp/merchant_token.txt` (valid ~until 2026-10-29). In browser on preview origin: `localStorage.setItem('token', <jwt>); localStorage.setItem('last_company_id','1');` then navigate. Always use a real browser User-Agent (bot UAs get 403'd).
- Preview URL = `SERVER_URL` in `/app/backend/.env`.
- GATES before testing each change: `node_modules/.bin/tsc --noEmit` = 0 errors; eslint on changed files; `node scripts/qa/strip_unused_imports.cjs tsconfig.json --check --skip=backend,scripts` must pass (CI fails ONLY on unused *imports*, not unused locals).
- i18n locales: `langs/locales/{en,es,fr,de,pt,nl}/<ns>.json`. Propagation script pattern: `scripts/copy/propagate_phase23_i18n.py` (idempotent; copy it).

## ALREADY DONE THIS SESSION (do NOT redo)
1. App restored from vault, services healthy, live on preview.
2. CI/build fix: removed unused `useCallback` import in `Components/Layout/NewHeader/CreateNewButton.tsx`. ⚠️ STILL NEEDS user **"Save to GitHub"** to push so the GitHub "Preflight" workflow goes green (we cannot push).
3. Create-Flows Phases 1–3 (per plan/plan.md): Product editor split into plain-language sections (Product basics/Images/Price & stock/Delivery/Tax/Variants) + post-creation "Your product is live" panel (`Components/Page/ProductEditor/index.tsx`); hub "Most used" badge (`Components/Layout/NewHeader/CreateHub.tsx`); i18n for all new keys (`scripts/copy/propagate_phase23_i18n.py`). Creator page already complete.
4. BUG FIX (VERIFIED by testing_agent): Brand/Account details "Save changes" was greyed despite unsaved changes → now `disabled={companyState.loading || !isDirty}` in `Components/UI/CompanySettingsDialog/index.tsx`.

## TASK STATUS — 4 enhancements the user asked for

### #4 Inline field error on brand save — CODE DONE, NEEDS TESTING
- File: `Components/UI/CompanySettingsDialog/index.tsx`.
- Change made: the "Save changes" button is now `type="submit"` (removed the direct `onClick={() => handleSubmit(values)}`). It submits the `FormManager` `<form>`, so `FormManager.handleSubmit` runs yup validation, sets ALL fields `touched=true` + `errors`, and only calls the dialog's `handleSubmit(values)` when valid. The fields in `CompanyDetailsSection.tsx` already render inline errors via `error={Boolean(touched.x && errors.x)}` + `helperText` (company_name line ~458, email ~488, address_line_1 ~995). So an invalid field now shows its message inline instead of a silent grey button.
- Also still present (defensive): a `checkValidation(schema, values)` guard + clear toast inside the dialog's `handleSubmit` (won't normally fire now since FormManager gates — harmless, can keep).
- ⚠️ Behaviour note: making Save `type="submit"` means pressing Enter in a field now submits the form (standard, validation+dirty-gated). If undesirable, revert to onClick and instead expose a `setTouched`/`submitForm` from `FormManager` (Components/Page/Common/FormManager/index.tsx) to trigger touched.
- TEST (testing_agent): login company 1 → /settings?section=company → Brand details. (a) Blank the Brand name OR set an invalid email, click Save → the SPECIFIC field shows an inline error message (not just a toast); Save stays usable. (b) Fix it → Save persists. (c) Regression: normal country/address change still enables + saves. Desktop + mobile 390.

### #3 Post-creation "where it lives / share / track" panel — NOT STARTED
- The payment-link + fundraiser flow ALREADY opens `PaymentLinkSuccessModal` after create (rendered at `Components/Page/CreatePaymentLink/index.tsx` ~line 1464, `open={successModalOpen}`; component file: find `Components/.../PaymentLinkSuccessModal*`). It already has copy-link / share bits.
- GOAL: make it a consistent 3-action panel for BOTH `linkKind==="payment"` and `linkKind==="donation"`: **(1) Where it lives** → `/pay-links` (manage), **(2) Share** → copy link + QR (already has copy via `onCopyLink`), **(3) Track** → `/transactions`. Mirror the Product flow's post-creation panel (`ProductEditor/index.tsx` search `product-next-steps` for the pattern + testids product-next-see/share/track). Use real routes only.
- Reuse i18n: add keys in the `createPaymentLinkScreen` namespace (or `common`), propagate via a new entry in the propagation script.
- TEST: create a payment link and a fundraiser as company 1 (owner's own brand — OK) → success modal shows the 3 actions, each routes correctly; desktop + mobile.

### #1 Reward tiers in the fundraiser PREVIEW — NOT STARTED (infra exists)
- Backend EXISTS: `backend/models/userModels/donationTierModel.ts` (tbl_donation_tier), endpoints in `backend/controller/payment/crowdfundingController.ts` registered in `backend/routes/paymentRouter.ts`:
  - POST `/api/payment/link/campaign/:linkId/tiers` (auth owner) createTier
  - PATCH `/api/payment/link/tier/:tierId` updateTier
  - DELETE `/api/payment/link/tier/:tierId` deleteTier
  - GET `/api/payment/link/campaign/:refOrId/tiers` (public) listTiers
- Editor EXISTS: `Components/UI/pay-link/CampaignManager.tsx` (tabs tiers/updates/supporters) — but ONLY rendered in EDIT mode of a donation link (needs saved `linkId`): see `Components/Page/CreatePaymentLink/index.tsx` ~line 1830 `{linkKind==="donation" && hasPaymentLinkData && paymentSettings.linkId && <CampaignManager .../>}`.
- Public render EXISTS: `Components/Page/Pay3Components/campaign/RewardTierShelf.tsx`.
- GAP: the **live preview** (`Components/UI/pay-link/LivePreviewPanel.tsx`, donation body ~line 145+, after the donor wall ~line 178) does NOT show reward tiers.
- APPROACH (recommended):
  1. Lift tiers into `CreatePaymentLink`: add `const [campaignTiers, setCampaignTiers] = useState<Tier[]>([])`; when editing a donation link with a linkId, fetch `GET campaignTiers(linkId)` (endpoint helper `API_ENDPOINTS.pay.campaignTiers`). Pass into `livePreviewProps` (search `livePreviewProps` in that file; used at lines ~1663 and ~2200).
  2. Add optional `onTiersChange(tiers)` callback to `CampaignManager.tsx`; call it after load + after create/update/delete so the preview stays in sync.
  3. In `LivePreviewPanel.tsx` donation body, render a compact "Reward tiers" shelf from the passed tiers (mirror `RewardTierShelf` styling; testid e.g. `preview-reward-tiers` / `preview-reward-tier-<i>`), each showing min_amount + title (+ description).
  4. CREATE mode has no linkId → tiers can't persist yet; either (a) show nothing (tiers managed after first save), or (b) allow drafting tiers locally and POST them right after the link is created in the create handler. (a) is lower risk; the original ask is satisfied by edit-mode preview.
- i18n: add preview-tier labels (previewRewardTiers etc.) and propagate.
- TEST: edit an existing donation campaign for company 1, add/edit a tier in CampaignManager → it appears live in the preview; delete → disappears. Confirm public campaign page still renders tiers (RewardTierShelf) unchanged.

### #2 Landing i18n propagation — NOT STARTED (precise gap known)
- Landing v7 (`Components/Page/Home/v7/*`) uses keys like `t("v7.hero.eyebrow")` with NO defaultValue → values come from `landing.json`; missing keys fall back to EN.
- EXACT GAP: 13 keys present in `en/landing.json` but MISSING from es/fr/de/pt/nl (all `v7.security.*` + `v7.trust.eyebrow`):
  `v7.security.body`, `v7.security.eyebrow`, `v7.security.headline`, `v7.security.trustLink`,
  `v7.security.noncustodial.title`, `v7.security.noncustodial.body`,
  `v7.security.compliance.title`, `v7.security.compliance.body`,
  `v7.security.keys.title`, `v7.security.keys.body`,
  `v7.security.uptime.title`, `v7.security.uptime.body`,
  `v7.trust.eyebrow`.
  (Get current EN values: `python3 -c "import json;d=json.load(open('langs/locales/en/landing.json'));print(json.dumps(d['v7']['security'],indent=2,ensure_ascii=False))"`.)
- ALSO verify (user explicitly mentioned hero/how-it-works/FAQ): those keys EXIST in all locales (75 shared) but may hold STALE translations from BEFORE the "Operations Console" landing rewrite. Spot-check a few `v7.hero.*` / `v7.howItWorks.*` / `v7.faq.*` values in es vs the current EN copy; if stale, refresh them too.
- DO: write translations for the 13 missing keys (+ any stale hero/how-it-works/FAQ) into all 5 non-en locales via a propagation script (copy `scripts/copy/propagate_phase23_i18n.py`, NESTED under `v7`). Validate JSON. No code change needed.
- TEST: switch app/site language to FR/ES on `/` and confirm the Security section + Trust eyebrow read translated (not English).

## SUGGESTED ORDER
#4 verify (quick) → #3 (reuse existing modal) → #2 (mechanical, no code risk) → #1 (biggest; backend infra already there).
After all: tsc + eslint + unused-imports gate → ONE testing_agent frontend pass → (optional) rebuild .next-prod → report. Update `/app/test_result.md` (free-form log, prepend a block) before each testing_agent run.
