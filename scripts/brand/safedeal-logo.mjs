#!/usr/bin/env node
// SafeDeal logo generator (2026-10 re-imagine). One geometry source for every surface.
//   node scripts/brand/safedeal-logo.mjs --concepts        -> React data for all 3 concepts (comparison page)
//   node scripts/brand/safedeal-logo.mjs --final=<id>      -> chosen concept: React data + every shipped asset
// Shipped concept (2026-10): --final=hold
// Marks live on a 48-unit grid (36-unit optical body). Wordmark = Outfit SemiBold, outlined (no font dependency).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const fontkit = createRequire(path.join(ROOT, "backend/package.json"))("fontkit");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");

const GOLD = "#FFC61A";
const INK = "#0A0A0B";
const WHITE = "#FFFFFF";
const f2 = (n) => (Math.round(n * 100) / 100).toString();

/* ---------- geometry helpers ---------- */
// Disc of radius R split by a stepped seam (left channel above centre, right channel below).
function discHalf(R, g, off, vw, flip = false) {
  const c = 24, yL = c - off - g / 2, yR = c + off - g / 2, xv = c + vw / 2;
  const xl = c - Math.sqrt(R * R - (yL - c) ** 2), xr = c + Math.sqrt(R * R - (yR - c) ** 2);
  const pts = [[xl, yL], [xr, yR], [xv, yR], [xv, yL]].map(([x, y]) => (flip ? [48 - x, 48 - y] : [x, y]).map(f2));
  return `M${pts[0].join(" ")}A${R} ${R} 0 0 1 ${pts[1].join(" ")}L${pts[2].join(" ")}L${pts[3].join(" ")}Z`;
}
function discSeam(R, g, off, vw) {
  const c = 24, a = c - off - g / 2, b = c - off + g / 2, d = c + off - g / 2, e = c + off + g / 2;
  const x1 = c - vw / 2, x2 = c + vw / 2;
  const xl1 = c - Math.sqrt(R * R - (a - c) ** 2), xl2 = c - Math.sqrt(R * R - (b - c) ** 2);
  const xr1 = c + Math.sqrt(R * R - (d - c) ** 2), xr2 = c + Math.sqrt(R * R - (e - c) ** 2);
  return `M${f2(xl1)} ${a}H${x2}V${d}H${f2(xr1)}A${R} ${R} 0 0 1 ${f2(xr2)} ${e}H${x1}V${b}H${f2(xl2)}A${R} ${R} 0 0 1 ${f2(xl1)} ${a}Z`;
}

/* ---------- the three concepts ---------- */
// part: { kind: "stroke"|"fill"|"rect", role: "ink"|"gold", mono: "ink"|"omit" }
export const CONCEPTS = {
  hold: {
    name: "The Hold",
    line: "Two halves hold the money in the middle.",
    story:
      "An “S” built from two interlocking halves — the buyer and the seller. The small gold square held between them is the money in escrow.",
    fit: [24, 24, 1],
    parts: [
      { kind: "stroke", d: "M36 10H17A7 7 0 0 0 17 24", w: 8, role: "ink" },
      { kind: "stroke", d: "M31 24A7 7 0 0 1 31 38H12", w: 8, role: "ink" },
      { kind: "rect", x: 20, y: 20, w: 8, h: 8, rx: 1.2, role: "gold", mono: "ink" },
    ],
  },
  seal: {
    name: "The Seal",
    line: "Two halves lock into one closed seal.",
    story:
      "Two halves locked together into one closed seal, like a handshake pressed into wax. Gold marks the seam where the two sides join.",
    fit: [24, 24, 1],
    parts: [
      { kind: "fill", d: discHalf(18, 4, 6.5, 4), role: "ink" },
      { kind: "fill", d: discHalf(18, 4, 6.5, 4, true), role: "ink" },
      { kind: "fill", d: discSeam(18, 4, 6.5, 4), role: "gold", mono: "omit" },
    ],
  },
  release: {
    name: "The Release",
    line: "The last stroke of the S is a tick.",
    story:
      "A bold “S” whose last stroke becomes a tick. The tick is gold: the deal is complete and the funds are released.",
    fit: [25.4, 24.3, 0.93],
    parts: [
      { kind: "stroke", d: "M36 8.5H19A7 7 0 0 0 19 22.5H28.2", w: 8, role: "ink" },
      { kind: "stroke", d: "M11.5 30.5L19.5 38.5L40 18", w: 8, join: "miter", role: "gold", mono: "ink" },
    ],
  },
};

/**
 * SVG inner markup for a mark on the 48 grid. `gold === null` = single-colour (mono) version.
 * Elements carry classes (if/is = ink fill/stroke, gf/gs = gold) so the favicon can re-colour via CSS.
 */
