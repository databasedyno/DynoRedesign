// Probe: does the landing page stay half-hidden on a slow phone after hydration?
// node scripts/qa/mobile_reveal_probe.mjs --base=https://dynopay.com --cpu=6
import { chromium } from "playwright";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const k = a.replace(/^--/, ""); const i = k.indexOf("="); return i < 0 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)]; }));
const BASE = (args.base || "https://dynopay.com").replace(/\/+$/, "");
const CPU = Number(args.cpu || 4);
const launchOpts = {};
if (process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH;
const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
page.on("pageerror", (e) => console.log("PAGEERROR", String(e.message).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200)); });

await page.addInitScript(() => {
  window.__longTasks = [];
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__longTasks.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: "longtask", buffered: true });
  } catch {}
});

const t0 = Date.now();
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
console.log("domcontentloaded", Date.now() - t0, "ms");

const snap = async (label) => {
  const s = await page.evaluate(() => {
    const q = (sel, attr) => Array.from(document.querySelectorAll(sel)).map((n) => n.getAttribute(attr));
    const reveals = q("[data-reveal]", "data-reveal");
    const staggers = q("[data-stagger]", "data-stagger");
    const counts = q("[data-countup]", "data-countup");
    const hydrated = !!(window.next && window.next.router);
    return {
      hydrated, scrollY: Math.round(window.scrollY), docH: Math.round(document.documentElement.scrollHeight),
      reveals: `${reveals.filter((x) => x === "in").length}/${reveals.length} in`,
      staggers: `${staggers.filter((x) => x === "in").length}/${staggers.length} in`,
      counts: counts.join(","),
      longTasks: (window.__longTasks || []).filter(([, d]) => d > 200).map(([s, d]) => `${s}+${d}`).slice(-8).join(" "),
    };
  });
  console.log(`[${Date.now() - t0}ms] ${label}`, JSON.stringify(s));
};

await snap("after DCL");
await page.waitForTimeout(3000);
await snap("+3s");
// scroll like a user: to the stats block, then further down
await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
await page.waitForTimeout(1500);
await snap("scrolled 900");
await page.screenshot({ path: "/tmp/probe_900.png" });
await page.evaluate(() => window.scrollTo({ top: 1800, behavior: "instant" }));
await page.waitForTimeout(1500);
await snap("scrolled 1800");
await page.screenshot({ path: "/tmp/probe_1800.png" });
for (let i = 0; i < 6; i++) { await page.waitForTimeout(3000); await snap(`+${3 * (i + 1)}s at 1800`); }
await page.screenshot({ path: "/tmp/probe_final.png" });
await browser.close();
