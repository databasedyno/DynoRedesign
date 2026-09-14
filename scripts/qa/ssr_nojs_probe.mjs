// Probe: what does the SSR HTML look like on a phone BEFORE any JS runs (JS disabled)?
// node scripts/qa/ssr_nojs_probe.mjs --base=https://dynopay.com --dark=1
import { chromium } from "playwright";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const k = a.replace(/^--/, ""); const i = k.indexOf("="); return i < 0 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)]; }));
const BASE = (args.base || "https://dynopay.com").replace(/\/+$/, "");
const launchOpts = {};
if (process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH;
const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, javaScriptEnabled: false,
  colorScheme: args.dark ? "dark" : "light",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 120000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if ((cs.position === "fixed" || cs.position === "absolute") && el.getBoundingClientRect().height > 200 && el.getBoundingClientRect().width > 200) {
      const r = el.getBoundingClientRect();
      out.push({ tag: el.tagName, cls: (el.className || "").toString().slice(0, 80), pos: cs.position, top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), bg: cs.backgroundColor, z: cs.zIndex, testid: el.getAttribute("data-testid") });
    }
  }
  return { docH: document.documentElement.scrollHeight, big: out.slice(0, 25) };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: "/tmp/nojs_top.png" });
await page.evaluate(() => window.scrollTo(0, 900));
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/nojs_900.png" });
await page.evaluate(() => window.scrollTo(0, 1700));
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/nojs_1700.png" });
await browser.close();
