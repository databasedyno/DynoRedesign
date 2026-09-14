// Checkpoint 4.2 motion audit: per page, computed transition/animation durations + `transition: all` + reduced-motion check.
// Usage: node scripts/qa/motion_audit.mjs [--pages=/dashboard,/kyc] [--width=1280] [--company=1]
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SWEEP_BASE_URL || "https://cred-manager-29.preview.emergentagent.com";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const W = Number(args.width || 1280);
const H = W <= 500 ? 844 : 800;
const PAGES = (args.pages ? args.pages.split(",") : [
  "/dashboard", "/pay-links", "/create-pay-link", "/transactions", "/payouts", "/wallet", "/wallet/security",
  "/invoices", "/customers", "/referrals", "/storefront", "/settings", "/developer-keys", "/notifications", "/help-support", "/kyc", "/get-started",
]);

const AUDIT = `(() => {
  const desc = (el) => { const id = el.getAttribute('data-testid') || (el.closest('[data-testid]') ? '^' + el.closest('[data-testid]').getAttribute('data-testid') : ''); const cls = (typeof el.className === 'string' ? el.className : '').split(' ').filter(c => c && !c.startsWith('mui-') && !c.startsWith('css-')).slice(0, 2).join('.'); return el.tagName.toLowerCase() + (id ? '[' + id + ']' : '') + (cls ? '.' + cls : ''); };
  const ms = (v) => v.split(',').map((x) => { x = x.trim(); return x.endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000; });
  const out = { total: 0, withTransition: 0, slow: [], fast: [], all: [], anim: [], hist: {} };
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) continue;
    out.total++;
    const cs = getComputedStyle(el);
    const props = cs.transitionProperty.split(',').map((s) => s.trim());
    const durs = ms(cs.transitionDuration);
    const hasT = durs.some((d) => d > 0) && !(props.length === 1 && props[0] === 'none');
    if (hasT) {
      out.withTransition++;
      const max = Math.max(...durs);
      const b = max <= 100 ? '<=100' : max <= 250 ? '101-250' : max <= 400 ? '251-400' : '>400';
      out.hist[b] = (out.hist[b] || 0) + 1;
      if (max > 250) out.slow.push(desc(el) + ' ' + max + 'ms [' + props.slice(0, 3).join(',') + '] ' + cs.transitionTimingFunction.split(',')[0]);
      if (props.includes('all')) out.all.push(desc(el) + ' ' + max + 'ms');
    }
    const ad = ms(cs.animationDuration);
    if (cs.animationName !== 'none' && ad.some((d) => d > 0)) out.anim.push(desc(el) + ' ' + cs.animationName.split(',')[0] + ' ' + Math.max(...ad) + 'ms x' + cs.animationIterationCount.split(',')[0]);
  }
  const uniq = (a) => [...new Set(a)];
  return { total: out.total, withTransition: out.withTransition, hist: out.hist, slow: uniq(out.slow).slice(0, 40), all: uniq(out.all).slice(0, 40), anim: uniq(out.anim).slice(0, 20) };
})()`;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: args.reduced ? "reduce" : "no-preference" });
const page = await ctx.newPage();
await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForSelector('[data-testid="login-email-input"]', { timeout: 60000 });
await page.fill('[data-testid="login-email-input"]', process.env.SWEEP_EMAIL || "onarrival21@gmail.com");
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.waitForSelector('[data-testid="password-input"]', { timeout: 30000 });
await page.fill('[data-testid="password-input"]', process.env.SWEEP_PASS || "Katiekendra123@");
await page.click('[data-testid="signin-submit-btn"]');
await page.waitForURL("**/dashboard**", { timeout: 90000 });
await page.evaluate((c) => { localStorage.setItem("last_company_id", c); localStorage.setItem("theme-mode-inapp", "light"); }, args.company || "1");
await page.setViewportSize({ width: W, height: H });

const report = {};
for (const p of PAGES) {
  try {
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const r = await page.evaluate(AUDIT);
    report[p] = r;
    console.log(`\n== ${p} elements=${r.total} withTransition=${r.withTransition} hist=${JSON.stringify(r.hist)}`);
    if (r.slow.length) console.log("  >250ms:", r.slow.join(" | "));
    if (r.all.length) console.log("  transition:all:", r.all.join(" | "));
    if (r.anim.length) console.log("  animations:", r.anim.join(" | "));
  } catch (e) { console.log(`XX ${p} ${String(e.message).slice(0, 100)}`); }
}
fs.mkdirSync("/app/memory/reports/motion", { recursive: true });
fs.writeFileSync(`/app/memory/reports/motion/audit-${W}${args.reduced ? "-reduced" : ""}.json`, JSON.stringify(report, null, 1));
await browser.close();
