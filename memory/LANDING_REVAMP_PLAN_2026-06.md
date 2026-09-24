# Landing Page Revamp Plan — Bybit-Style (2026-06)

> Status: DONE (2026-09-24). Homepage rebuilt from scratch into the strict 9-section
> Bybit-style layout (`Components/Page/Home/v7/*` + recomposed `Components/Page/Home/index.tsx`).
> Trust bar wired to LIVE `/api/status/landing-metrics` (1,076+ · 99.92% · 79). Products migrated
> to new `/products` page (registered in `_app.tsx` homePaths); fees/documentation already host the
> calculator + API samples; Resources live in footer. All marketing buttons use PrimaryBtn
> (#FFD100 bg / #121214 text); grids stack on mobile. tsc 0 errors, eslint clean. Old v3/v5/v6
> sections retired from homepage (still power other marketing pages).

## ⭐ NEXT ACTION ITEMS (execute in this order)
1. **Homepage Rebuild** — Rebuild `pages/index.tsx` into the exact 9 sections (below) and delete the sprawling v3/v5/v6 clutter in `Components/Page/Home/`.
2. **Trust Bar** — Add the 3-metric trust bar: **1,076+ payments · 99.92% uptime · 75+ countries** with a **"View live status"** link.
3. **Content Migration** — Move the **7 products → `/products`**, **fee calculator → `/fees`**, **API code → `/documentation`**; Resources → footer.
4. **Button Polish** — Make **every marketing button signal-yellow `#FFD100` with Bybit-black `#121214` text**, and **verify mobile stacking** (max 3 cards desktop / stacked on mobile).

## Goal (user-approved, verbatim intent)
Major revamp of the Dynopay landing page + ALL public marketing pages to reduce cognitive load and adopt a Bybit-style aesthetic.
- User approval: "Scope: Landing page + all public marketing pages... Dark by default like Bybit... Keep current signal yellow #FFD100... Switch to Inter... implement ideal structure exactly... Yes, go exactly like that"
- Respond to user in **English only**.

## Design tokens (STRICT)
- **Dark theme by default** for all marketing pages (Bybit-style).
- Accent = signal yellow **`#FFD100`** (NOT Bybit orange).
- Button background = `#FFD100`; button **text MUST be Bybit black `#121214`**.
- Font = **Inter** (headings semibold 600 max).

## Navigation (STRICT)
`Product · Developers · Pricing · Resources · Log in · Start free`

## Homepage = exactly 9 sections, each answers ONE question
1. **Hero** — What is it?
2. **Trust bar** — Can I trust it? → 3 metrics + "View live status" (1,076+ payments | 99.92% uptime | 75+ countries)
3. **How it works** — How does it work? → 3 steps
4. **Three ways to use** — How can I use it? → No code · Checkout · API
5. **Why Dynopay** — Why use it? → 4 points
6. **Customer proof** — 2 merchant stories max
7. **Pricing** — What does it cost? → From 1.5%
8. **FAQ** — 4 questions
9. **Final CTA** — How do I get started?

Remove all extraneous cards/tables/versions. Max 3 cards side-by-side desktop, stacked mobile.

## Content migration (move OFF homepage)
- 7 products → new/updated `/products` page.
- Calculator + chain confirmation times → `/fees` page.
- API code samples → `/documentation` page (homepage keeps ONE REST API line only).
- Resources → footer.

## Status
### DONE (previous session)
- `ThemeContext.tsx`, `_app.tsx`, `_document.tsx`: dark default for marketing + Inter font.
- Theme tokens: `constants/publicTheme.ts`, `styles/homeTheme.ts`, `Components/Page/Home/v3/theme.v3.ts`.
- Header/Footer/Nav updated to new IA: `Components/Layout/HomeHeader/{styled.tsx,index.tsx,menuData.tsx}` + footer equivalents.

### NOT STARTED (P0 — bulk of remaining work)
1. Rebuild `/app/pages/index.tsx` + `/app/Components/Page/Home/` into the strict 9-section structure. Consolidate/delete sprawling v3/v5/v6 versions.
2. Trust Bar section (3 metrics + View live status).
3. Strip products→3 ways, remove confirmation table, merge proof/live figures, remove "global by default", limit API to one REST line.
4. Content migration to `/products`, `/fees`, `/documentation`; Resources → footer.

### P1
- Verify `#FFD100` bg + `#121214` text applied across marketing theme buttons.
- Mobile responsiveness (max 3 cards desktop / stacked mobile).

## Verification plan
- Screenshot tool for iterative visual checks (desktop 1920x800 + mobile 390x844).
- `testing_agent` for full frontend regression once restructuring complete.
- NOTE: Next.js dev server is slow to compile on first load — wait/timeout before screenshot or you capture a blank white screen.

## Critical env notes
- **SAFE MODE**: live PostgreSQL (Railway). `ENABLE_BACKGROUND_JOBS=false`. DO NOT touch backend emails/sweeps.
- Landing page lives in `/app/pages/` (Next.js), NOT `/app/frontend/` (legacy CRA, unused for landing).
- Backend Node.js proxied 8001 → 3300.
- `search_replace` sometimes fails on whitespace — use careful edits/bash string replace as fallback.

## Reference files
- `/app/pages/index.tsx` — primary homepage to refactor.
- `/app/Components/Layout/HomeHeader/menuData.tsx` — nav links.
- `/app/constants/publicTheme.ts`, `/app/styles/homeTheme.ts` — design tokens.
- `/app/Components/Page/Home/v5/`, `v6/` — existing sections to pare down/delete.
- `/app/pages/{products?,fees.tsx,documentation.tsx}` — migration targets (fees.tsx & documentation.tsx exist).

## Credentials (merchant/admin)
- `moxxcompany@gmail.com` / `Katiekendra123@` (see /app/memory/test_credentials.md)

---
## Follow-up (2026-09-24) — PUBLIC MARKETING PAGES DECLUTTER (matches clean v7 landing)
User feedback: theme color was already consistent, but the public pages "looked too busy."
Applied a non-destructive "simple like the landing" recipe (no content removed):
centered SectionHeads (center + maxWidth 720) + centered content containers + calm
cardSx cards (removed aggressive translateY/glow hovers). Pages updated & VERIFIED by
frontend testing agent (desktop + mobile, no leaked i18n keys, no overflow):
  - /about (values cards calmed + centered head)
  - /referral-program (steps/leaderboard/faq heads centered, content centered)
  - /press (facts + logos heads centered)
  - /fees (all 7 section heads centered; interactive fee calculator confirmed intact)
Left intentionally: /documentation (API reference), /system-status (live dashboard),
/how-to (already minimal), /products (already v7-clean). NOT yet touched: /for/[vertical]
SEO pages (render via Components/Page/SEO/SEOLandingPage) — optional next pass.
tsc 0 errors, eslint clean.

---
## Session 2026-09-24 (part 2) — 4 FOLLOW-UP ITEMS (CODE-COMPLETE, VERIFY PENDING)
Offline gates ALL GREEN: `node_modules/.bin/tsc --noEmit` = 0 errors, ESLint clean on all
changed files, `node scripts/check-i18n.mjs` = passed (all 5 locales complete vs en).
NOT yet run: frontend testing agent (visual). Frontend is Next.js DEV (hot-reload) — no
restart needed (no .env change). DEV screenshots go black until hydration; wait for
[data-testid="hero-headline"] visible.

STATUS PER ITEM:
1) VERTICAL SEO PAGES (/for/[vertical]) — DONE (code). Centered the 4 SectionHeads in
   Components/Page/SEO/SEOLandingPage.tsx (features, how-it-works, faq, related) via
   `center maxWidth={720}`. Affects every /for/* page (ecommerce, saas, creators, ...).
   TESTIDS: seo-features, seo-how-it-works, seo-faq, seo-related-pages.
2) FEES TRIM — DONE (code) in pages/fees.tsx. Removed the redundant "worked example"
   section (fees-worked) + its `FeesWorkedExample` import (calculator supersedes it);
   centered the who-pays grid, its footnote, and the FAQ list (mx:auto). Interactive
   fee calculator (fees-calculator) LEFT INTACT — must stay working.
3) LIVE COINS STRIP — DONE (code). New Components/Page/Home/v7/CoinsStripV7.tsx (subtle
   Iconify `cryptocurrency-color:*` marquee, 11 coins, dup-track loop, pauses on hover,
   respects prefers-reduced-motion). Wired into Components/Page/Home/index.tsx directly
   under HeroV7 (before TrustBarV7). TESTIDS: coins-strip, coins-marquee-track.
   NOTE: Iconify icons load from the Iconify CDN at runtime (same as ProofV6/
   LiveSettlementFeed); if the sandbox is offline the glyphs may not paint but layout holds.
4) LANGUAGE CLEANUP — DONE + VERIFIED offline. Backfilled v6.stories.* into de/es/fr/nl/pt
   (brand names kept). check-i18n now passes. (v7.nav.product from part 1 still present in
   all 6 langs — reconfirmed after the JSON reformat.)

REMAINING WORK FOR NEXT AGENT (in order):
 a) [DONE — VERIFIED 2026-09-24 pt3] Frontend testing agent ran the SAFE-MODE read-only
    visual verification (desktop 1920 + mobile 390): 12/12 PASSED (100%). Confirmed:
    homepage coins-strip renders under hero / above trust bar + marquee animates + no
    horizontal overflow / layout shift + all 9 sections present; /for/ecommerce & /for/saas
    seo-features/seo-how-it-works/seo-faq/seo-related-pages headings centered, no leaked i18n
    keys; /fees worked-example block (fees-worked) GONE, fees-calculator present + interactive,
    who-pays/faq centered; i18n ?lang=de & ?lang=fr show no raw dotted keys. => REVAMP TRACK COMPLETE.
 b) [DONE] All pass → revamp track complete. Deploy only on explicit user ask.
 c) OPTIONAL polish not requested yet: further trim /fees "security" section; add coin
    count/logos to CoinsStripV7 from live /api/public/tickers instead of a static list.

CHANGED FILES (this whole revamp, for review):
 - NEW: Components/Page/Home/v7/{HeroV7,CoinsStripV7,TrustBarV7,HowItWorksV7,ThreeWaysV7,
        WhyDynopayV7,ProofV7,PricingV7,FAQV7,FinalCTAV7}.tsx ; pages/products.tsx
 - EDIT: Components/Page/Home/index.tsx ; pages/_app.tsx (homePaths + /products) ;
         pages/{about,referral-program,press,fees}.tsx ; Components/Page/SEO/SEOLandingPage.tsx ;
         langs/locales/{en,de,es,fr,nl,pt}/landing.json
