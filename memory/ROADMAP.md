# CURRENT PRIORITIES (2026-07-11, session 27) — top of stack

DONE this session (preview): login-bounce fix (withAuth retry), Google stay-on-page popup, Profile→Settings merge, Help refresh + chat CTA + quick-reply chips, branded favicon (ink+lime), site OG card, "15+ chains", "Dynotech" footer, SEO heading fix, donation/crowdfunding checkout redesign, **Creator vanity pages `dynopay.com/{handle}`** (migration on LIVE DB + endpoints + SSR page + Settings claim UI + dynamic OG). See CHANGELOG.

NEXT (user-requested order after creator):
- P0 STANDARD /pay checkout polish — make the regular payment checkout match landing-page quality (order summary, coin grid, trust signals). File: pages/pay/index.tsx (+ Pay3Components).
- P1 Landing page refresh — surface donations/crowdfunding/creator pages; keep clean.
- P1 Dynamic link previews for shared payment/donation links — SSR the /pay page's OG tags (crawlers don't run JS). Creator pages already have dynamic OG.

REMINDER: login-bounce fix is PREVIEW-only until the user deploys to production.

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
