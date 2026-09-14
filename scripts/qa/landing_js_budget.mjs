// Probe: JS payload + long tasks for the landing page on a phone profile.
// node scripts/qa/landing_js_budget.mjs --base=https://dynopay.com
import { chromium } from "playwright";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const k = a.replace(/^--/, ""); const i = k.indexOf("="); return i < 0 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)]; }));
const BASE = (args.base || "https://dynopay.com").replace(/\/+$/, "");
const PATH = args.path || "/";
const launchOpts = {};
if (process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH;
const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
const sizes = new Map();
cdp.on("Network.responseReceived", (e) => sizes.set(e.requestId, { url: e.response.url, type: e.type, enc: 0 }));
cdp.on("Network.loadingFinished", (e) => { const s = sizes.get(e.requestId); if (s) s.enc = e.encodedDataLength; });
await page.addInitScript(() => {
  window.__lt = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: "longtask", buffered: true }); } catch {}
});
await page.goto(`${BASE}${PATH}`, { waitUntil: "load", timeout: 120000 });
await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3000);
const rows = [...sizes.values()].filter((r) => r.enc > 0);
const byType = {};
for (const r of rows) { byType[r.type] = (byType[r.type] || 0) + r.enc; }
console.log("bytes by type (compressed):", Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, `${Math.round(v / 1024)} KB`])));
const js = rows.filter((r) => r.type === "Script").sort((a, b) => b.enc - a.enc);
console.log(`scripts: ${js.length}, total ${Math.round(js.reduce((s, r) => s + r.enc, 0) / 1024)} KB`);
for (const r of js.slice(0, 25)) console.log(`${String(Math.round(r.enc / 1024)).padStart(5)} KB  ${r.url.replace(BASE, "")}`);
const xhr = rows.filter((r) => r.type === "XHR" || r.type === "Fetch");
console.log(`fetch/xhr: ${xhr.length}`); for (const r of xhr) console.log(`  ${Math.round(r.enc / 1024)} KB ${r.url.slice(0, 120)}`);
const lt = await page.evaluate(() => window.__lt);
console.log("long tasks (start+dur ms):", lt.map(([s, d]) => `${s}+${d}`).join(" "), "total", lt.reduce((s, [, d]) => s + d, 0));
await browser.close();
