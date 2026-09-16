#!/usr/bin/env node
// Brand-refresh concept sheets (design exploration only — does NOT touch shipped assets).
// Run from repo root: node scripts/brand/concepts.mjs  →  memory/brand/concepts/*.png
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const fontkit = createRequire(path.join(ROOT, "backend/package.json"))("fontkit");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const OUT = path.join(ROOT, "memory/brand/concepts");
fs.mkdirSync(OUT, { recursive: true });

const fmt = (n) => (Math.round(n * 100) / 100).toString();
const rad = (d) => (d * Math.PI) / 180;

/* ---------- parametric arrows ---------- */
function arrowPolygon(cx, cy, R, a0deg, a1deg, g) {
  const r = R * g.r;
  const t = R * g.t;
  const hw = t * g.hw;
  const h = t * g.h;
  const pt = (ang, rr) => [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr];
  const a0 = rad(a0deg);
  const a1 = rad(a1deg);
  const steps = 32;
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(pt(a0 + ((a1 - a0) * i) / steps, r + t / 2));
  pts.push(pt(a1, r + hw));
  pts.push(pt(a1 + h / r, r));
  pts.push(pt(a1, r - hw));
  for (let i = steps; i >= 0; i--) pts.push(pt(a0 + ((a1 - a0) * i) / steps, r - t / 2));
  let d = "M" + pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L");
  if (g.roundTail) {
    // close the tail with a semicircle bulging backwards (single non-overlapping outline)
    const [ox, oy] = pt(a0, r + t / 2);
    d += `A${fmt(t / 2)} ${fmt(t / 2)} 0 0 0 ${fmt(ox)} ${fmt(oy)}`;
  }
  return d + "Z";
}
const arrows = (cx, cy, R, g) =>
  arrowPolygon(cx, cy, R, 180 + g.start, 180 + g.start + g.sweep, g) +
  arrowPolygon(cx, cy, R, g.start, g.start + g.sweep, g);

/* ---------- geometry presets ---------- */
const GEO = {
  current: { r: 0.57, t: 0.19, hw: 1.4, h: 1.9, start: 24, sweep: 116, roundTail: false },
  bold: { r: 0.57, t: 0.235, hw: 1.35, h: 1.6, start: 28, sweep: 108, roundTail: true },
};

/* ---------- palettes ---------- */
const PALETTES = {
  indigo: { name: "Indigo (current)", coin: "#4338CA", coinDark: "#6366F1", arrow: "#FFFFFF", g1: "#5B54F0", g2: "#3A2FB5" },
  cobalt: { name: "Cobalt", coin: "#1D4ED8", coinDark: "#3B82F6", arrow: "#FFFFFF", g1: "#3B72F5", g2: "#1A3FBF" },
  inkmint: { name: "Ink + Mint", coin: "#0F172A", coinDark: "#1E293B", arrow: "#34D399", g1: "#1F2A44", g2: "#0B1020" },
};

/* ---------- concept renderers (size = box px) ---------- */
function svgDoc(size, inner, defs = "") {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">${defs}${inner}</svg>`;
}
const R = 32 * 0.94;

function conceptCurrent(size, pal, dark) {
  const coin = dark ? pal.coinDark : pal.coin;
  return svgDoc(size, `<circle cx="32" cy="32" r="${fmt(R)}" fill="${coin}"/><path d="${arrows(32, 32, R, GEO.current)}" fill="${pal.arrow}"/>`);
}
function conceptBold(size, pal, dark) {
  const coin = dark ? pal.coinDark : pal.coin;
  return svgDoc(size, `<circle cx="32" cy="32" r="${fmt(R)}" fill="${coin}"/><path d="${arrows(32, 32, R, GEO.bold)}" fill="${pal.arrow}"/>`);
}
function conceptRim(size, pal, dark) {
  const coin = dark ? pal.coinDark : pal.coin;
  const rim = size >= 40 ? `<circle cx="32" cy="32" r="${fmt(R * 0.86)}" stroke="${pal.arrow}" stroke-opacity="0.32" stroke-width="1.6"/>` : "";
  return svgDoc(size, `<circle cx="32" cy="32" r="${fmt(R)}" fill="${coin}"/>${rim}<path d="${arrows(32, 32, R, GEO.bold)}" fill="${pal.arrow}"/>`);
}
function conceptDepth(size, pal, dark) {
  const g1 = dark ? pal.coinDark : pal.g1;
  const g2 = dark ? pal.coin : pal.g2;
  const defs = `<defs><linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/></linearGradient></defs>`;
  const shadow = size >= 40 ? `<path d="${arrows(32, 32.9, R, GEO.bold)}" fill="#000" fill-opacity="0.22"/>` : "";
  const hi = size >= 40 ? `<ellipse cx="24" cy="18" rx="18" ry="10" fill="#FFF" fill-opacity="0.10"/>` : "";
  return svgDoc(size, `<circle cx="32" cy="32" r="${fmt(R)}" fill="url(#c)"/>${hi}${shadow}<path d="${arrows(32, 32, R, GEO.bold)}" fill="${pal.arrow}"/>`, defs);
}
const CONCEPTS = [
  { id: "0", name: "Current mark (reference)", fn: conceptCurrent },
  { id: "A", name: "A · Bold Loop — thicker arrows, round tails, flat coin", fn: conceptBold },
  { id: "B", name: "B · Coin Rim — Bold Loop + subtle inner rim (drops at ≤32px)", fn: conceptRim },
  { id: "C", name: "C · Depth — Bold Loop + soft gradient, highlight & shadow (flat at ≤32px)", fn: conceptDepth },
];

