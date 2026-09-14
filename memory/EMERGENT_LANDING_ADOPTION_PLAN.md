# DynoPay — Applying Emergent's Landing Design (approved 2026-09-14)

Owner: user asked to adopt what makes the Emergent landing feel clean & premium,
decided end-to-end. Builds on the typography clarity fix already shipped (Inter
body font + neutral dark greys). This doc is the source of truth for the pass;
update the checklist as items land.

Preview: https://344a40b3-ff42-4c97-9de3-1b749ec105fa.preview.emergentagent.com
Owner login (2-step): onarrival21@gmail.com / Katiekendra123@
Dark mode: set localStorage 'theme-mode-inapp'='dark' + 'theme-mode-public'='dark'
(or click the sun/moon ThemeToggle). Frontend = Next.js dev, hot reload.

---

## Emergent landing — observations (what to borrow)
Typography
- Display font ("Brockmann") for headlines + Inter for everything else.
- Big text: tight negative letter-spacing (~-1px to -1.6px), medium/semibold.
- Headlines carry a soft glow (faint text-shadow) so they feel "lit" on dark.
Colour
- Semantic system (fg/bg/muted/primary/ring); light opacity tints for subtle
  surfaces (5-10% fg fill on secondary buttons). Greys = clean neutral (#808080/
  #8a8a8a), no blue tint.
Buttons & inputs
- Fully rounded ("pill") buttons, tall (48-56px). Hover = soft outer glow + small
  lift (~-3px), ~300ms ease. Inputs pill-shaped with clear focus ring.
Hero & layout
- Split screen: sign-in left, animated gradient panel right with device mockups
  (phone + browser), glass "YC S24" badge, "10M+ users" stat, dashed dividers,
  pill progress dots. Marketing/auth surface expressive+glowing; rest restrained.

---

## Approved scope for DynoPay

### A. Universal — everywhere incl. dashboard
- Inter as body/UI font.  [DONE ✅]
- Crisper text rendering (optimizeLegibility, font-feature-settings normal).  [DONE ✅]
- Clean neutral grey scale (remove blue tint), consistent both themes, AA-safe.
  [DARK done ✅ (#C2C8D2/#9BA1AD); LIGHT still slate — decide/neutralize].
- Tighter letter-spacing on large headings.  [DONE ✅ appTheme.ts h1 -0.03em / h2 -0.025em]
- Consistent hover feel on cards/buttons: subtle lift + soft shadow, 200-300ms.  [DONE ✅ MuiCard lift+shadow both themes; MuiButton contained/outlined -1px lift]

### B. Expressive — marketing landing, auth, public checkout/receipt ONLY
- Hero headlines: larger, tighter tracking, subtle glow, on Manrope (display).  [TODO]
- Primary hero/auth CTAs: larger + pill, glow + lift hover.  [TODO]
- Animated indigo→violet "aurora" gradient hero on landing; device/screenshot
  showcase; glassmorphism social-proof badges; dashed dividers; pill progress
  dots. Keep gradients/glows to hero/primary areas only.  [TODO]

### C. Intentionally NOT copying (unless user says otherwise)
- NOT making the whole dashboard pills/heavy-glow (keep "Quiet Money" calm).
- NOT licensing Brockmann (paid). Manrope (free, loaded) plays display role.

### Confirmed defaults
- Keep Manrope display; no paid font.
- Expressive on marketing + auth + public checkout; dashboard = universal only.
- Pill CTAs on hero/auth only; dashboard controls stay 8px.
- Gradients/glows subtle & reserved.
- THIS PASS delivers: universal refinements + upgraded marketing/auth hero (glow
  headings, pill CTAs, gradient hero panel, social-proof badges). Full
  device-mockup carousel is optional/next.

---

## Progress so far (2026-09-14)
DONE (typography clarity fix, verified frontend compiles + login reads crisp):
- /app/fonts/Inter-400/500/600.woff2 self-hosted (jsdelivr fontsource latin).
- pages/_app.tsx — Inter localFont added; --font-sans / --font-body / --font-inter
  now Inter (Plex Sans fallback). Manrope = --font-display/--font-hero; Plex Mono
  = --font-mono/--font-tech (money) unchanged.
- styles/globals.css — font-feature-settings: normal; text-rendering:
  optimizeLegibility; dark --text-secondary #C2C8D2, --text-tertiary #8C9199.
- constants/theme.ts — DARK.textSecondary #C2C8D2, textMuted #9BA1AD.
- Prior Phase-3 polish: RADIUS scale (12px cards/8px controls), dark skeletons.

---

## Remaining execution checklist + file pointers

PHASE 1 — Universal (theme-level, cascades):
- [x] Tighter heading tracking: styles/appTheme.ts `headingTypography`
      (h1 -0.02em→-0.03em, h2→-0.025em; h3 ok). Also landing hero component.  [DONE ✅ 2026-09-14]
- [x] Card/button hover polish: styles/appTheme.ts MuiCard (add subtle LIGHT hover
      lift + shadow to match dark), MuiButton root transition + gentle translateY(-1px)
      on hover ~200ms. Keep dashboard subtle.  [DONE ✅ 2026-09-14 — MuiCard translateY(-1px)+shadow
      both themes; MuiButton lift scoped to contained/outlined so inline text links stay flat]
- [x] neutralize LIGHT greys: constants/theme.ts LIGHT.textSecondary/textMuted are
      now zinc (#52525B / #71717A); globals.css light --text-* are zinc; authThemeLight
      already zinc (#3F3F46). Also neutralized authThemeDark secondary #94A3B8 → #A1A1AA
      for both-theme consistency.  [DONE ✅ 2026-06]

PHASE 2 — Expressive AUTH split-screen (matches Emergent reference the user shared):
  Current auth is a single CENTERED card (Coinbase-clean 2025-07 pass) — the
  split panel was intentionally removed. Files:
  - Containers/Login/styled.tsx — AuthPageBackground / SplitLayoutWrapper /
    FormPanel (currently single centered column; BrandPanel = display:none).
  - Components/UI/AuthLayout/AuthShell.tsx — the shared frame (logo row +
    children + TrustStrip). NOTE: login.tsx builds its own return (~line 1078),
    register.tsx/reset-password/secure-account/accept-invite use the shell.
  - Components/UI/AuthLayout/AuthBrandPanel.tsx — EXISTS (8.3KB) but not rendered;
    good starting point to revive as the right-side gradient panel.
  - [x] Add desktop split: FormPanel left + aurora gradient AuthBrandPanel right
        (glass badge + "processed $X" social proof + pill dots). Mobile: hide
        panel / stack. Pill CTA + glow heading on the form side.
        [DONE ✅ 2026-09-14 — login + register ONLY (per user). New SplitScreenWrapper/
        SplitFormColumn in Containers/Login/styled.tsx; AuthBrandPanel.tsx rewritten as an
        indigo→violet aurora panel with animated blobs, glass social-proof badge
        ("Non-custodial…"), glowing headline, bento stat tiles, coin marquee, pill dots.
        Hidden < lg; TrustStrip shows below the form on mobile. NOTE: reset-password/
        secure-account/accept-invite still use the plain centered AuthShell (unchanged).]
  - [x] Keep every data-testid (login-email-input, signin-submit-btn, etc.).  [DONE ✅ verified]
  - [x] Extend the split to reset-password, secure-account, accept-invite via a new
        `brand` prop on AuthShell (SplitScreenWrapper + SplitFormColumn + AuthBrandPanel,
        hidden < lg; TrustStrip below the form on mobile). Default AuthShell stays centered
        for any other consumer.  [DONE ✅ 2026-06 — testing_agent iteration_175 = 100%,
        brand panel visible @1920, hidden @768/390, both themes, zero console errors.]

PHASE 3 — Expressive LANDING hero (respect existing Swiss design; subtle):
  - Entry: pages/index.tsx → Components/Page/Home/v5/HeroV5.tsx (+ HeroCheckoutDemo,
    PublicPageHero). Theme: styles/homeTheme.ts, styles/homeBento.ts.
  - [x] Hero headline: subtle text glow + tighter tracking (Manrope) + pill primary
        CTA + reserved indigo→violet gradient accent. Did NOT overhaul the page.
        [DONE ✅ 2026-06 — HeadlineXL is Manrope @ -0.035em with a dark textShadow glow;
        GradientInk accent word + violet mesh; PrimaryBtn is a pill w/ glow+lift and now
        a hero-scoped indigo→violet gradient (linear 135° #4F46E5→#7C5CFF). Verified light+dark.]

GUARDRAILS: dark-first, no light regression, keep data-testids, verify screenshots
(dark+light, desktop+390+768), then MANDATORY run the frontend testing agent.

## Token/theme levers (single sources of truth)
- constants/theme.ts — DARK/LIGHT tokens, RADIUS scale, brand accents, status.
- styles/appTheme.ts — dashboard MUI theme (headingTypography, MuiButton/Card/Input).
- styles/theme.ts — base/marketing MUI (20px/50px pill brand geometry — leave).
- styles/homeTheme.ts / homeBento.ts — landing/marketing.
- styles/authTheme.ts — auth pages theme (its dark secondary ≈ #94A3B8 slate).
- styles/globals.css — CSS vars (--font-*, --text-*, --radius-*, --shadow-*),
  focus rings, skeleton, html/body font + smoothing.
- pages/_app.tsx — font wiring (Inter/Manrope/PlexMono → CSS vars).
