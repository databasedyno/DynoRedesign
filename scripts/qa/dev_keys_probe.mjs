import { chromium } from "playwright";
const EXE = "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell";
const BASE = "https://cred-manager-29.preview.emergentagent.com";
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
await page.fill('[data-testid="login-email-input"]', "onarrival21@gmail.com");
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.waitForSelector('[data-testid="password-input"]');
await page.fill('[data-testid="password-input"]', "Katiekendra123@");
await page.click('[data-testid="signin-submit-btn"]');
await page.waitForURL(/\/dashboard/, { timeout: 45000 });
await page.evaluate(() => localStorage.setItem("last_company_id", "1"));

await page.goto(`${BASE}/developer-keys`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

const info = await page.evaluate(() => {
  const sb = document.querySelector('[data-testid="sandbox-badge"]');
  if (!sb) return { error: "no sandbox-badge" };
  const sbRect = sb.getBoundingClientRect().toJSON();
  // find first MuiPaper ancestor
  let card = sb.parentElement;
  while (card && !(card.className && /MuiPaper|MuiCard/.test(card.className))) card = card.parentElement;
  const cardRect = card ? card.getBoundingClientRect().toJSON() : null;
  // dump every element inside card with text
  const scope = card || sb.parentElement.parentElement.parentElement;
  const items = Array.from(scope.querySelectorAll("*"))
    .filter(el => el.children.length === 0 && el.textContent.trim().length > 0)
    .map(el => ({ tag: el.tagName, tid: el.getAttribute("data-testid"), cls: (el.className||"").toString().slice(0,60), txt: el.textContent.trim().slice(0,50), r: el.getBoundingClientRect().toJSON() }));
  return { cardRect, sbRect, items: items.slice(0, 30) };
});

console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "/app/test_reports/dev_keys_390.png", fullPage: false, type: "jpeg", quality: 40 });
await browser.close();