/* ---------- wordmark lockup ---------- */
const font = fontkit.openSync(path.join(ROOT, "public/fonts/Manrope-ExtraBold.woff"));
const TRACK = -40, O_SLOT_PAD = 70, COIN_R_UNITS = font.xHeight * 0.6, ASC = 1440, DESC = 480;
function glyphRun(text) {
  const run = font.layout(text);
  return run.glyphs.map((g, i) => ({ glyph: g, adv: run.positions[i].xAdvance + TRACK }));
}
const left = glyphRun("dyn"), right = glyphRun("pay");
const slotW = COIN_R_UNITS * 2 + O_SLOT_PAD * 2;
const totalUnits = [...left, ...right].reduce((s, g) => s + g.adv, 0) + slotW - TRACK;
function lockupSvg(widthPx, ink, pal, geo, dark) {
  const s = widthPx / totalUnits;
  const h = (ASC + DESC) * s;
  const baseline = ASC * s;
  let x = 0, d = "";
  for (const g of left) { d += g.glyph.path.scale(s, -s).translate(x, baseline).toSVG(); x += g.adv * s; }
  const cx = x + (O_SLOT_PAD + COIN_R_UNITS) * s, cy = baseline - (font.xHeight / 2) * s, Rc = COIN_R_UNITS * s;
  x += slotW * s;
  for (const g of right) { d += g.glyph.path.scale(s, -s).translate(x, baseline).toSVG(); x += g.adv * s; }
  const coin = dark ? pal.coinDark : pal.coin;
  return { svg: `<svg width="${fmt(widthPx)}" height="${fmt(h)}" viewBox="0 0 ${fmt(widthPx)} ${fmt(h)}" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="${ink}"/><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(Rc)}" fill="${coin}"/><path d="${arrows(cx, cy, Rc, geo)}" fill="${pal.arrow}"/></svg>`, w: widthPx, h };
}

