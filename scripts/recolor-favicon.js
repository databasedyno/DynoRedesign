/**
 * Recolor the DynoPay favicon mark from blue to brand dark (#0A0A0B),
 * preserving the exact shape via the source alpha channel.
 *
 * Regenerates: favicon-16.png, favicon-32.png, dynopay-favicon.png, favicon.ico
 * Writes to /tmp/favicon-out first (verified), caller copies into public/ + assets/public-runtime/.
 *
 * Usage: node scripts/recolor-favicon.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR = path.join(__dirname, "..", "public");
const OUT_DIR = "/tmp/favicon-out";
const DARK = { r: 10, g: 10, b: 11 }; // #0A0A0B — brand near-black (matches dynopay-blackLogo.svg)

fs.mkdirSync(OUT_DIR, { recursive: true });

// Highest-resolution source of the mark to derive crisp square icons.
const HI_SRC = path.join(SRC_DIR, "dynopay-favicon.png"); // 88x96

/**
 * Recolor a PNG: force RGB to DARK for every pixel, keep the original alpha.
 * If width/height provided, contain-fit onto a transparent square canvas first.
 */
async function recolor(srcPath, { width, height, square } = {}) {
  let pipeline = sharp(srcPath).ensureAlpha();
  if (square) {
    pipeline = sharp(srcPath)
      .resize(width, height, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .ensureAlpha();
  } else if (width || height) {
    pipeline = sharp(srcPath).resize(width, height).ensureAlpha();
  }

  const { data, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });

  // channels should be 4 (RGBA)
  for (let i = 0; i < data.length; i += info.channels) {
    data[i] = DARK.r;
    data[i + 1] = DARK.g;
    data[i + 2] = DARK.b;
    // alpha (data[i+3]) left untouched
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
}

function buildIco(pngs /* [{ size, buf }] */) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  pngs.forEach((p, i) => {
    const o = 16 * i;
    dir[o] = p.size >= 256 ? 0 : p.size; // width
    dir[o + 1] = p.size >= 256 ? 0 : p.size; // height
    dir[o + 2] = 0; // palette colors
    dir[o + 3] = 0; // reserved
    dir.writeUInt16LE(1, o + 4); // color planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(p.buf.length, o + 8); // image data size
    dir.writeUInt32LE(offset, o + 12); // offset
    offset += p.buf.length;
  });

  return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)]);
}

(async () => {
  // 1. Recolor the standalone PNGs at their native dimensions (identical layout, dark color).
  const f16 = await recolor(path.join(SRC_DIR, "favicon-16.png"));
  fs.writeFileSync(path.join(OUT_DIR, "favicon-16.png"), f16);

  const f32 = await recolor(path.join(SRC_DIR, "favicon-32.png"));
  fs.writeFileSync(path.join(OUT_DIR, "favicon-32.png"), f32);

  const apple = await recolor(HI_SRC);
  fs.writeFileSync(path.join(OUT_DIR, "dynopay-favicon.png"), apple);

  // 2. Square dark icons (from hi-res source) for the .ico container.
  const sq32 = await recolor(HI_SRC, { width: 32, height: 32, square: true });
  const sq16 = await recolor(HI_SRC, { width: 16, height: 16, square: true });
  const ico = buildIco([
    { size: 32, buf: sq32 },
    { size: 16, buf: sq16 },
  ]);
  fs.writeFileSync(path.join(OUT_DIR, "favicon.ico"), ico);

  // 3. A 512 PNG for schema.org / OG logo (referenced in _app.tsx but currently missing).
  const sq512 = await recolor(HI_SRC, { width: 512, height: 512, square: true });
  fs.writeFileSync(path.join(OUT_DIR, "favicon-512.png"), sq512);

  console.log("Wrote dark favicons to", OUT_DIR);
  for (const f of fs.readdirSync(OUT_DIR)) {
    console.log("  •", f, fs.statSync(path.join(OUT_DIR, f)).size, "bytes");
  }
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
