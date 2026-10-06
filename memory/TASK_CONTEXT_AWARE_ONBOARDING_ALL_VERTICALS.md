# TASK — Context-aware first-run onboarding for EVERY signup vertical
_Written 2026-10-01 for the next agent. Read fully before touching code. English._

---

## 0. TL;DR

The signup "What brings you to Dynopay?" picker has four pills: **Merchant · Fundraiser · Creator · API developer**
(`Components/UI/AuthLayout/PurposePicker.tsx`, persisted to `tbl_user.purpose_vertical` + localStorage `dyno_purpose_vertical`).

Only **two** of the four get a context-aware guided setup today:

| Vertical | Where signup drops them | Guided 5-step wizard? | 2FA · profile · payout wallet covered? | Verdict |
|---|---|---|---|---|
| merchants | `/get-started` (default track) | ✅ | ✅ | baseline — OK |
| developers | `/get-started` (developers track: secure → about → payouts → **API key** → **test payment**) | ✅ (fixed 2026-10-01, **not yet verified by testing_agent**) | ✅ | OK pending test |
| creators | `/creator?onboarding=1` → **SSR 302** → `/storefront?tab=page` (**query string is dropped**) | ❌ | ❌ | **gap** |
| fundraisers | `/create-pay-link?type=donation&onboarding=1` | ❌ | ❌ | **gap** |

Answer to the user's question *"are the rest context aware also?"* → **No.** Creators and fundraisers bypass the
wizard entirely, skip security + payout setup, and land on a surface they can't fully use yet
(creator: no handle, so no public page; fundraiser: can design a campaign but hits the
"Activation required — add business details + a payout address" box). The next time they open `/dashboard`,
`FirstRunRedirect` pushes them into the **generic merchant** wizard whose step 4 says "Your first payment link" —
wrong vocabulary for both.

**Goal of this task:** one wizard, four tracks. Steps 1–3 stay shared (secure → about you → where payouts go);
steps 4–5 are swapped per vertical, exactly the pattern already shipped for developers.

---

## 1. Why this matters (UX rationale)

* Steps 1–3 are not optional for anybody: 2FA is mandatory (14-day deadline, hard wall), payouts need a wallet,
  the public page / campaign needs a brand name + country. Routing creators/fundraisers around the wizard just
  delays the same work to a worse moment (an "Activation required" dead-end instead of a guided step).
* The wizard already resumes from REAL data (`useSetupProgress`), has a "Do this later" escape hatch on every step,
  a progress ring, mobile stepper, analytics, and i18n. Reusing it keeps all four verticals consistent and
  measurable (per-vertical activation funnels via `trackOnboarding`).
* Vocabulary must match the pill the user clicked: a creator should read "Claim your @handle", a fundraiser
  "Launch your first campaign" — never "payment link".

---

## 2. Current implementation map (read these files first)

### Signup → destination
* `pages/auth/register.tsx`
  * L~515: after OTP success → `verticalToOnboarding(vertical)?.path ?? "/dashboard"` (1.5 s delay).
  * L~1133: success copy "Taking you to set up your {label}…" uses `dest.label`.
* `helpers/verticalOnboarding.ts` — the `DESTINATIONS` map (quoted above). `creators` → `/creator?onboarding=1`,
  `fundraisers` → `/create-pay-link?type=donation&onboarding=1`, `merchants`/`developers` → `/get-started`.
* `pages/creator.tsx` — `getServerSideProps` redirect to `/storefront?tab=page` with a **hard-coded destination** →
  `?onboarding=1` is lost → `OnboardingBanner vertical="creators"` in `Components/Page/Storefront/PageTab.tsx` never renders.
* `Components/UI/OnboardingBanner.tsx` — "Welcome, let's set up your X" strip; renders only when `router.query.onboarding === "1"`.
  Mounted in: `Storefront/PageTab.tsx` (creators), `pages/pay-links/products/new.tsx` (merchants), `pages/create-pay-link.tsx` (fundraisers),
  `pages/developer-keys.tsx` (developers). After this task only the fundraiser/merchant deep-links keep a reason to exist.

