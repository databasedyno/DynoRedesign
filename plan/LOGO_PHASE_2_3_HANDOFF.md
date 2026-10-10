# LOGO PHASE 2/3 — HANDOFF SPEC (for next agent, complete end-to-end)

> Written 2026-10-07 (pod bc82ec41) after a full code review of the brand/logo system.
> Preview: https://fiat-crypto-vault.preview.emergentagent.com
> Frontend = Next **production** build (`.next-prod`, no hot reload) → you MUST rebuild+swap
> after any FE edit (command in §7). Backend = ts-node via `backend/server.py` shim on :8001.
> SAFE MODE, LIVE prod DB. Changes ship via **"Save to GitHub"** (do not git-push yourself).

---

## 0. TL;DR — what the code review found

The original "Logo Phase 2/3" backlog line read: *branded email header/receipt treatment · logo
entrance animation · localized wordmark checks · full brand guide · press-kit page · "Powered by
Dynopay" badge*. **Most of this already exists.** Real status:

| Sub-task | Status | Evidence |
|---|---|---|
| **(a) Logo entrance micro-animation** | ❌ **NOT STARTED** — the one real dev task | `assets/Icons/Logo.tsx` is a static 2-path SVG; no `animate` affordance |
| (b) Branded email header / receipt | ✅ **DONE** (polish optional) | `backend/utils/emailTemplate.ts` — inversion-proof `dynopay-email-logo-v5.png` chip, gold `#FFD100`-on-ink `#121214` chrome, full header/content/footer shell, i18n, SafeDeal co-brand; receipts (`backend/services/email/customerReceiptEmail.ts`, `paymentEmails.ts`) render through it |
| (c) Brand-guide page | ✅ **DONE** | `pages/press.tsx` (265 lines, v8 system) — lockups, **colors (click-to-copy)**, **do/don't guidelines** (`#guidelines`), boilerplate + facts |
| (d) Press-kit page | ✅ **DONE** | same `pages/press.tsx` — downloadable `/press/dynopay-brand-kit.zip` + per-lockup SVG downloads; all assets present in `public/press/` |
| "Powered by Dynopay" badge | ✅ **DONE** (already broad) | checkout `CleanCheckoutV2.tsx` L1433, `CheckoutOrderSummary`, Creator profile/preview/`TipThankYou`/`HandleQrCode`, `PageUnavailable` |
| `/press` discoverability | ✅ **DONE** | linked in `Components/Layout/HomeFooter/index.tsx` L201 (`v6.footer.press`) and `HomeHeader/menuData.tsx` L200 |
| Localized wordmark checks | ⚠️ **QA only** | the wordmark is the word "Dynopay" (brand name, identical in every locale) → outlined from `Manrope-ExtraBold`; this is a visual spot-check, not a code change |

**So the next agent's job is essentially: build (a), optionally polish (b), and run the QA checklist for (b/c/d).**
Do NOT rebuild (c)/(d) — they exist and are linked. Do NOT re-add the "Powered by" badge.

---

## 1. Brand system map (where everything lives)

- **React mark:** `assets/Icons/Logo.tsx` — renders `LOGO_MARK_RING` (the bold "D") + `LOGO_MARK_ARROW`
  (settlement arrow). Colors from `constants/theme.ts`: `BRAND_ACCENT = #FFD100` (gold, on dark),
  `ESPRESSO = #121214` (on light). ViewBox `"9 7 50 50"`.
- **Generated paths:** `assets/Icons/logoMarkPaths.ts` (`LOGO_MARK_VIEWBOX/RING/ARROW`) — **generated, do not hand-edit**.
- **Asset generator (source of truth):** `scripts/brand/generate-logo.mjs` → emits `assets/Icons/home/*`,
  `assets/Images/auth/dynopay-logo.svg`, all `public/press/*.svg`, favicons, PWA icons, apple-touch.
  Run `node scripts/brand/generate-logo.mjs` ONLY if the mark geometry/colors change (then re-zip the kit — see §5).
- **Wrapper:** `Components/Layout/BrandLogo/index.tsx` — `<Logo width={40} height={40} variant>` for app/auth chrome.
- **Email logo/chrome:** `backend/utils/emailTemplate.ts` + `backend/utils/brandTokens.ts` + `emailButton.ts` + `emailI18n.ts`.
- **Brand/press page:** `pages/press.tsx` → assets under `public/press/`.
- **Fonts:** `public/fonts/Manrope-ExtraBold.woff` (wordmark), CSS vars `--font-hero/--font-body/--font-tech`.

`<Logo>` is used in ~20 places (checkout, headers, footers, auth, receipt, pay). **The animation MUST be opt-in
(default off) so none of these change** unless explicitly enabled.

---

## 2. ✅ TASK (a) — Logo entrance micro-animation  [THE MAIN TASK]

