// Rebrand QA sweep: node scripts/qa/rebrand_qa.mjs <base> <token> <out_dir> <light|dark> [routes]
// Scans every in-app route for indigo/violet/blue brand colours in computed styles, white-on-yellow text,
// runtime console errors, and exercises key interactions. Writes <out_dir>/qa_<mode>.json.
import { chromium } from "playwright";
import fs from "node:fs";

const [BASE, TOKEN, OUT, MODE = "light", ROUTES_ARG] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const ROUTES = (ROUTES_ARG ||
  "/dashboard,/brands,/pay-links,/create-pay-link,/storefront,/payouts,/transactions,/invoices,/wallet,/customers,/referrals,/settings,/profile,/notifications,/developer-keys,/help-support,/get-started,/company"
).split(",");

const SCAN = `(() => {
  const toHsl = (r,g,b) => { r/=255; g/=255; b/=255; const max=Math.max(r,g,b), min=Math.min(r,g,b); let h=0,s=0; const l=(max+min)/2;
    if (max!==min){ const d=max-min; s = l>0.5 ? d/(2-max-min) : d/(max+min);
      switch(max){case r: h=(g-b)/d+(g<b?6:0); break; case g: h=(b-r)/d+2; break; default: h=(r-g)/d+4;} h*=60; }
    return [h,s,l]; };
  const parse = (c) => { const m = c && c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/); if(!m) return null; return {r:+m[1],g:+m[2],b:+m[3],a:m[4]===undefined?1:+m[4]}; };
  const isBlueBrand = (c) => { const p = parse(c); if(!p || p.a < 0.25) return false; const [h,s,l] = toHsl(p.r,p.g,p.b); return h>=205 && h<=285 && s>0.30 && l>0.18 && l<0.88; };
  const isYellow = (c) => { const p = parse(c); if(!p || p.a < 0.8) return false; const [h,s,l] = toHsl(p.r,p.g,p.b); return h>=45 && h<=56 && s>0.85 && l>0.45 && l<0.6; };
  const isWhiteish = (c) => { const p = parse(c); if(!p) return false; return p.r>235 && p.g>235 && p.b>235; };
  const desc = (el) => { const t = el.getAttribute('data-testid'); const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0,2).join('.') : ''; const txt=(el.textContent||'').trim().slice(0,30); return el.tagName.toLowerCase() + (t?'[testid='+t+']':'') + (cls?'.'+cls:'') + (txt?' "'+txt+'"':''); };
  const inExcluded = (el) => !!el.closest('[data-merchant-branded], [data-coin-icon], iframe, svg, .recharts-wrapper, [data-testid="storefront-live-preview"], video, canvas');
  const blue = [], wy = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    if (el.closest('svg') || el.tagName === 'IMG' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const bg = cs.backgroundColor, fg = cs.color, bc = cs.borderTopColor, ol = cs.outlineColor;
    if (!inExcluded(el)) {
      if (isBlueBrand(bg)) blue.push({ prop:'background', value: bg, el: desc(el) });
      if (isBlueBrand(fg) && (el.textContent||'').trim()) blue.push({ prop:'color', value: fg, el: desc(el) });
      if (isBlueBrand(bc) && parseFloat(cs.borderTopWidth) > 0) blue.push({ prop:'border', value: bc, el: desc(el) });
      if (cs.backgroundImage && /rgb|#/.test(cs.backgroundImage)) { const cols = cs.backgroundImage.match(/rgba?\\([^)]*\\)/g) || []; for (const c of cols) if (isBlueBrand(c)) { blue.push({ prop:'background-image', value: c, el: desc(el) }); break; } }
    }
    if (isYellow(bg) && isWhiteish(fg) && (el.textContent||'').trim()) wy.push({ bg, fg, el: desc(el) });
  }
  const nav = document.querySelector('nav[aria-label]');
  const cell = document.querySelector('[data-testid="app-brand-cell"]');
  return { blue: blue.slice(0, 40), blueCount: blue.length, whiteOnYellow: wy.slice(0, 20), navBg: nav ? getComputedStyle(nav).backgroundColor : null, cellBg: cell ? getComputedStyle(cell).backgroundColor : null, title: document.title, url: location.pathname };
})()`;

const exe = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/usr/bin/google-chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, colorScheme: MODE === "dark" ? "dark" : "light" });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push({ url: page.url(), text: m.text().slice(0, 220) }); });
page.on("pageerror", (e) => consoleErrors.push({ url: page.url(), text: "PAGEERROR " + String(e).slice(0, 220) }));

await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(([t, m]) => {
  if (t && t !== "-") localStorage.setItem("token", t);
  sessionStorage.setItem("mfa_interstitial_seen", "1");
  localStorage.setItem("theme-mode-inapp", m);
  localStorage.setItem("theme-mode-public", m);
  document.cookie = `theme-mode-inapp=${m}; path=/`;
}, [TOKEN, MODE]);

