/**
 * Generate email-client-safe image assets:
 *  1) Social icons as PNG (rasterised from the SVGs already in emailTemplate.ts)
 *     — Gmail/Outlook/Yahoo/most mobile clients do NOT render SVG or data: URIs.
 *  2) An inversion-proof brand logo: the white wordmark composited onto a solid
 *     #050505 chip (the header/footer are ALWAYS #050505), so the logo stays
 *     visible even when a mail client force-adapts the dark footer to white.
 *
 * Output: backend/public/email/<network>.png  and  backend/public/dynopay-email-logo.png
 * Served at /api/static/email/<network>.png and /api/static/dynopay-email-logo.png
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const PUBLIC = path.join(__dirname, "..", "public");
const EMAIL_DIR = path.join(PUBLIC, "email");
fs.mkdirSync(EMAIL_DIR, { recursive: true });

async function main() {
  // ---- 1) Social icons: extract the 5 base64 SVGs (in file order) ----
  const tpl = fs.readFileSync(path.join(__dirname, "..", "utils", "emailTemplate.ts"), "utf8");
  const re = /data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g;
  const names = ["facebook", "instagram", "x", "linkedin", "telegram"];
  const svgs = [];
  let m;
  while ((m = re.exec(tpl)) !== null) svgs.push(m[1]);
  if (svgs.length < 5) throw new Error("expected 5 SVG data URIs, found " + svgs.length);

  for (let i = 0; i < 5; i++) {
    const svgBuf = Buffer.from(svgs[i], "base64");
    await sharp(svgBuf, { density: 384 })
      .resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(EMAIL_DIR, names[i] + ".png"));
    console.log("  ✅ wrote email/" + names[i] + ".png");
  }

  // ---- 2) Inversion-proof logo ----
  const src = path.join(PUBLIC, "dynopay-white-logo.png");
  const logo = sharp(src);
  const meta = await logo.metadata();
  const padX = 64;
  const padY = 40;
  const W = meta.width + padX * 2;
  const H = meta.height + padY * 2;
  const logoBuf = await logo.toBuffer();
  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 5, g: 5, b: 5, alpha: 1 } },
  })
    .composite([{ input: logoBuf, left: padX, top: padY }])
    .png()
    .toFile(path.join(PUBLIC, "dynopay-email-logo.png"));
  console.log("  ✅ wrote dynopay-email-logo.png (" + W + "x" + H + ")");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