### Goal
A tasteful **one-shot** reveal of the mark: the "D" ring eases up (scale + fade) and the settlement arrow
slides in from the left just after. No loop. Must respect `prefers-reduced-motion`. Opt-in via a prop so
every existing `<Logo>` is untouched. (Note `AuthBrandPanel.tsx` already has an `authRise` panel reveal and
a comment that "a single entrance reveal is the only motion" — keep that philosophy: calm, once, no loop.)

### Step 1 — add an opt-in `animate` prop to `assets/Icons/Logo.tsx`
Recommended: **pure CSS injected inside the SVG** (SSR-safe, zero new runtime deps, scoped by `React.useId`).
Do NOT reach for framer-motion here — it exists (`^12.42.2`) but is overkill for a low-level primitive and
risks hydration flashes. Implementation to add (keep real `< > " &` characters, not HTML entities):

```tsx
import React from 'react'
import { useTheme } from '@mui/material'
import { BRAND_ACCENT, ESPRESSO } from '@/constants/theme'
import { LOGO_MARK_ARROW, LOGO_MARK_RING, LOGO_MARK_VIEWBOX } from './logoMarkPaths'

interface LogoProps {
  width?: number
  height?: number
  color?: string
  variant?: 'onDark' | 'onLight'
  /** One-shot entrance reveal (ring scales+fades in, arrow slides in). Off by default. */
  animate?: boolean
  /** Delay before the reveal starts, ms. */
  animateDelayMs?: number
}

const Logo = ({ width = 64, height = 64, color, variant, animate = false, animateDelayMs = 0 }: LogoProps) => {
  const theme = useTheme()
  const onDark = variant ? variant === 'onDark' : theme.palette.mode === 'dark'
  const fill = color || (onDark ? BRAND_ACCENT : ESPRESSO)
  const uid = React.useId().replace(/:/g, '')      // SSR-safe, unique per instance
  const cls = `dyno-logo-${uid}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={LOGO_MARK_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="dynopay-logo"
      className={animate ? cls : undefined}
    >
      {animate && (
        <style>{`
          .${cls} .dyno-ring { transform-box: fill-box; transform-origin: center; opacity: 0; transform: scale(0.82);
            animation: dynoRing-${uid} 460ms cubic-bezier(0.22,1,0.36,1) ${animateDelayMs}ms both; }
          .${cls} .dyno-arrow { transform-box: fill-box; transform-origin: left center; opacity: 0; transform: translateX(-5px);
            animation: dynoArrow-${uid} 420ms cubic-bezier(0.22,1,0.36,1) ${animateDelayMs + 150}ms both; }
          @keyframes dynoRing-${uid} { to { opacity: 1; transform: scale(1); } }
          @keyframes dynoArrow-${uid} { to { opacity: 1; transform: translateX(0); } }
          @media (prefers-reduced-motion: reduce) {
            .${cls} .dyno-ring, .${cls} .dyno-arrow { animation: none !important; opacity: 1 !important; transform: none !important; }
          }
        `}</style>
      )}
      <path className="dyno-ring" d={LOGO_MARK_RING} fill={fill} fillRule="evenodd" clipRule="evenodd" />
      <path className="dyno-arrow" d={LOGO_MARK_ARROW} fill={fill} />
    </svg>
  )
}

export default Logo
```

Notes / gotchas:
- `animation-fill-mode: both` sets the *from* state during the delay → **no flash** of the final frame.
- `transform-box: fill-box; transform-origin: center` makes the scale pivot on the mark centre (not the SVG
  user-space origin). Supported in all current Chromium/WebKit/Firefox.
- When `animate` is false there is **no class and no `<style>`** → byte-identical to today for all existing uses.
- Keep the two `className`s (`dyno-ring`/`dyno-arrow`) on the paths unconditionally — harmless when unscoped.

### Step 2 — wire it in (opt-in, a few high-signal spots only)
1. **Auth chrome** — `Components/Layout/BrandLogo/index.tsx`: add `animate?: boolean` to its props and pass it
   to `<Logo ... animate={animate} />`. Then enable it where BrandLogo introduces the product:
   - `Components/Layout/Sidebar/index.tsx` L37 (`<BrandLogo redirect={false} variant="onDark" />`) → add `animate`.
   - `pages/payment/success.tsx` L60 → `animate` (celebratory). Leave `failed.tsx`/`verify.tsx` static.
2. **(Optional) App header once-per-session** — `Components/Layout/NewHeader/index.tsx` (`app-brand-cell`): only
   if you add it, gate with `sessionStorage` so it plays once per session, never on every route change.
3. **Do NOT** enable it on checkout/receipt/creator/pay inline marks (they're tiny chrome; motion would feel busy).

`SetupCompleteStrip.tsx` celebrates with a green check circle (not the mark) — leave as-is unless product wants
the mark there; if so, drop a small `<Logo width={20} height={20} animate />` beside the check.

### Acceptance criteria (a)
- `/auth/login` (desktop) shows the mark easing in once, arrow trailing; it does **not** loop and does not replay
  on client nav. `pages/payment/success.tsx` shows the reveal.
- With OS "reduce motion" on, the mark is fully static (no animation, final state, no flash).
- No hydration/console errors; every other `<Logo>` usage looks identical to before.
- `tsc --noEmit` clean; eslint clean on the two edited files; prod rebuild+swap done (§7).

---

## 3. (b) Branded email header / receipt — DONE; optional polish only

Current state is production-grade (see §0). Only pick this up if product explicitly wants a **receipt-specific
layout** (itemised amount/asset/tx-hash summary card) beyond the shared shell.
- Files: `backend/services/email/customerReceiptEmail.ts` + `paymentEmails.ts` (content), `emailTemplate.ts`
  (`generateEmailTemplate`/shell), `brandTokens.ts` (`EMAIL_TOKENS`), `emailButton.ts`.
- Brand rules already encoded: bar/button `#FFD100`, button text `#121214`, dark `#050505/#121214` chrome,
  logo via `getDynopayLogoUrl()` (resilient base-URL fallback; never a 3rd-party CDN).
