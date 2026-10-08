// Quick interaction probe for the responsive shell (phone sheets, back gesture, settings index).
// READ-ONLY: non-GET /api calls are mocked. Usage: node scripts/qa/shell_probe.mjs [--device=iphone-15-pro] [--engine=webkit]
import { chromium, webkit, devices } from "playwright";
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const k = a.replace(/^--/, ""); const i = k.indexOf("="); return i < 0 ? [k, "1"] : [k.slice(0, i), k.slice(i + 1)]; }));
const BASE = "http://localhost:3000";
const API = "http://localhost:8001";
const OUT = args.out || "/tmp/shell_probe";
fs.mkdirSync(OUT, { recursive: true });
const TOKEN = fs.readFileSync("/app/memory/tmp/merchant_token.txt", "utf8").trim();
const devName = args.device === "pixel-8" ? "Pixel 8" : "iPhone 15 Pro";
const engine = args.engine || (args.device === "pixel-8" ? "chromium" : "webkit");
const { defaultBrowserType, ...ctxOpts } = devices[devName];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = engine === "webkit" ? await webkit.launch() : await chromium.launch({ executablePath: "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
const ctx = await browser.newContext({ ...ctxOpts, locale: "en-US" });
await ctx.route((u) => /^http:\/\/localhost:3000\/api\//.test(u.href), async (route) => {
  const req = route.request(); const u = new URL(req.url());
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method()) && !/getAllTransactions$/.test(u.pathname)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: {} }) });
  return route.continue({ url: API + u.pathname + u.search });
});
await ctx.addInitScript((token) => { localStorage.setItem("token", token); localStorage.setItem("last_company_id", "1"); localStorage.setItem("dynopay_lang_onboarded", "1"); localStorage.setItem("cookie_consent", "accepted"); sessionStorage.setItem("mfa_interstitial_seen", "1"); }, TOKEN);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
const vis = (sel) => page.locator(sel).first().isVisible().catch(() => false);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.jpg`, type: "jpeg", quality: 55 });
const log = (...a) => console.log(...a);

async function go(path) { await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 }); await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {}); await wait(1500); }

try {
  await go("/dashboard");
  for (let i = 0; i < 3; i++) { if (await page.locator('[role="dialog"]:visible').count()) { await page.keyboard.press("Escape"); await wait(400); } }
  const h0 = await page.evaluate(() => history.length);
  await page.locator('[data-testid="mobile-nav-more"]').click();
  await wait(300); log("more@300", await vis('[data-testid="mobile-more-sheet"]'));
  await wait(900); log("more@1200", await vis('[data-testid="mobile-more-sheet"]'), "hist", h0, "->", await page.evaluate(() => history.length));
  await shot("more_open");
  await page.goBack(); await wait(900);
  log("after back: sheet", await vis('[data-testid="mobile-more-sheet"]'), "url", page.url());
  await shot("more_after_back");

  // More → navigate
  await page.locator('[data-testid="mobile-nav-more"]').click(); await wait(800);
  await page.locator('[data-testid="mobile-nav-settings"]').first().click().catch((e) => log("click settings fail", e.message.slice(0, 80)));
  await wait(2500); log("navigated to", page.url(), "sheet", await vis('[data-testid="mobile-more-sheet"]'));

  // Settings index → section → back button → index; then section → browser back
  await go("/settings");
  log("index visible", await vis('[data-testid="settings-phone-index"]'));
  await shot("settings_index");
  await page.locator('[data-testid="settings-index-row-security"]').click(); await wait(1500);
  log("section url", page.url(), "back btn", await vis('[data-testid="settings-back-btn"]'), "title", await page.locator('[data-testid="settings-section-title"]').innerText().catch(() => "-"));
  await shot("settings_security");
  await page.locator('[data-testid="settings-back-btn"]').click(); await wait(1200);
  log("after back btn url", page.url(), "index", await vis('[data-testid="settings-phone-index"]'));
  await page.locator('[data-testid="settings-index-row-company"]').click(); await wait(1500);
  await page.goBack(); await wait(1200);
  log("after browser back url", page.url(), "index", await vis('[data-testid="settings-phone-index"]'));
  await go("/settings?section=payments");
  log("deep link: index", await vis('[data-testid="settings-phone-index"]'), "title", await page.locator('[data-testid="settings-section-title"]').innerText().catch(() => "-"));
  await page.locator('[data-testid="settings-back-btn"]').click(); await wait(1200);
  log("deep link back → url", page.url(), "index", await vis('[data-testid="settings-phone-index"]'));

  // Pay links filters sheet
  await go("/pay-links");
  await page.locator('[data-testid="paylinks-filters-btn"]').click(); await wait(800);
  log("paylinks sheet", await vis('[data-testid="paylinks-filter-sheet"]'));
  await page.locator('[data-testid="paylinks-status-active"]').click(); await wait(300);
  await shot("paylinks_sheet");
  await page.locator('[data-testid="paylinks-filter-done"]').click(); await wait(800);
  log("sheet closed", !(await vis('[data-testid="paylinks-filter-sheet"]')), "count", await page.locator('[data-testid="paylinks-filters-btn-count"]').innerText().catch(() => "-"), "url", page.url());
  await shot("paylinks_after");

  // Create hub sheet + back
  await page.locator('[data-testid="mobile-nav-create"]').click(); await wait(900);
  await shot("create_open");
  log("create dialogs", await page.locator('[role="dialog"]:visible').count());
  await page.goBack(); await wait(900);
  log("create after back dialogs", await page.locator('[role="dialog"]:visible').count(), page.url());

  // User menu sheet
  await page.locator('[data-testid="user-menu-trigger"]').click(); await wait(900);
  log("user menu sheet", await vis('[data-testid="user-menu-sheet"]'));
  await shot("user_menu");
} catch (e) {
  log("ERR", e.message.slice(0, 300));
}
await browser.close();
