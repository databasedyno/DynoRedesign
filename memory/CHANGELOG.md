# Changelog

# SESSION ADDENDUM (2026-06 fork, part 2) — Wallet Sharing Nudge · Storefront Merge · IA tab audit — VERIFIED (testing agent iteration_49 + 50, 100% after fixes)

## A. Wallet Sharing Nudge (`Components/Page/Wallet/WalletReuseNudge.tsx`, NEW)
Wallets are per-Account, so a merchant who gains a second account lands on an EMPTY wallets page
while their addresses sit on the other one. On `/wallet`, when the selected account has zero wallets
and `GET /api/wallet/reusable-wallets` reports another account with some, a card offers
"Use the same wallets as <account>" + one tap `Copy N wallets`
(`POST /api/wallet/copyWalletAddresses`, idempotent, no OTP, one row per account/address so
settlement scoping is untouched) + "Add a different one". testids: wallet-reuse-nudge,
-copy, -add-new. `WalletReuseSelector` (inside AddWalletModal) re-copied to "another account" and
re-coloured from the legacy lime to Aurora indigo.

## B. Storefront Merge (user choices: inline products · single nav item · products for everyone · link called "your page")
- NEW `/storefront` (`pages/storefront/index.tsx`) with three tabs — **Page · Products · Share** —
  code-split via next/dynamic, tab state local + synced from `?tab=`, and a
  `USER_PROFILE_FETCH` dispatch because the Products/Share tabs don't otherwise pull the profile
  into Redux (Share would have claimed the merchant has no link). testids storefront-page,
  storefront-tab-{page,products,share}, storefront-open-page.
- NEW `Components/Page/Storefront/PageTab.tsx` (ex-/creator body), `ProductsTab.tsx`
  (ex-/pay-links/products list, actions moved into the panel header), `ShareTab.tsx`
  (link + copy + open + X/WhatsApp/Telegram/email + QR, with a "claim your handle" empty state).
- `/creator` and `/pay-links/products` are now zero-JS `getServerSideProps` redirects into
  `/storefront?tab=…`, so every existing `router.push("/creator")` keeps working. Product editor
  routes (`new`, `[id]/edit`, `[id]/orders`) unchanged; their back buttons point at the tab.
- Nav: sidebar + mobile second row now carry ONE **Storefront** item (the old "Creator page" +
  feature-flagged "Products" rows are gone); QuickActions catalog hrefs, `helpers/shortcutUsage`
  path map, `utils/theme/routeContext` (in-app dark theme) and `_app` noindex list all updated.
- PUBLIC PAGE — the whole point: `pages/[handle].tsx` now also SSR-fetches `/api/shop/{handle}`
  (best-effort, flag-aware) and `CreatorProfile` renders NEW `CreatorShopSection.tsx` inline under
  the tip widget (up to 6 cards, full-width when there is only one, "View all →" to `/{handle}/shop`).
  One shared link finally shows tips AND products. The page's "nothing here yet" state now also
  requires `products.length === 0`.
