import { chromium } from "playwright";
import fs from "fs";
const BASE = "https://7220be15-93bb-4068-92f6-0a20be84ac87.preview.emergentagent.com";
const CHROME = "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell";
const OUT = "/app/memory/brand/verify";
fs.mkdirSync(OUT, { recursive: true });

async function shoot(b, path, name, width) {
  const ctx = await b.newContext({ viewport: { width, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3500);
  // overflow check
  const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  const overflow = r.sw > r.cw;
  await p.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 45, fullPage: true });
  console.log(`${name} @${width}: overflow=${overflow} (sw=${r.sw} cw=${r.cw})`);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  await shoot(b, "/press", "press-desktop", 1280);
  await shoot(b, "/press", "press-mobile", 390);
  await shoot(b, "/about", "about-desktop", 1280);
  await shoot(b, "/about", "about-mobile", 390);
  await b.close();
  console.log("done");
})();