const results = [];
for (const r of ROUTES) {
  const before = consoleErrors.length;
  const resp = await page.goto(`${BASE}${r}`, { waitUntil: "load", timeout: 90000 }).catch((e) => ({ status: () => "nav-error " + e.message.slice(0, 60) }));
  await page.waitForTimeout(3500);
  const scan = await page.evaluate(SCAN);
  const name = r.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "root";
  await page.screenshot({ path: `${OUT}/${name}_${MODE}.jpg`, type: "jpeg", quality: 50 });
  results.push({ route: r, status: typeof resp.status === "function" ? resp.status() : "?", finalUrl: scan.url, ...scan, consoleErrors: consoleErrors.slice(before).map((e) => e.text) });
  console.log(MODE, r, "status", results.at(-1).status, "blue", scan.blueCount, "w/y", scan.whiteOnYellow.length, "errors", consoleErrors.length - before);
  fs.writeFileSync(`${OUT}/qa_${MODE}.json`, JSON.stringify({ mode: MODE, results, consoleErrors }, null, 2));
}
if (process.env.SKIP_INTERACTIONS) { await browser.close(); process.exit(0); }

/* ---------- interactions ---------- */
const inter = {};
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(1500);
  const collapse = page.locator('[data-testid="sidebar-collapse-toggle"]');
  await collapse.click({ timeout: 5000 });
  await page.waitForTimeout(600);
  inter.railMarkVisible = await page.locator('[data-testid="app-brand-mark"]').isVisible();
  inter.railLockupHidden = !(await page.locator('[data-testid="app-brand-cell"] img.logo').isVisible());
  await page.screenshot({ path: `${OUT}/rail_${MODE}.jpg`, type: "jpeg", quality: 50 });
  await collapse.click({ timeout: 5000 });
  await page.waitForTimeout(600);
  inter.lockupBack = await page.locator('[data-testid="app-brand-cell"] img.logo').isVisible();
} catch (e) { inter.railError = String(e).slice(0, 160); }
try {
  const toggle = page.locator('[data-testid="theme-toggle-header"]');
  const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
  await toggle.click({ timeout: 5000 });
  await page.waitForTimeout(900);
  const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme);
  inter.themeToggle = { before: themeBefore, after: themeAfter, navBgAfter: await page.evaluate(() => getComputedStyle(document.querySelector('nav[aria-label]')).backgroundColor) };
  await page.screenshot({ path: `${OUT}/toggled_from_${MODE}.jpg`, type: "jpeg", quality: 50 });
  await toggle.click({ timeout: 5000 });
  await page.waitForTimeout(600);
} catch (e) { inter.themeToggleError = String(e).slice(0, 160); }
try {
  // sidebar navigation click-through
  await page.locator('[data-testid="sidebar-item-transactions"]').click({ timeout: 5000 });
  await page.waitForURL(/transactions/, { timeout: 15000 });
  inter.navTransactions = page.url();
  await page.locator('[data-testid="sidebar-item-dashboard"]').click({ timeout: 5000 });
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  inter.navDashboard = page.url();
} catch (e) { inter.navError = String(e).slice(0, 160); }
try {
  // payment-link detail panel
  await page.goto(`${BASE}/pay-links`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(1500);
  const row = page.locator('table tbody tr').first();
  await row.click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  inter.paylinkDetailOpen = await page.locator('[data-testid="paylink-detail-title"]').isVisible().catch(() => false);
  const detailScan = await page.evaluate(SCAN);
  inter.paylinkDetailBlue = detailScan.blueCount;
  inter.paylinkDetailBlueSamples = detailScan.blue.slice(0, 8);
  await page.screenshot({ path: `${OUT}/paylink_detail_${MODE}.jpg`, type: "jpeg", quality: 50 });
} catch (e) { inter.paylinkDetailError = String(e).slice(0, 160); }
try {
  // security tab: open 2FA dialog then cancel (do not enable)
  await page.goto(`${BASE}/profile?tab=security`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(1800);
  const secScan = await page.evaluate(SCAN);
  inter.securityBlue = secScan.blueCount;
  inter.securityBlueSamples = secScan.blue.slice(0, 8);
  await page.screenshot({ path: `${OUT}/security_${MODE}.jpg`, type: "jpeg", quality: 50 });
} catch (e) { inter.securityError = String(e).slice(0, 160); }

fs.writeFileSync(`${OUT}/qa_${MODE}.json`, JSON.stringify({ mode: MODE, results, interactions: inter, consoleErrors }, null, 2));
console.log("interactions", JSON.stringify(inter));
await browser.close();
