// Throwaway exploration renderer for SafeDeal mark geometry.
import { createRequire } from "node:module";
import fs from "node:fs";
const sharp = createRequire("/app/package.json")("sharp");
const GOLD = "#FFC61A", INK = "#0A0A0B", WHITE = "#FFFFFF";

const f2 = (n) => Math.round(n * 100) / 100;
// Annulus piece between two horizontal cuts, walking clockwise from a to b.
function ringPiece(a, b, cx = 24, cy = 24, R = 18, r = 10) {
  const pt = (rad, c) => {
    const dy = c.y - cy;
    const dx = Math.sqrt(rad * rad - dy * dy) * (c.side === "L" ? -1 : 1);
    return [cx + dx, c.y, Math.atan2(dy, dx)];
  };
  const [ox1, oy1, oa1] = pt(R, a), [ox2, oy2, oa2] = pt(R, b);
  const [ix1, iy1] = pt(r, a), [ix2, iy2] = pt(r, b);
  let sweep = oa2 - oa1;
  while (sweep <= 0) sweep += Math.PI * 2;
  const large = sweep > Math.PI ? 1 : 0;
  return `M${f2(ox1)} ${f2(oy1)}A${R} ${R} 0 ${large} 1 ${f2(ox2)} ${f2(oy2)}L${f2(ix2)} ${f2(iy2)}A${r} ${r} 0 ${large} 0 ${f2(ix1)} ${f2(iy1)}Z`;
}
// Annulus segment by angle (deg, clockwise from 3 o'clock), centreline radius rc, width w.
function arcSeg(a1, a2, rc, w, cx = 24, cy = 24) {
  const R = rc + w / 2, r = rc - w / 2, t = (d) => (d * Math.PI) / 180;
  const P = (rad, d) => [f2(cx + rad * Math.cos(t(d))), f2(cy + rad * Math.sin(t(d)))];
  const large = a2 - a1 > 180 ? 1 : 0;
  const [o1, o2, i2, i1] = [P(R, a1), P(R, a2), P(r, a2), P(r, a1)];
  return `M${o1}A${R} ${R} 0 ${large} 1 ${o2}L${i2}A${r} ${r} 0 ${large} 0 ${i1}Z`.replace(/,/g, " ");
}
// Disc (radius R, centre 24) split by a stepped seam: left channel at cy-off, right at cy+off,
// joined by a vertical channel of width vw at x=24. g = seam gap.
function discHalf(R, g, off, vw, flip = false) {
  const c = 24, yL = c - off - g / 2, yR = c + off - g / 2, xv = c + vw / 2;
  const xl = c - Math.sqrt(R * R - (yL - c) ** 2), xr = c + Math.sqrt(R * R - (yR - c) ** 2);
  const pts = [[xl, yL], [xr, yR], [xv, yR], [xv, yL]].map(([x, y]) => (flip ? [48 - x, 48 - y] : [x, y]).map(f2));
  return `M${pts[0].join(" ")}A${R} ${R} 0 0 1 ${pts[1].join(" ")}L${pts[2].join(" ")}L${pts[3].join(" ")}Z`;
}
function seam(R, g, off, vw) {
  const c = 24, a = c - off - g / 2, b = c - off + g / 2, d = c + off - g / 2, e = c + off + g / 2;
  const x1 = c - vw / 2, x2 = c + vw / 2;
  const xl1 = c - Math.sqrt(R * R - (a - c) ** 2), xl2 = c - Math.sqrt(R * R - (b - c) ** 2);
  const xr1 = c + Math.sqrt(R * R - (d - c) ** 2), xr2 = c + Math.sqrt(R * R - (e - c) ** 2);
  return `M${f2(xl1)} ${a}H${x2}V${d}H${f2(xr1)}A${R} ${R} 0 0 1 ${f2(xr2)} ${e}H${x1}V${b}H${f2(xl2)}A${R} ${R} 0 0 1 ${f2(xl1)} ${a}Z`;
}
const S = (d, role, w = 8, extra = "") => ({ d, role, w, extra });
const shapes = {
  hold: [
    S("M36 10H17A7 7 0 0 0 17 24", "ink"),
    S("M31 24A7 7 0 0 1 31 38H12", "ink"),
    { rect: [20, 20, 8, 8], role: "gold" },
  ],
  seal: [
    { fill: discHalf(18, 4, 6.5, 4), role: "ink" },
    { fill: discHalf(18, 4, 6.5, 4, true), role: "ink" },
    { fill: seam(18, 4, 6.5, 4), role: "gold" },
  ],
  seal2: [
    { fill: discHalf(18, 3, 7, 9), role: "ink" },
    { fill: discHalf(18, 3, 7, 9, true), role: "ink" },
    { rect: [21, 21, 6, 6], role: "gold" },
  ],
  release: [
    S("M35 10H20A7 7 0 0 0 20 24H22L27 29", "ink", 8, 'stroke-linejoin="miter"'),
    S("M17.5 30.5L25 38L41 22", "gold", 8, 'stroke-linejoin="miter"'),
  ],
  release2: [
    S("M36 8.5H19A7 7 0 0 0 19 22.5H30", "ink"),
    S("M11.5 30.5L19.5 38.5L40 18", "gold", 8, 'stroke-linejoin="miter"'),
  ],
};

