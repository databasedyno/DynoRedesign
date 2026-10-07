#!/usr/bin/env node
// Dynopay brand generator (2026-10 logo refresh) — Concept A "Settle-D".
// Mark: a bold geometric "D" (even-odd ring) with a solid right-pointing arrow in the
// counter — payment flow settling straight into the owned form. SINGLE gold accent on
// dark; espresso on light; mono black/white. No aqua, no gradient, no 3D.
// Wordmark "Dynopay" outlined from Manrope ExtraBold (accent-safe for all five locales).
// Run from repo root:  node scripts/brand/generate-logo.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const fontkit = createRequire(path.join(ROOT, "backend/package.json"))("fontkit");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");

export const YELLOW = "#FFD100";
export const ESPRESSO = "#121214";
export const BLACK = "#0A0A0D";
export const CREAM = "#F5F7FA";
export const INK = "#121214";
const WHITE = "#FFFFFF";

const font = fontkit.openSync(path.join(ROOT, "public/fonts/Manrope-ExtraBold.woff"));
const TRACK = -15;
const CAP = font.capHeight;
const DESC = 480;
/** Mark body height relative to the wordmark cap height. */
const MARK_CAP_RATIO = 1.9;

const fmt = (n) => (Math.round(n * 100) / 100).toString();

/* ---------- mark geometry (64-unit box, fill based) ---------- */
// Bold "D": outer silhouette minus an inset counter (even-odd), 8-unit stroke weight.
const RING = "M14 8H30A24 24 0 0 1 30 56H14Z M22 16H30A16 16 0 0 1 30 48H22Z";
// Solid right arrow centred in the counter (settlement direction).
const ARROW = "M23 29H33.5V24L44 32L33.5 40V35H23Z";
const P = {
  bbox: { x: 14, y: 8, w: 40, h: 48 }, // stem x14 → bowl x54, y8 → y56
  body: { top: 8, bottom: 56, cy: 32, h: 48 },
};

const markInner = (fill) =>
  `<path d="${RING}" fill="${fill}" fill-rule="evenodd"/>` +
  `<path d="${ARROW}" fill="${fill}"/>`;

/* ---------- wordmark ---------- */
const run = font.layout("Dynopay");
const glyphs = run.glyphs.map((g, i) => ({ glyph: g, adv: run.positions[i].xAdvance + TRACK }));
const wordUnits = glyphs.reduce((s, g) => s + g.adv, 0) - TRACK;
const MS = (MARK_CAP_RATIO * CAP) / P.body.h; // font units per mark unit
const markUnitsW = P.bbox.w * MS;
const markUnitsH = P.bbox.h * MS;
const GAP_UNITS = CAP * 0.32;
const totalUnits = markUnitsW + GAP_UNITS + wordUnits;
const baselineUnits = (P.body.cy - P.bbox.y) * MS + CAP / 2;
const totalHUnits = Math.max(markUnitsH, baselineUnits + DESC);

/** Lockup (mark + wordmark) at scale `s` (px per font unit). */
function lockupAt(s, wordFill, markFill) {
  const baseline = baselineUnits * s;
  const ms = MS * s;
  let inner = `<g transform="translate(${fmt(-P.bbox.x * ms)} ${fmt(-P.bbox.y * ms)}) scale(${fmt(ms)})">${markInner(markFill)}</g>`;
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
  const l = lockupAt(s, palette.word, palette.mark);
  return svgDoc(boxW, boxH, `<g transform="translate(${fmt((boxW - l.w) / 2)} ${fmt((boxH - l.h) / 2)})">${l.inner}</g>`);
}

/** Stand-alone mark centred in a square, optional tile background. */
function markSvg(size, markFill, { bg = null, rx = 0, inset = 0.14 } = {}) {
  const k = bg ? 1 - inset * 2 : 1;
  const side = Math.max(P.bbox.w, P.bbox.h);
  const s = (size * k) / side;
  const tx = (size - P.bbox.w * s) / 2 - P.bbox.x * s;
  const ty = (size - P.bbox.h * s) / 2 - P.bbox.y * s;
  const content = `<g transform="translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(s)})">${markInner(markFill)}</g>`;
  if (!bg) return svgDoc(size, size, content);
  return svgDoc(size, size, `<rect width="${size}" height="${size}" rx="${fmt(rx)}" fill="${bg}"/>` + content);
}

const ON_DARK = { word: CREAM, mark: YELLOW };
const ON_LIGHT = { word: INK, mark: ESPRESSO };
const MONO_DARK = { word: BLACK, mark: BLACK };
const MONO_LIGHT = { word: WHITE, mark: WHITE };

/* ---------- wordmark-only + stacked lockups ---------- */
function wordmarkAt(s, fill) {
  const baseline = CAP * s;
  let x = 0, d = "";
  for (const g of glyphs) {
    d += g.glyph.path.scale(s, -s).translate(x, baseline).toSVG();
    x += g.adv * s;
  }
  return { inner: `<path d="${d}" fill="${fill}"/>`, w: wordUnits * s, h: (CAP + DESC) * s };
}
function boxedWordmark(boxW, boxH, fill, margin = 10) {
  const s = Math.min((boxW - margin * 2) / wordUnits, (boxH - margin * 2) / (CAP + DESC));
  const l = wordmarkAt(s, fill);
  return svgDoc(boxW, boxH, `<g transform="translate(${fmt((boxW - l.w) / 2)} ${fmt((boxH - l.h) / 2)})">${l.inner}</g>`);
}
/** Mark centred above a centred wordmark. */
function stackedLockup(boxW, boxH, palette, margin = 28) {
  const availH = boxH - margin * 2;
  const markPx = availH * 0.56;
  const markS = markPx / Math.max(P.bbox.w, P.bbox.h);
  const markH = P.bbox.h * markS;
  const wmS = Math.min((markH * 0.42) / CAP, (boxW - margin * 2) / wordUnits);
  const wmW = wordUnits * wmS;
  const wmBoxH = (CAP + DESC) * wmS;
  const gap = markH * 0.3;
  const totalH = markH + gap + wmBoxH;
  const top = (boxH - totalH) / 2;
  const mx = (boxW - P.bbox.w * markS) / 2 - P.bbox.x * markS;
  const my = top - P.bbox.y * markS;
  let inner = `<g transform="translate(${fmt(mx)} ${fmt(my)}) scale(${fmt(markS)})">${markInner(palette.mark)}</g>`;
  const wm = wordmarkAt(wmS, palette.word);
  inner += `<g transform="translate(${fmt((boxW - wmW) / 2)} ${fmt(top + markH + gap)})">${wm.inner}</g>`;
  return svgDoc(boxW, boxH, inner);
}

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