### The wizard (`Components/Page/GetStarted/`)
* `useSetupProgress.ts` — single source of truth. `SetupTrack = "default" | "developers"`; `track` derived from
  `userProfile.purpose_vertical` (fallback localStorage `dyno_purpose_vertical`). Step done-flags:
  `secure=twoFaEnrolled`, `about=profileComplete`, `payouts=hasWallet`, `link=hasLink|hasApiKey`,
  `share=hasPayment || (hasLink&&hasShared) | hasPayment||hasTestPayment`. Module-level fetch dedupe for links/keys/profile.
  Exposes `ready`, `firstIncomplete`, `doneCount`, `track`, etc.
* `stepMeta.ts` — `stepLabel/stepDesc/stepIcon(t, key, track)` + `STEP_TRACK_KEY` (analytics).
* `index.tsx` (GetStartedWizard) — URL-driven (`?step=`), guards (money steps need 2FA; step 5 needs step 4),
  `isDev` branches render `StepApiKey`/`StepTestPayment` instead of `StepFirstLink`/`StepShare`; `finishDev()` → `/developer-keys`.
* `WizardShell.tsx` — chrome (rail, phone stepper, glass card). Title "Set up Dynopay", subtitle "Five short steps…".
* Steps: `StepSecure`, `StepAboutYou`, `StepPayouts`, `StepFirstLink` (+ `linkFromRecord`, `CreatedLink`), `StepShare`,
  `StepApiKey`, `StepTestPayment`. Props convention: `{ progress: SetupProgress; onBack; onNext }` (+ step-specific callbacks).
* `GettingStartedHero.tsx` (dashboard hero) + `ProgressRing` (sidebar) — already branch on `track === "developers"` (`hasStep4`).
* `FirstRunRedirect.tsx` — on `/dashboard`, once per session, when `companyCount===1 && !hasWallet && !hasLink && !hasPayment` → `/get-started`.

### Reusable building blocks for the new steps
* **Handle claim**: `Components/UI/OnboardingFlow/HandleClaimNudge.tsx` — availability check `GET /api/user/creator/check-handle`,
  claim via `PUT /api/user/creator/profile {handle}` (`API_ENDPOINTS.creator.profile`), then `UserAction(USER_PROFILE_FETCH)` + `mutateStorefront()`.
  `AutoClaimHandle.tsx` (dashboard) finalises a handle reserved pre-signup from localStorage.
* **Campaign (donation link)**: `Components/Page/CreatePaymentLink/index.tsx` — `linkKind` from `?type=donation`; the
  "Activation required" box (L~1540-1560) pushes to `/dashboard?onboarding=1`. Reuse its create payload for `link_type:"donation"`
  (title, goal, currency, presets, min amount, optional end date). Existing donation QA link: `/pay?d=zEJtCe` (link 611, company 1).
* **Share surface**: `StepShare.tsx` (copy / QR / native share / open) + `markLinkShared(companyId)`.
* **Vertical accents / type**: `Components/UI/_shared/useVerticalAccent.ts` (`export type Vertical`).

### i18n
`langs/locales/{en,de,es,fr,nl,pt}/dashboardLayout.json` → `gs.*` block (L~400+). NOTE: the developer-track keys
(`gs.stepApiKey`, `gs.stepTestPayment`, `*Desc`) currently exist only as `defaultValue` in code — add them to the JSON files too.

---

## 3. Target UX (what "done" looks like)

