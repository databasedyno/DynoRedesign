// Repro/verify: SafeDeal inputs must stay readable on dark-mode devices when
// served from the safedeal.sh HOST (browser path is "/signin", not "/safedeal/signin").
// Maps safedeal.sh -> 127.0.0.1 (local Next on :3000) and emulates prefers-color-scheme: dark.
// Usage: node scripts/qa/safedeal_dark_inputs.mjs
import { chromium } from "playwright";

const exe = process.env.CHROME_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell";
const browser = await chromium.launch({
  executablePath: exe,
  args: ["--host-resolver-rules=MAP safedeal.sh 127.0.0.1, MAP www.safedeal.sh 127.0.0.1"],
});
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name} ${extra}`); if (!ok) failed++; };

async function probe(url, colorScheme, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ colorScheme, viewport, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const html = document.documentElement;
    const input = document.querySelector('[data-testid="sd-signin-email"], input[type="email"], input');
    const cs = input ? getComputedStyle(input) : null;
    return {
      theme: html.dataset.theme, colorScheme: html.style.colorScheme, htmlBg: getComputedStyle(html).backgroundColor,
      inputColor: cs?.color, inputBg: cs?.backgroundColor, hasInput: !!input, path: location.pathname, host: location.hostname,
    };
  });
  if (await page.locator('[data-testid="sd-signin-email"]').count()) {
    await page.fill('[data-testid="sd-signin-email"]', "visible@example.com");
  }
  await page.screenshot({ path: `/app/memory/tmp/sd_dark_${r.host}_${colorScheme}.jpg`, quality: 40 });
  await ctx.close();
  return r;
}

const lum = (rgb) => { const m = rgb?.match(/\d+/g)?.map(Number) || [0, 0, 0]; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };

// 1. safedeal.sh host, dark device → must be forced LIGHT with dark input text
const a = await probe("http://safedeal.sh:3000/signin", "dark");
console.log(a);
check("safedeal.sh host resolves to the SafeDeal sign-in (path /signin, input present)", a.hasInput && a.path === "/signin");
check("html[data-theme] forced to light on safedeal.sh even in dark mode", a.theme === "light", `theme=${a.theme}`);
check("input text is dark (readable on light field)", lum(a.inputColor) < 0.4, `color=${a.inputColor}`);

// 2. /safedeal/signin path on a non-SafeDeal host, dark device → still light (regression)
const b = await probe("http://127.0.0.1:3000/safedeal/signin", "dark");
check("/safedeal/signin path forced light in dark mode", b.theme === "light" && lum(b.inputColor) < 0.4, `theme=${b.theme} color=${b.inputColor}`);

// 3. Dynopay page on a dark device must still follow the device (dark) — theme logic untouched
const c = await probe("http://127.0.0.1:3000/auth/login", "dark");
check("Dynopay /auth/login still follows the device (dark)", c.theme === "dark", `theme=${c.theme}`);

await browser.close();
console.log(failed ? `\n${failed} check(s) FAILED` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
