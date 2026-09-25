#!/usr/bin/env node
// Dynopay brand generator (2026-09 rebrand) — concept B: the "coin D".
// Mark: two nested outlined D's (a coin seen edge-on), a pill slot crossing the stem and
// poking out to the left, a reeded coin-edge band hugging the bowl, one aqua dot top-right.
// Yellow on dark brown; espresso on light. Wordmark "Dynopay" in Manrope ExtraBold.
// Run from repo root:  node scripts/brand/generate-logo.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const fontkit = createRequire(path.join(ROOT, "backend/package.json"))("fontkit");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");

export const YELLOW = "#FFD100";
export const AQUA = "#2BD4C4";
// 2026-09 Bybit-neutral rebrand: dark grounds are graphite/near-black (was warm brown).
export const ESPRESSO = "#121214";
export const BLACK = "#0A0A0D";
export const CREAM = "#F5F7FA";
export const INK = "#121214";
const WHITE = "#FFFFFF";

const font = fontkit.openSync(path.join(ROOT, "public/fonts/Manrope-Bold.woff"));
const TRACK = -20;
const CAP = font.capHeight; // 1440
const DESC = 480;
/** Mark body height relative to the wordmark cap height (concept B: a big mark). */
const MARK_CAP_RATIO = 2.2;

const fmt = (n) => (Math.round(n * 100) / 100).toString();

/* ---------- mark geometry (64-unit box, stroke based) ---------- */
const W = 5; // D / pill stroke
const BAND_W = 3.2; // reeded coin-edge band
const MARK = (() => {
  const stemX = 16, arcX = 28, top = 8, bottom = 56; // centre-lines
  const cy = (top + bottom) / 2, R = (bottom - top) / 2; // 32, 24
  const inset = W + 3.6; // outer→inner centre-line offset
  const innerStemX = stemX + inset, r = R - inset;
  const pill = { h: 8, x0: 11.5, x1: innerStemX + 1.2, cy };
  const band = { r: R + W / 2 + 1.0 + BAND_W / 2, from: -74, to: 74, dash: "2.7 1.0" };
  const spark = { cx: 54, cy: 5.5, r: 4.4 };
  return { box: 64, stemX, arcX, cy, top, bottom, R, inset, innerStemX, r, pill, band, spark };
})();

const circle = (cx, cy, r) => `M${fmt(cx - r)} ${fmt(cy)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0Z`;

function markPaths(m = MARK) {
  const { stemX, arcX, cy, top, bottom, R, inset, innerStemX, r, pill, band, spark } = m;
  const ph = pill.h / 2;
  const slotIn = ph - W / 2; // half-height of the pill's dark interior — both stems open here
  const outer = `M${fmt(stemX)} ${fmt(cy - slotIn)}V${fmt(top)}H${fmt(arcX)}A${fmt(R)} ${fmt(R)} 0 0 1 ${fmt(arcX)} ${fmt(bottom)}H${fmt(stemX)}V${fmt(cy + slotIn)}`;
  const inner =
    `M${fmt(innerStemX)} ${fmt(cy - slotIn)}V${fmt(top + inset)}H${fmt(arcX)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(arcX)} ${fmt(bottom - inset)}H${fmt(innerStemX)}V${fmt(cy + slotIn)}`;
  const pillPath = `M${fmt(pill.x0)} ${fmt(pill.cy - ph)}H${fmt(pill.x1)}A${fmt(ph)} ${fmt(ph)} 0 0 1 ${fmt(pill.x1)} ${fmt(pill.cy + ph)}H${fmt(pill.x0)}A${fmt(ph)} ${fmt(ph)} 0 0 1 ${fmt(pill.x0)} ${fmt(pill.cy - ph)}Z`;
  const a0 = (band.from * Math.PI) / 180, a1 = (band.to * Math.PI) / 180;
  const bandPath = `M${fmt(arcX + Math.cos(a0) * band.r)} ${fmt(cy + Math.sin(a0) * band.r)}A${fmt(band.r)} ${fmt(band.r)} 0 0 1 ${fmt(arcX + Math.cos(a1) * band.r)} ${fmt(cy + Math.sin(a1) * band.r)}`;
  const left = pill.x0 - ph - W / 2;
  const right = arcX + band.r + BAND_W / 2;
  const bodyTop = top - W / 2, bodyBottom = bottom + W / 2;
  const topY = Math.min(bodyTop, spark.cy - spark.r);
  return {
    strokes: outer + inner + pillPath,
    band: bandPath,
    bandDash: band.dash,
    spark: circle(spark.cx, spark.cy, spark.r),
    bbox: { x: left, y: topY, w: right - left, h: bodyBottom - topY },
    body: { top: bodyTop, bottom: bodyBottom, h: bodyBottom - bodyTop, cy },
  };
}
const P = markPaths();