```
Step  default (merchants)          developers                creators                       fundraisers
 1    Secure your account   ───────────────── shared (StepSecure) ─────────────────────────────────────────
 2    About you             ───────────────── shared (StepAboutYou) ───────────────────────────────────────
 3    Where payouts go      ───────────────── shared (StepPayouts) ────────────────────────────────────────
 4    Your first payment    Your API key              Claim your @handle               Your first campaign
      link                  (sandbox key)             (dynopay.com/handle)             (goal · presets · story)
 5    Share it              Make a test payment       Share your page                  Share your campaign
      → /dashboard          → /developer-keys         → /storefront?tab=page           → /pay-links (campaign row)
```

### Per-track copy (en defaults; add to all 6 locales)
| key | creators | fundraisers |
|---|---|---|
| gs.stepHandle / Desc | "Claim your @handle" / "Your public page lives at dynopay.com/handle" | — |
| gs.stepSharePage / Desc | "Share your page" / "Copy, QR or post it — tips land in your wallet" | — |
| gs.stepCampaign / Desc | — | "Your first campaign" / "A goal, a story and suggested amounts" |
| gs.stepShareCampaign / Desc | — | "Share your campaign" / "Copy, QR or send it — then watch the goal fill" |
| gs.wizardSubtitle | unchanged ("Five short steps…") | unchanged |

Icons (`stepIcon`): creators step4 `at-sign`, step5 `megaphone`; fundraisers step4 `hand-heart` (or `target`), step5 `send`.

### UX rules (non-negotiable, inherited from the shipped wizard)
1. Never block: "Do this later" on every step → `/dashboard`; resume from real data on return.
2. Money steps (3→5) locked until a 2FA factor is enrolled (existing guard in `index.tsx`).
3. Step 5 unreachable until step 4's artefact exists (handle / campaign / key / link).
4. Step 4 must offer **"use what you already have"** when the artefact already exists (mirror `StepFirstLink`'s
   `gs-existing-link` / `gs-use-existing` pattern): creators who already own a handle see it with "Keep @handle →";
   fundraisers with an existing donation link see it with "Use this campaign →".
5. Keep each new step component **small**: form + one primary CTA + one escape ("Open the full editor/builder →").
   Full editors stay where they are (`/storefront?tab=page`, `/create-pay-link?type=donation`); the wizard only collects the minimum.
6. Celebrate once at step 5 completion (confetti is allowed ONLY in onboarding — see PRD "Confetti scope-down").
7. Mobile 390 px: phone stepper + single-column; verify with the 390×844 viewport.
8. All interactive elements get `data-testid` (see §6).
9. Vertical vocabulary everywhere the wizard is summarised: `GettingStartedHero`, sidebar ring tooltip, "Needs attention" items.

### Decisions to confirm with the user via `ask_human` BEFORE coding (recommended answers in bold)
* Q1 — Creator step 4 scope: **handle only** (fast, reuses HandleClaimNudge) vs handle + display name/bio/cover.
* Q2 — Fundraiser step 4 scope: **mini-form (title, goal, currency, 3 preset amounts)** vs embedding the full campaign builder.
* Q3 — Where "Finish" lands per track: **creators → /storefront?tab=page, fundraisers → /pay-links, developers → /developer-keys (unchanged), merchants → /dashboard (unchanged)**.
* Q4 — Should the `OnboardingBanner` deep-link surfaces stay (merchant product page, fundraiser builder) — **keep; harmless**. Remove the creators one (dead code after this change) only if the user agrees.

---

## 4. Step-by-step implementation plan (each step independently testable)

> Ordering: hard parts first (track plumbing + progress flags), then the two new step pairs, then wiring/copy/polish.
> Frontend here is a **production Next build** (no hot reload) — see §7 for the rebuild loop. Do all code for a
> phase, rebuild ONCE, then test.