export function markInner(id, ink, gold) {
  const c = CONCEPTS[id];
  const [cx, cy, k] = c.fit;
  const els = c.parts
    .map((p) => {
      const isGold = p.role === "gold" && gold !== null;
      if (p.role === "gold" && gold === null && p.mono === "omit") return "";
      const col = isGold ? gold : ink;
      const g = isGold ? "g" : "i";
      if (p.kind === "rect") return `<rect class="${g}f" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="${col}"/>`;
      if (p.kind === "fill") return `<path class="${g}f" d="${p.d}" fill="${col}"/>`;
      return `<path class="${g}s" d="${p.d}" fill="none" stroke="${col}" stroke-width="${p.w}"${p.join ? ` stroke-linejoin="${p.join}"` : ""}/>`;
    })
    .join("");
  if (cx === 24 && cy === 24 && k === 1) return els;
  return `<g transform="translate(24 24) scale(${k}) translate(${-cx} ${-cy})">${els}</g>`;
}

/* ---------- wordmark (Outfit SemiBold, tuned tracking) ---------- */
const font = fontkit.openSync(path.join(ROOT, "public/fonts/Outfit-SemiBold.woff2"));
const TRACK = -12; // per 1000 em
const CAP = font.capHeight;
const WM_SCALE = 100 / CAP; // normalised: cap height = 100 units
function buildWordmark() {
  const run = font.layout("SafeDeal");
  let x = 0, d = "", minY = Infinity, maxY = -Infinity, maxX = 0;
  run.glyphs.forEach((g, i) => {
    const p = g.path.scale(WM_SCALE, -WM_SCALE).translate(x, 100);
    const bb = p.bbox;
    minY = Math.min(minY, bb.minY);
    maxY = Math.max(maxY, bb.maxY);
    maxX = Math.max(maxX, bb.maxX);
    d += p.toSVG();
    x += (run.positions[i].xAdvance + (TRACK * font.unitsPerEm) / 1000) * WM_SCALE;
  });
  // shift so the ink box starts at y=0; baseline then sits at `base`
  const shifted = run.glyphs.reduce(
    (acc, g, i) => {
      const p = g.path.scale(WM_SCALE, -WM_SCALE).translate(acc.x, 100 - minY);
      return { x: acc.x + (run.positions[i].xAdvance + (TRACK * font.unitsPerEm) / 1000) * WM_SCALE, d: acc.d + p.toSVG() };
    },
    { x: 0, d: "" }
  );
  return { d: shifted.d.replace(/(\d+\.\d{2})\d+/g, "$1"), w: Math.ceil(maxX), h: Math.ceil(maxY - minY), base: Number(f2(100 - minY)) };
}
export const WORDMARK = buildWordmark();

/* ---------- lockup ---------- */
// Mark optical body (36 of 48 units) = 1.5 × cap height; gap = 0.42 × cap.
const MARK_BOX_PER_CAP = (1.5 * 48) / 36; // mark box height per cap unit
function lockup(id, { ink, gold, word }, capPx) {
  const s = capPx / 100;
  const markBox = MARK_BOX_PER_CAP * capPx;
  const capTop = (WORDMARK.base - 100) * s; // y of cap line inside the wordmark box
  const wmH = WORDMARK.h * s;
  const h = Math.max(markBox, wmH);
  const markY = (h - markBox) / 2;
  const wmY = markY + markBox / 2 - (capTop + 50 * s); // centre cap height on the mark
  const gap = 0.42 * capPx;
  const w = markBox + gap + WORDMARK.w * s;
  const inner =
    `<g transform="translate(0 ${f2(markY)}) scale(${f2(markBox / 48)})">${markInner(id, ink, gold)}</g>` +
    `<g transform="translate(${f2(markBox + gap)} ${f2(wmY)}) scale(${s})"><path d="${WORDMARK.d}" fill="${word}"/></g>`;
  return { inner, w, h };
}
const svgDoc = (w, h, inner, label = "SafeDeal") =>
  `<svg width="${f2(w)}" height="${f2(h)}" viewBox="0 0 ${f2(w)} ${f2(h)}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${inner}</svg>`;
const markSvg = (id, size, ink, gold, { bg = null, rx = 0, inset = 0 } = {}) => {
  const k = (size * (1 - inset * 2)) / 48;
  const o = (size - 48 * k) / 2;
  const tile = bg ? `<rect width="${size}" height="${size}" rx="${f2(rx)}" fill="${bg}"/>` : "";
  return svgDoc(size, size, tile + `<g transform="translate(${f2(o)} ${f2(o)}) scale(${f2(k)})">${markInner(id, ink, gold)}</g>`);
};

