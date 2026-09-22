# Dynopay Rebrand — Task Register (2026-09)

_Last updated: 2026-09-23 (fork, session ended by user mid-verification). Working tree only — nothing deploys
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
| 5 | Verify: screenshots landing / dashboard dark / checkout | ⚠️ **NOT DONE** — `scripts/qa/rebrand_shots.mjs` crashed ("Target page… closed") with `/usr/bin/google-chrome`; retry with `PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell`. Merchant login needs 2FA: `POST /api/user/login` returns `challenge_token` + `preview_otp` → `POST /api/user/2fa/validate {challenge_token, token}` for a JWT. Auth: /app/memory/test_credentials.md (QA throwaway `qa_minorder_p1b@example.com`). |
| 6 | Update `memory/PRD.md` (entry added) + this register | ✅ |

### Next agent — finish list (in order)
1. Screenshots (light+dark): `/`, `/fees`, `/documentation`, `/auth/login`, `/dashboard`, `/pay-links`, `/settings`,
   `/pay/demo`, a `/receipt/<token>`. Look for: leftover aqua/teal, gold text on cream (must be `#8B5E00` or brown),
   white-on-yellow, unreadable outlined buttons. Fix spots, not tokens.
2. Render one email preview (`memory/email_previews_v5` tooling / `backend/scripts`) + one receipt PDF and eyeball.
3. Then a **scoped** testing_agent run (frontend only, ~6 routes, both modes) — the rebrand has NO testing-agent
   report yet (two earlier runs timed out). Do not run the broad `rebrand_qa.mjs` crawler.
4. Ask user to confirm logo concept-B match visually (auth panel / sidebar / favicon).

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