### Step 0 — Verify the three fixes from the previous fork (STILL PENDING — do this first)
Code is complete and builds; `testing_agent` was never run. Brief it (frontend-only, read-only against prod DB):
1. **Settings chunk fallback** — `/settings` Profile & Security tabs render; simulate a `ChunkLoadError`
   (Playwright `page.route('**/_next/static/chunks/**', r => r.abort())` on one chunk after first load) → expect
   `DynamicFallback` Retry/Reload UI (not an endless spinner); `_app.tsx` `reloadOnceForStaleChunk` reloads once (sessionStorage guard).
   Files: `utils/staleChunkReload.ts`, `Components/UI/DynamicFallback.tsx` (`lazyLoading`), `pages/_app.tsx` L89-90, L145, L229, `pages/settings/index.tsx` L24.
2. **Notification ordering/timestamps** — `/notifications`: rows show their OWN event time (`created_at`), newest → oldest;
   a pending row never appears below its own received row; opening a *pending* notification shows the pending state in
   `TransactionDetailsModal` (`tx-status-timeline[data-status]`), a *settled* one shows settled. Files:
   `Components/Page/Notification/NotificationInbox.tsx` L93, L279-289; `Components/Page/Transactions/TransactionDetailsModal.tsx`.
   (iteration_245 already covered modal-state coherence — re-check ordering only.)
3. **Developer onboarding wizard** — login as the read-only developer fixture `gidineter@gmail.com` (user 361, company 368,
   `purpose_vertical=developers`, no 2FA/keys/links; password unknown → use API token injection or mock `/api/user/profile`
   to return `purpose_vertical:"developers"` on the owner account) → `/get-started` shows rail steps
   `gs-rail-step-link` labelled "Your API key" and `gs-rail-step-share` "Make a test payment"; `gs-step-apikey` renders at step 4;
   steps 4/5 locked until 2FA. Do NOT create real keys (prod DB) — mock `POST /api/userApi/createApiKey`.
Credentials & recipes: `/app/memory/test_credentials.md` (top block). Expect report `test_reports/iteration_246.json`.

### Step 1 — Track plumbing (no UI yet)
Files: `useSetupProgress.ts`, `stepMeta.ts`.
* `export type SetupTrack = "default" | "developers" | "creators" | "fundraisers"`;
  `const track = (["developers","creators","fundraisers"] as const).includes(vertical) ? vertical : "default"`.
* New data flags:
  * `hasHandle = Boolean(userProfile?.handle)` (creator profile handle is on the user profile; confirm field name via
    `GET /api/user/creator/profile` and `HandleClaimNudge` L61 `profile?.handle`). Also consider company-scoped handle (storefront) — check `Storefront/PageTab.tsx` L25 comment.
  * `campaignLinks = paymentLinks.filter(l => l.link_type === "donation")`; `hasCampaign`, `newestCampaign`.
  * `hasPageShared` via a new localStorage key `dyno_gs_pageshared:<companyId>` (mirror `GS_SHARED_KEY` + `markLinkShared` → add `markPageShared`), or simply reuse `GS_SHARED_KEY` (simpler — recommended).
* Steps array per track:
  * creators: `link: hasHandle`, `share: hasPayment || (hasHandle && hasShared)`
  * fundraisers: `link: hasCampaign`, `share: hasPayment || (hasCampaign && hasShared)`
* `ready`: no new fetches needed (handle comes with the profile already fetched; campaigns come from the links fetch).
* `stepMeta.ts`: extend `stepLabel/stepDesc/stepIcon` with the creators/fundraisers branches (table in §3).
* Return `hasHandle`, `hasCampaign`, `newestCampaign` from the hook.
**Test:** `npx tsc --noEmit` clean; unit-ish check in browser console not possible (prod build) → verify in Step 5 together.

### Step 2 — Routing
Files: `helpers/verticalOnboarding.ts`, (optionally) `pages/creator.tsx`.
* `creators.path = "/get-started"`, `fundraisers.path = "/get-started"`; keep `label`s (register success copy still uses them).
* Update the header comment block.
* `pages/creator.tsx`: optional — forward the incoming query in the SSR redirect (`context.query`) so deep-links keep `?onboarding=1`. Low priority once signup no longer uses it.
**Test:** `curl -I <preview>/creator` still 302 → `/storefront?tab=page`; register-success copy unchanged ("Taking you to set up your creator page…").

