// Checkpoint 4.5 keyboard audit: per page → non-focusable clickables, Tab order sanity, missing focus rings, positive tabindex.
// Usage: node scripts/qa/keyboard_audit.mjs [--pages=/dashboard,/kyc] [--width=1280] [--tabs=120] [--company=1]
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SWEEP_BASE_URL || "https://passphrase-init.preview.emergentagent.com";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const W = Number(args.width || 1280);
const H = W <= 500 ? 844 : W <= 800 ? 1024 : 800;
const TABS = Number(args.tabs || 120);
const PAGES = (args.pages ? args.pages.split(",") : [
  "/dashboard", "/pay-links", "/create-pay-link", "/transactions", "/payouts", "/wallet", "/wallet/security",
  "/invoices", "/customers", "/referrals", "/storefront", "/settings", "/developer-keys", "/notifications", "/help-support", "/kyc", "/get-started",
]);

const STATIC_AUDIT = `(() => {
  const focusableSel = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"], summary, iframe';
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0; };
  const desc = (el) => { const id = el.getAttribute('data-testid') || (el.closest('[data-testid]') ? '^' + el.closest('[data-testid]').getAttribute('data-testid') : null); const t = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40); return el.tagName.toLowerCase() + (id ? '[' + id + ']' : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(c => !c.startsWith('mui-') && !c.startsWith('Mui')).slice(0, 2).join('.') : '') + (t ? ' "' + t + '"' : ''); };
  const out = { nonFocusableClickables: [], positiveTabindex: [], inputsWithoutLabel: [], iconButtonsWithoutName: [] };
  const flagged = new Set();
  for (const el of document.body.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.cursor === 'pointer') {
      const selfFocusable = el.matches(focusableSel) && !(el.tabIndex < 0 && !el.matches('a[href],button,input,select,textarea'));
      const inFocusable = !!el.parentElement?.closest(focusableSel);
      const hasFocusableChild = !!el.querySelector(focusableSel);
      const isLabelFor = el.tagName === 'LABEL' || !!el.closest('label') || !!el.closest('.MuiSwitch-root, .MuiCheckbox-root, .MuiRadio-root');
      const ancestorFlagged = [...flagged].some((a) => a !== el && a.contains(el));
      if (!selfFocusable && !inFocusable && !hasFocusableChild && !isLabelFor && !ancestorFlagged && el.tagName !== 'IMG' && el.tagName !== 'svg' && !el.closest('svg')) { out.nonFocusableClickables.push(desc(el)); flagged.add(el); }
    }
    if (el.hasAttribute('tabindex') && Number(el.getAttribute('tabindex')) > 0) out.positiveTabindex.push(desc(el) + ' tabindex=' + el.getAttribute('tabindex'));
    if ((el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') && !(el.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title') && !el.querySelector('img[alt]:not([alt=""])')) out.iconButtonsWithoutName.push(desc(el));
    if (el.tagName === 'INPUT' && !['hidden','submit','button','checkbox','radio'].includes(el.type) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !(el.id && document.querySelector('label[for="' + el.id + '"]')) && !el.closest('label') && !el.getAttribute('placeholder')) out.inputsWithoutLabel.push(desc(el));
  }
  const uniq = (a) => [...new Set(a)];
  return { nonFocusableClickables: uniq(out.nonFocusableClickables).slice(0, 40), positiveTabindex: uniq(out.positiveTabindex), inputsWithoutLabel: uniq(out.inputsWithoutLabel).slice(0, 10), iconButtonsWithoutName: uniq(out.iconButtonsWithoutName).slice(0, 15) };
})()`;

const FOCUS_INFO = `(() => {
  const el = document.activeElement; if (!el || el === document.body) return { body: true };
  const isFirst = el.hasAttribute('data-kbfirst'); if (!document.querySelector('[data-kbfirst]')) el.setAttribute('data-kbfirst', '1');
  const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
  const id = el.getAttribute('data-testid'); const t = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
  const ringOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
  const ringShadow = cs.boxShadow && cs.boxShadow !== 'none';
  const offscreen = r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth;
  const toggleInput = el.tagName === 'INPUT' && ['checkbox','radio'].includes(el.type);
  const hidden = !toggleInput && (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || Number(cs.opacity) === 0);
  // ring clipped by an overflow:hidden ancestor whose box is tight around the element
  let clipped = false; let p = el.parentElement;
  while (p && p !== document.body) { const pcs = getComputedStyle(p); if (/(hidden|clip)/.test(pcs.overflow + pcs.overflowX + pcs.overflowY)) { const pr = p.getBoundingClientRect(); if (Math.abs(pr.left - r.left) < 2 || Math.abs(pr.right - r.right) < 2 || Math.abs(pr.top - r.top) < 2 || Math.abs(pr.bottom - r.bottom) < 2) { clipped = true; break; } } p = p.parentElement; }
  return { isFirst, desc: el.tagName.toLowerCase() + (id ? '[' + id + ']' : '') + (t ? ' "' + t + '"' : ''), ring: ringOutline || ringShadow, offscreen, hidden, clipped, tag: el.tagName, top: Math.round(r.top) };
})()`;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
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
  await page.waitForTimeout(1200);
  const tip = page.locator('[data-testid^="page-tip-dismiss-"]');
  if (await tip.count()) await tip.first().click({ force: true }).catch(() => {});
  const statics = await page.evaluate(STATIC_AUDIT);
  // Tab walk
  await page.evaluate(() => { (document.activeElement)?.blur?.(); window.scrollTo(0, 0); });
  const seen = []; const noRing = []; const hiddenFocus = []; let cycles = 0;
  for (let i = 0; i < TABS; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(FOCUS_INFO);
    if (f.body) { cycles++; if (cycles > 1) break; continue; }
    if (f.isFirst && i > 3) break;
    seen.push(f.desc);
    if (!f.ring) noRing.push(f.desc);
    if (f.hidden || f.offscreen) hiddenFocus.push(f.desc + (f.hidden ? " (hidden)" : " (offscreen top=" + f.top + ")"));
  }
  const uniq = (a) => [...new Set(a)];
  report[p] = { ...statics, tabStops: seen.length, noRing: uniq(noRing).slice(0, 20), hiddenFocus: uniq(hiddenFocus).slice(0, 20) };
  const r = report[p];
  console.log(`\n== ${p} (${W}px) tabStops=${r.tabStops}`);
  if (r.nonFocusableClickables.length) console.log("  NON-FOCUSABLE CLICKABLES:", r.nonFocusableClickables.join(" | "));
  if (r.positiveTabindex.length) console.log("  POSITIVE TABINDEX:", r.positiveTabindex.join(" | "));
  if (r.iconButtonsWithoutName.length) console.log("  BUTTONS WITHOUT NAME:", r.iconButtonsWithoutName.join(" | "));
  if (r.inputsWithoutLabel.length) console.log("  INPUTS WITHOUT LABEL:", r.inputsWithoutLabel.join(" | "));
  if (r.noRing.length) console.log("  NO FOCUS RING:", r.noRing.join(" | "));
  if (r.hiddenFocus.length) console.log("  FOCUS ON HIDDEN/OFFSCREEN:", r.hiddenFocus.join(" | "));
  } catch (e) { console.log(`XX ${p} ${String(e.message).slice(0, 100)}`); }
}
fs.mkdirSync("/app/memory/reports/keyboard", { recursive: true });
fs.writeFileSync(`/app/memory/reports/keyboard/audit-${W}.json`, JSON.stringify(report, null, 1));
await browser.close();
