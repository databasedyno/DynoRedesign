// Quick signed-in screenshots. node scripts/qa/quick_shots.mjs --routes=/wallet,/dashboard --widths=1440,390 [--theme=light] [--out=/app/test_reports/quick] [--scroll=0]
import { chromium } from "playwright";
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const s = a.replace(/^--/, ""); const i = s.indexOf("="); return i < 0 ? [s, "1"] : [s.slice(0, i), s.slice(i + 1)]; }));
const BASE = args.base || "https://secure-passphrase-15.preview.emergentagent.com";
const OUT = args.out || "/app/test_reports/quick";
const THEME = args.theme || "light";
const TOKEN = fs.readFileSync("/app/memory/tmp/merchant_token.txt", "utf8").trim();
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
for (const w of (args.widths || "1440").split(",").map(Number)) {
  const mobile = w < 500;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, colorScheme: THEME });
  await ctx.addInitScript(([t, theme, keep]) => {
    try {
      localStorage.setItem("token", t);
      localStorage.setItem("last_company_id", "1");
      localStorage.setItem("theme-mode-inapp", theme);
      localStorage.setItem("dynopay_lang_onboarded", "1");
      localStorage.setItem("cookie_consent", "accepted");
      sessionStorage.setItem("mfa_interstitial_seen", "1");
      if (!keep) for (const k of Object.keys(localStorage)) if (k.startsWith("dyno_tip_") || k.startsWith("page_tip")) localStorage.removeItem(k);
    } catch {}
  }, [TOKEN, THEME, args.keeptips === "1"]);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(`pageerror: ${String(e.message).slice(0, 200)}`));
  page.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text().slice(0, 200)}`); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/")) errs.push(`http ${r.status()} ${r.url().slice(0, 120)}`); });
  for (const route of (args.routes || "/dashboard").split(",")) {
    errs.length = 0;
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(Number(args.wait || 2500));
      if (args.scroll) await page.evaluate((y) => { const m = document.querySelector("main") || document.scrollingElement; window.scrollTo(0, y); m && m.scrollTo && m.scrollTo(0, y); }, Number(args.scroll));
      const name = `${route.replace(/[/?=&]+/g, "_").replace(/^_/, "") || "root"}__${w}__${THEME}${args.scroll ? "__s" + args.scroll : ""}`;
      await page.screenshot({ path: `${OUT}/${name}.jpeg`, quality: 55, type: "jpeg", fullPage: args.full === "1" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      console.log(`${w} ${route} -> ${OUT}/${name}.jpeg overflowX=${overflow} url=${page.url().replace(BASE, "")}`);
      for (const e of [...new Set(errs)].slice(0, 6)) console.log("   ", e);
    } catch (e) {
      console.log(`${w} ${route} FAILED ${String(e.message).slice(0, 160)}`);
    }
  }
  await ctx.close();
}
await browser.close();