### Step 3 — Creators: `StepClaimHandle.tsx` (step 4) + share variant (step 5)
Files: new `Components/Page/GetStarted/StepClaimHandle.tsx`; `StepShare.tsx` gets a `variant?: "link" | "page" | "campaign"` prop (copy + testids unchanged, `link.url` = `${siteUrl}/${handle}` for pages).
* Props `{ progress, onBack, onNext }`.
* If `hasHandle`: summary card "Your page: dynopay.com/@handle" (`gs-existing-handle`) + "Keep it →" (`gs-use-existing-handle`) + "Open page editor" link → `/storefront?tab=page`.
* Else: input prefilled from company name slug, live availability (`GET /user/creator/check-handle?handle=`, debounce 350 ms, same rules as `HandleClaimNudge`), hint line, primary "Claim @handle" → `PUT /user/creator/profile {handle}` → `UserAction(USER_PROFILE_FETCH)` → `onNext()`.
* Error inline (`gs-handle-error`).
* Step 5 (`index.tsx`): `current==="share" && track==="creators"` → `<StepShare variant="page" link={{url: pageUrl, …}} onDone={() => router.push("/storefront?tab=page")} />`; hide "Create another" for pages.
**Test (mocked writes!):** Playwright with `page.route('**/api/user/creator/profile', PUT → {success:true})` + `page.route('**/api/user/profile', GET → inject purpose_vertical:"creators", handle:null)`; expect `gs-step-handle`, type handle, `gs-handle-claim` enabled when available, after claim → step share with `gs-share-url` containing the handle.

### Step 4 — Fundraisers: `StepFirstCampaign.tsx` (step 4) + share variant (step 5)
Files: new `Components/Page/GetStarted/StepFirstCampaign.tsx`; `index.tsx` wiring; reuse `linkFromRecord` for existing campaigns.
* If `hasCampaign`: existing-campaign card (`gs-existing-campaign`: title, goal progress, URL) + "Use this campaign →" (`gs-use-existing-campaign`) + "Create a new one instead" (`gs-create-new-campaign`).
* Else mini-form: title (`gs-campaign-title`), goal amount (`gs-campaign-goal`) + currency (brand currency from `GET /api/user/display-currency?company_id=`), 3 preset chips editable (`gs-campaign-preset-1..3`), optional "Tell your story" textarea (`gs-campaign-story`), primary "Create campaign" (`gs-campaign-create`). Build the payload exactly as `CreatePaymentLink/index.tsx` does for `link_type:"donation"` (find the submit handler + endpoint there; keep server-side validation unchanged).
* Escape link: "Need rewards, end date or a cover image? Open the full campaign builder →" → `/create-pay-link?type=donation`.
* Payout gate: like `StepFirstLink` (`data-gated` when `!hasWallet`, `gs-link-go-payouts` equivalent `gs-campaign-go-payouts`).
* Step 5: `<StepShare variant="campaign" …>` with `onDone → /pay-links`, "Create another" → step 4 fresh form.
**Test (mocked writes!):** route the create endpoint → return a fake donation link record; expect transition to share with campaign URL; verify `gs-existing-campaign` path by mocking the links fetch to include a `link_type:"donation"` row.

### Step 5 — Wire `index.tsx` + shell polish
* Replace `isDev` branching with a `track` switch for steps 4/5; `finish` destination per track (Q3).
* Guards: step 5 requires `hasHandle` (creators) / `hasCampaign` (fundraisers) — extend the existing effect at L63-67.
* `WizardShell` — no structural change; optional eyebrow "Getting started · Creator" (`gs.eyebrowTrack.<track>`).
* `GettingStartedHero.tsx` + any place using `hasStep4`: derive from track (`hasHandle`/`hasCampaign`).
* `FirstRunRedirect.tsx`: condition unchanged (wallet/link/payment) — a creator with a handle but no wallet should still be guided; confirm no loop with the finish destinations (`GS_AUTO_OPEN_KEY` set on finish — keep).
* Analytics: `trackOnboarding(..., metadata: { surface:"wizard", track })` on step_completed/dismissed.
**Test:** rebuild → smoke screenshot `/get-started` on the owner account (default track) still renders 5 steps; then testing_agent (§6).

