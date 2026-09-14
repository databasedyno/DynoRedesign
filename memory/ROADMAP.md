# ══════════════════════════════════════════════════════════════════════════════
# NEXT SESSION — BRAND SOFT-DELETE FOLLOW-UPS + NEW ACCOUNT-DELETE FEATURE (2026-06, pod 7f90e7ef)
# Full detail: memory/SESSION_HANDOFF_BRAND_SOFT_DELETE.md
# ══════════════════════════════════════════════════════════════════════════════
#  R1 (P0) — DONE: admin "Deleted Brands" UI built (Components/Page/Admin/Merchants/DeletedBrandsPanel.tsx,
#            rendered at top of Merchants/index.tsx) — list + one-click Restore + confirm-guarded "Delete now".
#            Verified by testing_agent iteration_161.
#  R2 (P0) — DONE: full backend curl E2E on throwaway brands (create->soft-delete->admin list->restore->
#            re-delete->purge->hard-deleted; all 4 emails fired suppressed+dumped) + frontend testing_agent 100%.
#            Throwaway test brands purged; prod DB clean (owner back to brands 1/71/165).
#  R3 (P1) — Merchant delete-brand success toast should show the new "7 days to restore" API message (verify UI).
#  R4 (P2) — Translate v5.faq.myCountry into de/es/fr/pt/nl.
#  NEW FEATURE (user-requested, not started) — Merchant "Delete entire account" UI: same OTP confirmation
#            dialog as brand delete + 7-day recoverable grace before purge. Mirror the brand soft-delete on
#            tbl_user (migration deleted_at/scheduled_purge_at, block login when soft-deleted, admin restore,
#            purge cron, 3 emails). accountLifecycle.ts currently HARD-deletes immediately.
#  NOTE: companyModel is now paranoid — any NEW raw SQL listing a user's ACTIVE brands must add
#        `AND deleted_at IS NULL`. Migration 012 already applied to prod (idempotent). Ship = Save to GitHub.


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC-SITE ELEVATION — PHASE 2 STATUS  ·  2026-06 (fork pod, session ended by user mid-QA)
# ══════════════════════════════════════════════════════════════════════════════
# CODE DONE THIS SESSION (FE tsc 0, eslint 0, all 8 routes 200, self-screenshots 1920 + one 390; PREVIEW-ONLY until Save to GitHub):
#   P1-1 Consistency pass — DONE: /fees, /how-to, /referral-program, /for/* + /compare/* (SEOLandingPage), /blog, /system-status,
#        /documentation all use the shared PublicPageHero (left-aligned aurora hero) + Section/SectionHead rhythm + cardSx cards +
#        Stagger entrance motion + the NEW shared closing band PublicFinalCta (CtaBand with eyebrow + trust footnote). FinalCTAAurora DELETED.
#   P2-1 Device frames — DONE: NEW v5/DeviceFrame.tsx (BrowserFrame / PhoneFrame / FramedImage). ProductsV5 shots now browser-framed with
#        per-tab URL + floating PhoneFrame on the checkout tab; SEO hero aside = PhoneFrame (real 390px /pay/demo shot) + illustration badge.
#        Shots: public/landing/products/checkout-phone-{light,dark}.webp (regenerate: node scripts/landing/capture_phone_shots.mjs).
#   P2-2 Feed density — DONE: recent-settlements returns ALL settlements from the last LANDING_FEED_WINDOW_HOURS (6, max 24) and backfills
#        older ones only up to the requested floor (8); response adds recent_count/window_hours; marquee speed scales with chip count.
#   Wallet icons — FIXED (unverified in browser): Phantom/Coinbase/Ledger/WalletConnect were BLANK (Iconify names did not exist).
#        Now token-branded:{phantom,coinbase,ledger} + simple-icons:walletconnect (all confirmed present on api.iconify.design).
#
# STILL PENDING (do first next session):
#   P1-2  FULL testing_agent sweep (NOT RUN) of every public page — landing (/?view=landing), /about, /press, /fees, /how-to,
#         /referral-program, /for/saas, /for/creators, /compare/coingate, /blog, /system-status, /documentation — at 1920 + 390, light + dark,
#         EN + one non-EN locale (raw i18n keys), scrollWidth == viewport, 0 console errors; confirm the 6 wallet chips in
#         [data-testid="wallets-strip"] each render an <svg> with paths; confirm live feed data-loaded=true; confirm PublicFinalCta buttons
#         (public-cta-start/-demo/-talk) navigate. Not yet eyeballed at all: /system-status + /documentation at 390 and every page in DARK.
#   Then: Save to GitHub → droplet auto-deploy (post-deploy hydration guard covers /, /fees, /pay/demo).
#
# NEW SHARED PRIMITIVES (reuse, don't re-invent): v5/PublicPageHero (props: eyebrow,title,body,actions,note,topSlot,aside,compact,testId),
#   v5/CtaBand (eyebrow, footnote added), v5/PublicFinalCta (attributionRef,title,body,actions,footnote), v5/shared cardSx(s,{hover,radius}),
#   SectionHead eyebrow now optional, v5/DeviceFrame {BrowserFrame,PhoneFrame,FramedImage}.
# NEW i18n keys ×6: apiStatus.eyebrow, landing seo.compareEyebrow, seo.introEyebrow. SEO pages now also render content.intro_paragraph.
# Testids added: fees-hero(-cta/-start), fees-tiers/-calculator/-compare/-who-pays/-included/-security, fees-faq-<i>, how-to-hero,
#   how-to-walkthrough, referral-hero/-steps/-calculator/-faq, blog-hero/-index/-category-filters, status-hero, status-overall-chip[data-status],
#   docs-hero, docs-hero-api-key, docs-base-url, docs-final-cta, docs-cta-api-key/-fees, seo-hero(-cta/-fees/-illustration/-phone), seo-breadcrumbs,
#   seo-intro, seo-features, seo-feature-<i>, seo-how-it-works, seo-step-<i>, seo-faq, seo-related-pages, seo-final-cta, seo-cta-signup/-demo,
#   public-final-cta, public-cta-start/-demo/-talk, cta-band-eyebrow/-footnote, public-page-hero-note, product-shot-checkout-phone.
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC-SITE ELEVATION — PHASE 2 (PENDING)  ·  set 2026-06 (fork pod 8d48377a)
# ══════════════════════════════════════════════════════════════════════════════
# Phase 1 (DONE, preview-only until Save to GitHub): backend recent-settlements +
# onchain-proof endpoints; landing live feed / on-chain proof section / wallets strip /
# security verify-links / richer hero backdrop / global-reach world-map band; about + press
# rebuilt on the aurora system; i18n added to 6 locales. Decisions locked: KEEP +1000 pad;
# feed = coin+network+time only; on-chain proof = Dynopay's own store (user_id 1).
#
# PHASE 2 — STILL PENDING (not started):
#   P1-1  Consistency pass so the WHOLE site reads as one product — apply the shared
#         premium hero (Components/Page/Home/v5/PublicPageHero.tsx) + shared section rhythm,
#         card radius/borders, footer trust row, entrance motion & refined type to:
#         /fees, /how-to, /referral-program, /for/[vertical], /compare/[slug], /blog,
#         /system-status, /documentation. (They already use aurora — this is alignment/polish.)
#   P1-2  FULL testing_agent sweep of every public page (landing, about, press + the 8 above),
#         INCLUDING a visual check that each wallet brand icon in CoinsV5 renders (Iconify:
#         MetaMask/Phantom/Trust/Coinbase/Ledger/WalletConnect) — swap any blank one.
#   P2-1  Device-framed product screenshots (clean browser/phone frames) on the landing +
#         vertical pages for depth (ProductsV5 currently uses a light browser-chrome frame).
#   P2-2  Feed density: have the live settlement feed prefer the last few hours so it always
#         feels busy at peak traffic (currently newest-N over 180 days).
#
# NEXT ACTION ITEMS (in priority order, from the Phase-1 handoff):
#   1. Full QA Sweep    — run testing_agent across every public page + confirm wallet logos render.
#   2. Consistency Pass — bring fees/how-to/referral/verticals/compare/blog/status/docs onto the shared premium hero.
#   3. Ship It          — Save to GitHub so the new landing, About and Press go live.
#   4. Feed Density     — let the live feed pull from the last few hours so it always feels busy.
# ══════════════════════════════════════════════════════════════════════════════


