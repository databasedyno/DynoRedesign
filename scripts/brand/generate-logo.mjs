#!/usr/bin/env node
// Dynopay brand generator — wordmark "dynopay" with the indigo "conversion coin" as the o.
// Run from repo root:  node scripts/brand/generate-logo.mjs
// Emits every logo asset (SVG lockups, mark, favicons, PNGs for auth/PDF/email/press).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const fontkit = createRequire(path.join(ROOT, "backend/package.json"))("fontkit");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");

const INK = "#0A0A0B";
const WHITE = "#FFFFFF";
const INDIGO = "#4338CA";
const INDIGO_DARK = "#6366F1";
const CHIP = "#050505";

const font = fontkit.openSync(path.join(ROOT, "public/fonts/Manrope-ExtraBold.woff"));
const TRACK = -40; // font units between glyphs (tighter, logo-like)
const O_SLOT_PAD = 70; // sidebearing kept around the coin (matches the "o")
const COIN_R_UNITS = font.xHeight * 0.6; // coin slightly taller than the x-height
const ASC = 1440; // "d" ascender in font units
const DESC = 480; // "y" / "p" descender

const fmt = (n) => (Math.round(n * 100) / 100).toString();

/* ---------- coin geometry (px space, centre cx,cy, radius R) ---------- */
function arrowPolygon(cx, cy, R, a0deg, a1deg) {
  const r = R * 0.57;
  const t = R * 0.19;
  const hw = t * 1.4;
  const h = t * 1.9;
  const rad = (d) => (d * Math.PI) / 180;
  const pt = (ang, rr) => [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr];
  const a0 = rad(a0deg);
  const a1 = rad(a1deg);
  const steps = 28;
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(pt(a0 + ((a1 - a0) * i) / steps, r + t / 2));
  pts.push(pt(a1, r + hw));
  pts.push(pt(a1 + h / r, r));
  pts.push(pt(a1, r - hw));
  for (let i = steps; i >= 0; i--) pts.push(pt(a0 + ((a1 - a0) * i) / steps, r - t / 2));
  return "M" + pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L") + "Z";
}
const arrowsPath = (cx, cy, R) => arrowPolygon(cx, cy, R, 204, 320) + arrowPolygon(cx, cy, R, 24, 140);
const circlePath = (cx, cy, R) =>
  `M${fmt(cx - R)} ${fmt(cy)}a${fmt(R)} ${fmt(R)} 0 1 0 ${fmt(2 * R)} 0a${fmt(R)} ${fmt(R)} 0 1 0 ${fmt(-2 * R)} 0Z`;

function coinSvgInner(cx, cy, R, coinFill, arrowFill) {
  return (
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(R)}" fill="${coinFill}"/>` +
    `<path d="${arrowsPath(cx, cy, R)}" fill="${arrowFill}"/>`
  );
}

/* ---------- wordmark ---------- */
function glyphRun(text) {
  const run = font.layout(text);
  return run.glyphs.map((g, i) => ({ glyph: g, adv: run.positions[i].xAdvance + TRACK }));
}
const left = glyphRun("dyn");
const right = glyphRun("pay");
const slotW = COIN_R_UNITS * 2 + O_SLOT_PAD * 2;
const totalUnits = [...left, ...right].reduce((s, g) => s + g.adv, 0) + slotW - TRACK;

// Returns { inner, w, h } for a lockup at the given pixel width.
function lockup(widthPx, inkFill, coinFill = INDIGO, arrowFill = WHITE, pad = 0) {
  const s = (widthPx - pad * 2) / totalUnits;
  const h = (ASC + DESC) * s + pad * 2;
  const baseline = pad + ASC * s;
  let x = pad;
  let d = "";
  for (const g of left) {
    d += g.glyph.path.scale(s, -s).translate(x, baseline).toSVG();
    x += g.adv * s;
  }
  const cx = x + (O_SLOT_PAD + COIN_R_UNITS) * s;
  const cy = baseline - (font.xHeight / 2) * s;
  const R = COIN_R_UNITS * s;
  x += slotW * s;
  for (const g of right) {
    d += g.glyph.path.scale(s, -s).translate(x, baseline).toSVG();
    x += g.adv * s;
  }
  const inner = `<path d="${d}" fill="${inkFill}"/>` + coinSvgInner(cx, cy, R, coinFill, arrowFill);
  return { inner, w: widthPx, h };
}

function svgDoc(w, h, inner, { viewW = w, viewH = h, extra = "" } = {}) {
  return (
    `<svg width="${fmt(w)}" height="${fmt(h)}" viewBox="0 0 ${fmt(viewW)} ${fmt(viewH)}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dynopay">` +
    extra +
    inner +
    `</svg>`
  );
}

// Lockup centred inside a fixed box (keeps the historical 134×45 frame every caller relies on).
function boxedLockup(boxW, boxH, inkFill, opts = {}) {
  const { coinFill = INDIGO, arrowFill = WHITE, margin = 1 } = opts;
  const l = lockup(boxW - margin * 2, inkFill, coinFill, arrowFill);
  const dy = (boxH - l.h) / 2;
  return svgDoc(boxW, boxH, `<g transform="translate(${fmt(margin)} ${fmt(dy)})">${l.inner}</g>`);
}