### Step 6 — i18n
Add to `gs` in all 6 `langs/locales/*/dashboardLayout.json`: `stepApiKey`, `stepApiKeyDesc`, `stepTestPayment`, `stepTestPaymentDesc` (currently code-only), plus the new creators/fundraisers keys and any `StepClaimHandle`/`StepFirstCampaign` strings. Run the repo's i18n check if present (`ls scripts/qa | grep -i i18n`; `memory/i18n/`).
**Test:** `node -e "for (const l of ['en','de','es','fr','nl','pt']) JSON.parse(require('fs').readFileSync('langs/locales/'+l+'/dashboardLayout.json'))"`.

### Step 7 — Dead code / banner cleanup (only after Q4)
* `Components/UI/OnboardingBanner.tsx` `VERTICAL_META.creators` + its mount in `Storefront/PageTab.tsx` become unreachable from signup → remove or keep per user.
* Update comments in `verticalOnboarding.ts`, `useSetupProgress.ts`, `register.tsx` L511-513.

---

## 5. Acceptance criteria

* Signing up with ANY of the four pills lands on `/get-started` with step 1 "Secure your account".
* Rail/stepper labels for steps 4–5 match the chosen vertical (table §3); dashboard hero + sidebar ring use the same labels.
* Creators: can claim an available handle in step 4 (or keep an existing one), step 5 shares `dynopay.com/<handle>`, Finish → `/storefront?tab=page`.
* Fundraisers: can create a donation link with goal + presets in step 4 (or reuse one), step 5 shares it, Finish → `/pay-links`.
* Developers/merchants: unchanged behaviour (regression).
* Steps 3–5 stay locked until 2FA; step 5 locked until step 4's artefact exists; "Do this later" works on every step.
* Returning user resumes at the first incomplete step (`?step=` absent → `firstIncomplete`).
* No `?onboarding=1` reliance anywhere on the signup path.
* `npx tsc --noEmit` (root + `/app/backend`) clean, `next build` OK, ESLint 0 new warnings; 6 locale JSONs valid.
* 390 px mobile: stepper visible, no horizontal overflow.

---

## 6. Test plan (testing_agent brief — frontend only, prod DB ⇒ MOCK EVERY WRITE)

Login recipe, TOTP, token injection and the developer fixture are in `/app/memory/test_credentials.md` (top block).
The wizard track comes from `GET /api/user/profile → purpose_vertical`; force a vertical **without writing** by
`page.route('**/api/user/profile', …)` and rewriting `purpose_vertical` (+ `handle:null` for the creator case), or by
setting localStorage `dyno_purpose_vertical=<vertical>` before the profile loads (fallback path).
Use an EMPTY brand of the owner account (`last_company_id` 228 "QA HashKeys Brand" or 219) so wallet/link/payment flags are false.

Mocks to always install: `PUT **/api/user/creator/profile`, `GET **/api/user/creator/check-handle*`,
the donation-link create endpoint, `POST **/api/userApi/createApiKey`, `**/api/pay/addPayment`, `**/api/pay/verifyCryptoPayment*`.