# CURRENT PRIORITIES (2026-09-12, Stripe-style checkout + landing pad session) — top of stack

DONE this session (preview-only until Save to GitHub): buyer-facing fee-payer breakdown removed everywhere (hosted checkout, success card,
public receipt page, PDF, buyer receipt email, legacy checkout); landing "payments settled this month" padded +1000 server-side
(`SETTLED_MONTH_PAD` in backend/controller/status/landingMetricsController.ts — set to 0 to show the real number); CHANGELOG back-filled.

NEXT ACTION ITEMS (user-visible order):
1. **Save to GitHub → deploy** (droplet auto-deploy; post-deploy hydration guard will confirm /, /fees, /pay/demo).
2. P1 (owner) Rotate the DO API token + GitHub PAT pasted in chat; run `correct_overpayment_excess.cjs --execute 940 942` on the droplet;
   settle the 3 FAILED Dev Store conversions.
3. P2 **Checkout themes** — merchant accent colour + logo placement for CleanCheckoutV2 (stored on tbl_company, live preview in Settings › Brand).
4. P2 **Expired-link rescue** — one-tap Extend / Resend on an expired payment link (46 expired customer-pays links exist on prod today).
5. P3 Deferred frontend testing_agent pass: Payment-link detail panel (2.2) + Gateway health strip (user chose not to run this session).