/* ---------- raster helpers ---------- */
const render = (svg, size) => sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toBuffer();
const pixelPreview = async (svg, size, scale) => {
  const small = await render(svg, size);
  return sharp(small).resize(size * scale, size * scale, { kernel: "nearest" }).png().toBuffer();
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const label = (text, color, w, h = 28, fontSize = 16, weight = 600) =>
  sharp(Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="0" y="${h - 8}" font-family="Liberation Sans, FreeSans, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${color}">${esc(text)}</text></svg>`)).png().toBuffer();

/* ---------- sheet 1: concepts × size ladder, light + dark ---------- */
async function conceptSheet() {
  const W = 1600, rowH = 260, top = 90;
  const H = top + rowH * CONCEPTS.length + 20;
  const comps = [];
  comps.push({ input: await label("DynoPay icon refresh — concepts (palette: Indigo). Each row: 128 · 48 · 32 · 16 px (16/32 shown pixel-accurate ×4)", "#111", 1500, 40, 22, 700), left: 40, top: 20 });
  const pal = PALETTES.indigo;
  for (let i = 0; i < CONCEPTS.length; i++) {
    const c = CONCEPTS[i];
    const y = top + i * rowH;
    // light half background + dark half background
    comps.push({ input: await sharp({ create: { width: 760, height: rowH - 16, channels: 4, background: "#F8FAFC" } }).png().toBuffer(), left: 40, top: y });
    comps.push({ input: await sharp({ create: { width: 760, height: rowH - 16, channels: 4, background: "#0B0D17" } }).png().toBuffer(), left: 800, top: y });
    comps.push({ input: await label(c.name, "#111", 740, 30, 18, 700), left: 56, top: y + 8 });
    comps.push({ input: await label(c.name, "#E5E7EB", 740, 30, 18, 700), left: 816, top: y + 8 });
    for (const [dark, x0] of [[false, 56], [true, 816]]) {
      const svg128 = c.fn(128, pal, dark), svg48 = c.fn(48, pal, dark), svg32 = c.fn(32, pal, dark), svg16 = c.fn(16, pal, dark);
      comps.push({ input: await render(svg128, 128), left: x0, top: y + 60 });
      comps.push({ input: await render(svg48, 48), left: x0 + 170, top: y + 100 });
      comps.push({ input: await pixelPreview(svg32, 32, 4), left: x0 + 260, top: y + 60 });
      comps.push({ input: await pixelPreview(svg16, 16, 4), left: x0 + 430, top: y + 92 });
      // browser-tab mock: 16px real size next to a title
      const tabBg = dark ? "#202124" : "#DEE1E6";
      comps.push({ input: await sharp({ create: { width: 200, height: 34, channels: 4, background: tabBg } }).png().toBuffer(), left: x0 + 530, top: y + 100 });
      comps.push({ input: await render(svg16, 16), left: x0 + 542, top: y + 109 });
      comps.push({ input: await label("Dynopay — Dashboard", dark ? "#E8EAED" : "#202124", 170, 24, 13, 400), left: x0 + 566, top: y + 106 });
    }
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: "#FFFFFF" } }).composite(comps).png().toFile(path.join(OUT, "01-concepts.png"));
  console.log("wrote 01-concepts.png");
}

/* ---------- sheet 2: palettes on Concept A + C, light + dark, with lockups ---------- */
async function paletteSheet() {
  const W = 1600, colW = 500, top = 90, rowH = 330;
  const rows = [["A", conceptBold], ["C", conceptDepth]];
  const H = top + rowH * rows.length + 20;
  const comps = [];
  comps.push({ input: await label("Palette options — shown on Concept A (row 1) and Concept C (row 2) · light + dark · 96 / 32 / 16 px + wordmark", "#111", 1500, 40, 22, 700), left: 40, top: 20 });
  const pals = Object.values(PALETTES);
  for (let ri = 0; ri < rows.length; ri++) {
    const [cid, fn] = rows[ri];
    for (let pi = 0; pi < pals.length; pi++) {
      const pal = pals[pi];
      const x = 40 + pi * (colW + 25), y = top + ri * rowH;
      comps.push({ input: await sharp({ create: { width: colW, height: 150, channels: 4, background: "#F8FAFC" } }).png().toBuffer(), left: x, top: y });
      comps.push({ input: await sharp({ create: { width: colW, height: 150, channels: 4, background: "#0B0D17" } }).png().toBuffer(), left: x, top: y + 150 });
      comps.push({ input: await label(`${pal.name}  ·  ${pal.coin} / ${pal.arrow}${pal.coinDark !== pal.coin ? `  ·  dark ${pal.coinDark}` : ""}  ·  Concept ${cid}`, "#111", colW - 20, 28, 15, 700), left: x + 12, top: y + 6 });
      for (const [dark, y0] of [[false, y], [true, y + 150]]) {
        comps.push({ input: await render(fn(96, pal, dark), 96), left: x + 14, top: y0 + 40 });
        comps.push({ input: await pixelPreview(fn(32, pal, dark), 32, 3), left: x + 124, top: y0 + 40 });
        comps.push({ input: await pixelPreview(fn(16, pal, dark), 16, 3), left: x + 234, top: y0 + 64 });
        const lk = lockupSvg(190, dark ? "#FFFFFF" : "#0A0A0B", pal, GEO.bold, dark);
        comps.push({ input: await sharp(Buffer.from(lk.svg), { density: 300 }).resize(190).png().toBuffer(), left: x + 300, top: y0 + 40 + Math.round((96 - lk.h) / 2) });
      }
    }
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: "#FFFFFF" } }).composite(comps).png().toFile(path.join(OUT, "02-palettes.png"));
  console.log("wrote 02-palettes.png");
}

/* ---------- sheet 3: in-context mocks (home-screen tile, social card corner, email header) ---------- */
async function contextSheet() {
  const W = 1600, H = 560;
  const comps = [];
  comps.push({ input: await label("In context — Concept A vs C (Indigo): iOS home-screen tile · Android adaptive · email header chip · dark sidebar", "#111", 1500, 40, 22, 700), left: 40, top: 20 });
  const pal = PALETTES.indigo;
  const items = [["A", conceptBold], ["C", conceptDepth]];
  for (let i = 0; i < items.length; i++) {
    const [cid, fn] = items[i];
    const y = 90 + i * 230;
    comps.push({ input: await label(`Concept ${cid}`, "#111", 200, 28, 18, 700), left: 40, top: y });
    // iOS tile: coin on indigo squircle
    const tile = `<svg width="180" height="180" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="${pal.coin}"/><path d="${arrows(32, 32, 32, GEO.bold)}" fill="#FFF"/></svg>`;
    comps.push({ input: await sharp(Buffer.from(tile), { density: 300 }).resize(140, 140).png().toBuffer(), left: 40, top: y + 40 });
    comps.push({ input: await label("home-screen tile", "#555", 200, 24, 13, 400), left: 40, top: y + 186 });
    // iOS tile alt: coin floating on dark
    const tile2 = `<svg width="180" height="180" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0B0D17"/>${fn(64, pal, true).replace(/<svg[^>]*>|<\/svg>/g, "").replace(/<defs>.*<\/defs>/, "")}</svg>`;
    comps.push({ input: await sharp(Buffer.from(fn(64, pal, false)), { density: 300 }).resize(96, 96).png().toBuffer(), left: 262, top: y + 62 });
    comps.push({ input: await sharp({ create: { width: 140, height: 140, channels: 4, background: "#0B0D17" } }).png().toBuffer(), left: 240, top: y + 40 });
    comps.push({ input: await sharp(Buffer.from(fn(64, pal, true)), { density: 300 }).resize(96, 96).png().toBuffer(), left: 262, top: y + 62 });
    comps.push({ input: await label("dark tile (Android)", "#555", 200, 24, 13, 400), left: 240, top: y + 186 });
    void tile2;
    // email header chip
    comps.push({ input: await sharp({ create: { width: 520, height: 140, channels: 4, background: "#050505" } }).png().toBuffer(), left: 440, top: y + 40 });
    const lk = lockupSvg(220, "#FFFFFF", pal, cid === "A" ? GEO.bold : GEO.bold, false);
    comps.push({ input: await sharp(Buffer.from(lk.svg), { density: 300 }).resize(220).png().toBuffer(), left: 590, top: y + 40 + Math.round((140 - lk.h) / 2) });
    comps.push({ input: await label("email header (always-dark chip)", "#555", 300, 24, 13, 400), left: 440, top: y + 186 });
    // in-app sidebar (light + dark)
    comps.push({ input: await sharp({ create: { width: 260, height: 140, channels: 4, background: "#FFFFFF" } }).png().toBuffer(), left: 1000, top: y + 40 });
    comps.push({ input: await sharp({ create: { width: 258, height: 138, channels: 4, background: "#FFFFFF" } }).png().toBuffer(), left: 1001, top: y + 41 });
    comps.push({ input: await render(fn(40, pal, false), 40), left: 1024, top: y + 64 });
    comps.push({ input: await label("Dashboard", "#111", 150, 24, 14, 600), left: 1080, top: y + 72 });
    comps.push({ input: await label("Transactions", "#666", 150, 24, 14, 400), left: 1024, top: y + 120 });
    comps.push({ input: await sharp({ create: { width: 260, height: 140, channels: 4, background: "#0F1117" } }).png().toBuffer(), left: 1280, top: y + 40 });
    comps.push({ input: await render(fn(40, pal, true), 40), left: 1304, top: y + 64 });
    comps.push({ input: await label("Dashboard", "#F3F4F6", 150, 24, 14, 600), left: 1360, top: y + 72 });
    comps.push({ input: await label("Transactions", "#9CA3AF", 150, 24, 14, 400), left: 1304, top: y + 120 });
    comps.push({ input: await label("in-app header, light / dark", "#555", 300, 24, 13, 400), left: 1000, top: y + 186 });
  }
  // outline the light sidebar boxes
  await sharp({ create: { width: W, height: H, channels: 4, background: "#EEF0F4" } }).composite(comps).png().toFile(path.join(OUT, "03-context.png"));
  console.log("wrote 03-context.png");
}

await conceptSheet();
await paletteSheet();
await contextSheet();
