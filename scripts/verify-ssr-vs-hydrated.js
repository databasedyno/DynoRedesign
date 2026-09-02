// Regression guard for the "landing appears small then grows" bug: renders a page
// with JS DISABLED (pure SSR paint) and with JS enabled (hydrated) and prints the
// hero/header geometry + fonts side by side — they must be identical.
// Usage: node scripts/verify-ssr-vs-hydrated.js http://localhost:3400/ 390 844
// (run against a PRODUCTION build — `next dev` hides <body> until hydration.)
const { chromium } = require("/app/node_modules/playwright");
(async () => {
  const [url="http://localhost:3000/", w="390", h="844"] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const out = {};
  for (const js of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width:+w, height:+h }, isMobile: +w<800, javaScriptEnabled: js });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: js ? "load" : "domcontentloaded" });
    if (js) await page.waitForFunction(() => document.body.getBoundingClientRect().height > 100, null, { timeout: 30000 });
    await page.waitForTimeout(js ? 2500 : 1500);
    out[js ? "hydrated" : "ssr"] = await page.evaluate(() => {
      const q = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y), fs: c.fontSize, ff: c.fontFamily.split(",")[0] }; };
      return { h1: q("h1"), hero_p: q("h1 ~ p, h1 + *"), header: q("header"), logo: q("header img"), logoSrc: document.querySelector("header img")?.getAttribute("src"), bodyH: Math.round(document.body.scrollHeight), main: q("main") };
    });
    await page.screenshot({ path: `/tmp/ssr_${js?'hyd':'ssr'}_${w}.png` });
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
