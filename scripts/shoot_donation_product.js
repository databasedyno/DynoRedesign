/* One-off: capture the /pay/donation-demo campaign as the landing product shots
 * (light + dark, 16:10) → public/landing/products/donations-{mode}.webp */
const { chromium } = require("playwright");
const sharp = require("sharp");

const BASE = process.env.BASE || "https://speedup-check.preview.emergentagent.com";
const OUT = "/app/public/landing/products";

(async () => {
  const fs = require("fs");
  const candidates = [
    "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell",
    "/usr/bin/chromium",
    "/root/bin/chromium",
    "/usr/lib/chromium/chromium",
  ];
  const exe = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  console.log("using chromium:", exe);
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-gpu"] });
  for (const mode of ["light", "dark"]) {
    const ctx = await browser.newContext({
      colorScheme: mode,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    // The pay pages read their theme from localStorage (public context defaults
    // to light) — seed it so the dark shot actually renders dark.
    await ctx.addInitScript((m) => {
      try {
        ["theme-mode-public", "theme-mode-inapp", "theme-mode", "theme-mode-creator"].forEach((k) =>
          window.localStorage.setItem(k, m),
        );
      } catch (e) { /* ignore */ }
    }, mode);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pay/donation-demo`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    // Hide the demo-only chrome (scenario toggle + "preview" label) for a clean product shot.
    await page.evaluate(() => {
      const tog = document.querySelector('[data-testid="donation-demo-toggle"]');
      if (tog) tog.style.display = "none";
      [...document.querySelectorAll("*")]
        .filter((e) => e.children.length === 0 && e.textContent && e.textContent.trim() === "Donation checkout — preview")
        .forEach((l) => (l.style.display = "none"));
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 } });
    await sharp(png)
      .resize(1280, 800, { fit: "cover", position: "top" })
      .webp({ quality: 82 })
      .toFile(`${OUT}/donations-${mode}.webp`);
    console.log("wrote donations-" + mode + ".webp");
    await ctx.close();
  }
  await browser.close();
  console.log("done");
})().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