- Fixed a pre-existing dev warning: the mobile sticky-CTA `createPortal` is now wrapped in a
  Fragment (a raw portal object fails MUI's `children: PropTypes.node` check on the parent Box).

## C. BUG (self-found, P0) — route loader stuck when leaving /storefront
`routeChangeStart` + `beforeHistoryChange` fired, the URL changed, but `routeChangeComplete` never
did, so `RouteTransitionLoader` hung over the next page. Root cause was NOT the dynamic imports (the
first hypothesis): the page was in a **render loop — 69 renders per load** — because the header-action
effect depended on MUI's `theme` AND called `setPageAction` (state in `_app`); each commit produced a
new dep, re-ran the effect, set state again. React never commits the next route while a page loops,
so Next's `set()` promise never resolves. Fixed by moving the action into its own
`<OpenPageAction/>` component so the effect depends only on `[setPageAction, handle]`.
Renders 69 → 5, transitions complete, code-splitting kept.
**RULE:** any effect that writes layout state (`setPageName`/`setPageAction`/`setPageWarning`) must
depend on PRIMITIVES ONLY. Non-primitive deps show up later as a "navigation bug" elsewhere.

## D. `docs/IA_TAB_ARCHITECTURE_AUDIT.md` (NEW) — human-experience / tab-ownership audit
Which functionality belongs in which tab, judged by four tests (job · frequency · config-vs-result ·
consequence) for the two personas that now exist (`account_type`). 14 findings; headline ones:
product orders live in 3 places, tips are configured/reported/counted in 3 places, creating things
has no single home, "Invoices & Tax" is a receipts archive, developer tooling has 3 doors, and one
IA is shown to both personas. Proposes 4 nav groups / 8 rows with reveal-on-relevance, a full
tab-ownership map, 7 anti-sprawl laws, a P0/P1/P2 plan, **§6 build specs for the four agreed next
actions (N1 persona nav · N2 product sales inline · N3 one `+ New` · N4 Developers home)** and **§7
seven potential improvements (I1 expired-link rescue, I2 share nudge, I3 KPI plain-English read,
I4 QR pack, I5 sell-again, I6 storefront SEO, I7 buyer receipt page)**. Read it before the next IA change.

---

# SESSION ADDENDUM (2026-06 (fork)) — Individual vs Business account UX · low-base KPI delta · pay-links search crash — VERIFIED (testing agent iteration_47 + 48 + self-verified via route interception)

## Why
Backend auto-provisioning (2026-08-12) gives EVERY user an Account row in `tbl_company`
(`account_type='individual'|'business'`), so every frontend onboarding check of the form
`companyList.length > 0` became permanently TRUE. Result: "Set up your business profile" was
silently ticked and the header nudge disappeared, so nobody was ever asked for the COUNTRY that
invoices + VAT reporting need. Founder rule applied: an individual creator is never BLOCKED, only nudged.

## A. New shared signal — `hooks/useAccountProfile.ts` (NEW, no API/DDL change)
`{ account, accountType, isIndividual, hasAccount, profileComplete, missing, fetched }` derived from
the existing `GET /api/company/getCompany` payload (it already returns the whole row incl. `account_type`).
`profileComplete = company_name && country` both non-empty. Consumers: dashboard v2026, NewHeader,
MobileNavigationBar, OnboardingFlow, WalletTotalHero.

## B. Onboarding UX (individual vs business)
- `Components/Page/Dashboard/v2026/ActivationChecklist.tsx` REWRITTEN: props `accountType/profileComplete/hasWallet`;
  step 1 = "Complete your business profile" (business) / "Add your country so invoices and tax are right"
  (individual), ticked only when profileComplete; unfinished steps are now CLICKABLE (→ /settings?section=company,
  /wallet, /create-pay-link) with a chevron; account-type chip `dash2026-account-type`; secondary CTA becomes
  "Add business details" for individuals. testids: dash2026-step-{profile,wallet,link,payment}.
- `Components/Layout/NewHeader/index.tsx` + `MobileNavigationBar`: the old "create your company" warning is now an
  account-completeness nudge → `data-testid=account-setup-warning` / `mobile-account-setup-warning`, href
  `/settings?section=company` (falls back to the legacy create-company copy only if NO account row exists).
- `Components/UI/OnboardingFlow/index.tsx`: company step `done = profileComplete`, click routes to Settings when an
  account already exists (nothing to "create"), copy switches per account type, and the legacy checklist now stands
  down when `hasPayment` OR when `hasAccount && hasWallet` (the v2026 Activation card owns that state — iteration_47
  found BOTH rendering at once).
- `Components/UI/CompanySelector/index.tsx`: Individual/Business chip per account row (`company-type-<id>`).

## C. Wallets under the new architecture (user question)
Individual accounts CAN hold wallets — `tbl_user_wallet` is user-owned with a nullable `company_id`, and the
auto-provisioned Account supplies that scope, so AddWalletModal works unchanged. Re-using the SAME address across
accounts already existed end-to-end: `GET /api/wallet/reusable-wallets` + `POST /api/wallet/copyWalletAddresses`
(independent per-account copies, idempotent, no OTP) surfaced by `Components/UI/WalletReuseSelector` at the top of
AddWalletModal. This session: copy switched from "existing company" → "another account", and `WalletTotalHero` now
shows an account-scope chip `wallet-account-scope` ("hostbay · Business") so a merchant with both an individual and
a business account can tell WHICH wallets they are looking at.

## D. BUG — dashboard "↑300.0%" on Payments today
Root cause: day-over-day COUNTS on a tiny base (today 4 vs yesterday 1 = a true +300%) rendered as a bare percentage
next to a volume that had FALLEN 42% — mathematically right, editorially nonsense. `KpiStrip.tsx`: when yesterday's
count < 5 the chip shows the plain difference (`+3`) instead of a percentage, and a caption always states the
baseline ("vs 1 yesterday"). Baselines >= 5 still show the percentage. Backend `calculateChange` untouched.
testid `dash2026-kpi-payments-delta`. VERIFIED live (4 → "+3 · vs 1 yesterday") and via interception (30/20 → "50.0%").

## E. BUG — /pay-links search crashed the page (pre-existing, HIGH)
`link.id.toLowerCase is not a function` — payment-link ids are NUMBERS, so every keystroke in the search box threw
inside the filter `useMemo` and the ErrorBoundary tore the page down (this is why iteration_47 "could not reproduce"
the no-results state). Fixed with `String(link.description ?? "")` / `String(link.id ?? "")`.

## F. No-results vs first-run empty states (Empty-State Everywhere)
`Components/UI/EmptyDataModel/index.tsx` gained `variant="no-results"` + `onClearFilters` (testids
`no-results-<page>`, `empty-state-<page>`, `empty-state-clear-filters`, `empty-state-cta-<page>`); the template/
revenue-stream chips are hidden in the no-results variant. Wired into `Components/Page/Transactions/index.tsx` and
`Components/Page/Payment-link/index.tsx`, each with a `clearFilters()` that also bumps a `filterResetKey` so the top
bar REMOUNTS and its internal search/date state visibly clears. A genuinely empty list still shows the original
first-run empty state.

## G. Smart Suggested Shortcuts (Quick Actions dock)
`helpers/shortcutUsage.ts` (NEW) counts in-app route visits in localStorage `dp_qa_usage_v1` (recorded from
`Containers/Client/index.tsx` on every routeChangeComplete — no request, no DB write). `getSuggestedShortcuts(4)`
needs >= 8 total visits. `QuickActionsDock.tsx` shows a dismissible strip `dash2026-qa-suggestion` ("Pin the 4 pages
you open most?" + `dash2026-qa-suggest-apply` / `dash2026-qa-suggest-dismiss`, dismissal remembered in
`dp_qa_suggest_dismissed_v1`) and a "Use most visited" button inside the Customize dialog
(`dash2026-qa-suggest-dialog-apply`). Applying persists through the existing PUT /api/user/dashboard-quick-actions.

## H. `GET /api/publishable-keys` 400 fixed
`hooks/usePublishableKeys.ts` no longer fetches with a null company (the endpoint REQUIRES company_id); the SWR key
is null until a company is selected, so the Elements embed card shows its placeholder pk instead of 400ing.

## Notes for future agents
- hostbay (the live test merchant) is `account_type='business'` with `country=NULL` → `profileComplete` is FALSE by
  design; that is why the "Finish your business profile" nudge shows. Do NOT set its country in tests.
- To force the first-run Activation card on a real merchant you must intercept BOTH `GET /api/dashboard` (zero
  `total_transactions.count` / `total_volume.amount`) AND `GET /api/dashboard/recent-transactions` (empty array) —
  `hasPayment` is derived from both (iteration_48 missed the second one and got an inconclusive result).
- Known pre-existing, NOT fixed: MUI validateDOMNesting warnings in ApiKeyCard (fieldset/div under <p>) and a
  Recharts "width(-1) height(-1)" warning on first dashboard paint.

---

## 2026-08-05 (session 6) — DE/NL locales + MM:SS countdown + analytics + full-shell localisation

**🟢 German + Dutch translations for the checkout strip**
- Added `checkout.strip.*` block to `langs/locales/de/landing.json` and `nl/landing.json`. All 5 states (pending, confirming, confirmed, settled, failed) plus the `urgent` overlay are localised — human-quality copy, not machine-translated.
  - DE: `SCHNELL · Nur noch {{seconds}}s · Schließe deine Überweisung jetzt ab — dieser Zahlungslink läuft bald ab.`
  - NL: `HAAST · Nog maar {{seconds}}s · Voltooi je overboeking nu — deze betaallink verloopt binnenkort.`
- All six preview locales (en/pt/es/fr/de/nl) are now complete.

**🟢 MM:SS visible countdown**
- New `formatCountdown()` pure helper exported from `Components/UI/CheckoutStatusStrip.tsx` — turns raw seconds into `M:SS` with proper zero-padding, clamps negative/NaN to `0:00`.
- When `isUrgent` (0 < secondsRemaining ≤ 60), the strip now renders a right-aligned coral **MM:SS chip** in tabular-nums monospace — width stays stable as the counter ticks from `1:00 → 0:59 → 0:12 → 0:08`.
- `aria-live="polite"` on the chip so screen-readers announce the countdown updates without preempting the primary title.
- Verified in EN (0:45), DE (0:45), NL (0:08 — proves padStart on single-digit seconds).

**🟢 Analytics hook — `dynopay:checkout_urgent_shown`**
- Fires the first moment `isUrgent` flips false→true. Uses `useRef` to gate re-fires while urgent stays true (would flood analytics with ~60 events per checkout otherwise). Genuine off→on transitions DO re-fire (rare but semantically meaningful).
- Dual-channel dispatch:
  1. `window.dispatchEvent(new CustomEvent("dynopay:checkout_urgent_shown", { detail: {state, secondsRemaining, at} }))` — for first-party analytics scripts on the same origin.
  2. `window.parent.postMessage({source:"dynopay", v:1, type:"dynopay:checkout_urgent_shown", ...}, "*")` — for merchants who embed the checkout in an iframe (subscribes cleanly alongside their existing `dynopay:success` / `dynopay:resize` listeners).
- **Playwright test proved the contract:** first urgent click → 1 event · switch 45→12 while urgent → still 1 event · switch to No-Timer then back to 45s → 2 events. No page errors.

**🟢 Full `<CheckoutShell>` localisation**
- `CheckoutShell.tsx` now reads title/caption/pill through `useTranslation("landing")` using the same `checkout.strip.*` keys the compact `CheckoutStatusStrip` variant reads. English `STATE_META` retained as `defaultValue` fallback so any locale that hasn't been extended still works.
- `pages/pay/state-demo.tsx` gained a new `checkout.demo.*` block for its own chrome (`eyebrow`, `headline`, `timerLabel`, `noTimer`, `urgent45`, `urgent12`, `compactHeader`, `totalDue`, `mockBlurb`). Localised in all 6 locales. Demo now reads entirely in the user's chosen language.

**Verification (Playwright at 1440×900):**
- EN urgent 45s → `HURRY · Only 45s left` + right-side `0:45` chip · analytics events=1 · data-urgent=1 ✓
- EN urgent 12s (from within-urgent transition) → `0:12` · analytics stays at 1 (no re-fire) ✓
- No timer → countdown chip removed from DOM · data-urgent=0 ✓
- Re-click 45s (off→on) → analytics=2 ✓
- DE urgent 45s → `SCHNELL · Nur noch 45s · 0:45` + full shell `WARTEN · Warten auf deine Wallet` + demo chrome `CHECKOUT-ZUSTANDS-SPIELPLATZ · Die fünf Zustände eines Dynopay-Checkouts · Kein Timer / 45s übrig · dringend / …` ✓
- NL urgent 8s → `HAAST · Nog maar 8s · 0:08` + shell `BEVESTIGEN · Uitzending op de blockchain` + demo `SPEELTUIN VOOR CHECKOUT-STATUSSEN` ✓
- PT confirmed → full shell now shows `CONFIRMADO · Pagamento confirmado · A rede confirmou o seu pagamento. A liquidação está em curso.` + demo `PLAYGROUND DOS ESTADOS DO CHECKOUT` ✓
- `tsc --noEmit` PASS · 0 page errors across all 7 test surfaces

**Files touched:**
- `Components/UI/CheckoutStatusStrip.tsx` (formatCountdown export + MM:SS chip + analytics hook)
- `Components/UI/CheckoutShell.tsx` (useTranslation reads for title/caption/pill)
- `pages/pay/state-demo.tsx` (localised chrome via `checkout.demo.*`)
- `langs/locales/de/landing.json` (new `checkout.strip` + `checkout.demo`)
- `langs/locales/nl/landing.json` (new `checkout.strip` + `checkout.demo`)
- `langs/locales/en/landing.json`, `pt/landing.json`, `es/landing.json`, `fr/landing.json` (added `checkout.demo` block)


## 2026-08-05 (session 5) — Timeout urgency + PT/ES/FR translations for the checkout strip

**🟢 Timeout warning (`?urgent=45` / real-time countdown)**
- `Components/UI/CheckoutStatusStrip.tsx` gains a new `secondsRemaining?: number` prop. When the value is in `(0, 60]`, the strip flips into an **urgent** mode:
  - Border + tint shift to soft coral (`rgba(255,91,73,0.34)` border, coral fill)
  - New `coralUrgent` keyframe pulses a 2.4s expanding coral halo around the box (`box-shadow: 0 0 0 → 10px rgba(255,91,73)`), keeping the buyer's eye on the strip without flashing the whole page
  - Title + caption are replaced with the localised **urgent copy** ("Only {seconds}s left · Complete your transfer now — this pay link expires soon.")
  - Pill flips to the failed tone (coral) with the localised "HURRY" label
  - The base status (pending/confirming) is retained under the hood so if the buyer completes in the last 30s we still know which flow they were in
- `Components/Page/Pay3Components/CleanCheckoutV2.tsx` passes its existing `timeLeft` state to the strip: `<CheckoutStatusStrip state={stripState} secondsRemaining={timeLeft} />`. `timeLeft` was already computed there for the countdown display — zero new derived state.
- Motion honours `prefers-reduced-motion` (keyframe disabled).
- `data-urgent="0|1"` attribute exposed for QA + analytics.

**🟢 PT / ES / FR translations on the checkout status strip**
- `langs/locales/{en,pt,es,fr}/landing.json` — added `checkout.strip.{state}.{pill,title,caption}` for all 5 states (pending, confirming, confirmed, settled, failed) plus a special `checkout.strip.urgent.{pill,title,caption}` block. Translations authored end-to-end (not machine-translated) — e.g. FR uses "Diffusion sur la blockchain" for confirming, PT uses "A transmitir na blockchain", ES uses "Transmitiendo en la blockchain".
- `CheckoutStatusStrip.tsx` reads copy via `useTranslation("landing")` with English `defaultValue` fallbacks so any locale that hasn't been extended (de, nl) still renders correctly (falls back to English).
- Pill label localised too, so ES sees `ESPERANDO`, PT sees `AGUARDA`, FR sees `EN ATTENTE`.

**🟢 State-demo playground now covers both**
- `pages/pay/state-demo.tsx` grew a second row of pill buttons — "No timer / 45s left · urgent / 12s left · very urgent" — plus a new **"Compact strip (used in the live /pay checkout)"** section that mounts `<CheckoutStatusStrip>` directly. Deep-links: `?state=pending&urgent=30` jumps straight into the urgent view. Handy for design review of the coral pulse.

**Verification (Playwright at 1440×900):**
- No timer, EN, pending: `WAITING · Waiting for your wallet` — indigo tint, aurora blob visible ✓
- 45s urgent, EN: coral border + coral halo pulse + `HURRY · Only 45s left · Complete your transfer now` ✓ · `data-urgent=1`
- 12s urgent, EN: `HURRY · Only 12s left` ✓
- PT locale + urgent=30: `DEPRESSA · Restam apenas 30s · Complete a sua transferência agora — este link expira em breve.` ✓
- ES locale + pending (no timer): `ESPERANDO · Esperando tu billetera · Envía el importe exacto indicado…` ✓
- FR locale + failed: `ÉCHEC · Quelque chose s'est mal passé · Le paiement n'a pas abouti…` ✓ · coral shake fires
- `tsc --noEmit` PASS · 0 page errors across all 6 test surfaces

**Files touched:**
- `Components/UI/CheckoutStatusStrip.tsx` (urgent mode + i18n + `coralUrgent` keyframe)
- `Components/Page/Pay3Components/CleanCheckoutV2.tsx` (pass `timeLeft` as `secondsRemaining`)
- `pages/pay/state-demo.tsx` (urgent picker + compact strip variant)
- `langs/locales/en/landing.json`, `pt/landing.json`, `es/landing.json`, `fr/landing.json` (added `checkout.strip` block)


## 2026-08-05 (session 4) — CheckoutShell wired into the live /pay checkout

**🟢 CheckoutStatusStrip landed inside CleanCheckoutV2**

Live buyers on `/pay?d={link}` now see the same aurora status treatment demonstrated on the state playground — without touching v2's existing PanelShell/QR/address/confirmations layout.

- **New:** `Components/UI/CheckoutStatusStrip.tsx` — a "just the header strip" variant of `<CheckoutShell>`, purpose-built for pages that already own their outer panel. Same tokens (StatusPill, aurora pulse blob, sky spinning ring on confirming, coral shake on failed), no outer wrapper card. Returns `null` on `settled` so v2's existing success view + canvas-confetti isn't duplicated.
- **Wire:** `Components/Page/Pay3Components/CleanCheckoutV2.tsx` computes a `stripState: CheckoutState | null` from the v2 FSM and drops the strip at the top of the main `PanelShell` when it's non-null:
  - `awaiting_payment` (no mempool detect) → `pending` (aurora pulse blob)
  - `awaiting_payment` (mempool detected) → `confirming` (sky-blue spinning ring)
  - `underpaid` → `confirming` (funds arrived, partial)
  - `confirmed` → strip renders nothing (v2's own success view + canvas-confetti already fires)
  - `currency_select` / other pre-checkout phases → strip renders nothing (buyer hasn't committed)
  - TypeScript control-flow narrowing confirms the earlier `phase === 'confirmed' | 'expired' | 'failed' | 'error'` return branches make those states unreachable here — no dead code.

**Verification:**
- `tsc --noEmit` PASS
- `/pay/state-demo` regression: shell mounts on `?state=pending` (1) and `?state=confirming` (1)
- `/pay-links` regression: 11 rows load post-CleanCheckoutV2 edits (list unchanged)
- `/pay/demo` mock regression: renders fine (separate `PaymentDemo` component; not touched)
- 0 page errors across all four pages tested


## 2026-08-05 (session 3) — Transactions drawer + Checkout state machine + Invoices Kanban

**🟢 Transactions drawer (Phase 3 in-app polish)**
- `Components/Page/Transactions/TransactionDetailsModal.tsx` — swapped the centered `PopupModal`/Dialog wrapper for a right-anchored MUI `<Drawer>`. Same rich body (Amount Details / Transaction Hashes / Actions), now with a sticky header (title + status pill + close X), a scrollable body, and a blurred backdrop. Users can now click through transactions in sequence without losing the list beneath them.
- `Components/Page/Transactions/styled.tsx` — `CryptoIconChip` gains an aurora indigo halo (subtle at rest, brightens on parent hover); coin icons now render inside a soft indigo→violet gradient ring. Ties every row visually to the Aurora palette.

**🟢 Checkout state machine (Phase 5)**
- `Components/UI/CheckoutShell.tsx` — new. The 5-state animated wrapper covering the full on-chain lifecycle: `pending` (aurora pulse blob), `confirming` (sky-blue spinning ring on the icon), `confirmed` (volt fade-in on the status strip), `settled` (canvas confetti burst — 70 particles, 1.6s single shot, volt+violet+indigo+sky, respects `prefers-reduced-motion`), `failed` (one-shot coral horizontal shake). Zero API/socket coupling — parent page passes `state` as a prop. Uses `useVerticalAccent()` so the resting palette adapts to creators/fundraisers/developers surfaces automatically.
- `pages/pay/state-demo.tsx` — new consolidated demo playground. State-picker at the top (`?state=settled` etc. deep-links straight into a single URL) that lets QA and design walk through all five states without touching the checkout state machine. Hidden from indexing (`<meta robots="noindex">`), not linked in nav. SSR-safe: initial query read moved into `useEffect` to avoid a React #418 hydration mismatch (verified 0 page errors after fix).

**🟢 Invoices Kanban + live PDF preview drawer (Phase 3)**
- `Components/Page/Invoices/InvoicePreviewDrawer.tsx` — new. Row click opens a right-anchored drawer showing (a) invoice metadata + `Paid` StatusPill in the header, (b) two actions (Download PDF / Open in new tab), (c) an iframe live-rendering the invoice PDF from the same `/invoices/{id}/pdf` blob endpoint the download button already uses. Blob URLs are `URL.revokeObjectURL()`-ed in the effect cleanup so we don't leak on repeated open/close. Skeleton + error state included.
- `pages/invoices.tsx` gains:
  - **Kanban grouping by month** — data rows now precede a monospace header row per YYYY-MM (`JULY 2026 · 4 invoices · $7.30`, `JUNE 2026 · 2 invoices · $5.37`, etc.). Uses indigo accent to tie into the dashboard shell.
  - **StatusPill on every invoice row** — replaces the plain invoice number cell with a stacked layout (number bold + green "PAID" mono pill). Tone tokens are consistent with the transactions drawer and checkout state machine.
  - Row-level `cursor: pointer` + `onClick` opens the preview drawer; the existing download-PDF icon in the last column stays as a shortcut and now uses `e.stopPropagation()` so it doesn't also fire the row-click preview.
  - Drawer mounted at the bottom of the page, controlled by `previewInvoice` state.

**Verification (Playwright at 1440×900, logged in as hostbay@moxx.co):**
- `/transactions` → row click opens right drawer with header showing "Transaction Details · Settled ✓ ×" · body shows Amount Details, Transaction Hashes, Actions · `MuiDrawer-paper` count = 1 · 0 page errors
- `/pay/state-demo` → all 5 states swap on pill click, `data-state` attribute updates, confetti fires on the pending→settled transition (verified mid-flight screenshot), coral shake runs on failed, `?state=settled` deep-link loads correctly, hydration error count: **0**
- `/invoices` → 2 month-group headers rendered (July 2026, June 2026) with correct invoice counts + totals · 6 rows now show `PAID` StatusPill · row click opens the PDF preview drawer with `MuiDrawer-paper` = 1 · Download and Open-in-new-tab actions visible · 0 page errors
- `tsc --noEmit` PASS across all changes

**Files touched this session:**
- `Components/UI/CheckoutShell.tsx` (new)
- `Components/UI/OnboardingBanner.tsx` (session 2 · unchanged)
- `Components/Page/Invoices/InvoicePreviewDrawer.tsx` (new)
- `Components/Page/Transactions/TransactionDetailsModal.tsx` (Dialog → Drawer)
- `Components/Page/Transactions/styled.tsx` (aurora ring on CryptoIconChip)
- `pages/pay/state-demo.tsx` (new)
- `pages/invoices.tsx` (Kanban headers + StatusPill + drawer mount)


## 2026-08-05 (session 2) — Backend vertical + Phase 3/4 rollout + New-Signup Onboarding

**🟢 Vertical-specific first-run onboarding — end-to-end**
Ties the PurposePicker at signup all the way to the correct first-action surface.
- `helpers/verticalOnboarding.ts` — new. Single source-of-truth mapping `Vertical → { path, label }`:
  - creators → `/creator?onboarding=1` (label: "creator page")
  - merchants → `/pay-links/products/new?onboarding=1` (label: "first product")
  - fundraisers → `/create-pay-link?type=donation&onboarding=1` (label: "campaign page")
  - developers → `/developer-keys?onboarding=1` (label: "API access")
- `pages/auth/register.tsx` — the post-signup redirect now calls `verticalToOnboarding(vertical)` for NEW signups and falls back to `/dashboard` for logins + skipped-picker signups. Success step copy shows a vertical-aware hint ("Taking you to set up your {label}…").
- `Components/Page/CreatePaymentLink/index.tsx` — `linkKind` initial state now reads `?type=donation` from the URL, so fundraisers land on the Crowdfunding tab (verified: the Crowdfunding tile is pre-selected with the green check).
- **`Components/UI/OnboardingBanner.tsx` — new.** The compact "Welcome to Dynopay · {heading}" strip that renders on each destination when `?onboarding=1` is present. Uses `useVerticalAccent(vertical)` so the accent already reflects the user's intent (indigo / violet / volt-lime / obsidian). Contains a right-aligned **"Skip setup →"** control that `router.replace("/dashboard")` (verified: click routed to /dashboard).
- Banner wired into all 4 destinations:
  - `pages/creator.tsx` — `<OnboardingBanner vertical="creators" />` above status banner
  - `pages/pay-links/products/new.tsx` — above ProductEditor
  - `pages/create-pay-link.tsx` — above CreatePaymentLinkPage in the setup-complete branch
  - `pages/developer-keys.tsx` — above ApiKeysPage

**Verification (Playwright at 1440×900, logged in as hostbay):**
- `/creator?onboarding=1` → volt-lime banner "Claim your @handle" ✓
- `/pay-links/products/new?onboarding=1` → indigo banner "Add your first product" ✓
- `/create-pay-link?type=donation&onboarding=1` → violet banner "Launch your first campaign" + Crowdfunding tab pre-selected ✓
- `/developer-keys?onboarding=1` → obsidian banner "Grab your API keys" with volt-lime code icon ✓
- `/creator` (no query) → banner count 0 (correct SSR/CSR guarded) ✓
- Skip click → routed to /dashboard ✓
- 0 page errors across all 4 destinations ✓

**🟢 Backend vertical column — LIVE**
- Migration `addPurposeVertical.ts` applied to Railway Postgres (idempotent, CHECK constraint gates the 4 enum values, safe for pre-existing users returning NULL)
- `registerEmailStep1/2` + `registerPhoneStep1/2` accept and persist `purpose_vertical` via Redis stash keys (`reg-vertical:{email}`, `reg-vertical-phone:{mobile}`)
- `useVerticalAccent()` now resolves `override → Redux profile → localStorage → route heuristic → INDIGO`, so once a user picks a vertical it follows them across devices

**🟢 Phase 4 · Public marketing (`/for/{slug}`)**
- `SEOLandingPage.tsx` gains a vertical-aware eyebrow chip + CTA color:
  - `/for/merchants` — indigo CTA
  - `/for/fundraisers` — violet CTA
  - `/for/creators` — volt-lime CTA with dark ink
  - `/for/developers` — obsidian CTA with volt-lime text
- Country pages untouched (verticalOverride guard)

**🟢 Phase 3 · Wallet aurora hero**
- New `WalletTotalHero.tsx` renders a `$21,093.43` (indigo→violet→sky gradient) big number with mono eyebrow + 3 stat chips (Active Chains 13 · Supported 15 · Coverage 87%) — data from existing `useWalletData()`, zero new network traffic
- Only renders when the merchant has wallets so the empty-state banner still leads for first-timers
- Verified on preview: hero renders, existing chain cards preserved below, 0 page errors


## 2026-08-05 — Design audit + Phase 1 & 2 groundwork (Aurora extension)
- `backend/migrations/addPurposeVertical.ts` — additive, idempotent migration that adds `purpose_vertical VARCHAR(20)` to `tbl_user` + a named CHECK constraint (`tbl_user_purpose_vertical_chk`) allowing only `merchants | fundraisers | creators | developers | NULL`. Applied against the LIVE Railway Postgres via `ts-node --transpile-only`; verified with `/api/user/login` returning `purpose_vertical: None` for pre-existing users (no data corruption).
- `backend/models/userModels/userModel.ts` — added the column to the Sequelize model with the same enum comment.
- `backend/controller/userController.ts`:
  - `registerEmailStep1` now accepts `purpose_vertical` in the request body, whitelists it against the four enum values, and stores it in Redis at `reg-vertical:{email}` for use in Step 2. `registerEmailVerifyOtp` reads it back (with request-body fallback), passes it to `userModel.create()`.
  - Same pattern for `registerPhoneStep1` / `registerPhoneStep2` using `reg-vertical-phone:{mobile}` key.
- `Components/UI/_shared/useVerticalAccent.ts` — resolution priority updated: `override → user.purpose_vertical from Redux → localStorage → route heuristic → INDIGO merchants fallback`. Once a user signs up with a vertical picked, the accent tint follows them everywhere they use the app.

**🟢 Phase 4 · Public marketing — per-vertical accents on /for/{slug}**
- `Components/Page/SEO/SEOLandingPage.tsx` — now imports `useVerticalAccent()` and applies:
  - A new "FOR {vertical}" mono eyebrow chip at the top of the hero, tinted with the vertical's accent color (indigo merchants / violet fundraisers / volt-lime creators / obsidian developers)
  - The primary CTA button (`bgcolor`) uses `accent.color` with `accent.onColor` text — creators get dark ink on volt-lime, developers get volt-lime text on obsidian, etc.
  - Hover state uses `accent.colorDeep`.
- Country pages (`/accept-crypto-payments-in/*`) unaffected — the `verticalOverride` guard falls through to the default indigo when `content._kind !== "vertical"`.
- All four `/for/{merchants|fundraisers|creators|developers}` pages visually differentiate in the Playwright audit; no regression on the shipped `/` and `/fees`.

**🟢 Phase 3 · Wallet aurora total-hero**
- `Components/Page/Wallet/WalletTotalHero.tsx` — new component. Aurora gradient big-number hero (`$21,093.43` in indigo→violet→sky, mono `USD` label) + 3 stat chips (Active Chains / Supported / Coverage %) computed from the existing `useWalletData()` hook (zero new network traffic). Aurora glow blob top-right for depth.
- `Components/Page/Wallet/index.tsx` — renders `<WalletTotalHero />` only when `walletData.length > 0` so the empty-state warning banner still leads for first-time visitors. Hero is data-testid'd (`wallet-total-hero`) for future Playwright coverage.

**Verification (all in one run):**
- `tsc --noEmit` PASS on `/app` + `/app/backend`
- Live migration confirmed via `/api/user/login`
- Playwright at 1440×900: `/for/creators` volt-lime CTA · `/for/fundraisers` violet CTA · `/for/merchants` indigo CTA · `/for/developers` obsidian+volt CTA · `/wallet` hero renders with `wallet-total-hero` testid · `/creator` still 0 hydration errors after all changes


## 2026-08-05 — Design audit + Phase 1 & 2 groundwork (Aurora extension)

**Context:** After the shipped Aurora v3 pages (`/`, `/fees`) and v2026 dashboard (`/dashboard`), 30+ other pages were still on legacy MUI palette / one-off `sx` styles. Full audit report in `/app/memory/DESIGN_AUDIT_2026_08_05.md`.

**🟢 Phase 1 · Unblock**
- **Fixed hydration error on `/creator`** — MUI `useMediaQuery` returned different values SSR-vs-client for desktop viewports (flipping the sticky preview column) and Redux `profile` wasn't populated during SSR, so `hasHandle`-gated blocks rendered differently. Fix: `useMediaQuery(..., { noSsr: true })` + `mounted` gate on all Redux-dependent conditionals. Verified 0 page errors, no error overlay.
- **Extracted shared UI primitives** into `/app/Components/UI/_shared/`:
  - `index.ts` — single barrel export
  - `StatusPill.tsx` — 5-tone monospace chip (settled/pending/failed/info/neutral), dark-mode parity
  - `SurfaceCard.tsx` — 20 px radius aurora card with optional accent bar (indigo/violet/volt/coral)
  - `PillButton.tsx` — active/inactive timeframe & filter chip
  - `useVerticalAccent.ts` — the cross-cutting hook. Returns `{color, colorDeep, tint, gradient, onColor}` for the current route, auto-detects creators/fundraisers/developers/merchants from path, override supported.
- Callers now do a single import: `import { Eyebrow, HeadlineL, SurfaceCard, StatusPill, PillButton, useVerticalAccent } from "@/Components/UI/_shared"`.

**🟢 Phase 2 · Auth — purpose-driven signup wizard**
- **New `PurposePicker` component** (`/app/Components/UI/AuthLayout/PurposePicker.tsx`) — 4 pills opening registration: "Sell products / Fundraise / Get tips / Build with API".
  - **Auto-detects** the vertical from three sources (SEO attribution → prior localStorage pick → URL `?vertical=` query). If detected, the picker renders nothing and register jumps straight to the input step.
  - **Persists** the manual pick to `localStorage["dyno_purpose_vertical"]` so downstream `useVerticalAccent(override)` can tint the app for the user's stated intent.
  - **Zero backend dependency** in Phase 2 — the register API call now sends an optional `purpose_vertical` field that the backend safely ignores; the column will be added in Phase 3.
- `pages/auth/register.tsx` gains a new `Step = "purpose"` opening state; existing input/otp/success flow untouched.
- Left the July 2025 "Coinbase-clean" single-column auth card as-is (an earlier team explicitly removed the split-screen to reduce friction — reintroducing it would regress that decision).

**Verification:** eslint clean, `tsc --noEmit` PASS, Playwright verified purpose pills render (4/4), click "creators" → localStorage set + advances to input step, seeding `dyno_seo_attr` → picker hidden (0/4). No hydration errors.


## 2026-07-13 — Pre-push TypeScript gate + DigitalOcean deploy fix

**🔴 Fixed:** DigitalOcean auto-deploys had been failing 5× in a row (~37 min of wasted build time). Root cause: 8 `TS2339` errors in `backend/controller/payment/cryptoCheckout.ts` — the inline `RedisPaymentItem` interface was missing four donation-flow fields (`parent_link_id`, `donor_name`, `donor_message`, `is_anonymous`) that the code was already reading from the Redis session. Added the four optional fields; DO deploy `943e303e` went **ACTIVE** at 13:52 UTC.

**🟢 New:** Pre-push TypeScript gate so this class of error can never eat a DO build again.
- `scripts/preflight-tsc.sh` — shared entry point. In hook-mode it inspects staged files and only runs when `backend/**/*.ts`, `backend/tsconfig.json`, `backend/package.json`, or `backend/yarn.lock` are staged (typical frontend-only commits pay <1s). With `--force` it always runs `cd backend && tsc --noEmit` (~15–18s). Prints a loud, actionable failure message with the `--no-verify` bypass instruction.
- `.husky/pre-commit` + Husky v9 (added to root `devDependencies`) — fires the preflight on every `git commit`. E2E verified: intentionally regressed the fix and confirmed Husky blocks the commit (exit 1, `husky - pre-commit script failed (code 1)`, broken commit absent from `git log`).
- `.github/workflows/preflight.yml` — CI backstop. Fires on push/PR to `New-Onboarding2` and `main` when `backend/**` changes; runs the same `tsc --noEmit`. Catches the case where the hook is bypassed with `--no-verify` or a fresh clone pushes without running `yarn install`.
- `yarn preflight` — added as a script for manual invocation.
- Also refreshed `backend/yarn.lock` — was missing `openai@^6.46.0` (declared in `backend/package.json` but not resolved in the lockfile), which was making DO's Stage 3 `yarn install --frozen-lockfile` fall back to a slower plain `yarn install`. Now clean; should shave ~50s off future backend dep-install steps.

**Impact estimate:** each caught failure saves ~7½ min of DO build minutes. Today alone this would have caught 5 pushes = ~37 min. Ongoing cost: 0–18s per commit (0s when only frontend changes).



## 2026-07-12 (session 35) — First-run creator onboarding coach-mark  [option (d)]

**Feature:** A one-time coach-mark that points at the sidebar "Creator page" NEW pill for merchants who haven't claimed a handle yet — nudges them to set up their tip/donation link-in-bio.
- `Components/Layout/NewSidebar/index.tsx`: MUI `Popper` + `ClickAwayListener` + `Fade` coach-mark (`data-testid="creator-tour-popper"`) anchored to the creator NEW pill (callback ref on the `sidebar-new-creator` Box). Title "New: your creator page", body about claiming a handle for tips/donations, buttons **"Maybe later"** (`creator-tour-dismiss`) and **"Set it up"** (`creator-tour-cta` → `/creator`). Gated by: desktop only + profile loaded + `!hasClaimedCreator` + localStorage `dyno_creator_tour_seen` not set (dismiss/setup persists the flag so it shows once). 900ms delay so the anchor is measured. `AutoAwesomeRounded` sparkle icon (already imported).
- Shows for unclaimed merchants (e.g. qa.empty); correctly does NOT show for claimed merchants (e.g. hostbay).

**Verification:** eslint clean; `next build` PASS (70s); frontend restarted; `/dashboard` + all routes 200. In-browser logged-in verification pending frontend testing agent.


## 2026-07-12 (session 35) — Share-sheet on public creator page /{handle}  [option (b)]

**Feature:** Added a social share bar to the public creator page so creators/visitors can spread a tip-jar/donation page (virality is core to a creator product).
- `Components/Page/Creator/CreatorProfile.tsx`: new "SHARE THIS PAGE" bar (`data-testid="creator-share"`) with circular buttons — **Copy link** (`creator-share-copy`, shows check + "Link copied!" state via `helpers/copyToClipboard`), **X/Twitter**, **WhatsApp**, **Telegram**, **Facebook** (each `creator-share-{key}`, intent/share URLs, open in new tab), plus a **native Web Share** button (`creator-share-native`) rendered only after mount when `navigator.share` exists (gated to avoid SSR/client hydration mismatch). Canonical share URL built from new optional `siteUrl` prop (falls back to `window.location.href`). Icons via existing `@iconify/react` `mdi:*` pattern; `shareBtnSx()` is a plain sx-returning helper (not a nested component).
- `pages/[handle].tsx`: passes `siteUrl` into `CreatorProfile`.

**Verification:** eslint clean (the only warning is the PRE-EXISTING `LinkCard` nested-component at what's now L125 — untouched, ships in prod, doesn't fail build); `next build` PASS; `/hostbay` = 200 with all 5 share testids SSR'd; own Playwright confirms Iconify API 200 + 5 svg paths rendered + **0 console/0 hydration errors**; proper-timed screenshot shows all icons. NOTE: the built-in screenshot tool sometimes captures the icons blank because Iconify fetches glyphs async from the CDN after first paint — this is a screenshot-timing artifact only; real browsers (and DOM inspection) render them fine. This is the app-wide icon pattern (57 mdi usages), not new.


## 2026-07-12 (session 35) — Bridge Creator page ↔ donation / "Buy me a coffee"

**Problem (user report):** "I can't find donate button or buy me coffee option with swift crypto payment option on create page" — user's mental model is that donations/tips are a **Creator** feature. The donation link type + full DonationSettings (goal, presets = quick tip amounts, campaign image) already existed on `/create-pay-link`, and a donation link auto-becomes the "Featured tip box" on the public creator page (`CreatorProfile.tsx` L69). BUT the two were disconnected in the UX: `CreatorLivePreview` literally says "Create a donation link and it will feature at the top of your page" with **no button to do so**, and `/create-pay-link` had no way to deep-link into the donation type.

**Shipped (frontend-only, no backend/DB changes; safe for the LIVE prod DB):**
- `Components/Page/CreatePaymentLink/index.tsx`:
  - New effect: `/create-pay-link?type=donation` (also `?kind=donation` / `?template=donation`) preselects the Donation link kind (one-shot ref-guarded, create-mode only). This ALSO fixes the pre-existing `EmptyDataModel` "Accept a donation" chip (`?template=donation&amount=10`) which previously opened a *standard* link titled "Donation".
  - Added a creator-association hint banner (☕, lime-tinted, `data-testid="donation-creator-hint"`) shown when linkKind==='donation' in create mode: if the merchant has a handle → "featured at the top of your creator page {url}"; else → "Publish a creator page…" + a `Set up your creator page →` CTA (`data-testid="donation-creator-hint-cta"`) → `/creator`. Reads `state.userReducer.profile.handle` + `NEXT_PUBLIC_BASE_URL`.
- `pages/creator.tsx`: added a prominent "Collect tips & donations" CTA card (`data-testid="creator-donation-cta"` + button `creator-donation-cta-btn`) between the stat tiles and the form/preview columns → deep-links to `/create-pay-link?type=donation`. Imported `useRouter` + MUI `Button`.
- i18n via `t(key, { defaultValue })` fallback pattern (no locale files edited — English fallback works across all 6 locales).

**Also fixed in this session (stale audit P1s that were still genuinely open):**
- **F8 — create-pay-link live-preview fidelity** (`Components/UI/pay-link/LivePreviewPanel.tsx`): both preview CTA buttons ("Donate" + "Cryptocurrency") were green `#10B981`, but the real checkout CTA is lime-on-ink. Changed them to `theme.palette.primary.main` bg + `#0A0A0B` text so the preview matches what customers actually see. (`acceptedCount` was already wired to the real selected-currency count — no change needed.)
- **F11 — React hydration errors (#418/#425) on the donation checkout** (`Components/Page/Pay3Components/donationCampaign.tsx`): `timeAgo()` in the supporters wall calls `Date.now()` during render, so SSR (server clock) and client hydration (client clock) produced different "Xm ago" text → hydration mismatch (desktop/tablet only, where the 2-col supporters wall renders). Fix: added a `mounted` flag (set in a mount effect) and gate the relative-time `<Typography>` on `mounted` so SSR and first client paint agree, then the time fills in client-side. **Verified via own Playwright (headless_shell 1208): /pay/donation-demo now reports 0 console errors, 0 hydration errors** (was throwing #418/#425 before).

**Verification (donation↔creator bridge):** eslint clean on both files; `next build` standalone PASS (type-checked, 69s, 436 kB shared JS); frontend restarted; external `/create-pay-link?type=donation` + `/creator` = 200. Full logged-in flow (CTA → deep-link → donation preselected + hint) pending frontend testing_agent (awaiting user approval — authed SPA won't hydrate via simple token injection).



## 2026-07-11 (session 28-cont) — Creator page: flagship discovery + full feature expansion

**Problem:** The Creator vanity page (dynopay.com/{handle}) was fully built (backend + settings UI + public /{handle} SSR page) and heavily marketed on the landing, but had **zero discovery inside the app** — no sidebar link, no dashboard card, no header entry. The only way to find it was `/settings → left rail → Creator page`. Confirmed via grep across every layout/nav file.

**Shipped — full flagship treatment (option C + r2 + sparkles icon):**

**Backend** (`/app/backend/`)
- Migration `migrations/addCreatorFlagship.ts` (idempotent) — added `tbl_user.cover_image VARCHAR(500)` + `tbl_user.social_links JSONB DEFAULT '{}'::jsonb`. Ran ✅ on live Railway PG.
- Model `models/userModels/userModel.ts` — added the two fields.
- `controller/userController.ts`:
  - `updateCreatorProfile` — now also accepts `cover_image` (url or null, validated http(s)/`/api/static/`) and `social_links` (allowlist: `twitter/instagram/youtube/tiktok/website`, ≤200 chars, blocks `javascript:/data:/vbscript:`). Returns fresh row incl. new fields.
  - NEW `uploadCoverImage` — reuses existing multer `uploadImage`, returns `SERVER_URL/api/static/images/<file>`.
  - NEW `getCreatorStats` — `{total_visits, this_week_visits, supporters_count, has_handle}` from Redis (`creator-visits:<handle>` + daily 32-day-TTL buckets) + SQL for distinct donation supporters. Best-effort; never fails the request.
- `controller/payment/paymentLinkController.ts` `getCreatorProfile` — public route now returns `cover_image` + `social_links` and INCRs the Redis visit counters (fire-and-forget, ignored on failure).
- `routes/userRouter.ts` — 2 new routes: `POST /api/user/creator/upload-cover` (auth + multer) + `GET /api/user/creator/stats` (auth).

**Frontend — new files**
- `pages/creator.tsx` — first-class `/creator` route. Dashboard-style layout: status banner (live/draft) → 3 stat tiles (visits, 7-day, supporters) → 2-column desktop (form left, sticky Live Preview right).
- `Components/Page/Creator/CreatorLivePreview.tsx` — non-interactive visual clone of the public page driven by form state (browser chrome, cover, avatar, name, @handle, bio, social row, sample featured card, sample link, "Powered by").
- `Components/Page/Dashboard/CreatorPageCard.tsx` — right-column dashboard card with **3 smart states**:
  1. **No handle** → "Claim your creator page" with URL preview `.../yourname`, 3 benefits, lime "Claim my handle" CTA.
  2. **Handle set, not published** → "Publish your creator page" with URL pill + "Go live" CTA.
  3. **Live** → URL pill + Copy + View + 3 mini stats + "Manage page →" link.
  Live stats come from `GET /api/user/creator/stats`.

**Frontend — edits**
- `Components/Page/Creator/CreatorPageSettings.tsx` (rewrite) — added: `onChange` prop (broadcasts form state for live preview), cover image upload (drag-target + Remove + 10 MB limit), 5 social inputs, save now sends `cover_image` + `social_links`.
- `Components/Page/Creator/CreatorProfile.tsx` (public page) — renders new cover-image hero (140-180px, avatar overlaps bottom), social icon row below bio (`socialHref()` normalizes bare @handles to URLs per platform).
- `Components/Layout/NewSidebar/index.tsx` — new "Creator page" item in Payments section (after Pay Links), `AutoAwesomeRounded` sparkles icon, lime "NEW" pill visible only until merchant claims + publishes.
- `Components/Layout/NewSidebar/styled.tsx` (via new SidebarItem shape) + prefetch list includes `/creator`.
- `Components/UI/UserMenu/index.tsx` — new "View my creator page ↗" (published) / "Claim my creator page" (not yet) entry, sparkles icon. Opens `dynopay.com/{handle}` in new tab when handle exists.
- `Components/Page/Dashboard/DashboardRightSection.tsx` — inserts `<CreatorPageCard />` above `<GrowPanel />`.
- `Components/Page/Dashboard/EmptyStatePanel.tsx` — second CTA "Or claim your creator page →" for zero-payment merchants (`empty-state-claim-creator` testid).
- `pages/settings/index.tsx` — removed creator section from settings rail (it's now `/creator`). Added redirect: `/settings?section=creator` → `router.replace("/creator")` for backward-compat.

**i18n** — 32 keys added to `dashboardLayout.json` × 6 locales (en/es/fr/de/nl/pt) via idempotent script `scripts/i18n_add_creator_flagship.py`.

**Verified live** (Playwright + user JWT injection):
- `hostbay@moxx.co` (claimed + published) → sidebar "Creator page" (no NEW pill), dashboard shows "Your creator page" card w/ URL pill + Copy + View + 3 stats; `/creator` shows green status banner + stats + form + preview; UserMenu shows "View my creator page ↗".
- `qa.empty` (no handle) → sidebar "Creator page" **with NEW pill**, dashboard shows "Claim your creator page" card w/ benefits + lime CTA.
- Public `/hostbay` → SSR renders name + @handle (mono) + bio + empty-state.
- 3 endpoints healthy: `POST /api/user/creator/upload-cover` (403 without CSRF, expected), `GET /api/user/creator/stats` (401 without auth, expected), migration ran ✅.
- `next build` clean; internal + external URLs all 200.

**Fixed during build:** UserMenu edit was missing `import { useSelector } from "react-redux"` — caught by the ErrorBoundary on first Playwright run, re-imported, rebuilt.

---

## 2026-07-11 (session 28) — VERIFIED: checkout network-switch race fix (P0) + theme-flicker

End-to-end verification of the crypto-checkout race-condition fix in `Components/Page/Pay3Components/cryptoTransfer.tsx` (`requestSeqRef` latest-wins + `inFlightTargetsRef` dedupe + `setCryptoDetails({empty})` on switch + `loading`-gated address render).
- Method: temporarily restored the QA-only `pages/pay/crypto-preview.tsx` (real `CryptoTransfer` with mock props → NO live pool-address reservation), and drove it with Playwright request-interception mocking `/pay/getCurrencyRates`, `/pay/encrypt-payload`, `/pay/addPayment`. Simulated the exact bug: made USDT-TRC20's `addPayment` respond SLOWLY (2.2s) and a subsequent ETH selection respond fast (0.2s).
- RESULTS (all pass): (1) after TRC20→ETH switch the address shows ETH and STAYS ETH even after the slow TRC-20 response resolves — stale address never overwrites; (2) exactly 2 `addPayment` calls for the switch (no duplicate firing); (3) rapid double-click on the same coin (ETH) fires exactly 1 `addPayment` call (dedupe prevents the double-address bug the user reported).
- Theme-flicker fix (`contexts/ThemeContext.tsx` `useLayoutEffect` + `styles/globals.css` transitions) was already screenshot-verified in the prior session.
- Cleanup: temp `crypto-preview.tsx` removed again; full standalone `next build` + frontend restart; `/pay/crypto-preview` → 404, `/` → 200.


## 2026-07-11 (session 27h) — Infra: DigitalOcean fixed 2 instances → CPU autoscaling

Investigated (via DO API) why the app "needed two instances": the `dynopay` App Platform app is ONE service (`dynoredesign`) that was set to a fixed `instance_count: 2` (two replicas of the same container for HA/throughput) — not a hard requirement. Backend already supports multi-replica safely via `backend/utils/leaderElection.ts` (Redis lease → crons/BullMQ worker run on one leader only). The other DO app `moxxwebsite` is unrelated.
- Per user request, switched to **CPU autoscaling**: `apps-s-1vcpu-2gb` (shared, 2×, $50/mo) → `apps-d-1vcpu-2gb` (dedicated) with `autoscaling { min 1, max 3, cpu 80% }`. Floor ~$39/mo, bursts to $78/$117. (Autoscaling requires dedicated CPU; shared can't scale.)
- Applied via full-spec round-trip PUT; all 170 env vars preserved (verified). Triggered a redeploy ("app spec updated").
- App ID: f86b27dc-feb0-4a44-a4e9-ebd2053e0468 (region ams, repo databasedyno/DynoRedesign@New-Onboarding2, deploy_on_push).
- SECURITY: DO API token was shared in chat — user advised to rotate it.

## 2026-07-11 (session 27g) — Removed "Accept crypto by country" SEO pages (regulatory risk)

Decision (user): the programmatic per-country landing pages create regulatory exposure (targeting jurisdictions like UK/Turkey/Vietnam/Nigeria where crypto-payment promotion is restricted) that outweighs their modest SEO value. Removed entirely; kept the lower-risk industry/verticals pages.
- Deleted route `pages/accept-crypto-payments-in/[country].tsx` + all `data/seo-pages/countries/*.json` (US, UK, DE, IN, NG, BR, TR, VN).
- `Components/Layout/HomeFooter/index.tsx`: removed the `SEO_COUNTRIES` list + the "By country" footer block; SEO footer grid is now single-column (industries only).
- `utils/seoContent.ts` `getRelatedPages()`: added same-kind fallback so vertical pages still cross-link to each other now that the opposite (country) pool is empty.
- `Components/Page/SEO/SEOLandingPage.tsx`: related-links section header made kind-neutral ("Explore more / More guides for crypto merchants") since only vertical pages remain.
- Sitemap auto-updates via `getAllSEOPagesIndex()` — 0 country URLs, 6 vertical pages retained.
- **Verified:** build passes; country URLs → 404; `/for/ecommerce` → 200; footer shows only "For your industry"; sitemap country-count 0.
- Note: also flagged (not yet fixed) that the deleted country pages had STALE facts (1.5% fee / 12 chains) vs the site's current 0.5% / 15+ — the surviving vertical pages should be checked for the same drift.

## 2026-07-11 (session 27f) — Testimonials redesigned (metric-led, Stripe-style credibility)

User feedback: the testimonial section "looked common." Researched Stripe's approach (no quote-cards; they use logos + aggregate metrics + product-as-proof). User chose to KEEP testimonials but make them credible (option 3b).
- Rewrote `Components/Page/Home/TestimonialsV2.tsx`: **removed 5-star rows and stock-photo avatars** (fake headshots hurt trust on a payments site). Each card now **leads with a hard outcome number in monospace** (`0.8%` processing fee, `0` chargebacks, `30` countries) + uppercase mono label, a divider, the quote, then a **monogram** (initials, lime ring) attribution + chain pill. Featured card content vertically centered.
- Copy: added `testimonial{1,2,3}MetricLabel` keys to `landing.json` (6 locales); fixed stale "12 chains" → "15+ chains" in the 2nd quote across all 6 locales (brand consistency).
- Verified via screenshot (light mode); uses `swiss` tokens so dark mode inherits (accentText = lime in dark). Standalone build passed + restarted.
- Note: quotes remain placeholder/anonymous (user has no publishable logos/hard metrics yet). If real customer logos or volume/uptime figures become available, a Stripe-style "by the numbers" + logo band would be the stronger next step.

## 2026-07-11 (session 27e) — Dark-mode verify, network testids, /system-status + /payment i18n

**Dark-mode checkout (investigation, NO code change):** Reproduced with the real pay-header theme toggle — body → `#060606`, full card dark, lime accents legible. Confirmed WORKING. Prior "stays light" report was a test artifact (Pay3 header is ink-colored in light mode by design; wrong control was clicked).

**Network tile testids:** `cryptoTransfer.tsx` network tiles (USDT + RLUSD blocks) now expose `data-testid="network-tile-{TRC20|ERC20|POLYGON|XRPL}"` for E2E.

**i18n — /system-status + /payment/* result screens:**
- `pages/system-status.tsx`: `getStatusLabel()` now returns `t()` (operational/degraded/outage/partialOutage/unknown); uptime legend labels ("Operational/Degraded/No Data") + "Collecting data" now translated.
- Added keys `degraded, outage, partialOutage, unknown, noData, collectingData` to `apiStatus.json` in all 6 locales.
- `pages/payment/verify.tsx`: hardcoded "Verifying...." → `t("verifyingPayment")`; added `verifyingPayment` to `common.json` in all 6 locales.
- Verified `payment/success.tsx` + `payment/failed.tsx` already fully translated (keys present in all 6 locales) — no change needed.
- **Verified (screenshots):** EN + ES `/system-status` — ES shows "Todos los Sistemas Operativos", per-service "Operativo", legend "Operativo/Degradado/Sin datos", "Recopilando datos". Build passes + restarted.
- Note: Recent-incident card content + service names are dynamic backend data (`/status/*`) and stay English — out of i18n scope. `pages/payment/index.tsx` (legacy standard-payment method labels: Card/Bank Transfer/etc.) still hardcoded — deferred.

## 2026-07-11 (session 27d) — Landing refresh (creator vanity mockup) + /pay checkout lime polish

**Landing — surface Creator vanity pages** (`Components/Page/Home/UseCasesBento.tsx`)
- Replaced the old `MockPayLink` ("dynopay.me/ava-designs · one-time payment · $12") with new `MockCreatorPage`: avatar (lime ring, "A") + "Ava Designs" + "3 links · 128 supporters", a `dynopay.com/ava-designs` URL pill (lime handle), and a lime "Support my work →" CTA. Surfaces the new creator feature on the "Digital creators" use-case card.
- Copy updated in all 6 locales (`langs/locales/*/landing.json`): `useCase2Tag` "Wallet stats" → "Creator page"; `useCase2Description` → "Claim your own dynopay.com/handle and get paid with tips, donations and one-tap links."

**Standard /pay checkout — visual + UX polish (matches landing/donation)**
- Rebranded selection + primary CTA accents to brand lime `#CCFF00` (ink `#0A0A0B` text), matching landing & donation. Green (`#10B981/#12B76A`) kept ONLY for payment-detected/confirmed success states.
  - `pages/pay/index.tsx`: step-0 "Pay with Cryptocurrency" CTA → lime.
  - `Components/Page/Pay3Components/cryptoTransfer.tsx`: added ACCENT/ON_ACCENT/ACCENT_SOFT consts; coin tile + USDT/RLUSD network tile selected states → lime.
  - `pages/pay/demo.tsx`: mock step-0 CTA → lime (landing TryItNow embed + standalone consistency). Success/confirm buttons left green.
- Functional UX (additive, no payment/rate/polling logic changed):
  - (a) Low-fee hint under USDT networks: "TRC-20 usually has the lowest network fees." (`data-testid="lowfee-hint"`).
  - (c) Address row is now tap-to-copy (`data-testid="copy-address-row"`, hover lime border) + existing copy buttons kept.
  - (b/d) Trust strip below the QR/address card (`data-testid="checkout-trust-strip"`): "Funds go directly to the merchant · amount locked until the timer ends" (new keys `crypto.lowestFeeHint`, `crypto.trustNote` use defaultValue fallback).

**Verified:** full `next build` (standalone) passes + restarted. testing_agent (frontend, iteration_26.json) = 100%, 0 console errors on landing & /pay/demo. Evidence: creators "Support my work" btn rgb(204,255,0)/text rgb(10,10,10); demo CTA lime "Pay with Cryptocurrency"; real crypto screen (verified via temp `/pay/crypto-preview`, since removed): USDT tile lime border+bg, lowfee-hint renders; donations bar lime; dark-mode landing OK.

**Observation (pre-existing, NOT this task):** `/pay/demo` (and likely the real /pay checkout) page body stays light when the header theme toggle is switched to dark — MUI theme for the pay route may not follow the toggle. Lime CTAs stay legible. Flagged for a future dark-mode-checkout pass if desired.

## 2026-07-11 (session 27c) — Creator vanity pages (dynopay.com/{handle})

**DB (LIVE prod, additive migration — user approved):** `backend/migrations/addCreatorHandle.ts` added `handle` VARCHAR(50), `bio` VARCHAR(500), `creator_page_enabled` BOOLEAN to `tbl_user` + partial unique index `idx_tbl_user_handle_lower` on `LOWER(handle)`. Idempotent (`IF NOT EXISTS`). Model updated (`userModel.ts`). Verified columns exist.

**Backend endpoints:**
- Auth'd: `GET /api/user/creator/check-handle?handle=x` + `PUT /api/user/creator/profile` (userController `checkHandle`/`updateCreatorProfile`). Validation: 3–30 chars `^[a-z0-9][a-z0-9_-]{2,29}$`, lowercase, RESERVED_HANDLES guard (auth/admin/pay/fees/blog/etc.), case-insensitive uniqueness. Clears `profile:{id}` Redis cache on save. Routes in `userRouter.ts`.
- Public: `GET /api/pay/creator/:handle` (paymentLinkController `getCreatorProfile`, mounted on public `paymentRouter`). Returns `{creator:{name,handle,bio,photo}, links:[...]}` — user's donation campaigns (with raised/supporters/progress via `getDonationAggregates`) + reusable `createLink` links, expired filtered out, donations first.
- `getProfile` already returns handle/bio/creator_page_enabled (spreads dataValues).

**Frontend:**
- `pages/[handle].tsx` — root SSR catch-all, `getServerSideProps` fetches `${NEXT_PUBLIC_BASE_URL}/api/pay/creator/{handle}` → notFound on 404. `layout='home'` (public; default layout is auth-gated `client`). Dynamic per-creator OG/Twitter meta (og:type=profile) with `key` dedupe.
- `Components/Page/Creator/CreatorProfile.tsx` — avatar (lime ring), name, @handle (mono), bio, featured donation "Support" card (progress + CTA), link cards grid, empty state, "Powered by Dynopay".
- `Components/Page/Creator/CreatorPageSettings.tsx` — Settings → new "Creator page" section: handle input (dynopay.com/ prefix + debounced availability check + tick/cross), bio, publish toggle, live URL banner (copy + view). Fetches profile via `UserAction(USER_PROFILE_FETCH)` (raw action doesn't trigger saga — saga watches USER_INIT+crudType). Seeds only when `profile.user_id` present (empty `{}` default was seeding blank).
- `_app.tsx` OG/Twitter meta now all have `key`s so per-page (creator/SEO) Head overrides dedupe (fixed duplicate og:title/og:type).

**Verified:** migration + columns; all 3 endpoints via curl (check→claim→public); `/hostbay` SSR 200 + single OG tags + renders (empty-state); unknown handle → 404; existing routes (/fees,/settings) intact; settings section renders + seeds handle "hostbay" (Playwright + minted JWT — prod login is OTP-gated). NOTE: set test user hostbay@moxx.co handle="hostbay", page enabled, on LIVE DB → public at /hostbay.

**Still pending (user order after creator = 1,2,3):** 1) standard /pay checkout polish, 2) landing refresh, 3) dynamic OG for shared pay/donation links. Login-bounce fix still PREVIEW-only (deploy to go live).

## 2026-07-11 (session 27b) — Brand assets, chat chips, donation checkout redesign, copy fixes

**Branding / SEO**
- New favicon: ink `#0A0A0B` rounded square + lime `#CCFF00` wave mark (no more blue). Regenerated favicon.ico (PNG-in-ICO), favicon-16/32, apple-touch (`dynopay-favicon.png` 180), favicon-512. Generator: `/tmp/gen_brand.js` (uses exact mark path from `assets/Icons/Logo.tsx`).
- New rich link-preview card `public/og/dynopay-og.png` (1200×630, real wordmark + "Accept crypto payments in minutes." + coins + dynopay.com). Wired into `_app.tsx` OG + Twitter meta with `key` dedupe + og:image width/height. JSON-LD `logo` now uses square `favicon-512.png`.
- "13 chains" → "15+ chains" (StatWall, ChainsMarquee, HeroSwiss + comment).
- Footer copyright → "© {{year}} Dynotech. All rights reserved" (all 6 locales; dropped "Innovations, LDA").
- Fixed dangling SEO headings: `HomeSectionTitle` only highlights when `title` CONTAINS `highlightText`; SEO pages passed them separately. Fixed `title` to include the highlight in `SEOLandingPage.tsx` ("…to start accepting crypto", "Live in under 10 minutes").

**Support chat**
- Added 4 one-tap quick-reply chips under the greeting (`SupportChatWidget`); `send()` refactored to accept an optional message. Help page "Chat with us" CTA opens the widget (verified panel opens).

**Donation / Crowdfunding checkout redesign** (`Components/Page/Pay3Components/donationCampaign.tsx`)
- Rebuilt to crowdfunding-platform quality per design_agent blueprint (`/app/design_guidelines.json`): hero cover, big mono raised amount, animated lime progress bar, "% funded" lime pill (black text), mono stat row (supporters / funded / to-go), two-column layout (supporters wall left, sticky glass donate form right; column-reverse on mobile so the form is on top).
- Accent hardcoded to brand lime `#CCFF00` (pay theme's `palette.primary` is ink, NOT lime — earlier caused black pill/bar/button). All other colors theme-derived (works light+dark). Logic & all data-testids preserved.
- Added `pages/pay/donation-demo.tsx` (permanent QA preview, matches success-demo pattern; scenarios: crowdfunding/tip-jar/goal-reached).
- Verified: progress bar renders lime at 65% (aria-valuenow=65, bg rgb(204,255,0)); layout + pill correct.

**Answered (no code needed):** Google/GitHub users don't need a password or login OTP; if they want email+password too, Settings → Profile & Security already shows "Set password" (OTP-verified) via `UpdatePassword.tsx` (`has_password` false).

**PENDING (confirmed with user, not yet built):** standard payment checkout polish; creator vanity pages `dynopay.com/{handle}` (needs prod-DB migration — users table already has `username`+`referral_code`, migrations dir exists, no auto-sync on boot); dynamic OG for pay/donation/creator (SSR); landing-page refresh. Login-bounce fix is in PREVIEW only — needs prod deploy.

## 2026-07-11 (session 27) — Login bounce fix, Google popup, Profile/Settings merge, Help refresh

**🔴 P0 — "Login successful but stuck on login page" (iPhone, intermittent) — FIXED**
- Root cause (found via DigitalOcean prod RUN logs for the iPhone attempt): `POST /api/user/login → 200`
  (token issued server-side), the dashboard chunk loaded, then a **full-document** `GET /auth/login`
  (referer /dashboard) fired with **zero** authenticated API calls in between. i.e. `withAuth`
  (wrapping `ClientLayout`) read `localStorage.getItem("token")` as **null** on the freshly-loaded
  dashboard and redirected — an iOS Safari/Chrome localStorage write-visibility race right after the
  client-side SPA navigation.
- Fix: `Components/Page/Common/HOC/withAuth.tsx` — on first mount, retry the token check up to
  8× / 120ms (~960ms grace) and also react to cross-tab `storage` writes before redirecting to
  `/auth/login`. Hardened `pages/auth/login.tsx` post-login nav to only `router.replace("/dashboard")`
  once the token is confirmed in localStorage.
- Verified (Playwright + minted JWT): logged-in `/dashboard` stays put; logged-out `/dashboard`
  still redirects to `/auth/login`.

**Google sign-in stays on the SAME page (no "new page")**
- `pages/auth/login.tsx`: `handleGoogleLogin` now always uses the Google Identity Services popup
  token flow, briefly polling (≤2.5s) for the async GIS script to load, and **removed the
  `signIn("google")` full-page-redirect fallback** (that was the "new page"). Removed now-unused
  `next-auth/react` `signIn` import. Verified: clicking Google keeps URL on `/auth/login` and opens
  a popup.

**🟠 P1 — Profile & Settings consolidated**
- `/profile` now permanently client-redirects to `/settings?section=profile` (`pages/profile.tsx`).
- Removed the redundant "Profile" item from the desktop `UserMenu`; repointed the mobile
  `Header` drawer and legacy `Sidebar` profile links to `/settings?section=profile`.
- Verified: `/profile` → `/settings?section=profile` renders the Profile & Security section.

**Help & Support refresh + Chat CTA**
- `Components/Page/HelpAndSupport/index.tsx`: replaced hardcoded `#4F46E5`/fixed-px widths with
  theme-driven, responsive CSS-grid layout (article cards + search). Added a "Chat with us" primary
  CTA that dispatches `dynopay:open-support-chat` to open the existing AI support widget, alongside
  an "Email us" card. Verified: CTA opens `support-chat-panel`.

**Not a code change**
- GitHub authorize-screen logo is set in the user's GitHub OAuth App settings (they will upload it).
