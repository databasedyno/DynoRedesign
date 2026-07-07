# DynoPay — Roadmap & Next-Agent Handoff

> Living document of what's left and what could be improved. Pair this with
> `PRD.md` (problem statement + dated changelog) and `test_credentials.md`.
> Last updated: 2026-07-07

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

## 5. Refactoring / tech-debt backlog

- `pages/auth/login.tsx` is ~2000 lines — candidate for extraction into smaller
  components (EmailStep, PhoneStep, OtpStep, SocialAuth) once flows are stable.
- Multiple one-off `scripts/i18n_*.js` files exist — could be consolidated into a
  single parameterized merge script.
- Consider a typed `authTheme` module augmentation for the custom `primary.hover`
  palette token (currently cast via `as any`).

---

## 6. Quick reference

- Preview URL comes from `frontend/.env` `REACT_APP_BACKEND_URL` /
  `.env.local` `NEXT_PUBLIC_BASE_URL` — trust the current one, ignore stale URLs.
- Force-compile a route to catch errors: `curl -s -o /dev/null -w "%{http_code}"
  http://localhost:3000/<route>` then check `/var/log/supervisor/frontend.*.log`.
- Test login is a **two-step** flow: email → Continue → password → Continue.
  Credentials in `/app/memory/test_credentials.md`.
