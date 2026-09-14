// Checkpoint 4.1 sweep: every merchant page × viewports × themes → overflow / clipped-text report.
// Usage: node scripts/qa/responsive_sweep.mjs [--shots] [--pages=/dashboard,/kyc] [--widths=390,1920] [--themes=light,dark]
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SWEEP_BASE_URL || "https://speedup-check.preview.emergentagent.com";
const EMAIL = process.env.SWEEP_EMAIL || "onarrival21@gmail.com";
const PASS = process.env.SWEEP_PASS || "Katiekendra123@";
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const k = a.replace(/^--/, ""); const i = k.indexOf("="); return i < 0 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)]; }));
const SHOTS = "shots" in args;
const OUT = args.out || "/tmp/sweep";
fs.mkdirSync(OUT, { recursive: true });

const PAGES = (args.pages ? args.pages.split(",") : [
  "/dashboard", "/pay-links", "/create-pay-link", "/transactions", "/payouts", "/wallet", "/wallet/security",
  "/invoices", "/customers", "/referrals", "/storefront", "/settings", "/settings?section=company",
  "/settings?section=notifications", "/settings?section=team", "/developer-keys", "/notifications",
  "/help-support", "/kyc", "/get-started",
]);
const WIDTHS = (args.widths ? args.widths.split(",") : ["390", "768", "1280", "1920"]).map(Number);
const THEMES = args.themes ? args.themes.split(",") : ["light", "dark"];
const HEIGHT = { 390: 844, 768: 1024, 1280: 800, 1920: 1080 };

const AUDIT = `(() => {
  const iw = window.innerWidth;
  const de = document.documentElement;
  const out = { scrollWidth: de.scrollWidth, innerWidth: iw, overflow: de.scrollWidth > iw + 1, offenders: [], clipped: [] };
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const desc = (el) => { const id = el.getAttribute('data-testid'); const t = (el.textContent || '').trim().slice(0, 40); return el.tagName.toLowerCase() + (id ? '[' + id + ']' : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : '') + (t ? ' "' + t + '"' : ''); };
  for (const el of document.body.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (out.overflow && r.right > iw + 1 && cs.position !== 'fixed' && r.left < iw) out.offenders.push(desc(el) + ' right=' + Math.round(r.right));
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText && el.scrollWidth > el.clientWidth + 2 && (cs.overflowX === 'hidden' || cs.overflowX === 'clip') && cs.textOverflow !== 'ellipsis' && cs.webkitLineClamp === 'none') out.clipped.push(desc(el) + ' sw=' + el.scrollWidth + ' cw=' + el.clientWidth);
    if (hasText && cs.whiteSpace === 'nowrap' && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && cs.overflowX === 'visible') { const p = el.parentElement; const pcs = p ? getComputedStyle(p) : null; if (pcs && (pcs.overflowX === 'hidden' || pcs.overflowX === 'clip')) out.clipped.push('nowrap ' + desc(el) + ' sw=' + el.scrollWidth + ' cw=' + el.clientWidth); }
  }
  out.offenders = [...new Set(out.offenders)].slice(0, 8);
  out.clipped = [...new Set(out.clipped)].slice(0, 10);
  out.gateway = /Bad gateway|Error code 5\\d\\d|Application error/.test((document.body.innerText || '').slice(0, 600));
  out.rawKeys = [...document.body.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^(common|pageTips|transactions|payments|walletScreen|notifications|settingsPage)\\.[a-zA-Z.]+$/.test((e.textContent || '').trim())).map((e) => e.textContent.trim()).slice(0, 5);
  return out;
})()`;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForSelector('[data-testid="login-email-input"]', { timeout: 60000 });
await page.fill('[data-testid="login-email-input"]', EMAIL);
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.waitForSelector('[data-testid="password-input"]', { timeout: 30000 });
await page.fill('[data-testid="password-input"]', PASS);
await page.click('[data-testid="signin-submit-btn"]');
await page.waitForURL("**/dashboard**", { timeout: 90000 });
await page.evaluate((c) => { localStorage.setItem("last_company_id", c); }, args.company || "1");
console.log("logged in");

const results = [];
for (const theme of THEMES) {
  await page.evaluate((t) => { localStorage.setItem("theme-mode-inapp", t); document.cookie = `theme-mode-inapp=${t}; path=/`; }, theme);
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: HEIGHT[w] || 900 });
    for (const p of PAGES) {
      errors.length = 0;
      const label = `${theme} ${w} ${p}`;
      try {
        await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const dismiss = page.locator('[data-testid^="page-tip-dismiss-"]');
        if (await dismiss.count()) await dismiss.first().click({ force: true }).catch(() => {});
        const a = await page.evaluate(AUDIT);
        const bad = a.overflow || a.clipped.length || a.rawKeys.length || errors.length || a.gateway;
        results.push({ theme, w, p, ...a, errors: [...errors] });
        console.log(`${bad ? "!! " : "ok "}${label} sw=${a.scrollWidth}/${a.innerWidth}${a.gateway ? " GATEWAY-ERROR" : ""}${a.overflow ? " OVERFLOW " + a.offenders.join(" | ") : ""}${a.clipped.length ? " CLIPPED " + a.clipped.join(" | ") : ""}${a.rawKeys.length ? " RAWKEYS " + a.rawKeys.join(",") : ""}${errors.length ? " JSERR " + errors.join(" | ") : ""}`);
        if (SHOTS) await page.screenshot({ path: `${OUT}/${theme}-${w}-${p.replace(/[\/?=]/g, "_")}.png`, fullPage: w <= 768 });
      } catch (e) {
        console.log(`XX ${label} ${String(e.message).slice(0, 120)}`);
        results.push({ theme, w, p, error: String(e.message).slice(0, 200) });
      }
    }
  }
}
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
await browser.close();
