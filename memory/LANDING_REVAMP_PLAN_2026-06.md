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
