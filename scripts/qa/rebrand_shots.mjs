// Rebrand smoke shots: node scripts/qa/rebrand_shots.mjs <base> <token> <out_dir> <light|dark> <routes,comma>
import { chromium } from "playwright";
import fs from "node:fs";

const [BASE, TOKEN, OUT, MODE = "light", ROUTES = "/dashboard"] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const exe = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/usr/bin/google-chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, colorScheme: MODE === "dark" ? "dark" : "light" });
const page = await ctx.newPage();
await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(
  ([t, m]) => {
    if (t && t !== "-") localStorage.setItem("token", t);
    sessionStorage.setItem("mfa_interstitial_seen", "1");
    localStorage.setItem("theme-mode-inapp", m);
    localStorage.setItem("theme-mode-public", m);
    localStorage.setItem("theme-mode", m);
    document.cookie = `theme-mode-inapp=${m}; path=/`;
  },
  [TOKEN, MODE]
);
for (const r of ROUTES.split(",")) {
  await page.goto(`${BASE}${r}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1800);
  const name = r.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "root";
  await page.screenshot({ path: `${OUT}/${name}_${MODE}.jpg`, type: "jpeg", quality: 55 });
  console.log("shot", name, MODE);
}
await browser.close();