- **Verification without sending (email is OFF in SAFE MODE):** write a tiny node script that imports the
  template fn, renders the HTML string for a sample receipt, and dumps it to `/tmp/receipt.html`; open it with
  the `analyze_file_tool`/screenshot to eyeball the header + summary. Never flip background jobs / outbound email on.

## 4. (c) Brand-guide & (d) Press-kit — DONE; verification checklist only

`pages/press.tsx` already serves both. **Verify, don't rebuild:**
- `/press` renders: `press-page`, `press-hero`, `press-lockups`, `press-colors`, `#guidelines`.
- Every lockup tile downloads (testids `press-download-<file>.svg`) and the hero kit (`press-download-kit`)
  → `/press/dynopay-brand-kit.zip` returns 200.
- Colour chips copy hex on click (`press-color-<hex>`).
- Footer link (`v6.footer.press`) and header menu both route to `/press`.
- All referenced assets exist in `public/press/` (confirmed 2026-10-07): logo/stacked/mono/wordmark (black+white),
  `dynopay-mark-on-dark/-on-light/-tile.svg`, `dynopay-icon-512.png`, `dynopay-brand-kit.zip`, `BRAND-USAGE.md`.

## 5. Regenerating assets (only if the mark changes)
`node scripts/brand/generate-logo.mjs` regenerates every SVG/PNG/favicon/press asset from the font + mark geometry.
After regen, **rebuild the brand-kit zip** so `/press` downloads match (zip the `public/press/*.svg` + PNG + usage
md). Then verify the favicon/PWA icons still render. Skip this entirely for task (a) — the geometry is unchanged.

## 6. Localized wordmark QA (the "localized wordmark checks" line)
Visual spot-check only — the wordmark text is constant ("Dynopay"). On `/`, `/press`, `/auth/login`, and an email
preview, switch locale to de/es/fr/nl/pt and confirm: the wordmark/mark never clips, never gets translated, and the
surrounding localized copy doesn't overlap it at 1920 and 390 widths, light + dark. No code change expected.

---

## 7. Build / test / deploy mechanics
- **Rebuild prod after FE edits (zero-downtime swap):**
  ```bash
  cd /app && rm -rf .next-prod-new && NEXT_DIST_DIR=.next-prod-new NODE_OPTIONS="--max-old-space-size=8192" \
    node_modules/.bin/next build > /tmp/next-build.log 2>&1
  # on "Compiled successfully":
  rm -rf .next-prod-old && mv .next-prod .next-prod-old && mv .next-prod-new .next-prod && sudo supervisorctl restart frontend
  ```
- **Gates before testing:** `node_modules/.bin/tsc --noEmit` (0 errors), eslint the changed files,
  `node scripts/qa/strip_unused_imports.cjs tsconfig.json --check --skip=backend,scripts`.
- **Quick login for testing (2FA on):** merchant JWT in `memory/tmp/merchant_token.txt` (valid ~2026-11-04);
  on the preview origin set `localStorage.token` + `localStorage.last_company_id = '1'`. Real browser UA required.
  Company 1 "The Dev Store" (onarrival21@gmail.com) is the owner's own test brand — safe to use; don't touch others.
- **Frontend test = `auto_frontend_testing_agent`** (never hand-written scripts). Animation verification tip:
  check the mark is static when the harness sets `prefers-reduced-motion: reduce`, and animates otherwise.
- **Ship:** everything stays uncommitted until the user hits **"Save to GitHub"**.

## 8. Suggested order for the next agent
1. Implement (a) in `Logo.tsx` + wire BrandLogo/Sidebar/payment-success → gates → rebuild → `auto_frontend_testing_agent`.
2. Run the (c)/(d) + (b) verification checklists (no/low code).
3. Only if product asks: receipt-specific email layout (b) + optional NewHeader once-per-session reveal.
4. Localized wordmark visual QA.
