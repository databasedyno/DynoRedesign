# Landing Speed & Font-Flash Report — 2026-08-26

_Scope: **B2** in `REFACTOR_STATUS.md` ("Font-flash polish & landing speed report").
Target: the public landing page (`/` → `Components/Page/Home`). Frontend-only._

---

## 0. Environment caveat (read first)

This report was produced on the Emergent **preview pod**, which runs `next dev`
(unminified, HMR overhead) behind Cloudflare. **Dev-mode timings are NOT
representative of production Core Web Vitals.** The findings below are therefore
a **static / configuration audit** plus a few measured resource facts. For
authoritative LCP / CLS / TBT numbers, run **Lighthouse against a production
build** (`next build && next start`) on staging (see R3 / ties into §2 CI + A4).

---

## 1. Current posture — already strong

The font-flash mechanism is mature and correct (heavily bug-fixed in prior
sessions — see `test_result.md` 2026-08-14 / 08-24 and Session 85):

| Area | State | Evidence |
|------|-------|----------|
| `font-display` | **`swap` everywhere, ZERO `optional`** | `styles/globals.css` (all @font-face `swap`); the only "optional" strings left are explanatory comments |
| Primary fonts | **self-hosted via `next/font`** (Geist local + Unbounded / IBM Plex Sans / IBM Plex Mono google), all `display:"swap"`, auto-preloaded, auto size-adjusted fallback | `pages/_app.tsx` |
| Heading / hero font | **Manrope** (`--font-hero`, `--font-display`, MUI heading stack) — the primary above-the-fold face | `pages/_app.tsx` L525, `styles/globals.css` |
| Body font | **IBM Plex Sans** (`--font-sans`), Manrope as next fallback | `pages/_app.tsx` L522, `styles/theme.ts` |
| CLS on swap | **Metric-matched `"Manrope Fallback"` @font-face** (capsize size-adjust/ascent/descent overrides) so Manrope swaps in with ~zero layout shift | `styles/globals.css` L218+ |
| CLS (ticker) | `LivePriceStrip` renders a **fixed-height reserved bar** (SSR + loading) instead of popping in | Session 85 (test_result CLS 0.0079) |
| CLS (images) | Storefront covers use `next/image` (`ProductImage`) with reserved boxes | Session 85 |
| Hero logo | preloaded `as="image"` (`dynopay-whiteLogo.svg`) | landing SSR |

**Preload inventory on `/` (measured):** 10 font preloads
(5 × `next/font` `.woff2` for Geist/Unbounded/IBM Plex Sans/Mono + 5 × Manrope)
plus 1 hero-logo image preload.

---

## 2. Change shipped this session — Manrope `.woff` → `.woff2`

The 5 preloaded Manrope weights (the primary heading/hero face, on the critical
path of every page) were served as `.woff`. They are now served as `.woff2`
(Brotli), which is smaller for the exact same glyphs & metrics:

| Weight | .woff | .woff2 | saved |
|--------|------:|-------:|------:|
| Regular | 39416 | 30304 | 23% |
| Medium | 39188 | 30024 | 23% |
| SemiBold | 39444 | 30400 | 23% |
| Bold | 39512 | 30668 | 22% |
| ExtraBold | 38152 | 29144 | 24% |
| Light (not preloaded) | 39440 | 30476 | 23% |

**≈ 45 KB shaved off the preloaded critical-path fonts** on a cold landing load.

Implementation (zero-FOUT-risk):
- Generated `/public/fonts/Manrope-*.woff2` from the existing `.woff` (same font, re-flavored to WOFF2 — `fontTools`/`brotli`).
- `styles/globals.css`: every Manrope `@font-face` (canonical **+ 20 legacy alias blocks** like `OutfitSemiBold` / `UrbanistMedium`) now lists `woff2 format("woff2")` **first**, with the original `woff` kept as a **fallback** for the <1% of browsers without WOFF2.
- `pages/_document.tsx`: the 5 preloads switched to `.woff2` (`type="font/woff2"`).
- `font-display:swap` and the metric-matched `"Manrope Fallback"` are **unchanged**, so the documented cold-load-FOUT class of bug cannot recur (same glyphs, same box, font always wins once loaded).

**Verified:** `/fonts/Manrope-ExtraBold.woff2` → 200 `font/woff2`; landing SSR now
preloads all 5 weights as `font/woff2`; `next dev` recompiled `/` cleanly;
ESLint/tsc unaffected.

---

## 3. Prioritized recommendations (remaining, for staging)

- **R1 — Trim preloaded Manrope weights to those actually above-the-fold** (low
  risk, staging-gated). We preload 5 weights on every page; a real above-the-fold
  audit of `/` (likely ExtraBold hero + SemiBold/Medium) may let 1–2 preloads
  drop → fewer competing high-priority requests → faster LCP. Keep the `@font-face`
  (they still lazy-load); only remove the `<link rel=preload>`. **Must be checked
  on a cold mobile load in staging** before shipping (this is the bug-sensitive
  area the prior fixes hardened).
- **R2 — Confirm the hero LCP element gets high priority.** The hero logo is
  preloaded `as=image`; verify in Lighthouse that the true LCP node (Manrope hero
  headline text, or the logo) isn't render-blocked; add `fetchpriority="high"` to
  the LCP image if it's an `<Image>` without `priority`.
- **R3 — Authoritative CWV in CI.** Run Lighthouse on a **prod build** in staging
  (LCP/CLS/TBT/INP) and wire a budget check into CI. Ties into **§2 (CI tsc gate)**
  and **A4 (reusable staging load-test kit)**.

---

## 4. Bottom line

Font-flash is essentially solved (swap + preload + metric-matched fallback). This
session removed the last easy, risk-free inefficiency (woff→woff2, ~45 KB off the
critical path). Everything further (weight-trimming, LCP-priority, budgeted CWV)
needs a **prod build + Lighthouse on staging** to measure safely — documented above
as R1–R3.