# CURRENT PRIORITIES (2026-09-11, store-credit / coins-badge / swagger-split session) — top of stack

DEPLOY STATUS: commit `e728219f6` (Swagger merchant/internal split, Customer store-credit panel + API, "Accepts all N coins" badge,
referral + tolerance unit tests) is LIVE on the droplet `dynopay-prod-ams3` (134.209.94.115) as of 2026-09-11 ~04:10 UTC —
verified by fingerprint: prod `/api/docs.json` → title "Dynopay Merchant API", 65 paths; new Next build id `dmzRDstnXVc8h94WlXKdy`.
Deploy path = Save to GitHub → push to `Improvement` → GitHub Actions "Deploy to Droplet (Option C)" → GHCR `:latest` → SSH `docker compose up`.
Quick re-check any time: `curl -s https://dynopay.com/api/docs.json | jq .info.title` + `curl -s https://dynopay.com/health | jq .uptime`.

NEXT ACTION ITEMS (user-visible order):
1. P1 **Rotate the DigitalOcean API token** (owner) — the token was pasted in chat on 2026-09-10 and again on 2026-09-11; it has full
   account access (droplets + apps + WHM box). Rotate at cloud.digitalocean.com → API → Tokens. Also rotate the GitHub PAT from 09-10.
2. P1 **Old App Platform app `dynopay`** (id `f86b27dc-feb0-4a44-a4e9-ebd2053e0468`, branch `main`, `deploy_on_push: true`,
   `dynopay-bcibf.ondigitalocean.app`, last deployment cause "app spec updated, app archived"). **Owner decision 2026-09-11: DO NOT delete.**
   Leave as-is; only flip `deploy_on_push` off if a stray `main` push ever re-deploys it (check DO billing for a second app charge).
3. P2 **Checkout themes** — let merchants pick an accent colour + logo placement for the hosted checkout (`CleanCheckoutV2`), stored on
   `tbl_company`, previewed live in Settings › Brand and in the create-link two-pane preview.
4. P2 **Store-credit notifications** — send the customer a short branded email when a merchant adds store credit
   (`services/email/*` + `customerWalletController.adjust` on direction=credit; respect DISABLE_OUTBOUND_EMAIL).
5. P2 **Store credit at checkout** — let an identified buyer apply their store-credit balance on the hosted checkout and pay only the
   remainder in crypto (needs balance lookup by payer e-mail + partial-payment ledger row + receipt line).
6. P3 Minor follow-ups: legacy x-api-key `/api/user/customers/:id/credit|debit` path does not call `invalidateDirectoryCache` (60 s stale
   balance in the Customers list); `react-hooks/exhaustive-deps` warnings in `Customers/index.tsx:255` and `Transactions/index.tsx`;
   desktop pay-links table content ~86 px wider than its scroll container at 1920 (long nowrap donation description — pre-existing).
   Previously listed and still open: expired-link rescue (Extend/Resend), storefront share nudge, offline QR pack, plain-English KPI read.


# CURRENT PRIORITIES (2026-09-10, UX plan session 5 — close-out) — top of stack

Source of truth: `memory/UX_PLAN_STATUS.md` — **every row DONE or PRESENT-verified** (43 rows: 28 DONE / 15 PRESENT / 0 open).
DONE this session: 1.12 sidebar setup-progress ring, 1.2 closed, 3.3 verified + add-mode OTP marker, 3.6 / 3.8 verified,
`/ux-plan/status.html` regenerated from the md (`python3 scripts/ux_plan_status_html.py`), and — from the product backlog —
the live **Gateway health strip** on /dashboard (`GET /api/status/gateway`). PREVIEW-only until Save to GitHub.

NEXT ACTION ITEMS (user-visible order):
1. 🟡 **Final frontend testing_agent smoke pass** (user deferred): 4.2 motion + reduced-motion, 4.4 raw-key scan ×6 langs,
   3.2 Receipts drawer, sidebar ring (brand 179/165 vs The Dev Store), add-wallet OTP line, gateway strip (1920/390, both themes).
2. **Save to GitHub → deploy** (all UX-plan work is preview-only).
3. P1 **Expired-link rescue** — one-tap Extend / Resend on an expired payment link (NEXT_STEPS.md §1).
4. P2 Storefront share nudge · Offline QR pack · Plain-English KPI read (NEXT_STEPS.md §1).


# CURRENT PRIORITIES (2026-09-09, UX plan session 2) — top of stack

