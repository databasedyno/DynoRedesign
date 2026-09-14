// Visual check of the link-based auth screens in their "valid" states using mocked API responses (no prod writes).
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.SWEEP_BASE_URL || "https://speedup-check.preview.emergentagent.com";
const OUT = "/tmp/auth_mock"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
const CASES = [
  { slug: "invite-new", url: "/auth/accept-invite?token=mock", route: "**/team/invite/**", body: { data: { email: "new.teammate@example.com", email_has_account: false, invited_by: "Kendra", companies: [{ company_id: 1, company_name: "The Dev Store", role: "member" }] } } },
  { slug: "invite-existing", url: "/auth/accept-invite?token=mock", route: "**/team/invite/**", body: { data: { email: "onarrival21@gmail.com", email_has_account: true, invited_by: "Kendra", companies: [{ company_id: 1, company_name: "The Dev Store", role: "admin" }] } } },
  { slug: "secure-success", url: "/auth/secure-account?token=mock", route: "**/user/security/flag-login", body: { message: "We locked your account and signed out every device." } },
];
for (const theme of ["light", "dark"]) for (const [w, h] of [[390, 844], [1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate((t) => { localStorage.setItem("theme-mode-auth", t); document.cookie = `theme-mode-auth=${t}; path=/`; }, theme);
  for (const c of CASES) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.route(c.route, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(c.body) }));
    await page.goto(`${BASE}${c.url}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    if (c.slug === "invite-new") { await page.locator('[data-testid="accept-invite-password"]').first().click().catch(() => {}); await page.keyboard.type("abc"); await page.waitForTimeout(400); }
    console.log(theme, w, c.slug, (await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 200))));
    await page.screenshot({ path: `${OUT}/${theme}-${w}-${c.slug}.png` });
  }
  await ctx.close();
}
await browser.close();
