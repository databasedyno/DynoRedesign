// Capture phone-sized product shots for the device frames (public/landing/products/*-phone-{light,dark}.webp).
// Usage: node scripts/landing/capture_phone_shots.mjs [--base=http://localhost:3000]
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const base = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").split("=")[1];
const OUT = "public/landing/products";
const SHOTS = [
  { id: "checkout", path: "/pay/demo", settle: 3500 },
];
const THEMES = ["light", "dark"];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    for (const k of ["theme-mode-auth", "theme-mode-public", "theme-mode-inapp", "theme-mode-pay"]) localStorage.setItem(k, t);
    document.cookie = `theme-mode-public=${t}; path=/`;
    document.cookie = `theme-mode-pay=${t}; path=/`;
    localStorage.setItem("lang_onboard", "1");
  }, theme);
  for (const s of SHOTS) {
    await page.goto(`${base}${s.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(s.settle);
    // hide floating chrome (chat FAB, language bar, scroll-top) so the shot is just the product
    await page.addStyleTag({ content: `[data-testid="support-chat-fab"],[data-testid="lang-onboarding-bar"],[data-testid="scroll-to-top"],.dp-support-fab{display:none!important}` });
    const png = await page.screenshot({ fullPage: false, type: "png" });
    const out = `${OUT}/${s.id}-phone-${theme}.webp`;
    await sharp(png).webp({ quality: 82 }).toFile(out);
    console.log("wrote", out, fs.statSync(out).size, "bytes");
  }
  await ctx.close();
}
await browser.close();