const markInner = (bodyFill, sparkFill) =>
  `<path d="${P.strokes}" stroke="${bodyFill}" stroke-width="${W}" stroke-linejoin="miter" fill="none"/>` +
  `<path d="${P.band}" stroke="${bodyFill}" stroke-width="${BAND_W}" stroke-dasharray="${P.bandDash}" fill="none"/>` +
  `<path d="${P.spark}" fill="${sparkFill}"/>`;

/* ---------- wordmark ---------- */
const run = font.layout("Dynopay");
const glyphs = run.glyphs.map((g, i) => ({ glyph: g, adv: run.positions[i].xAdvance + TRACK }));
const wordUnits = glyphs.reduce((s, g) => s + g.adv, 0) - TRACK;
const MS = (MARK_CAP_RATIO * CAP) / P.body.h; // font units per mark unit
const markUnitsW = P.bbox.w * MS;
const markUnitsH = P.bbox.h * MS;
const GAP_UNITS = CAP * 0.36;
const totalUnits = markUnitsW + GAP_UNITS + wordUnits;
// Mark body centre sits on the wordmark cap-height centre; lockup height = mark height.
const baselineUnits = (P.body.cy - P.bbox.y) * MS + CAP / 2;
const totalHUnits = Math.max(markUnitsH, baselineUnits + DESC);

/** Lockup (mark + wordmark) at scale `s` (px per font unit). */
function lockupAt(s, wordFill, markFill, sparkFill) {
  const baseline = baselineUnits * s;
  const ms = MS * s; // mark units → px
  let inner = `<g transform="translate(${fmt(-P.bbox.x * ms)} ${fmt(-P.bbox.y * ms)}) scale(${fmt(ms)})">${markInner(markFill, sparkFill)}</g>`;
  let x = (markUnitsW + GAP_UNITS) * s;
  let d = "";
  for (const g of glyphs) {
    d += g.glyph.path.scale(s, -s).translate(x, baseline).toSVG();
    x += g.adv * s;
  }
  inner += `<path d="${d}" fill="${wordFill}"/>`;
  return { inner, w: totalUnits * s, h: totalHUnits * s };
}

function svgDoc(w, h, inner, extra = "") {
  return `<svg width="${fmt(w)}" height="${fmt(h)}" viewBox="0 0 ${fmt(w)} ${fmt(h)}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dynopay">${extra}${inner}</svg>`;
}

/** Lockup centred inside a fixed box (callers rely on the historical 134×45 frame). */
function boxedLockup(boxW, boxH, palette, margin = 1) {
  const s = Math.min((boxW - margin * 2) / totalUnits, (boxH - margin * 2) / totalHUnits);
  const l = lockupAt(s, palette.word, palette.mark, palette.spark);
  return svgDoc(boxW, boxH, `<g transform="translate(${fmt((boxW - l.w) / 2)} ${fmt((boxH - l.h) / 2)})">${l.inner}</g>`);
}

/** Stand-alone mark centred in a square, optional tile background. */
function markSvg(size, markFill, sparkFill, { bg = null, rx = 0, inset = 0.14 } = {}) {
  const k = bg ? 1 - inset * 2 : 1;
  const side = Math.max(P.bbox.w, P.bbox.h);
  const s = (size * k) / side;
  const tx = (size - P.bbox.w * s) / 2 - P.bbox.x * s;
  const ty = (size - P.bbox.h * s) / 2 - P.bbox.y * s;
  const content = `<g transform="translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(s)})">${markInner(markFill, sparkFill)}</g>`;
  if (!bg) return svgDoc(size, size, content);
  return svgDoc(size, size, `<rect width="${size}" height="${size}" rx="${fmt(rx)}" fill="${bg}"/>` + content);
}

const ON_DARK = { word: CREAM, mark: YELLOW, spark: AQUA };
const ON_LIGHT = { word: INK, mark: ESPRESSO, spark: AQUA };
const MONO_DARK = { word: BLACK, mark: BLACK, spark: BLACK };
const MONO_LIGHT = { word: WHITE, mark: WHITE, spark: WHITE };

/* ---------- writers ---------- */
const write = (rel, content) => {
  const p = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  console.log("wrote", rel);
};
const png = async (rel, svg, { width, height, background } = {}) => {
  let img = sharp(Buffer.from(svg), { density: 600 });
  if (width || height) img = img.resize(width, height, { fit: "contain", background: background || { r: 0, g: 0, b: 0, alpha: 0 } });
  if (background) img = img.flatten({ background });
  const buf = await img.png().toBuffer();
  write(rel, buf);
  return buf;
};

