// Full-page landing screenshots at given widths (light + dark) for a visual rhythm pass.
// Usage: PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell \
//        node scripts/qa/landing_shots.mjs --base=<url> --widths=390,768 --out=/tmp/landing
import { chromium } from "playwright";
import fs from "node:fs";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const base = arg("base", "http://localhost:3000");
const widths = arg("widths", "390,768").split(",").map(Number);
const out = arg("out", "/tmp/landing");
const path = arg("path", "/");
const dark = arg("dark", "0") === "1";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH });
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (dark) await page.addInitScript(() => localStorage.setItem("theme-mode-public", "dark"));
  await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("footer, [data-testid=\"home-footer\"]", { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(2500);
  // trigger scroll-in animations
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 600) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(120); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(`w=${w} scrollHeight=${h} scrollWidth=${sw}${sw > w ? "  <-- HORIZONTAL OVERFLOW" : ""}`);
  await page.screenshot({ path: `${out}/landing_${w}${dark ? "_dark" : ""}.png`, fullPage: true, type: "jpeg", quality: 35 });
  await ctx.close();
}
await browser.close();
