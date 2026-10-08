import { chromium } from "playwright";
import fs from "fs";
const BASE = "https://secure-passphrase-18.preview.emergentagent.com";
const CHROME = "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell";
const OUT = "/app/memory/brand/verify";
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  // 1) Marketing nav (home) — light + dark top strip
  for (const theme of ["light", "dark"]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
    const p = await ctx.newPage();
    await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3500);
    const brand = await p.$('[data-testid="dynopay-logo"], [data-testid="app-brand-cell"], header');
    await p.screenshot({ path: `${OUT}/nav-${theme}.jpg`, type: "jpeg", quality: 55, clip: { x: 0, y: 0, width: 1440, height: 120 } });
    await ctx.close();
  }

  // 2) Auth login
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
    const p = await ctx.newPage();
    await p.goto(BASE + "/auth/login", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `${OUT}/auth.jpg`, type: "jpeg", quality: 50 });
    await ctx.close();
  }

  // 3) Dashboard (owner token) — capture left sidebar / header brand
  {
    const token = fs.readFileSync("/tmp/owner_token.txt", "utf8").trim();
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.addInitScript((t) => {
      localStorage.setItem("token", t);
      localStorage.setItem("last_company_id", "1");
      sessionStorage.setItem("mfa_interstitial_seen", "1");
    }, token);
    await p.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
    let ok = false;
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(1000);
      if (await p.$('[data-testid="dynopay-logo"], [data-testid="app-brand-cell"]')) { ok = true; break; }
      if (/\/auth\//.test(p.url())) break;
    }
    console.log("dashboard url:", p.url(), "brandFound:", ok);
    await p.screenshot({ path: `${OUT}/dashboard.jpg`, type: "jpeg", quality: 50, clip: { x: 0, y: 0, width: 420, height: 700 } });
    await ctx.close();
  }

  // 4) favicon.svg rendered at 16 and 32 (tab realism) — just load the svg
  await b.close();
  console.log("captures written to", OUT);
})();