data-testids (existing): `gs-wizard[data-step]`, `gs-rail-step-{secure|about|payouts|link|share}[data-done]`, `gs-stepper-*`,
`gs-do-later`, `gs-step-secure|about|payouts|link|share|apikey|testpay`, `gs-share-url|copy|download-qr|share-native|open`, `gs-existing-link`, `gs-use-existing`.
New (this task): `gs-step-handle`, `gs-handle-input`, `gs-handle-hint`, `gs-handle-error`, `gs-handle-claim`, `gs-existing-handle`, `gs-use-existing-handle`,
`gs-step-campaign`, `gs-campaign-title`, `gs-campaign-goal`, `gs-campaign-currency`, `gs-campaign-preset-{1,2,3}`, `gs-campaign-story`,
`gs-campaign-create`, `gs-campaign-error`, `gs-campaign-go-payouts`, `gs-existing-campaign`, `gs-use-existing-campaign`, `gs-create-new-campaign`, `gs-campaign-open-builder`.

Scenarios: (A) creators fresh → claim → share → finish lands on storefront; (B) creators with existing handle → keep → share;
(C) fundraisers fresh → create → share → finish lands on /pay-links; (D) fundraisers existing donation link → use → share;
(E) developers regression (step 0 #3); (F) merchants regression (owner account, brand 1 → all done / brand 228 → resume at secure);
(G) mobile 390 for A and C; (H) "Do this later" from step 4 of each new track → /dashboard, no redirect loop (sessionStorage `gs_autoopen_seen=1`).

---

## 7. Build / run notes for this pod (IMPORTANT)

* App shape: Next.js at `/app` root (NOT `/app/frontend/src`), Express/TS backend at `/app/backend` (ts-node behind uvicorn proxy :8001 → :3300). Preview URL = `SERVER_URL` in `/app/backend/.env` (`https://secure-passphrase-15.preview.emergentagent.com`). There is NO `/app/frontend/.env`.
* **Frontend is a production build** (`FRONTEND_MODE=production`, dist `.next-prod`). Source edits are NOT live until:
  `cd /app && NEXT_DIST_DIR=.next-prod-new NODE_OPTIONS=--max-old-space-size=8192 node_modules/.bin/next build` (≈2.5 min, run in background, poll the log)
  → `sudo supervisorctl stop frontend && rm -rf .next-prod && mv .next-prod-new .next-prod && sudo supervisorctl start frontend`.
* Typecheck: `cd /app && npx tsc --noEmit`; backend `cd /app/backend && npx tsc --noEmit`. Lint: `npx next lint` (pre-existing warning at `pages/documentation.tsx` ~L1348 is not ours).
* **The pod is wired to the LIVE production DB (SAFE MODE)** — never create real users/keys/links/handles in tests; mock writes. Background jobs + outbound email are OFF. Always send a browser User-Agent (bot protection 403s curl/python UAs).
* Do not run git write commands; the user ships via "Save to GitHub" → DigitalOcean droplet. `emergent__send_to_deployer` does not apply.
* Memory files to update when done: `memory/PRD.md` (entry), `memory/CHANGELOG.md`, this file (status), `memory/test_credentials.md` if any QA fixture is added.

---

## 8. Status log
* 2026-10-01 — Investigation complete; this doc written. **No code changed for this task yet.** Step 0 (testing_agent for the three previous fixes) still outstanding. Awaiting user answers to Q1–Q4 (§3) before Step 1.

* 2026-10-01 (pod 31539451) — **IMPLEMENTED + testing_agent VERIFIED (all 4 tracks + skip fallback + focused-layout bug fix).** User confirmed decisions Q1a/Q2a/Q3a/Q4a and testing order "build all, test together at end". Code done, tsc 0, ESLint clean, prod build swapped. **auto_frontend_testing_agent: PASS — creators rail "Claim your @handle"/"Share your page" + handle step (existing-handle path on brand 1 "the-dev-store"); fundraisers "Your first campaign"/"Share your campaign" + full campaign form; merchant regression (default payment-link step) intact; 0 console errors.**
  - DONE — Step 1 (track plumbing): `useSetupProgress.ts` SetupTrack += creators|fundraisers; new flags `hasHandle`/`handle` (via `useStorefrontProfile`), `hasCampaign`/`newestCampaign` (donation links); per-track steps 4/5; `ready` waits on storefront profile for creators (`handleSettled`). `stepMeta.ts` creators/fundraisers labels+descs+icons (at-sign/megaphone, hand-heart/send).
  - DONE — Step 2 (routing): `helpers/verticalOnboarding.ts` creators+fundraisers → `/get-started`.
  - DONE — Step 3 (creators): NEW `StepClaimHandle.tsx` (check-handle + PUT creator/profile, existing-handle "Keep @handle" path). `StepShare.tsx` gained `variant` prop (link|page|campaign) + optional `onCreateAnother`/`doneLabel`.
  - DONE — Step 4 (fundraisers): NEW `StepFirstCampaign.tsx` (mini donation form: title/goal/currency/3 presets/story + wallet gate mirroring StepFirstLink; `campaignFromRecord` export; existing-campaign "Use this campaign" path).
  - DONE — Step 5 (wiring): `index.tsx` track switch for steps 4/5, per-track share guards (`shareArtefactReady`), per-track Finish (`finishTo`): creators→/storefront?tab=page, fundraisers→/pay-links, developers→/developer-keys, merchants→/dashboard. `GettingStartedHero.tsx` `hasStep4` now track-aware. `claimedHandle` state avoids a guard race after claim.
  - DONE — SKIP FALLBACK (user-requested): `pages/auth/register.tsx` — a skipped PurposePicker (null vertical) now routes NEW signups to `/get-started` (default track = payment link→share), not a bare /dashboard. Success copy `accountReadySetup` added.
  - DONE — Step 7 (cleanup, Q4a): removed the dead creators `<OnboardingBanner>` mount + import in `Storefront/PageTab.tsx`.
  - DONE — i18n: all new strings are code `defaultValue` (English), matching the already-shipped developer-track convention; NO JSON locale edits (6 JSONs untouched, still valid). Non-English locales fall back to English for the new gs.* keys (same as dev track). **Next agent: optionally add the gs.* creator/fundraiser/dev keys to langs/locales/*/dashboardLayout.json for real translations.**
  - DONE — icons: merged at-sign, megaphone, hand-heart, target, circle-x into styles/iconBundle.json (offline render).
  - BUILD: `.next-prod` rebuilt + swapped twice (compiled ✓).

* 2026-10-01 (pod 31539451) — **BUG FIX (user-reported): onboarding flow interrupted by competing nav/CTAs → FOCUSED ONBOARDING LAYOUT.**
  - User: while in `/get-started`, clicking the header "payout address setup" chip, the "Start accepting payments" fee-free banner CTA, OR any left-sidebar nav item pulls you out of the guided flow. "Investigate similar issues and fix all."
  - FIX (all gated on `router.pathname === "/get-started"`):
    - `Containers/Client/index.tsx` (`isOnboarding`): hide the left sidebar `<nav>` + the mobile `<MobileNavigationBar>`.
    - `Components/Layout/NewHeader/index.tsx` (`isOnboarding`): hide the mobile hamburger (opens the nav drawer), the desktop `+ New` button, the wallet-warning "payout address setup" chip (→/wallet) and the KYC chip (→/kyc).
    - `Components/UI/FeeFreeBanner/index.tsx`: added `/get-started` to `suppressPaths` (hides "Start accepting payments →" which pushed to /create-pay-link).
  - KEPT (deliberate, non-interrupting): top-bar brand/logo (→/dashboard), account menu, search, notifications, theme toggle, EmailVerificationBanner (inline resend, no nav), and the wizard's own "Do this later" (→/dashboard) as the single explicit exit. `MfaGate` already self-skips /get-started.
  - **testing_agent VERIFIED (auto_frontend_testing_agent, desktop 1920 + mobile 390): on /get-started the sidebar, mobile bottom nav, hamburger, +New, fee-free banner and wallet/KYC chips are all ABSENT; "Do this later" still exits to /dashboard; chrome RETURNS on /dashboard (regression PASS); 0 console errors.**
