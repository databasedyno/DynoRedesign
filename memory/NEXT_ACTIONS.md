# SafeDeal / Dynopay — Next Action Items (handoff)

_Last updated: 2026-09-19 session. Preview pod is SAFE MODE (outbound email suppressed → dumped
to `/app/memory/email_outbox`; background jobs off; wired to prod DB). All code changes below are
in the working tree only — nothing is deployed until **"Save to GitHub"** triggers the
`deploy-droplet.yml` pipeline._

---

## ✅ Completed this session
- Pod restored from vault; backend healthy (db+redis), frontend 200.
- **Build fix**: `Components/SafeDeal/Hero3D.tsx` Framer Motion `ease` type error (broke `next build`
  in the Docker image). Fixed + full `tsc --noEmit` = 0 errors.
- **Interior SafeDeal reskin** indigo → gold across deals list, wallet, sign-in, new-deal flow,
  dialogs, legal/help. Global gold MUI theme added in `Components/SafeDeal/SafeDealShell.tsx`
  (`ThemeProvider` overriding `palette.primary`) so unstyled controls (focus rings, switches, links)
  are gold too. New shared tokens in `Components/SafeDeal/sdTheme.ts`: `SD_ACCENT`, `SD_ACCENT_HOVER`,
  `SD_ACCENT_GLOW`, `SD_NOTE_BG`, `SD_NOTE_FG`, `SD_NOTE_BORDER`.
- **Brevo DNS for safedeal.sh** added to DigitalOcean zone (LIVE): DKIM `mail._domainkey`,
  `brevo-code` @, DMARC `_dmarc`. Brevo verified DKIM + brevo-code; DMARC pending propagation.
- **SafeDeal sender = hi@safedeal.sh**: per-brand sender threaded through `backend/utils/mailTransporter.ts`
  + `backend/services/email/emailShared.ts` (brand `safedeal`). Dynopay stays `hi@dynopay.com`.
  Env: `SAFEDEAL_SENDER_EMAIL=hi@safedeal.sh` (code also defaults to it). Vault re-sealed.
- **SafeDeal emails reskinned** indigo → gold-on-ink in `backend/utils/emailTemplate.ts`
  (brand palette `bc`), `backend/utils/emailButton.ts` (ctaButton bg/color opts), gold OTP block,
  gold wordmark. Gold hero-icon set generated to `backend/public/email/hero/safedeal/*` via
  `backend/scripts/generate_email_hero_icons.mjs` (served through `getEmailHeroUrl(icon, isSafeDeal)`).

---

## 🔜 Next action items

### 1. Save & Deploy (do first)
- Click **"Save to GitHub"** in the chat input → pushes branch `Improvement` → `deploy-droplet.yml`
  builds the image and deploys to the droplet (safedeal.sh / dynopay.com). Build now passes tsc.
- Do NOT run git write commands from the agent.

### 2. 🔐 Rotate leaked tokens
- GitHub PAT `ghp_YSp…` and DigitalOcean key `dop_v1_413…` were pasted in chat — revoke/rotate both.

### 3. Dynopay page-title localization (six languages; SafeDeal stays English)
- Languages: **en, pt, fr, es, de, nl** (`helpers/setAppLanguage.ts` → `SUPPORTED_LANGUAGES`).
- Frontend locale JSON: `langs/locales/<lang>/*.json`. Titles set via `<Head><title>` per page.
- Task: replace hardcoded Dynopay `<title>` strings with `t("...pageTitle", { defaultValue })`
  keys and add translations in all six locale files. Examples still hardcoded:
  `pages/how-to.tsx`, `pages/pay/state-demo.tsx`, `pages/pay/donation-demo.tsx`, `pages/_error.tsx`
  (some pages already use `t()` e.g. `pages/saved.tsx`, `pages/developer-keys.tsx` — follow that pattern).
- **Leave `pages/safedeal/*` titles in English.**

### 4. Live email check (after deploy)
- Send a real SafeDeal sign-in code in production → confirm it arrives from **hi@safedeal.sh**, passes
  DKIM (green), and shows the gold look + gold hero badge. Confirm Brevo DMARC flips to verified.

### 5. (Spark) Reply-To on SafeDeal emails
- Add a `replyTo` (e.g. support@safedeal.sh) so recipients can reach support instead of the no-reply
  mailbox. Extend `mailTransporter` payload with `replyTo` and set it for brand `safedeal`.