function inner(id, ink, gold) {
  return shapes[id]
    .map((p) => {
      const c = p.role === "gold" ? gold : ink;
      if (p.fill) return `<path d="${p.fill}" fill="${c}"/>`;
      if (p.rect) return `<rect x="${p.rect[0]}" y="${p.rect[1]}" width="${p.rect[2]}" height="${p.rect[3]}" rx="1.2" fill="${c}"/>`;
      return `<path d="${p.d}" stroke="${c}" stroke-width="${p.w}" fill="none" ${p.extra}/>`;
    })
    .join("");
}
const mark = (id, size, ink, gold, x, y) =>
  `<g transform="translate(${x} ${y}) scale(${size / 48})">${inner(id, ink, gold)}</g>`;

const ids = Object.keys(shapes);
let body = `<rect width="1400" height="${ids.length * 300}" fill="#F5F7FA"/>`;
ids.forEach((id, i) => {
  const y = i * 300;
  body += `<rect x="700" y="${y}" width="700" height="300" fill="${INK}"/>`;
  body += mark(id, 220, INK, GOLD, 20, y + 40);
  body += mark(id, 64, INK, GOLD, 280, y + 40);
  body += mark(id, 32, INK, GOLD, 360, y + 40);
  body += mark(id, 16, INK, GOLD, 410, y + 40);
  body += mark(id, 64, INK, INK, 280, y + 160);
  body += mark(id, 220, WHITE, GOLD, 720, y + 40);
  body += mark(id, 64, WHITE, GOLD, 980, y + 40);
  body += mark(id, 32, WHITE, GOLD, 1060, y + 40);
  body += mark(id, 16, WHITE, GOLD, 1110, y + 40);
  body += `<rect x="1000" y="${y + 160}" width="96" height="96" rx="22" fill="${INK}" stroke="#333"/>` + mark(id, 72, WHITE, GOLD, 1012, y + 172);
  body += `<rect x="1120" y="${y + 160}" width="96" height="96" rx="22" fill="${GOLD}"/>` + mark(id, 72, INK, INK, 1132, y + 172);
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="${ids.length * 300}">${body}</svg>`;
await sharp(Buffer.from(svg)).png().toFile("/app/memory/tmp/sd_explore.png");
// true-size 16px renders upscaled (nearest) to judge pixel legibility
const tiny = [];
for (const [k, id] of ids.entries()) {
  for (const [j, [ink, bg]] of [[INK, "#FFFFFF"], [WHITE, "#202124"]].entries()) {
    const s16 = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="${bg}"/>${mark(id, 16, ink, GOLD, 0, 0)}</svg>`;
    const b = await sharp(Buffer.from(s16)).png().toBuffer();
    tiny.push({ input: await sharp(b).resize(128, 128, { kernel: "nearest" }).png().toBuffer(), left: 20 + j * 150, top: 20 + k * 150 });
  }
}
await sharp({ create: { width: 340, height: ids.length * 150 + 20, channels: 4, background: "#888" } }).composite(tiny).png().toFile("/app/memory/tmp/sd_explore16.png");
console.log("ok");
