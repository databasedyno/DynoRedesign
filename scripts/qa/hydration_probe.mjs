// Capture hydration/console errors per page. Usage: node scripts/qa/hydration_probe.mjs --pages=/settings,/customers --widths=390,1920 [--login]
import { chromium } from "playwright";

const BASE = process.env.SWEEP_BASE_URL || "https://cred-manager-29.preview.emergentagent.com";
const EMAIL = process.env.SWEEP_EMAIL || "onarrival21@gmail.com";
const PASS = process.env.SWEEP_PASS || "Katiekendra123@";
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const k = a.replace(/^--/, ""); const i = k.indexOf("="); return i < 0 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)]; }));
const PAGES = (args.pages || "/settings,/customers").split(",");
const WIDTHS = (args.widths || "390,1920").split(",").map(Number);
const REPEAT = Number(args.repeat || 1);

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.text().slice(0, 900)); });
page.on("pageerror", (e) => logs.push("PAGEERROR " + String(e.message).slice(0, 300)));

if ("login" in args) {
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
}

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: w <= 500 ? 844 : 900 });
  for (const p of PAGES) {
    for (let r = 0; r < REPEAT; r++) {
      logs.length = 0;
      await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const hyd = logs.filter((l) => /hydrat|did not match|Expected server HTML|Text content does not match/i.test(l));
      console.log(`\n=== ${w} ${p} (run ${r + 1}) url=${page.url()} hydrationIssues=${hyd.length} otherErrors=${logs.length - hyd.length}`);
      for (const l of hyd) console.log("  H> " + l.replace(/\n/g, " ⏎ ").slice(0, 700));
      for (const l of logs.filter((l) => !hyd.includes(l)).slice(0, 6)) console.log("  E> " + l.replace(/\n/g, " ⏎ ").slice(0, 300));
    }
  }
}
await browser.close();