Source of truth for the premium in-app experience plan: `memory/UX_PLAN_STATUS.md`.
DONE this session: 1.4 status chip unification (`StatusChip` + `helpers/txStatus`), 1.3 copy-tick rollout
(`CopyInline` boxed variant on API keys, tx-drawer hashes, link success, quick-create, storefront share),
first-visit tips on 5 secondary pages (6 langs). Verified testing_agent iteration_138. PREVIEW-only until Save to GitHub.

NEXT ACTION ITEMS (user-visible order):
1. ✅ **Wallet page fix (3.3)** — DONE (testing_agent iteration_139 100%): 1920px overflow removed (hero glow blob was the
   `mui-33muq1` offender), masked address (first 8 + last 6) with per-card eye reveal + `CopyInline` copy of the full address.
2. ✅ **First-run wizard (1.18)** — DONE (testing_agent iteration_140 100%): `/get-started` 4-step wizard
   (`Components/Page/GetStarted/*`), URL-resumable, "Do this later", reuses OTP `WalletManagerModal`, live checkout preview,
   share step with copy/QR/share. `FirstRunRedirect` replaces the auto-popping `CreateCompanyModal` on /dashboard.
3. ✅ **New-merchant dashboard (1.19)** — DONE (iteration_140): `GettingStartedHero` (progress ring + steps + one CTA)
   over `DashboardPreview` (faded, inert real widgets) until the first payment lands. WalletSetupNudge / OnboardingChecklist /
   ActivationChecklist / EmptyHero no longer rendered on /dashboard (files kept).
   Follow-ups (small): sidebar setup-progress ring during onboarding (1.12), hide ClaimHandleBanner while the hero shows (phone).
4. 🟡 **Payment link detail panel (2.2)** — CODE DONE, TESTING PENDING. Slide-in drawer (full-screen sheet on phone)
   with copy, QR, embed snippet, stats and recent payments. Built + committed:
   `Components/Page/Payment-link/{PaymentLinkDetailPanel,EmbedSnippet}.tsx`, `useLinkPayments.ts` (reuses
   `/api/wallet/getAllTransactions`, no backend change), `linkStatus.ts`; wired into `PaymentLinksTable.tsx` (replaces
   old success/view dialog). tsc/eslint clean, visual screenshots pass. NEXT: run frontend testing_agent (row-click open,
   mobile sheet, copy URL, QR download, embed snippet) before marking DONE. Then the two-pane Create-link preview (2.3).
5. Then per the plan: Transactions phone-filter decision (2.5), Settings sub-nav (3.7), remaining Checkpoint 3 pages
   (Wallet security 3.4 + KYC 3.10 get their first-visit tips when built), Checkpoint 4 cross-device sweep.


# CURRENT PRIORITIES (2026-09-04, session 30) — top of stack

🔴 IN PROGRESS — I18N SWEEP PART 2 (user-approved scope "all customer-facing UI"): register/chrome/banners DONE
(session 30c); ~450 strings remain across checkout + dashboard files — exact list in CHANGELOG 2026-09-04 "REMAINING"
and memory/i18n/inscope.txt. Workflow: scan → edit with t() → write memory/i18n/batchN.json → `python3
scripts/i18n_add.py` → `node scripts/check-i18n.mjs` → tsc → testing_agent (PT/FR).

DONE (30b): landing navigators (desktop dot rail + mobile chip bar, scroll-spy), hero "Explore ↓" jump links,
"More about Dynopay" tabbed fold (6 sections) + ~30% tighter section padding → desktop page ≈31% shorter
(20.6k → 14.3k px). Further shortening options offered but NOT taken (drop Referral band / fold Numbers band).
DONE: new "conversion coin" wordmark logo everywhere (regenerate with `node scripts/brand/generate-logo.mjs`),
bidirectional landing scroll reveals (<Reveal/>), and the REAL fix for "auto-converted icon missing"
(Settings never actually enabled auto-convert — payload mismatch; now mapped/awaited/toasted). See CHANGELOG.

NEXT / BACKLOG:
- 🔴 DEPLOY: logo + animations + auto-convert fix are PREVIEW-only until deployed. Note the merchant must
  re-save Settings → Crypto conversion → "Yes" once after deploy for auto-convert to actually turn on.
