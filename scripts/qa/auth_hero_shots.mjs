import { chromium } from "playwright";

const BASE = process.env.BASE || "https://cred-manager-29.preview.emergentagent.com";
const OUT = process.env.OUT || "/app/.screenshots";
const EXEC = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH;

const only = process.env.ONLY;
let shots = [
  { name: "login_dark_desktop", url: "/auth/login", w: 1440, h: 980, mode: "dark" },
  { name: "login_light_desktop", url: "/auth/login", w: 1440, h: 980, mode: "light" },
  { name: "register_dark_desktop", url: "/auth/register", w: 1440, h: 980, mode: "dark" },
  { name: "login_dark_mobile", url: "/auth/login", w: 390, h: 844, mode: "dark" },
  { name: "landing_dark_hero", url: "/", w: 1440, h: 900, mode: "dark" },
  { name: "landing_light_hero", url: "/", w: 1440, h: 900, mode: "light" },
];
if (only) shots = shots.filter((s) => s.name.includes(only));

const run = async () => {
  const browser = await chromium.launch({ executablePath: EXEC || undefined, headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Prime theme in localStorage before first paint.
  await page.goto(BASE + "/auth/login", { waitUntil: "domcontentloaded" });
  for (const s of shots) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.evaluate((m) => {
      localStorage.setItem("theme-mode-public", m);
      localStorage.setItem("theme-mode-inapp", m);
    }, s.mode);
    await page.goto(BASE + s.url, { waitUntil: "domcontentloaded" });
    try {
      await page.waitForSelector("[data-testid='auth-brand-panel'], [data-testid='hero-v5']", { timeout: 30000 });
    } catch {
      await page.waitForSelector("input", { timeout: 25000 });
    }
    await page.waitForTimeout(2800);
    await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: false });
    console.log("saved", s.name);
  }
  await browser.close();
};
run().catch((e) => { console.error(e); process.exit(1); });
