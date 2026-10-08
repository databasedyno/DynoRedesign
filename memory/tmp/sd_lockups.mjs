import { createRequire } from "node:module";
const sharp = createRequire("/app/package.json")("sharp");
const m = await import("/app/scripts/brand/safedeal-logo.mjs");
const { markInner, WORDMARK } = m;
const ids = ["hold", "seal", "release"];
let body = `<rect width="1500" height="${ids.length*200}" fill="#fff"/>`;
ids.forEach((id, i) => {
  const cap = 60, s = cap/100, box = 2*cap, y = i*200 + 40;
  const mk = (x, ink, word, gold) => `<g transform="translate(${x} ${y}) scale(${box/48})">${markInner(id, ink, gold)}</g><g transform="translate(${x+box+0.42*cap} ${y + box/2 - (WORDMARK.base-50)*s}) scale(${s})"><path d="${WORDMARK.d}" fill="${word}"/></g>`;
  body += mk(30, "#0A0A0B", "#0A0A0B", "#FFC61A");
  body += `<rect x="750" y="${i*200}" width="750" height="200" fill="#0A0A0B"/>` + mk(780, "#fff", "#fff", "#FFC61A");
});
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="${ids.length*200}">${body}</svg>`)).png().toFile("/app/memory/tmp/sd_lockups.png");
