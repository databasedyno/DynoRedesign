# 3D Imagery on the Landing Page — Placement Plan

## Objective
Add a small, curated set of 3D visuals to the homepage so it feels more premium and
"crypto‑product", without breaking the clean, decluttered, dark Bybit‑style look that was
just shipped. The guiding rule: 3D should support the message and fill existing empty
space — never crowd it. Fewer, consistent, high‑quality renders beat many scattered ones.

## What "clean" means here (the rules the visuals must follow)
- One consistent art style across every render (same lighting, perspective, materials).
- Brand palette only: dark charcoal surfaces, signal yellow `#FFD100` as the accent
  material/glow, Bybit‑black. No rainbow gradients or stock‑crypto clichés.
- Transparent backgrounds so objects sit seamlessly on the dark sections.
- Restrained scale and generous whitespace — the 3D is a supporting accent, not a hero
  takeover.
- Motion (if any) is subtle and respects "reduce motion" preferences.

## Recommended placements (the core proposal)
The homepage has 9 sections (Hero → Coins strip → Trust bar → How it works → Three ways to
use → Why Dynopay → Customer proof → Pricing → FAQ → Final CTA). 3D is proposed in only
**three** of them:

1. **Hero (primary, highest impact).**
   Today the hero is centered text with large empty space on either side at desktop width.
   Proposal: a single 3D focal object that visually says "accept crypto → settle your way"
   (e.g. a stylised cluster of coins/tokens resolving into a payment card or wallet).
   Two layout options — see Decision 2.

2. **"Three ways to use" (No‑code · Checkout · API).**
   One small, matching 3D vignette per card: a phone showing a checkout, a no‑code/pay‑link
   tile, and an API/code cube. This is natural product storytelling and the section already
   has three side‑by‑side slots.

3. **Final CTA (closing accent).**
   A single 3D object echoing the hero motif to bookend the page.

That's **5 renders total** in one consistent style. Recommended to stop there.

Deliberately left text‑only to protect the clean feel: Coins strip, Trust bar, Why Dynopay,
Customer proof, Pricing, FAQ. (Optional add‑on available — see Decision 4.)

## Visual style direction
Soft "studio" 3D: matte objects, gentle rim‑light in signal yellow, soft contact shadows,
slight top‑down 3/4 angle, transparent background. Same camera and lighting on all five so
they read as one set.

## How the 3D art is produced
The renders would be created once and saved as static image files, so the live page loads
plain images — no 3D engine and no per‑visit API calls (keeps it fast and clean). Options
for producing them (Decision 3):
- **AI‑generated to brand (recommended).** Generate custom, palette‑matched renders on
  transparent backgrounds. Verified model options: **OpenAI `gpt-image-1`** (recommended;
  supports transparent output) or **Google Gemini "nano‑banana"** image model. This needs
  a key: the Emergent **universal key** (credits draw from your balance) or your own
  provider key.
- **You supply the assets.** If you already have or will commission 3D renders, we place
  them and skip generation.
- **Licensed stock 3D.** Use ready‑made 3D asset packs (less on‑brand, palette may differ).

## Motion
Recommended: a slow, subtle float/parallax on the hero object only; all other renders
static. Everything honours "reduce motion". (Decision 5 if you'd rather it be fully static.)

## Out of scope (to keep it clean and fast)
- No interactive/heavy WebGL (e.g. Spline/three.js) by default — static renders only.
- No 3D in every section; no autoplaying 3D video.

## Decisions needed before build
1. **Placement scope** — approve the curated set (Hero + 3 "ways to use" vignettes + Final
   CTA)? Or a subset (e.g. Hero only)?
2. **Hero layout** — (a) asymmetric hero: text stays left, 3D object on the right, stacks
   on mobile (recommended, uses the empty space); or (b) keep the current centered hero and
   place the 3D as a subtle low‑opacity backdrop behind the headline.
3. **Art production** — AI‑generate (which model: `gpt-image-1` recommended, or Gemini
   nano‑banana) vs. you supply assets vs. stock. If AI‑generated: universal key or your own
   key?
4. **Optional extra** — also add tiny 3D spot‑icons to "How it works" (3) and "Why Dynopay"
   (4)? Default is **no**, to stay clean.
5. **Motion** — subtle float on the hero (recommended) or fully static?

## Assumptions (chosen unless you say otherwise)
- Static image renders, transparent WebP/PNG, generated once and committed as files — no
  live 3D/API calls on the page.
- Dark palette + `#FFD100` accent; reduced‑motion respected; images below the fold are
  lazy‑loaded, hero image is prioritised.
- Consistent single art style across all renders; scope capped at the 5 placements above
  unless the optional extra is approved.
