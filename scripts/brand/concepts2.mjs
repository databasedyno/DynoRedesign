#!/usr/bin/env node
// Dynopay 2026 logo refresh — concept exploration for the APPROVED brief:
// mark = "payment flow -> direct settlement", reads as a D, SINGLE gold accent on dark
// (no aqua, no gradient, no 3D). Exploration only — does not touch shipped assets.
// Run from repo root: node scripts/brand/concepts2.mjs -> memory/brand/concepts/flow-concepts.png
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const OUT = path.join(ROOT, "memory/brand/concepts");
fs.mkdirSync(OUT, { recursive: true });

const GOLD = "#FFD100";
const DARK = "#121214";
const LIGHT = "#F5F7FA";

// Shared bold "D" ring (even-odd: outer D silhouette minus inset counter). 64-unit box.
const D_RING =
  "M14 8H30A24 24 0 0 1 30 56H14Z M22 16H30A16 16 0 0 1 30 48H22Z";

// Flow elements (all drawn in the mark colour, inside the D counter).
const ARROW = "M24 29H34V24.5L43 32L34 39.5V35H24Z"; // solid right arrow
const CHEVRON = "M28 23H33L42 32L33 41H28L35 32Z"; // thick ">" chevron
const DOT = "M39 32a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0 -6.8 0Z"; // settled coin
const ARROW_SHORT = "M24 29H33V24.5L40.5 32L33 39.5V35H24Z";

function concept(id, fill) {
  const ring = `<path d="${D_RING}" fill="${fill}" fill-rule="evenodd"/>`;
  if (id === "A") return ring + `<path d="${ARROW}" fill="${fill}"/>`;
  if (id === "B") return ring + `<path d="${CHEVRON}" fill="${fill}"/>`;
  // C: arrow lands on a settled coin dot
  return ring + `<path d="${ARROW_SHORT}" fill="${fill}"/><path d="${DOT}" fill="${fill}"/>`;
}

const svg = (size, id, dark) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${concept(id, dark ? GOLD : DARK)}</svg>`;
// tile = gold mark on a dark rounded square (app icon)
const tile = (size, id) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="${DARK}"/><g transform="translate(6.4 6.4) scale(0.8)">${concept(id, GOLD)}</g></svg>`;

const render = (s, size) => sharp(Buffer.from(s), { density: 600 }).resize(size, size).png().toBuffer();
const pixel = async (s, size, scale) => sharp(await render(s, size)).resize(size * scale, size * scale, { kernel: "nearest" }).png().toBuffer();
const label = (text, color, w, h = 28, fs = 16, weight = 600) =>
  sharp(Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="0" y="${h - 8}" font-family="Liberation Sans, FreeSans, sans-serif" font-size="${fs}" font-weight="${weight}" fill="${color}">${text}</text></svg>`)).png().toBuffer();

const CONCEPTS = [
  ["A", "A · Settle-D — bold D, solid right arrow in the counter (flow into the owned form)"],
  ["B", "B · Aperture-D — bold D with an open ' > ' chevron (lighter, more abstract)"],
  ["C", "C · Landing-D — arrow meets a settled coin dot (flow -> settlement)"],
];

async function main() {
  const W = 1600, rowH = 250, top = 92;
  const H = top + rowH * CONCEPTS.length + 20;
  const comps = [];
  comps.push({ input: await label("Dynopay logo refresh — mark concepts (gold on dark · dark on light). Row: 128 · 48px + pixel-accurate 32/16 + app tile + 16px tab", "#111", 1550, 40, 20, 700), left: 36, top: 22 });
  for (let i = 0; i < CONCEPTS.length; i++) {
    const [id, name] = CONCEPTS[i];
    const y = top + i * rowH;
    comps.push({ input: await sharp({ create: { width: 760, height: rowH - 16, channels: 4, background: LIGHT } }).png().toBuffer(), left: 36, top: y });
    comps.push({ input: await sharp({ create: { width: 780, height: rowH - 16, channels: 4, background: "#0A0A0D" } }).png().toBuffer(), left: 800, top: y });
    comps.push({ input: await label(name, "#111", 740, 28, 16, 700), left: 50, top: y + 6 });
    comps.push({ input: await label(name, "#E5E7EB", 740, 28, 16, 700), left: 814, top: y + 6 });
    for (const [dark, x0] of [[false, 50], [true, 814]]) {
      comps.push({ input: await render(svg(120, id, dark), 120), left: x0, top: y + 48 });
      comps.push({ input: await render(svg(48, id, dark), 48), left: x0 + 150, top: y + 84 });
      comps.push({ input: await pixel(svg(32, id, dark), 32, 4), left: x0 + 230, top: y + 48 });
      comps.push({ input: await pixel(svg(16, id, dark), 16, 4), left: x0 + 380, top: y + 80 });
      comps.push({ input: await render(tile(120, id), 96), left: x0 + 470, top: y + 60 });
      // 16px browser-tab mock
      const tabBg = dark ? "#202124" : "#DEE1E6";
      comps.push({ input: await sharp({ create: { width: 196, height: 32, channels: 4, background: tabBg } }).png().toBuffer(), left: x0 + 580, top: y + 92 });
      comps.push({ input: await render(tile(16, id), 16), left: x0 + 590, top: y + 100 });
      comps.push({ input: await label("Dynopay", dark ? "#E8EAED" : "#202124", 150, 22, 13, 400), left: x0 + 612, top: y + 98 });
    }
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: "#FFFFFF" } }).composite(comps).png().toFile(path.join(OUT, "flow-concepts.png"));
  console.log("wrote", path.join(OUT, "flow-concepts.png"));
}
main().catch((e) => { console.error(e); process.exit(1); });