- P1 Brute-force / OTP lockout UI: "Too many attempts, try again in X:XX" live timer on login + OTP screens.
- P2 Security Activity panel (Settings → Security): recent logins, lockouts, alert history, "sign out everywhere".
- P2 Optional: apply <Reveal/> to other public pages (fees, docs, about) for the same scroll feel.
- P2 Optional (user declined for now): fold Numbers band / drop Referral band to reach the ~40% shorter target.
- P3 Optional: deep-link tabs (#more=whopays) so header/footer "Fees" can open the Who-pays tab directly.

# CURRENT PRIORITIES (2026-07-11, session 28) — top of stack

✅ VERIFIED this session: crypto-checkout network-switch race fix (P0) — stale-address-on-switch, double-address-on-rapid-select, and superseded-response-overwrite all confirmed fixed via Playwright request-interception against the real `CryptoTransfer` component (no live data touched). See CHANGELOG session 28. Theme-flicker already verified prior session. NOTHING left on the last-working-item.

# CURRENT PRIORITIES (2026-07-11, session 27) — earlier

DONE this session (preview): login-bounce fix (withAuth retry), Google stay-on-page popup, Profile→Settings merge, Help refresh + chat CTA + quick-reply chips, branded favicon (ink+lime), site OG card, "15+ chains", "Dynotech" footer, SEO heading fix, donation/crowdfunding checkout redesign, **Creator vanity pages `dynopay.com/{handle}`** (migration on LIVE DB + endpoints + SSR page + Settings claim UI + dynamic OG), dynamic OG for shared /pay links, **landing refresh (creator vanity mockup)**, **standard /pay checkout lime polish + UX (low-fee hint, tap-to-copy address, trust strip)**. See CHANGELOG.

NEXT / BACKLOG:
- 🔴 DEPLOY: login-bounce fix + ALL session-27 UI changes are PREVIEW-only until the user deploys to production.
- ✅ Dark-mode checkout: VERIFIED WORKING (session 27e). Toggling the real pay-header theme switch flips the whole checkout to dark (body → #060606, card dark, lime accents legible). The earlier "body stays light" report was a test artifact (the Pay3 header is ink-colored in LIGHT mode by design; tester clicked the wrong control). No fix needed.
- ✅ Network tiles now expose `data-testid="network-tile-{TRC20|ERC20|POLYGON|XRPL}"` (both USDT + RLUSD blocks) for E2E. (session 27e)
- 🟢 Public-page design refresh: DONE/verified — fees, documentation, system-status all on Swiss/lime theme.
- ✅ i18n /system-status + /payment/* result screens DONE (session 27e): status labels + legend + "Collecting data" translated (6 locales); verify.tsx "Verifying payment..." translated; success/failed already translated. Verified EN+ES.
- 🟡 i18n remaining: `/documentation` (~150 strings), `/blog` (UI chrome + article content), and `pages/payment/index.tsx` legacy method labels (Card/Bank Transfer/Bank Account/Mobile Money/Crypto). Recent-incident content on /system-status is backend data (not i18n).

---


## 2026-07-07 — Feature A (dashboard bento reskin) — Phase 1: DARK MODE DONE ✅ (tested), light-mode + residual-blue cleanup REMAINING
- Created styles/appTheme.ts (appThemeDark/appThemeLight) = createTheme(themeDark/theme, bento palette) — cyber-lime accent, void/frost canvas; re-declared custom MuiButton variants (rounded/pills/bluepill) with accent; set BOTH primary & secondary to the accent (old theme used one blue for both, so many dashboard elements read `secondary`). Wired into _app.tsx `default` (client) layout case. Fixed hardcoded blues in Components/Page/Wallet/index.tsx (→ palette tokens).
- Testing agent (read-only, JWT): DARK MODE PASS — lime dominant (dashboard 124 lime / 18 blue, wallet 211/19, pay-links 68/17, profile 78/17), renders, no console errors. NewSidebar/dashboard widgets already palette-driven → now lime.
- REMAINING for A: (1) LIGHT mode polish — applies (frost + near-black buttons w/ lime text) but agent judged it not "lime-forward" (by design for light) — needs a visual design pass; (2) ~14-18 residual blue elements per page from COMPONENT-LEVEL hardcoded #0004FF/#6C7BFF (RadioGroup, EmailVerificationBanner, CustomButton, some selects/borders) — need a per-component sweep to palette tokens. theme.ts #0004FF are all in MuiButton variants (already overridden in appTheme); homeTheme is standalone (landing NOT affected); theme2.ts (#1034A6) appears unused.
- NOTE: auto_frontend_testing_agent re-routed the DashboardAction import in OnboardingFlow/index.tsx to the @/Redux/Actions barrel (functionally equivalent; lints clean). CHECKPOINTED with user on how to proceed with A's remaining light-mode + blue-cleanup (iterative, needs testing-agent visual QA each cycle).


# PROGRESS LOG (most recent on top)

## 2026-07-07 — Features B & C DONE ✅ (tested by testing agent, read-only)
- **B — Checkout /pay i18n (P1):** bankTransferCompo.tsx fully i18n'd (~13 strings under common.checkout.*: bankName, accountNumber, copy, recipient, toPay, secureTransfer, accountUnique, madePayment, invoiceExpiresIn, ngnBankTransfer, noAccountToCopy, paymentNotVerified) + backButton "Back" (common.checkout.back). All 6 locales. Verified: Back button EN/DE/FR on /pay legal pages. NOTE: crypto checkout flow (cryptoTransfer + TransferExpectedCard + header) was ALREADY i18n'd; success/failed/verify Pay3 components are dead code (unused). Generic "Something went wrong" fallback in bankTransferCompo left as-is (edge case, out of scope).
- **C — Onboarding "first payment" milestone:** added 4th checklist step "Receive your first payment" (obPaymentLabel/obPaymentDesc, 6 locales). Added `fetched` flag to dashboardReducer; OnboardingFlow fetches dashboard stats once when a link exists (company-scoped, no clobber) and keeps the checklist visible (nudge) until totalTransactions>0. Verified: qa.empty 0/4, qa.onboard 1/4, hostbay (has tx) checklist hidden.
- **NEXT: A — extend bold bento theme into the logged-in dashboard (phased).**
- Gotcha reconfirmed: parallel search_replace on the SAME file can silently drop edits AND corrupt the file tail (both hit here — dashboardReducer `cer;` + OnboardingFlow duplicated tail). Do same-file edits SEQUENTIALLY and always re-lint/verify tail.


# DynoPay — Roadmap & Next-Agent Handoff

> Living document of what's left and what could be improved. Pair this with
> `PRD.md` (problem statement + dated changelog) and `test_credentials.md`.
> Last updated: 2026-07-07

---

## ⭐ Suggested next actions (carried over from last session, verbatim)

These were proposed to the user at the end of the auth-redesign session and are
awaiting a go-ahead:

- **Potential improvement:** want me to add a subtle animated 3D coin/mesh or a
  "trusted by" logo strip to the bento — plus mirror this bold theme on your
  public landing page so the brand feels consistent from first click to sign-up?
- **Optionally:** quick pass on the OTP dialog + forgot-password modal visuals
  (they inherit the theme; not individually screenshotted).
- **Extend the bold theme into the app/dashboard** (user said "yes, later").

---

## 0. ⚠️ CRITICAL SAFETY (read before touching backend)

- This app is connected to the user's **LIVE PRODUCTION** PostgreSQL (Railway) + Redis and uses **LIVE MAINNET** crypto keys.
- `backend/.env` MUST keep `NODE_ENV=production` and `WORKER_ROLE=secondary`.
  Changing these triggers destructive Sequelize `alter: true` syncs and cron
  sweeps against **real customer funds**. Do NOT alter DB models or restart the
  worker in primary mode.
- When testing, **never** perform data-mutating actions on live data: no wallet
  credit/debit submits, no real OTP/email sends, no account creation, no invoice
  creation. Restrict the testing agent to navigation/read/language-switching and
  tell it so explicitly.

## 1. Stack snapshot

- **Frontend:** Next.js 14 (Pages router) + MUI 5 + Emotion (styled). i18n via
  `react-i18next` (namespaces registered in `/app/i18n.js`). Self-hosted
  Urbanist/Outfit fonts; Google Fonts (Unbounded/Manrope/JetBrains Mono) added
  for the auth theme.
- **Backend:** Node/TS Express, proxied to internal port 3300 via supervisor
  (exposed on 8001). All API routes prefixed `/api`.
- **6 locales:** en, pt, fr, es, de, nl. Locale JSON at `/app/langs/locales/<lang>/<namespace>.json`.

---

## 2. i18n backlog (replace hardcoded English strings)

### ✅ Completed
- Sidebar/layout, dashboard widgets, Create-Company flow, onboarding, auth
  `ForgotPasswordDialog` (earlier sessions).
- **Batch A (2026-07-07):** Referrals, Invoices & Tax, Customers (+ detail/wallet
  modal), Profile (AccountSetting, UpdatePassword, LoginActivity, AddContactInfo).
  Verified in EN/DE/NL, no raw-key leaks. See `PRD.md` for key details.

### 🟠 P1 — Next up
- **Checkout `/pay` payment methods** (~30 strings): Bank transfer, Mobile Money,
  USSD, Card, Bank account. Files under `pages/pay/` and its child components.
- **Notifications page**, **CompanySettingsDialog**, **PaymentLinksTopBar** (~15 strings).

### 🟡 P2 — Later
- `documentation.tsx`, admin tools, demo/QA pages (~150 strings).
- Consider translating relative-time/date glue words still in English in a few
  spots (e.g. LoginActivity full-date tooltip " at " separator).

### i18n workflow (recommended, proven)
1. Enumerate hardcoded strings in the target file(s).
2. Write a one-off Node script (see `/app/scripts/i18n_batchA.js` as a template)
   that merges keys + translations into all 6 locale JSONs at once (avoids
   missing non-EN keys). Run with `node scripts/<name>.js`.
3. `search_replace` the component strings to `t("...")`.
4. Namespaces: prefer the file's existing namespace. `invoices`/`customers` were
   nested under the already-loaded `common` namespace (e.g. `t("invoices.colDate")`)
   to avoid editing the large loader in `/app/i18n.js`. New top-level namespaces
   require edits to `ALL_NAMESPACES`, `requireLanguage`, and `loadLanguageAsync`
   in `i18n.js` — do this carefully or reuse `common`.
5. Verify: `node -e` JSON parse check + grep for leftover strings + a testing-agent
   pass in EN + 1–2 non-EN locales checking for raw dotted keys.

### ⚠️ Known editing gotcha (happened repeatedly)
- `search_replace` on large `.tsx` files has occasionally caused **file-tail
  corruption** (a stray fragment like `errals;` appended after `export default`)
  or **partial reverts** after an environment resume. ALWAYS after a batch of
  edits: (a) `tail -n 2` the file, (b) grep the file for the strings you just
  replaced to confirm they're gone, (c) force-compile the route (curl it) and
  check `/var/log/supervisor/frontend.*.log` for `⨯`/Syntax Error. If corrupted,
  fix the tail or overwrite the file cleanly with `create_file`.

---

## 3. Auth redesign — "Floating Glass Bento" (2026-07-07)

### ✅ Done
- Bold cyber-lime-on-void-black glass theme for Login + Register + Forgot/Reset.
- Implemented as a **scoped MUI theme** `styles/authTheme.ts`
  (`authThemeLight`/`authThemeDark`) wired in `pages/_app.tsx` under the `login`
  layout case (covers `/auth/*`, `/reset-password`, `/admin/login`). This
  cascades colors/glass through all shared auth components without touching the
  ~2000-line auth page logic.
- Redesigned shell `Containers/Login/styled.tsx` + `Components/UI/AuthLayout/AuthBrandPanel.tsx`.
- Backward-compatible `CustomButton` tweak (`primary.contrastText` + optional
  `primary.hover` token, both with safe fallbacks so the rest of the app is
  visually unchanged).

### 🔧 Auth follow-ups / to verify
- **Reset-password card body** not visually confirmed (page redirects to /login
  without a valid `?token=`). It shares the redesigned `AuthContainer`/`CardWrapper`
  and compiles 200 — but visually confirm once a real reset link is available.
- **OTP dialog** + **ForgotPasswordDialog** inherit the theme but weren't
  individually screenshotted. Open them and polish if needed (they use MUI Dialog
  paper bg from the inherited dark theme, not the void/glass — could be upgraded).
- **Register E-mail/Mobile tab** active state reads slightly indigo vs the lime
  used on login — align for consistency if desired.
- **`admin/login`** also resolves to the `login` layout → it now gets the new
  theme. Sanity-check it looks right.
- **Neon focus polish:** inputs currently get a lime focus border via
  `border.focus`. Optional: switch auth inputs to bottom-border-only + neon glow
  (would require editing `Components/UI/AuthLayout/InputFields`).

---

## 4. 💡 Potential improvements (product / conversion / polish)

### Auth & branding
- **Mirror the bold theme onto the public landing page** so the brand feels
  consistent from first click → sign-up (currently landing uses a different look).
- Add a **"trusted by" logo strip** or an animated 3D coin/mesh element to the
  auth bento for more credibility + delight.
- Add **framer-motion** (not yet installed) for richer 2-step login transitions
  and staggered bento reveals (currently CSS keyframes only).

### Merchant growth (fits a crypto payment gateway)
- **Referral sharing:** one-tap "Share to WhatsApp/Telegram/X" with a pre-filled
  localized invite message on the Referrals page — native-language sharing tends
  to lift sign-up conversion.
- **Onboarding nudges:** progress/streak indicators to push merchants to first
  successful payment.

### i18n quality
- Visually spot-check **FR/ES/PT** on Batch A pages (only EN/DE/NL were tested).
- Add an automated CI check that every namespace JSON has the same key set across
  all 6 locales (catches missing translations early).

---

## 5. Landing page & other public / checkout surfaces

Public/marketing pages use the **`homeTheme`** ("Floating Glass Bento": cyber-lime
`#CCFF00` on void-black in dark / near-black + lime on frost in light — mirrored from
`styles/authTheme.ts`, see `styles/homeTheme.ts` + shared tokens in `styles/homeBento.ts`)
and the `home` layout. As of 2026-07-07 the **landing page redesign (Phase 1) is DONE**
and the new palette now cascades to fees/blog/docs/legal (they still need per-section glass
polish — Phases 2–3). Checkout uses the `pay`/`payment` layouts (`lightTheme`/`darkTheme`).

### ✅ Phase 1 — Landing redesign (DONE 2026-07-07)
Updated `homeTheme`/`homeThemeDark` (bold palette, opaque `background.paper` so header
menus stay crisp) + new `styles/homeBento.ts`. Restyled: `HomeWrapper` (hero lime aurora
glow), `HomeButton` (lime/near-black + glass outlined), `SectionTitle` (Unbounded headings),
HeroClean, CoreValueProps (lime/indigo/emerald glass cards), FinalCTA (glass + lime glow),
FAQ (glass accordion, lime open-state), TestimonialsV2 (indigo avatar, Unbounded), FeeCalculator
(lime slider/winner-card/CTA via `primary.contrastText`), TryItNow (glass panels, lime CTA).
ComplianceLogoStrip + SupportedChainsRail auto-adapt (theme tokens). Verified in light+dark
by the frontend testing agent: correct colors, Unbounded fonts, no blue leaks, no console errors.

### Surface inventory (design + i18n status)

| Surface | File(s) | Theme today | i18n | Priority |
|---|---|---|---|---|
| Landing / home | `pages/index.tsx`, `Containers/Home` | ✅ bento (lime/void) homeTheme | ✅ `landing.json` | ✅ redesign DONE 2026-07-07 |
| Fees | `pages/fees.tsx` | blue homeTheme | ✅ `fees.json` | design refresh (P2) |
| Terms / Privacy / AML | `pages/terms-conditions.tsx`, `privacy-policy.tsx`, `aml-policy.tsx` | blue homeTheme | ✅ (each has a namespace) | low |
| Documentation | `pages/documentation.tsx` | blue homeTheme | ❌ (~150 strings) | i18n P2 |
| Blog | `pages/blog/index.tsx`, `blog/[slug].tsx` | blue homeTheme | ❌ content | P2 |
| System status | `pages/system-status.tsx` | blue homeTheme | partial (`apiStatus.json`) | P2 |
| QA / demos | `pages/QA.tsx`, `pages/pay/demo.tsx`, `pay/payment-states-demo.tsx`, `pay/success-demo.tsx` | mixed | ❌ | lowest |
| **Checkout `/pay`** | `pages/pay/index.tsx` + method components | pay theme | ❌ (~30 strings: Bank transfer, Mobile Money, USSD, Card, Bank account) | **i18n P1** |
| Payment result | `pages/payment/{success,failed,verify,index}.tsx` | payment theme | ❓ verify | P1 |
| Pay legal | `pages/pay/aml-policy.tsx`, `pay/terms-of-service.tsx` | pay theme | ❓ | P2 |

### What's left / recommended for the landing + public pages

**Design (brand consistency — the user's stated direction):**
- **Mirror the bold "Floating Glass Bento" theme onto the landing page** (`pages/index.tsx` /
  `Containers/Home`) so the brand feels consistent from first click → sign-up. This is
  the biggest visual win. Approach mirrors auth: create a scoped landing theme (or extend
  `homeTheme`) with the cyber-lime accent + void/frost canvas, and restyle the hero,
  feature bento, pricing/CTA sections. **Get user approval on scope first** (landing is a
  high-traffic marketing page — larger than auth).
- Roll the same accent/glass system through **fees, blog, docs, legal** pages for a unified
  look (secondary priority).
- Reuse the auth fonts (Unbounded/Manrope/JetBrains Mono — already loaded in `_document.tsx`).

**Checkout `/pay` (highest-impact non-auth surface — this is what the merchant's customers see):**
- Finish **i18n of the payment-method strings** (P1 in section 2).
- Consider a light design polish so the hosted checkout feels premium and trustworthy
  (it directly affects payment conversion). Keep it its own restrained theme — a checkout
  shouldn't be as "loud" as the marketing site.

**i18n (public pages):**
- `documentation.tsx`, `blog`, `system-status`, demos still need translation (P2).
- Verify `pages/payment/*` result screens (success/failed/verify) are translated.

---

## 6. Refactoring / tech-debt backlog

- `pages/auth/login.tsx` is ~2000 lines — candidate for extraction into smaller
  components (EmailStep, PhoneStep, OtpStep, SocialAuth) once flows are stable.
- Multiple one-off `scripts/i18n_*.js` files exist — could be consolidated into a
  single parameterized merge script.
- Consider a typed `authTheme` module augmentation for the custom `primary.hover`
  palette token (currently cast via `as any`).

---

## 7. Quick reference

- Preview URL comes from `frontend/.env` `REACT_APP_BACKEND_URL` /
  `.env.local` `NEXT_PUBLIC_BASE_URL` — trust the current one, ignore stale URLs.
- Force-compile a route to catch errors: `curl -s -o /dev/null -w "%{http_code}"
  http://localhost:3000/<route>` then check `/var/log/supervisor/frontend.*.log`.
- Test login is a **two-step** flow: email → Continue → password → Continue.
  Credentials in `/app/memory/test_credentials.md`.