/** Espresso tile with the gold mark — favicons, launcher icons, square contexts. */
const tile = (size, rx = 0) => markSvg(size, YELLOW, { bg: ESPRESSO, rx, inset: 0.15 });

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
  write("public/press/dynopay-mark-on-dark.svg", markSvg(512, YELLOW));
  write("public/press/dynopay-mark-on-light.svg", markSvg(512, ESPRESSO));
  write("public/press/dynopay-mark-tile.svg", tile(512, 512 * 0.22));
  write("public/press/dynopay-wordmark-black.svg", boxedWordmark(900, 220, INK));
  write("public/press/dynopay-wordmark-white.svg", boxedWordmark(900, 220, CREAM));
  write("public/press/dynopay-logo-stacked-black.svg", stackedLockup(600, 620, ON_LIGHT));
  write("public/press/dynopay-logo-stacked-white.svg", stackedLockup(600, 620, ON_DARK));

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
      `/** Bold "D" ring (even-odd fill). */\n` +
      `export const LOGO_MARK_RING = "${RING}";\n` +
      `/** Right-pointing settlement arrow in the counter (same fill). */\n` +
      `export const LOGO_MARK_ARROW = "${ARROW}";\n`
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
  /* Web push: icon tile + monochrome badge (OS masks it) */
  await png("public/dynopay-icon-192.png", tile(64, 64 * 0.22), { width: 192, height: 192 });
  await png("public/dynopay-badge-72.png", markSvg(64, WHITE), { width: 72, height: 72 });
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
  // Email chip: on-dark lockup baked onto the espresso header colour. Versioned (v5) to bust mail-proxy caches.
  const chipW = 480;
  const chipH = 160;
  const chipLock = lockupAt(Math.min(360 / totalUnits, 110 / totalHUnits), CREAM, YELLOW);
  const chip = svgDoc(
    chipW,
    chipH,
    `<rect width="${chipW}" height="${chipH}" fill="${ESPRESSO}"/>` +
      `<g transform="translate(${fmt((chipW - chipLock.w) / 2)} ${fmt((chipH - chipLock.h) / 2)})">${chipLock.inner}</g>`
  );
  await png("backend/public/dynopay-email-logo-v5.png", chip, { width: chipW * 2, height: chipH * 2 });

  /* Open Graph share card 1200×630 — espresso ground, single gold corner glow, grain, lockup */
  const og = lockupAt(Math.min(640 / totalUnits, 220 / totalHUnits), CREAM, YELLOW);
  const ogSvg = svgDoc(
    1200,
    630,
    `<rect width="1200" height="630" fill="${ESPRESSO}"/>` +
      `<defs><radialGradient id="g1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1200 0) scale(900 700)"><stop offset="0" stop-color="${YELLOW}" stop-opacity="0.34"/><stop offset="0.5" stop-color="${YELLOW}" stop-opacity="0.12"/><stop offset="1" stop-color="${ESPRESSO}" stop-opacity="0"/></radialGradient>` +
      `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.10 0"/></filter></defs>` +
      `<rect width="1200" height="630" fill="url(#g1)"/><rect width="1200" height="630" filter="url(#grain)" opacity="0.6"/>` +
      `<g transform="translate(${fmt((1200 - og.w) / 2)} ${fmt((630 - og.h) / 2 - 20)})">${og.inner}</g>` +
      `<text x="600" y="500" text-anchor="middle" font-family="Manrope, Inter, Arial, sans-serif" font-size="30" font-weight="600" fill="${CREAM}" fill-opacity="0.72">Crypto payments, settled straight to your wallet · dynopay.com</text>`
  );
  await png("public/og/dynopay-og.png", ogSvg, { width: 1200, height: 630 });

  /* Preview sheet */
  const sheet = svgDoc(
    900,
    480,
    `<rect width="900" height="240" fill="${CREAM}"/><rect y="240" width="900" height="240" fill="${ESPRESSO}"/>` +
      `<g transform="translate(40 50)">${lockupAt(Math.min(440 / totalUnits, 140 / totalHUnits), INK, ESPRESSO).inner}</g>` +
      `<g transform="translate(560 40)">${markSvg(140, ESPRESSO).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(730 40)">${tile(64, 14).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(810 40)">${tile(32, 7).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(860 40)">${tile(16, 3.5).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(40 290)">${lockupAt(Math.min(440 / totalUnits, 140 / totalHUnits), CREAM, YELLOW).inner}</g>` +
      `<g transform="translate(560 280)">${markSvg(140, YELLOW).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(730 280)">${markSvg(64, WHITE).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`
  );
  await png("memory/tmp/dynopay-brand-sheet.png", sheet, { width: 1800, height: 960 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