/* ---------- writers ---------- */
const write = (rel, content) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  console.log("wrote", rel);
};
const png = async (rel, svg, w, h, background) => {
  let img = sharp(Buffer.from(svg), { density: 480 }).resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (background) img = img.flatten({ background });
  const buf = await img.png({ compressionLevel: 9 }).toBuffer();
  write(rel, buf);
  return buf;
};
function ico(parts) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(parts.length, 4);
  let offset = 6 + 16 * parts.length;
  const dir = parts.map(({ size, buf }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size, 0);
    e.writeUInt8(size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    return e;
  });
  return Buffer.concat([header, ...dir, ...parts.map((p) => p.buf)]);
}

const TPL_INK = "__INK__";
const TPL_GOLD = "__GOLD__";
function dataFile(ids) {
  if (ids.length === 1) {
    const [id] = ids;
    return (
      `// Generated by scripts/brand/safedeal-logo.mjs (--final=${id}) — do not edit by hand.\n` +
      `// Mark markup is for a 48×48 viewBox; replace ${TPL_INK} / ${TPL_GOLD} with colours.\n` +
      `/** SafeDeal symbol — ${CONCEPTS[id].name}: ${CONCEPTS[id].story.replace(/[“”]/g, '"')} */\n` +
      `export const SD_MARK = ${JSON.stringify({ color: markInner(id, TPL_INK, TPL_GOLD), mono: markInner(id, TPL_INK, null) }, null, 2)} as const;\n\n` +
      `/** "SafeDeal" wordmark outline (Outfit SemiBold). Cap height = 100 units; baseline at y=${WORDMARK.base}. */\n` +
      `export const SD_WORDMARK = ${JSON.stringify(WORDMARK)} as const;\n\n` +
      `/** Mark box height per wordmark cap-height unit, and the gap between them (× cap height). */\n` +
      `export const SD_LOCKUP = { markPerCap: ${f2(MARK_BOX_PER_CAP)}, gapPerCap: 0.42 } as const;\n`
    );
  }
  const concepts = ids.map((id) => ({
    id,
    name: CONCEPTS[id].name,
    line: CONCEPTS[id].line,
    story: CONCEPTS[id].story,
    color: markInner(id, TPL_INK, TPL_GOLD),
    mono: markInner(id, TPL_INK, null),
  }));
  return (
    `// Generated by scripts/brand/safedeal-logo.mjs — do not edit by hand.\n` +
    `// Mark markup is for a 48×48 viewBox; replace ${TPL_INK} / ${TPL_GOLD} with colours.\n` +
    `export const SD_LOGO_CONCEPTS = ${JSON.stringify(concepts, null, 2)} as const;\n\n` +
    `/** "SafeDeal" wordmark outline (Outfit SemiBold). Cap height = 100 units; baseline at y=${WORDMARK.base}. */\n` +
    `export const SD_WORDMARK = ${JSON.stringify(WORDMARK)} as const;\n\n` +
    `/** Mark box height per wordmark cap-height unit, and the gap between them (× cap height). */\n` +
    `export const SD_LOCKUP = { markPerCap: ${f2(MARK_BOX_PER_CAP)}, gapPerCap: 0.42 } as const;\n`
  );
}

