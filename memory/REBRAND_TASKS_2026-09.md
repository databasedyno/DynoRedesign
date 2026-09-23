# Dynopay Rebrand — Task Register (2026-09)

_Last updated: 2026-09-23 (fork #2 — brand/SEO asset audit, session ended by user). Working tree only — nothing deploys
until "Save to GitHub"._

## Brand direction (user-approved, latest wins)
- **Gold `#FFD100` + dark brown `#2B1D14` / `#3A2A1F` + near-black `#0B0908` lead** — Binance/Bybit weight.
- Aqua `#2BD4C4` is a **rare micro-accent only**: logo spark/dot + small live dots (e.g. hero sandbox `LiveDot`).
  NOT for links, focus rings, info, buttons, gradients, chart lines, headers, sidebar, text.
- Yellow fills ALWAYS carry dark-brown text (`BRAND_ON_ACCENT`). Never white on yellow.
- Light surfaces: brand-tinted text/icons = deep gold `#8B5E00` (≈5.3:1 on cream); links = dark brown `#1F140D`,
  underlined. Dark surfaces: brand text / links = gold `#FFD100`.
- Charts: gold line by default (Sparkline, AreaChart). Money semantics stay green/red. Alerts solid & readable
  (info alert = brown-neutral: `#F3EDE2`/`#3A2A1F` with gold icon).
- Cream neutrals light: canvas `#FAF6EF`, card `#FFFDF7`, border `#E8DFD2`, ink `#1F140D`.
- **Untouched:** SafeDeal (own gold/black brand), merchant-branded storefront/checkout colours & logos, coin colours,
  creator accent palette (`constants/creatorTheme.ts`), logo SVGs (aqua spark kept).
- Logo = concept B (coin-D, aqua spark). Final vector match to the user's picked image is **not user-confirmed**.

## This session — gold/brown retune (aqua → sparingly) — CODE DONE, VISUAL CHECK PENDING
| # | Task | Status |
|---|------|--------|
| 1 | Shared tokens → gold/brown: `constants/theme.ts` (new `GOLD`, `GOLD_DEEP`, `linkFg`, `goldAlpha`, `goldDeepAlpha`; `brandFg` = gold/deep-gold; `DARK/LIGHT.info`, `focusRing`, glows), `styles/appTheme.ts` (links dark-brown on light, checkbox/radio dark-brown on light, info alert brown-neutral), `styles/theme.ts`, `styles/authTheme.ts`, `styles/homeTheme.ts` (rewritten: gold primary, brown secondary, cream grounds, MuiLink/Button/Chip overrides so no gold text on cream), `styles/globals.css` focus ring | ✅ tsc 0 |
| 2 | Sweep ≈200 hard-coded aqua/teal refs → gold/brown via `scripts/brand/gold_retune.py` (192 files; literal hex + rgba + `AQUA`→`GOLD` identifiers; skips SafeDeal/logo/coin/creator files). Hand edits: `Home/v3/theme.v3.ts` (rewritten, aqua aliases → gold), `HomeHeader/styled.tsx`, `HomeFooter/index.tsx` (link hover brown on light), `HeroV6.tsx` (LiveDot aqua kept), `AuroraField.tsx` (gold glow, softened), `StatusDot.tsx` info→gold, `avatarGradient.ts`, `useVerticalAccent.ts`, `motion/accents.tsx`, `StickyPromoBar.tsx` (gold claim button + brown text), `pages/documentation.tsx` (yellow-text-on-light → `GOLD_DEEP`), 18 files where `dark ? "#FFD100" : BRAND_ACCENT` (yellow text on light) → `"#8B5E00"`, `help-support/[slug].tsx` article links → inherit + underline | ✅ tsc 0; grep for aqua/teal hex in Dynopay dirs = 0 (only logo/StatusDot-comment/HeroV6 LiveDot) |
| 3 | Checkout/receipt default chrome: `CheckoutShell.tsx`, `CheckoutStatusStrip.tsx` (light accent `#8B5E00`), `Pay3Components/*`, `pages/pay/index.tsx`, `pages/receipt/[token].tsx` retuned through tokens + sweep | ✅ code; ⚠️ not screenshotted |
| 4 | Emails + PDFs: `backend/utils/brandTokens.ts` (aqua slot now deep gold, name kept), `emailTemplate.ts` (info badge gold/brown, `infoBox` default border deep gold), email services explorer links → `#8B5E00`, `pdfReceiptService.ts` footer links → gold (`#C7D2FE` indigo gone), `pdf/invoiceChrome.ts` link deep gold | ✅ BE tsc 0; ⚠️ no rendered preview |
| 5 | Verify: screenshots landing / dashboard dark / checkout | ✅ DONE 2026-09-23 (see session block below). `rebrand_shots.mjs` works with `PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell`. Shot `/ /fees /documentation /auth/login /dashboard /pay-links /settings` light+dark. Also rendered emails (otp/payment/welcome) + PDFs (receipt/invoice EN/DE) — all clean, no indigo/aqua. |
| 6 | Update `memory/PRD.md` (entry added) + this register | ✅ |

### Next agent — finish list (in order)
1. Screenshots (light+dark): ✅ DONE 2026-09-23 — no leftover aqua/teal, no gold-on-cream. **Found & fixed** white-on-gold
   on 14 files (see session block below).
2. Email preview + receipt PDF: ✅ DONE 2026-09-23 — rendered & eyeballed, on-brand, no indigo/aqua.
3. Scoped testing_agent run (frontend only, ~6 routes, both modes) — **STILL PENDING** (awaiting user go; the rebrand has no
   testing-agent report yet). Do not run the broad `rebrand_qa.mjs` crawler.
4. Ask user to confirm logo concept-B match visually (auth panel / sidebar / favicon) — **STILL PENDING**.

## 2026-09-23 (fork) — Visual QA complete + white-on-gold contrast fixed
- Pod set up from `env.vault.enc`; app healthy (db/redis/tatum connected, SAFE MODE on). Captured light+dark shots of
  `/ /fees /documentation /auth/login /dashboard /pay-links /settings`. Rebrand reads clean: gold `#FFD100` + dark brown
  chrome, deep-gold `#8B5E00` text on cream, links dark-brown/gold, only logo aqua spark + green money semantics remain.
- **Bug the user caught: white text/icons on solid gold fills** (fails "yellow always carries dark-brown text"). Fixed 18
  spots across 14 files → foreground now `BRAND_ON_ACCENT` (`#2B1D14`):
  `Components/UI/EmptyDataModel/index.tsx` (Create-link CTA), `Components/UI/AuthLayout/AuthBrandPanel.tsx` ("Pay $42.00"
  mock), `Components/UI/AuthLayout/BrandContent/LiveBrandContent.tsx` (Pay Now), `Components/Page/Shop/MiniCart.tsx` (FAB),
  `Components/Page/SEO/SEOLandingPage.tsx` (step number), `pages/pay/index.tsx` (crypto pay btn), `pages/auth/register.tsx`
  (OTP method icons ×2), `Components/Page/HelpAndSupport/index.tsx` (chat icon), `Components/Page/Dashboard/
  ReferralRewardBanner.tsx` (icon + CTA), `Components/Page/Dashboard/RecentTransactionsWidget.tsx` (count badge),
  `Components/Modals/FirstPaymentCelebrationModal.tsx` (icon), `Components/Layout/Menus.tsx` (tooltip), `Components/Layout/
  ScrollToTopButton.tsx` (FAB), `Components/Common/SupportChatWidget/index.tsx` (avatar/escalate chip/send btn/FAB, chip
  colour made conditional on `escalateOpen`). frontend `tsc --noEmit` = 0 errors; ESLint clean.
- **Deliberately left alone:** `Components/Page/Creator/HandleQrCode.tsx` (uses dynamic creator/merchant `accentColor`, out
  of rebrand scope), `Components/Page/CreatePaymentLink/styled.tsx:272` (Switch thumb, not text-on-gold), `Components/UI/
  Buttons/index.tsx` `contrastText || white` fallbacks (contrastText is already `BRAND_ON_ACCENT`, so white never applies).
- Nothing deployed — working tree only until "Save to GitHub".

### Next agent — finish list (in order) — ORIGINAL

## 2026-09-23 (fork) — Brand/SEO asset audit ("logo/icon/branding everywhere incl. SEO?") — 6/7 fixed, no testing_agent
| # | Surface | Was | Now | Verified |
|---|---------|-----|-----|----------|
| 1 | `public/og/*.png` ×40 per-page share cards (`scripts/generate-og-images.py`) | navy/indigo + old logo | espresso/black + yellow glow + Manrope + coin-D lockup; `?v=2` on all og URLs (`_app.tsx`, `SEOLandingPage.tsx`, `blog/[slug].tsx`, `press.tsx`, `blogData.ts`, `ResourcesV6.tsx`) | ✅ viewed 6 cards |
| 2 | `GET /api/pay/og-image` (`backend/controller/payment/campaignOgImage.ts`) | indigo→violet gradient, "DYNOPAY" text | espresso ground, merchant accent = soft glow only, real lockup composited, gold eyebrow/bar, `onAccent()` for monogram | ✅ demo card; ⚠️ `?d=` / `?shop=` not viewed |
| 3 | Email hero icons (`backend/scripts/generate_email_hero_icons.mjs`) | 26 icons indigo | deep gold `#8B5E00` on `#FFF3CE` (user pick) | ✅ viewed |
| 4 | Web push icons `/dynopay-icon-192.png`, `/dynopay-badge-72.png` | files missing (404) | generated by `generate-logo.mjs` | ✅ exist |
| 5 | `public/landing/products/checkout-phone-{light,dark}.webp` | old indigo checkout | re-captured from `/pay/demo` (`scripts/landing/capture_phone_shots.mjs`, hides `nextjs-portal`) | ✅ viewed |
| 6 | Help article `getting-started-with-dynopay.tsx` → `assets/Images/home/Dashboard.png` | old blue dashboard | **OPEN** — re-capture `/dashboard` with a merchant token | ❌ |
| 7 | Swagger `/api/docs` favicon | swagger default | `customfavIcon: /favicon-32.png?v=6` | ✅ HTML |
- Backend = `ts-node --transpile-only` without watch → `sudo supervisorctl restart backend` after backend edits (~25 s to `/health` 200).
- Still stale but unused: `assets/Images/home/*.svg` (10 indigo), `backend/public/dynopay-email-logo{,-v2,-v3}.png`.
- Pending: scoped testing_agent run for the above; item 6; "Save to GitHub" (nothing deployed).


## Carried-over pending items (from previous forks)
### Rebrand
- `assets/Images/home/*.svg` still indigo (10 files) — check they are rendered before recolouring.
- `pages/QA.tsx` semantic badge blues (P2). Admin console accents (P1).
### Product / bugs
- **ETH dust native sweep fix** (`directEvmTransfer.ts` `quoteNativeSweep`, `merchantPoolSweep.ts`) — testing_agent
  iteration_219 PASS; **not deployed** — needs "Save to GitHub" → droplet pipeline.
- **Update Password step-up** (`Components/Page/Profile/UpdatePassword.tsx`) — iteration_220 PASS. Open product
  decision: user asked "email OTP THEN 2FA"; shipped one-factor step-up (TOTP if enrolled, else email). Ask user.
- Duplicate pending-payment notifications: DB guard added in crumb-sweeper recovery path (tsc only); 5 stale rows
  deleted on prod. User has not confirmed dashboard state.
- 2FA card desktop layout tweak (`TwoFactorAuth.tsx`) — screenshot-only.
### Older backlog (memory/NEXT_ACTIONS.md, ROADMAP.md)
- Rotate leaked GitHub PAT + DigitalOcean key (pasted in chat earlier).
- Dynopay page-title localisation (6 langs); i18n remaining list in CHANGELOG.
- SafeDeal live email check after deploy (hi@safedeal.sh DKIM/DMARC) + Reply-To spark.
- Phase 0 API architecture (idempotency key, webhook sig v2) — awaiting user go.

## Do-not ledger (rebrand)
- Do not rerun `scripts/brand/rebrand_sweep.py`. `gold_retune.py` is idempotent but re-check logo SVGs are skipped.
- Do not touch SafeDeal or merchant-owned colours. Do not swap the SafeDeal loader shield for the Dynopay logo.
- Never grep/echo `.env.local` unfiltered — it contains DB/Redis URLs with passwords.
- `screenshot_tool` returned stale cached images for this app previously — prefer the repo playwright scripts.
