// Auth-screen audit shots (no login). Usage: node scripts/qa/auth_shots.mjs [--out=/tmp/auth]
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SWEEP_BASE_URL || "https://cred-manager-29.preview.emergentagent.com";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const OUT = args.out || "/tmp/auth";
fs.mkdirSync(OUT, { recursive: true });
const SHOTS = [
  { slug: "login", url: "/auth/login" },
  { slug: "login-forgot", url: "/auth/login", after: async (p) => { const l = p.getByText(/forgot/i).first(); if (await l.count()) await l.click({ force: true }); await p.waitForTimeout(800); } },
  { slug: "register", url: "/auth/register" },
  { slug: "register-email", url: "/auth/register", after: async (p) => { const b = p.locator('[data-testid="purpose-skip"]'); if (await b.count()) await b.click({ force: true }); await p.waitForTimeout(800); } },
  { slug: "reset-password", url: "/reset-password?token=qa-invalid-token&email=qa%40example.com" },
  { slug: "secure-account", url: "/auth/secure-account?token=qa-invalid-token" },
  { slug: "accept-invite", url: "/auth/accept-invite?token=qa-invalid-token" },
  { slug: "validate-social", url: "/auth/validateSocialLogin" },
];
const VIEWS = [[390, 844], [1920, 1080]];
const THEMES = ["light", "dark"];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
for (const theme of THEMES) {
  for (const [w, h] of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
    await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.evaluate((t) => { localStorage.setItem("theme-mode-auth", t); localStorage.setItem("theme-mode-public", t); localStorage.setItem("theme-mode-inapp", t); document.cookie = `theme-mode-auth=${t}; path=/`; document.cookie = `theme-mode-public=${t}; path=/`; }, theme);
    for (const s of SHOTS) {
      errs.length = 0;
      try {
        await page.goto(`${BASE}${s.url}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1200);
        if (s.after) await s.after(page);
        const info = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, bg: getComputedStyle(document.body).backgroundColor, title: document.title, h1: [...document.querySelectorAll("h1,h2")].slice(0, 3).map((e) => e.textContent.trim().slice(0, 60)), text: document.body.innerText.replace(/\s+/g, " ").slice(0, 260) }));
        console.log(`${theme} ${w} ${s.slug}: ${info.sw > info.iw ? "OVERFLOW " : ""}bg=${info.bg} h=${JSON.stringify(info.h1)} ${errs.length ? "JSERR " + errs.join("|") : ""}\n    ${info.text}`);
        await page.screenshot({ path: `${OUT}/${theme}-${w}-${s.slug}.png`, fullPage: w < 500 });
      } catch (e) { console.log(`XX ${theme} ${w} ${s.slug} ${String(e.message).slice(0, 100)}`); }
    }
    await ctx.close();
  }
}
await browser.close();
