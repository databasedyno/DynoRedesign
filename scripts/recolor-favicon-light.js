/**
 * Generate LIGHT (#F5F5F5) favicon variants for dark browser themes.
 * Uses the same alpha-preserving recolor as recolor-favicon.js.
 * Output: /tmp/favicon-out/*-light.png
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR = path.join(__dirname, "..", "public");
const OUT_DIR = "/tmp/favicon-out";
const LIGHT = { r: 245, g: 245, b: 245 }; // #F5F5F5

fs.mkdirSync(OUT_DIR, { recursive: true });

async function recolor(srcPath, { width, height, square } = {}) {
  let pipeline = sharp(srcPath).ensureAlpha();
  if (square) {
    pipeline = sharp(srcPath)
      .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha();
  } else if (width || height) {
    pipeline = sharp(srcPath).resize(width, height).ensureAlpha();
  }
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    data[i] = LIGHT.r;
    data[i + 1] = LIGHT.g;
    data[i + 2] = LIGHT.b;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer();
}

(async () => {
  // Recolor from the ORIGINAL blue source shapes — but public/*.png are already dark now.
  // Dark→light recolor works identically (we only overwrite RGB, alpha preserved).
  fs.writeFileSync(path.join(OUT_DIR, "favicon-16-light.png"), await recolor(path.join(SRC_DIR, "favicon-16.png")));
  fs.writeFileSync(path.join(OUT_DIR, "favicon-32-light.png"), await recolor(path.join(SRC_DIR, "favicon-32.png")));
  fs.writeFileSync(path.join(OUT_DIR, "dynopay-favicon-light.png"), await recolor(path.join(SRC_DIR, "dynopay-favicon.png")));
  console.log("Wrote light favicons:");
  for (const f of fs.readdirSync(OUT_DIR).filter((n) => n.includes("light"))) {
    console.log("  •", f, fs.statSync(path.join(OUT_DIR, f)).size, "bytes");
  }
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