async function final(id) {
  const color = (ink) => ({ ink, gold: GOLD, word: ink });
  const mono = (ink) => ({ ink, gold: null, word: ink });

  /* Brand family (SVG) */
  const L = (pal, cap = 100) => lockup(id, pal, cap);
  const fam = {
    "safedeal-logo-black.svg": L(color(INK)),
    "safedeal-logo-white.svg": L(color(WHITE)),
    "safedeal-logo-mono-black.svg": L(mono(INK)),
    "safedeal-logo-mono-white.svg": L(mono(WHITE)),
  };
  for (const [f, l] of Object.entries(fam)) write(`public/safedeal/brand/${f}`, svgDoc(l.w, l.h, l.inner));
  write("public/safedeal/brand/safedeal-mark.svg", markSvg(id, 512, INK, GOLD));
  write("public/safedeal/brand/safedeal-mark-white.svg", markSvg(id, 512, WHITE, GOLD));
  write("public/safedeal/brand/safedeal-mark-mono-black.svg", markSvg(id, 512, INK, null));
  write("public/safedeal/brand/safedeal-mark-mono-white.svg", markSvg(id, 512, WHITE, null));
  write("public/safedeal/brand/safedeal-icon-tile.svg", markSvg(id, 512, WHITE, GOLD, { bg: INK, rx: 112, inset: 0.18 }));

  /* Tab icon — black mark on light tabs, white on dark tabs (gold accent kept). */
  const fav = markSvg(id, 64, INK, GOLD).replace(
    'aria-label="SafeDeal">',
    `aria-label="SafeDeal"><style>.if{fill:${INK}}.is{stroke:${INK}}@media (prefers-color-scheme:dark){.if{fill:${WHITE}}.is{stroke:${WHITE}}}</style>`
  );
  write("public/safedeal/favicon.svg", fav);
  // Legacy PNG/ICO tab icons: black mark on a white rounded tile (readable on light and dark tabs).
  const lightTile = markSvg(id, 64, INK, GOLD, { bg: WHITE, rx: 14, inset: 0.1 });
  const icoParts = [];
  for (const size of [16, 32, 48]) icoParts.push({ size, buf: await png(`public/safedeal/favicon-${size}.png`, lightTile, size, size) });
  write("public/safedeal/favicon.ico", ico(icoParts));

  /* App / home-screen icons — ink tile, white mark, gold accent. */
  const appTile = markSvg(id, 512, WHITE, GOLD, { bg: INK, rx: 112, inset: 0.18 });
  const squareTile = markSvg(id, 512, WHITE, GOLD, { bg: INK, inset: 0.2 });
  await png("public/safedeal/favicon-192.png", appTile, 192, 192);
  await png("public/safedeal/favicon-512.png", appTile, 512, 512);
  await png("public/safedeal/favicon-maskable-512.png", markSvg(id, 512, WHITE, GOLD, { bg: INK, inset: 0.26 }), 512, 512);
  await png("public/safedeal/apple-touch-icon.png", squareTile, 180, 180);
  // Telegram bot profile picture (upload via @BotFather → /setuserpic). Circle-crop safe.
  await png("public/safedeal/brand/safedeal-telegram-avatar-640.png", markSvg(id, 640, WHITE, GOLD, { bg: INK, inset: 0.24 }), 640, 640);

  /* Emails — gold-free. Light: black lockup on a white rounded chip (survives Gmail's forced dark). Dark: white lockup. */
  const E = { w: 396, h: 132, padX: 18 };
  const emailLogo = (pal, chip) => {
    const l = lockup(id, pal, 40);
    return svgDoc(E.w, E.h, (chip ? `<rect width="${E.w}" height="${E.h}" rx="20" fill="${chip}"/>` : "") + `<g transform="translate(${E.padX} ${f2((E.h - l.h) / 2)})">${l.inner}</g>`);
  };
  await png("backend/public/safedeal-email-logo-light-v1.png", emailLogo(mono(INK), WHITE), E.w * 3, E.h * 3);
  await png("backend/public/safedeal-email-logo-dark-v1.png", emailLogo(mono(WHITE), null), E.w * 3, E.h * 3);

  /* PDFs — colour lockup on transparent (pdfkit embeds the PNG). */
  const pdfL = L(color(INK), 100);
  await png("backend/assets/safedeal-logo.png", svgDoc(pdfL.w, pdfL.h, pdfL.inner), Math.round(pdfL.w * 2), Math.round(pdfL.h * 2));
  // Per-deal share card header (white lockup, composited by controller/safedeal/safedealOgImage.ts).
  const ogL = L(color(WHITE), 100);
  await png("backend/assets/safedeal-og-lockup.png", svgDoc(ogL.w, ogL.h, ogL.inner), Math.round((ogL.w * 64) / ogL.h), 64);

  /* Static site share card 1200×630 — calm ink ground, white lockup, one line of copy. */
  const og = lockup(id, color(WHITE), 120);
  const ogSvg = svgDoc(
    1200,
    630,
    `<rect width="1200" height="630" fill="${INK}"/>` +
      `<g transform="translate(${f2((1200 - og.w) / 2)} ${f2(250 - og.h / 2)})">${og.inner}</g>` +
      `<text x="600" y="430" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="600" fill="${WHITE}" fill-opacity="0.78">Escrow for online deals. The payment is held until the seller delivers.</text>` +
      `<text x="600" y="540" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="600" letter-spacing="2" fill="${GOLD}">SAFEDEAL.SH</text>`
  );
  await png("public/safedeal/og-image.png", ogSvg, 1200, 630);

  write("Components/SafeDeal/brand/sdLogoData.ts", dataFile([id]));
}

const arg = process.argv.find((a) => a.startsWith("--final="));
if (arg) await final(arg.split("=")[1]);
else write("Components/SafeDeal/brand/sdLogoData.ts", dataFile(Object.keys(CONCEPTS)));
