// Long-lived Playwright driver controlled over local HTTP (QA only).
// Start: node scripts/qa/pw_driver.mjs [--port=4499] [--width=390] [--height=844]
// Commands (POST JSON to /cmd): {op:"goto",url} | {op:"click",sel|text,force?} | {op:"fill",sel,value}
//   | {op:"type",sel,value} | {op:"press",sel?,key} | {op:"shot",path?,full?} | {op:"eval",js}
//   | {op:"text"} (visible interactive summary) | {op:"viewport",width,height} | {op:"storage",key,value}
//   | {op:"wait",ms} | {op:"url"} | {op:"logs"} | {op:"quit"}
import { chromium } from "playwright";
import http from "node:http";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const PORT = Number(args.port || 4499);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
const ctx = await browser.newContext({ viewport: { width: Number(args.width || 390), height: Number(args.height || 844) }, isMobile: Number(args.width || 390) < 500, hasTouch: Number(args.width || 390) < 500 });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on("pageerror", (e) => logs.push(`pageerror: ${String(e.message).slice(0, 200)}`));
page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/")) logs.push(`http ${r.status()} ${r.request().method()} ${r.url().slice(0, 140)}`); });

const SUMMARY = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight * 3; };
  const items = [];
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role=button], [role=link], [role=tab], [role=radio], [role=checkbox]')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const tid = el.getAttribute('data-testid');
    const label = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || el.value || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
    items.push(el.tagName.toLowerCase() + (el.type ? ':' + el.type : '') + (tid ? ' [' + tid + ']' : '') + ' "' + label + '"' + (el.disabled ? ' (disabled)' : '') + ' @' + Math.round(r.top));
  }
  const heads = [...document.querySelectorAll('h1,h2,h3')].filter(vis).map((h) => h.tagName + ': ' + h.textContent.trim().slice(0, 80));
  return { url: location.href, title: document.title, heads, items: items.slice(0, 60), overflow: document.documentElement.scrollWidth > innerWidth };
})()`;

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", async () => {
    let out;
    try {
      const c = JSON.parse(body || "{}");
      const loc = () => (c.sel ? page.locator(c.sel).first() : c.text ? page.getByText(c.text, { exact: c.exact ?? false }).first() : c.role ? page.getByRole(c.role, { name: c.name, exact: c.exact ?? false }).first() : null);
      switch (c.op) {
        case "goto": await page.goto(c.url, { waitUntil: "domcontentloaded", timeout: 90000 }); await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {}); out = { url: page.url() }; break;
        case "click": await loc().click({ force: !!c.force, timeout: c.timeout || 15000 }); await page.waitForTimeout(c.wait || 800); out = { url: page.url() }; break;
        case "fill": await loc().fill(String(c.value), { timeout: 15000 }); out = { ok: true }; break;
        case "type": await loc().pressSequentially(String(c.value), { delay: 40 }); out = { ok: true }; break;
        case "press": if (c.sel) await loc().press(c.key); else await page.keyboard.press(c.key); await page.waitForTimeout(400); out = { ok: true }; break;
        case "shot": { const p = c.path || `/tmp/pw_${Date.now()}.png`; await page.screenshot({ path: p, fullPage: !!c.full }); out = { path: p }; break; }
        case "eval": out = { value: await page.evaluate(c.js) }; break;
        case "text": out = await page.evaluate(SUMMARY); break;
        case "viewport": await page.setViewportSize({ width: c.width, height: c.height }); out = { ok: true }; break;
        case "storage": await page.evaluate(([k, v]) => localStorage.setItem(k, v), [c.key, c.value]); out = { ok: true }; break;
        case "wait": await page.waitForTimeout(c.ms || 1000); out = { ok: true }; break;
        case "waitfor": await page.waitForSelector(c.sel, { timeout: c.timeout || 30000 }); out = { ok: true }; break;
        case "url": out = { url: page.url() }; break;
        case "logs": out = { logs: logs.splice(0) }; break;
        case "quit": res.end("{}"); await browser.close(); server.close(); process.exit(0);
        default: out = { error: "unknown op" };
      }
    } catch (e) { out = { error: String(e.message).split("\n")[0].slice(0, 300), url: page.url() }; }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(out));
  });
});
server.listen(PORT, "127.0.0.1", () => console.log(`pw_driver listening on ${PORT}`));