function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    dir.push(e);
  }
  return Buffer.concat([header, ...dir, ...pngs.map((p) => p.buf)]);
}

/** Espresso tile with the yellow mark — favicons, launcher icons, sidebar/checkout square mark. */
const tile = (size, rx = 0) => markSvg(size, YELLOW, AQUA, { bg: ESPRESSO, rx, inset: 0.13 });

async function main() {
  /* SVG lockups (134×45 frame) */
  const onLight = boxedLockup(134, 45, ON_LIGHT);
  const onDark = boxedLockup(134, 45, ON_DARK);
  write("assets/Icons/home/dynopay-blackLogo.svg", onLight);
  write("assets/Icons/home/dynopay-whiteLogo.svg", onDark);
  write("assets/Images/auth/dynopay-logo.svg", onLight);
  write("public/press/dynopay-logo-black.svg", boxedLockup(1340, 450, ON_LIGHT, 10));
  write("public/press/dynopay-logo-white.svg", boxedLockup(1340, 450, ON_DARK, 10));
  write("public/press/dynopay-logo-mono-dark.svg", boxedLockup(1340, 450, MONO_DARK, 10));
  write("public/press/dynopay-logo-mono-light.svg", boxedLockup(1340, 450, MONO_LIGHT, 10));
  write("public/press/dynopay-mark-on-dark.svg", markSvg(512, YELLOW, AQUA));
  write("public/press/dynopay-mark-on-light.svg", markSvg(512, ESPRESSO, AQUA));
  write("public/press/dynopay-mark-tile.svg", tile(512, 512 * 0.22));

  /* favicon.svg — espresso tile reads on light and dark tabs alike */
  write("public/favicon.svg", tile(64, 64 * 0.22));

  /* Mark paths for the React <Logo/> component — square viewBox centred on the mark */
  const side = Math.max(P.bbox.w, P.bbox.h) + 2;
  const vbX = P.bbox.x + P.bbox.w / 2 - side / 2;
  const vbY = P.bbox.y + P.bbox.h / 2 - side / 2;
  write(
    "assets/Icons/logoMarkPaths.ts",
    `// Generated by scripts/brand/generate-logo.mjs — do not edit by hand.\n` +
      `export const LOGO_MARK_VIEWBOX = "${fmt(vbX)} ${fmt(vbY)} ${fmt(side)} ${fmt(side)}";\n` +
      `/** Outer D + inner D (both open at the slot) + pill slot — stroked, one colour. */\n` +
      `export const LOGO_MARK_STROKES = "${P.strokes}";\n` +
      `export const LOGO_MARK_STROKE_WIDTH = ${W};\n` +
      `/** Reeded coin edge hugging the bowl (dashed arc band). */\n` +
      `export const LOGO_MARK_TICKS = "${P.band}";\n` +
      `export const LOGO_MARK_TICK_WIDTH = ${BAND_W};\n` +
      `export const LOGO_MARK_TICK_DASH = "${P.bandDash}";\n` +
      `/** The aqua dot at the top-right (filled). */\n` +
      `export const LOGO_MARK_SPARK = "${P.spark}";\n`
  );

  /* Favicon PNGs + ICO */
  for (const size of [16, 32, 48, 192, 512]) await png(`public/favicon-${size}.png`, tile(64, 64 * 0.22), { width: size, height: size });
  await png("public/favicon-16-light.png", tile(64, 64 * 0.22), { width: 16, height: 16 });
  await png("public/favicon-32-light.png", tile(64, 64 * 0.22), { width: 32, height: 32 });
  await png("public/press/dynopay-icon-512.png", tile(64, 64 * 0.22), { width: 512, height: 512 });

  /* Home-screen / launcher tiles (OS masks square ones) */
  await png("public/apple-touch-icon.png", tile(64), { width: 180, height: 180 });
  await png("public/pwa-maskable-512.png", tile(64), { width: 512, height: 512 });
  await png("public/pwa-192.png", tile(64, 64 * 0.22), { width: 192, height: 192 });
  await png("public/pwa-512.png", tile(64, 64 * 0.22), { width: 512, height: 512 });
  await png("public/dynopay-favicon.png", tile(64), { width: 180, height: 180 });
  await png("public/dynopay-favicon-light.png", tile(64), { width: 180, height: 180 });
  /* Web push (public/sw-push.js + services/webPushService.ts): icon tile + monochrome badge (OS masks it) */
  await png("public/dynopay-icon-192.png", tile(64, 64 * 0.22), { width: 192, height: 192 });
  await png("public/dynopay-badge-72.png", markSvg(64, WHITE, WHITE), { width: 72, height: 72 });
  const icoParts = [];
  for (const size of [16, 32, 48]) {
    const buf = await sharp(Buffer.from(tile(64, 64 * 0.22)), { density: 600 }).resize(size, size).png().toBuffer();
    icoParts.push({ size, buf });
  }
  write("public/favicon.ico", ico(icoParts));

  /* Auth / marketing PNGs */
  await png("assets/Images/auth/dynopay-white-logo.png", onDark, { width: 536, height: 180 });
  await png("assets/Images/auth/dynopay-logo.png", onLight, { width: 536, height: 180 });
  await png("assets/Images/auth/dynopay-mobile-logo.png", tile(64, 64 * 0.22), { width: 96, height: 96 });

  /* Backend: PDF + email */
  await png("backend/assets/dynopay-logo.png", onLight, { width: 1340, height: 450 });
  await png("backend/assets/dynopay-white-logo.png", onDark, { width: 804, height: 270 });
  await png("backend/assets/dynopay-logo2.png", tile(64, 64 * 0.22), { width: 128, height: 128 });
  await png("backend/public/dynopay-white-logo.png", onDark, { width: 804, height: 270 });
  // Email chip: on-dark lockup baked onto the espresso header colour. Versioned (v4) to bust mail-proxy caches.
  const chipW = 480;
  const chipH = 160;
  const chipLock = lockupAt(Math.min(360 / totalUnits, 110 / totalHUnits), CREAM, YELLOW, AQUA);
  const chip = svgDoc(
    chipW,
    chipH,
    `<rect width="${chipW}" height="${chipH}" fill="${ESPRESSO}"/>` +
      `<g transform="translate(${fmt((chipW - chipLock.w) / 2)} ${fmt((chipH - chipLock.h) / 2)})">${chipLock.inner}</g>`
  );
  await png("backend/public/dynopay-email-logo-v4.png", chip, { width: chipW * 2, height: chipH * 2 });

  /* Open Graph share card 1200×630 — espresso ground, aqua→yellow corner glow, grain, lockup */
  const og = lockupAt(Math.min(640 / totalUnits, 220 / totalHUnits), CREAM, YELLOW, AQUA);
  const ogSvg = svgDoc(
    1200,
    630,
    `<rect width="1200" height="630" fill="${ESPRESSO}"/>` +
      `<defs><radialGradient id="g1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1200 0) scale(900 700)"><stop offset="0" stop-color="${AQUA}" stop-opacity="0.55"/><stop offset="0.45" stop-color="${YELLOW}" stop-opacity="0.22"/><stop offset="1" stop-color="${ESPRESSO}" stop-opacity="0"/></radialGradient>` +
      `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.10 0"/></filter></defs>` +
      `<rect width="1200" height="630" fill="url(#g1)"/><rect width="1200" height="630" filter="url(#grain)" opacity="0.6"/>` +
      `<g transform="translate(${fmt((1200 - og.w) / 2)} ${fmt((630 - og.h) / 2 - 20)})">${og.inner}</g>` +
      `<text x="600" y="500" text-anchor="middle" font-family="Manrope, Inter, Arial, sans-serif" font-size="30" font-weight="600" fill="${CREAM}" fill-opacity="0.72">Crypto payments, settled in stablecoins · dynopay.com</text>`
  );
  await png("public/og/dynopay-og.png", ogSvg, { width: 1200, height: 630 });

  /* Preview sheet */
  const sheet = svgDoc(
    900,
    480,
    `<rect width="900" height="240" fill="${CREAM}"/><rect y="240" width="900" height="240" fill="${ESPRESSO}"/>` +
      `<g transform="translate(40 50)">${lockupAt(Math.min(440 / totalUnits, 140 / totalHUnits), INK, ESPRESSO, AQUA).inner}</g>` +
      `<g transform="translate(560 40)">${markSvg(140, ESPRESSO, AQUA).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(730 40)">${tile(64, 14).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(810 40)">${tile(32, 7).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(860 40)">${tile(16, 3.5).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(40 290)">${lockupAt(Math.min(440 / totalUnits, 140 / totalHUnits), CREAM, YELLOW, AQUA).inner}</g>` +
      `<g transform="translate(560 280)">${markSvg(140, YELLOW, AQUA).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(730 280)">${markSvg(64, WHITE, WHITE).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`
  );
  await png("memory/tmp/dynopay-brand-sheet.png", sheet, { width: 1800, height: 960 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
