# DynoPay — Dark Mode & UI/UX Redesign Plan (2026-09-14)

Owner: design pass initiated from stakeholder feedback ("dark mode is flat/dull; make it
rich, colorful and brilliant like the reference"). Analysis by the design-review agent.

## Verdict (from full audit, light + dark)
- Overall 6.5/10. Light mode acceptable; **dark mode is the critical gap**.
- Current dark system (`constants/theme.ts` DARK) is the deliberate flat "Quiet Money"
  system: solid navy steps, hairline borders, **no shadows, no gradients, no glow**.
- Result: cards/tables/inputs blend into a single flat background; crypto badges look
  muted; CTAs look dead; charts are dim. 87 issues (32 P0 / 31 P1 / 24 P2).

## Design direction (target)
Premium fintech dark: **deep near-black layered surfaces** with real elevation, **hairline
light borders**, **soft accent glow** on cards/CTAs/focus, **vibrant crypto colors**, and
tasteful **indigo→violet / amber→coral gradients** on hero + primary actions only (respect
the 80/20 gradient rule — never dull dark gradients on small buttons/reading areas).

## Architecture (where dark colors come from)
- `constants/theme.ts` → `DARK` token object = single source of truth for the dashboard
  MUI palette. `LIGHT` = light counterpart. **(primary lever)**
- `styles/appTheme.ts` → dashboard MUI theme (`appThemeDark`/`appThemeLight`): palette wiring
  + component overrides (MuiButton/MuiCard/MuiOutlinedInput). **(elevation + glow lever)**
- `styles/theme.ts` (base), `authTheme.ts`, `homeTheme.ts` = auth + marketing themes.
- `styles/globals.css` → `html[data-theme="dark"]` bg + CSS variables (non-MUI surfaces:
  landing, checkout, receipt) + focus rings + `.themed-icon`.
- Crypto colors: `helpers`/`utils` `getAssetColor` / coin icon rendering.

## Plan (phased, dark-mode first; do NOT regress light mode)

### Phase 1 — Dark foundation (P0)  [DONE ✅ verified 2026-09-14]
Implemented + screenshot-verified (dashboard, transactions, checkout dark; light dashboard
no-regression):
1. `constants/theme.ts` DARK → "Aurora Dark" layered tokens (canvas #07090F, surface #0F1320,
   raised #171C2C, active #212A42) + new tokens: hairline/hairlineStrong, shadowSoft/shadow,
   cardShadow/cardShadowHover, glowAccent/glowAccentStrong/glowSuccess, focusRing,
   gradient/gradientHover/gradientWarm. Brighter textSecondary/textMuted.
2. `styles/appTheme.ts` → dark MuiCard elevation (cardShadow) + hairline border + hover lift;
   MuiOutlinedInput raised bg + indigo focus glow ring; primary CTA variants (rounded/bluepill)
   now carry accent glow in dark (soft indigo shadow in light).
3. `styles/globals.css` → instant dark bg #07090F, autofill inset #171C2C, brighter dark
   --text-tertiary, stronger indigo keyboard focus ring.
Cascades to base/auth/home themes too (all import DARK) → public checkout/login also upgraded.

### Phase 2 — Hierarchy & color (P1)  [DONE ✅ verified 2026-09-14; preflight green]
Implemented + screenshot-verified (dashboard dark, transactions dark):
4. Crypto badge vibrancy: `Components/Page/Transactions/styled.tsx` CryptoIconChip now uses the
   `accent` prop → per-coin `drop-shadow` bloom in dark (BTC/ETH/USDT read vividly).
5. Chart (`coinbase/Sparkline.tsx`): added faint `CartesianGrid`, glowing line
   (`drop-shadow`), and a stronger gradient area fill in dark.
6. Dashboard cards (`coinbase/styled.tsx` SurfaceCard): real elevation (`DARK.cardShadow`) +
   hairline light border + hover lift in dark; light gets a whisper shadow. PrimaryCTA + hover
   now carry the accent glow.
7. Status: `Components/UI/StatusDot.tsx` filled dots get a soft bloom in dark; StatusBadge
   (styled) settled/confirmed get an outer glow.
8. Warm gradient accents: intentionally SKIPPED broad usage to respect the 80/20 gradient rule
   and keep the cohesive indigo system (avoids clashing dark colorful gradients on controls).
Preflight (`yarn preflight`): Backend TS OK + Frontend TS OK → "safe to push" (also cleared a
pre-existing TS error in `Components/Page/Payouts/RecentSettlementsCard.tsx:69`).

### Phase 3 — Polish (P2)
9. Standardize radii (12px cards / 8px controls), shadow scale, spacing.
10. Micro-interactions (hover lift, focus rings), skeletons, empty states.
11. Responsive (390/768) + WCAG AA contrast recheck; add icons to color-only badges.

## Surfaces to re-verify after each phase (dark + light)
Landing `/`, Fees `/fees`, Login `/auth/login`, Checkout `/pay?d=rNtQRX` (+QR via mock),
Receipt `/receipt/...`, Dashboard `/dashboard`, Transactions `/transactions` (+detail modal),
Payment Links, Payouts, Store/"Your page", Settings.

## Guardrails
- Dark-mode changes only via tokens/overrides so they cascade; keep light mode intact.
- No dull/dark gradients on small buttons or reading areas (80/20 rule).
- Verify with screenshots after each phase; do not break existing data-testids.