// Stand-alone mark (coin) in a square box.
function markSvg(size, coinFill, arrowFill = WHITE, { bg = null, marginRatio = 0.03 } = {}) {
  const R = (size / 2) * (1 - marginRatio * 2);
  const inner = bg
    ? `<rect width="${size}" height="${size}" fill="${bg}"/><path d="${arrowsPath(size / 2, size / 2, size / 2)}" fill="${arrowFill}"/>`
    : coinSvgInner(size / 2, size / 2, R, coinFill, arrowFill);
  return svgDoc(size, size, inner);
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

// Minimal ICO container with PNG-encoded entries.
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
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    dir.push(e);
  }
  return Buffer.concat([header, ...dir, ...pngs.map((p) => p.buf)]);
}

async function main() {
  /* SVG lockups (134×45 frame) */
  const black = boxedLockup(134, 45, INK);
  const white = boxedLockup(134, 45, WHITE);
  write("assets/Icons/home/dynopay-blackLogo.svg", black);
  write("assets/Icons/home/dynopay-whiteLogo.svg", white);
  write("assets/Images/auth/dynopay-logo.svg", black);
  write("public/press/dynopay-logo-black.svg", boxedLockup(1340, 450, INK, { margin: 10 }));
  write("public/press/dynopay-logo-white.svg", boxedLockup(1340, 450, WHITE, { margin: 10 }));

  /* favicon.svg — adapts coin tint to the OS colour scheme */
  const fav = markSvg(64, INDIGO).replace(
    `<circle `,
    `<style>.coin{fill:${INDIGO}}@media (prefers-color-scheme:dark){.coin{fill:${INDIGO_DARK}}}</style><circle class="coin" `
  );
  write("public/favicon.svg", fav);

  /* Mark paths for the React <Logo/> component */
  const M = 64;
  const R = (M / 2) * 0.94;
  write(
    "assets/Icons/logoMarkPaths.ts",
    `// Generated by scripts/brand/generate-logo.mjs — do not edit by hand.\n` +
      `export const LOGO_MARK_VIEWBOX = "0 0 ${M} ${M}";\n` +
      `export const LOGO_MARK_COIN = "${circlePath(M / 2, M / 2, R)}";\n` +
      `export const LOGO_MARK_ARROWS = "${arrowsPath(M / 2, M / 2, R)}";\n`
  );

  /* Favicon PNGs + ICO */
  const mark = (fill) => markSvg(64, fill);
  await png("public/favicon-16.png", mark(INDIGO), { width: 16, height: 16 });
  await png("public/favicon-32.png", mark(INDIGO), { width: 32, height: 32 });
  await png("public/favicon-16-light.png", mark(INDIGO_DARK), { width: 16, height: 16 });
  await png("public/favicon-32-light.png", mark(INDIGO_DARK), { width: 32, height: 32 });
  await png("public/favicon-512.png", mark(INDIGO), { width: 512, height: 512 });
  await png("public/press/dynopay-icon-512.png", mark(INDIGO), { width: 512, height: 512 });
  const tile = markSvg(64, INDIGO, WHITE, { bg: INDIGO });
  await png("public/dynopay-favicon.png", tile, { width: 180, height: 180 });
  await png("public/dynopay-favicon-light.png", tile, { width: 180, height: 180 });
  const icoParts = [];
  for (const size of [16, 32, 48]) {
    const buf = await sharp(Buffer.from(mark(INDIGO)), { density: 600 }).resize(size, size).png().toBuffer();
    icoParts.push({ size, buf });
  }
  write("public/favicon.ico", ico(icoParts));

  /* Auth / marketing PNGs */
  await png("assets/Images/auth/dynopay-white-logo.png", white, { width: 536, height: 180 });
  await png("assets/Images/auth/dynopay-logo.png", black, { width: 536, height: 180 });
  await png("assets/Images/auth/dynopay-mobile-logo.png", mark(INDIGO), { width: 96, height: 96 });

  /* Backend: PDF + email */
  await png("backend/assets/dynopay-logo.png", black, { width: 1340, height: 450 });
  await png("backend/assets/dynopay-white-logo.png", white, { width: 804, height: 270 });
  await png("backend/assets/dynopay-logo2.png", mark(INDIGO), { width: 128, height: 128 });
  await png("backend/public/dynopay-white-logo.png", white, { width: 804, height: 270 });
  // Email chip: white wordmark baked onto the always-dark header colour (3:1 to match the <img> box).
  const chipW = 480;
  const chipH = 160;
  const chipLock = lockup(360, WHITE);
  const chip = svgDoc(
    chipW,
    chipH,
    `<rect width="${chipW}" height="${chipH}" fill="${CHIP}"/>` +
      `<g transform="translate(${fmt((chipW - chipLock.w) / 2)} ${fmt((chipH - chipLock.h) / 2)})">${chipLock.inner}</g>`
  );
  await png("backend/public/dynopay-email-logo.png", chip, { width: chipW, height: chipH });

  /* Preview sheet for eyeballing */
  const sheet = svgDoc(
    800,
    420,
    `<rect width="800" height="210" fill="#FFFFFF"/><rect y="210" width="800" height="210" fill="#09090B"/>` +
      `<g transform="translate(40 40)">${lockup(400, INK).inner}</g>` +
      `<g transform="translate(520 40)">${markSvg(128, INDIGO).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(680 40)">${markSvg(32, INDIGO).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(730 40)">${markSvg(16, INDIGO).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>` +
      `<g transform="translate(40 250)">${lockup(400, WHITE).inner}</g>` +
      `<g transform="translate(520 250)">${markSvg(128, INDIGO_DARK).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`
  );
  await png("/tmp/dynopay-brand-sheet.png", sheet, { width: 1600, height: 840 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
