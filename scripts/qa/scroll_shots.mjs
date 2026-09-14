// Scroll-through screenshots of a page (handles inner scroll containers). Usage:
// node scripts/qa/scroll_shots.mjs --company=179 --width=390 --theme=light --pages=/payouts,/wallet --out=/tmp/scroll
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SWEEP_BASE_URL || "https://speedup-check.preview.emergentagent.com";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const OUT = args.out || "/tmp/scroll";
fs.mkdirSync(OUT, { recursive: true });
const W = Number(args.width || 390);
const H = W <= 500 ? 844 : W <= 800 ? 1024 : 1080;
const PAGES = (args.pages || "/payouts").split(",");
const THEME = args.theme || "light";
const MAX_STEPS = Number(args.steps || 6);

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
await page.evaluate(([c, t]) => { localStorage.setItem("last_company_id", c); localStorage.setItem("theme-mode-inapp", t); document.cookie = `theme-mode-inapp=${t}; path=/`; }, [args.company || "1", THEME]);
await page.setViewportSize({ width: W, height: H });

const SCROLLER = `(() => { let best = document.scrollingElement; let bestH = best.scrollHeight - best.clientHeight; for (const el of document.querySelectorAll('*')) { const cs = getComputedStyle(el); if (!/(auto|scroll)/.test(cs.overflowY)) continue; const r = el.getBoundingClientRect(); if (r.width < 200 || r.height < 200 || r.bottom < 0 || r.top > innerHeight || el.closest('[aria-hidden="true"]') || el.closest('.MuiDialog-root')) continue; const d = el.scrollHeight - el.clientHeight; if (d > bestH) { best = el; bestH = d; } } window.__qaScroller = best; return { tag: best.tagName, cls: (best.className||'').toString().slice(0,40), extra: bestH }; })()`;

for (const p of PAGES) {
  await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const tip = page.locator('[data-testid^="page-tip-dismiss-"]');
  if (await tip.count()) await tip.first().click({ force: true }).catch(() => {});
  const info = await page.evaluate(SCROLLER);
  const slug = p.replace(/[\/?=]/g, "_");
  console.log(p, JSON.stringify(info));
  for (let i = 0; i < MAX_STEPS; i++) {
    await page.screenshot({ path: `${OUT}/${THEME}-${W}-${slug}-${i}.png` });
    const done = await page.evaluate((h) => { const s = window.__qaScroller; const before = s.scrollTop; s.scrollTop = before + h - 80; return s.scrollTop === before; }, H);
    await page.waitForTimeout(400);
    if (done) break;
  }
}
await browser.close();
