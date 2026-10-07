# Dynopay — Logo usage (v1, 2026-10)

The Dynopay mark is the **"Settle-D"**: a bold geometric **D** with a right-pointing
arrow in its counter — crypto payments flowing **straight into the merchant's own wallet**
(non-custodial, direct settlement). One gold accent on a dark base. Nothing decorative.

## Files (this folder — `public/press/`)
| Use | File |
|---|---|
| Primary lockup, gold-on-dark | `dynopay-logo-white.svg` |
| Lockup, dark-on-light | `dynopay-logo-black.svg` |
| Mono (solid black) | `dynopay-logo-mono-dark.svg` |
| Mono (solid white) | `dynopay-logo-mono-light.svg` |
| Mark only, on dark (gold) | `dynopay-mark-on-dark.svg` |
| Mark only, on light (espresso) | `dynopay-mark-on-light.svg` |
| App/favicon tile | `dynopay-mark-tile.svg` · `/favicon.svg` |
| Social / OG share | `/og/dynopay-og.png` (1200×630) |

In‑product, the mark renders from `assets/Icons/Logo.tsx` (auto light/dark); the lockups
from `assets/Icons/home/dynopay-whiteLogo.svg` (dark grounds) and `dynopay-blackLogo.svg`
(light grounds). All raster icons regenerate from `scripts/brand/generate-logo.mjs`.

## Lockups
- **Horizontal** (mark + wordmark) — default for nav bars and wide headers.
- **Mark-only** — favicon, app icon, avatars, tight corners, square tiles.
- **Wordmark-only** — where the mark already appears nearby.
- **Stacked** — centered vertical placements (generate at a taller frame if needed).

## Colour
- **Gold** `#FFD100` — the single accent. Mark on dark grounds; never as a text colour on white (fails contrast).
- **Espresso** `#121214` — dark ground; and the mark/wordmark on light grounds.
- **Cream** `#F5F7FA` — wordmark on dark grounds.
- Mono **black** / **white** — one‑colour print, embossing, partner constraints.

## Clear space & minimum size
- **Clear space:** keep a margin of at least the width of the D's stem on all sides; the OG/press SVGs already bake this in.
- **Minimum size:** mark **16px** (favicon floor — stays legible); full lockup **≥ 96px** wide. Below that, use the mark only.

## Do
- Put the **gold mark on dark**; **espresso on light**.
- Use the mark alone in small/square contexts.
- Keep the arrow pointing **right** (direction of settlement).

## Don't
- No gradients, 3D, bevels, shadows or glows on the mark.
- Don't recolour the mark outside the palette, add a second accent, or reintroduce the old aqua.
- Don't stretch, rotate, outline, or rebuild the wordmark in another font.
- Don't place the gold lockup on a busy or low‑contrast background.

_Regenerate every asset after any change:_ `node scripts/brand/generate-logo.mjs`
