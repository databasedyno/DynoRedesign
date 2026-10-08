import { createRequire } from "node:module";
const fk = createRequire("/app/backend/package.json")("fontkit");
const sharp = createRequire("/app/package.json")("sharp");
const opts = [
  ["Outfit-SemiBold.woff2", -10], ["Outfit-Bold.woff2", -14], ["Urbanist-Bold.woff2", -20], ["Manrope-Bold.woff", -20], ["Outfit-Medium.woff2", 0],
];
let body = `<rect width="1400" height="${opts.length * 140}" fill="#fff"/>`;
opts.forEach(([f, track], i) => {
  const font = fk.openSync("/app/public/fonts/" + f);
  const run = font.layout("SafeDeal");
  const s = 90 / font.capHeight;
  let x = 40, d = "";
  run.glyphs.forEach((g, k) => { d += g.path.scale(s, -s).translate(x, 110 + i * 140).toSVG(); x += (run.positions[k].xAdvance + track * font.unitsPerEm / 1000) * s; });
  body += `<path d="${d}" fill="#0A0A0B"/><text x="700" y="${80 + i * 140}" font-size="22" font-family="Arial">${f} ${track}</text>`;
});
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="${opts.length * 140}">${body}</svg>`)).png().toFile("/app/memory/tmp/sd_wordmarks.png");
