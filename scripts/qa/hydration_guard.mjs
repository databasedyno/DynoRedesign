// Hydration regression guard — fails (exit 1) if any public page throws a React
// hydration error (server HTML ≠ first client render → React #418/#423 → the whole
// page is discarded and re-rendered client-side → "loads, then goes blank" on phones)
// or renders blank. Fresh browser context per page × width (no cached state).
//
//   GUARD_BASE_URL=https://dynopay.com node scripts/qa/hydration_guard.mjs
//   node scripts/qa/hydration_guard.mjs --base=<url> --pages=/,/fees --widths=390,1920
//
// Env/flags: GUARD_PAGES (default "/,/fees,/pay/demo"), GUARD_WIDTHS ("390,1920"),
// GUARD_RETRIES (1 — a failure must reproduce to count), PLAYWRIGHT_CHROME_EXECUTABLE_PATH.
import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const k = a.replace(/^--/, "");
    const i = k.indexOf("=");
    return i < 0 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)];
  }),
);
const BASE = (args.base || process.env.GUARD_BASE_URL || "").replace(/\/+$/, "");
if (!BASE) {
  console.error("hydration_guard: set GUARD_BASE_URL or --base=<url>");
  process.exit(2);
}
const PAGES = (args.pages || process.env.GUARD_PAGES || "/,/fees,/pay/demo").split(",").filter(Boolean);
const WIDTHS = (args.widths || process.env.GUARD_WIDTHS || "390,1920").split(",").map(Number);
const RETRIES = Number(args.retries ?? process.env.GUARD_RETRIES ?? 1);

const HYDRATION_RE =
  /Minified React error #(418|419|422|423|424|425)\b|Hydration failed|error while hydrating|did not match|Expected server HTML|Text content does not match|Did not expect server HTML/i;

const launchOpts = {};
if (process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH;
const browser = await chromium.launch(launchOpts);

async function probe(path, width) {
  const ctx = await browser.newContext({
    viewport: { width, height: width <= 500 ? 844 : 900 },
    isMobile: width <= 500,
    hasTouch: width <= 500,
    userAgent:
      width <= 500
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") logs.push(m.text().slice(0, 600));
  });
  page.on("pageerror", (e) => logs.push("PAGEERROR " + String(e.message).slice(0, 600)));
  const problems = [];
  try {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (!res || res.status() >= 400) problems.push(`HTTP ${res ? res.status() : "no response"}`);
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => !!(window.next && window.next.router), null, { timeout: 30000 }).catch(() => {
      problems.push("never hydrated (window.next.router missing after 30s)");
    });
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => {
      const root = document.getElementById("__next");
      return {
        rootHeight: root ? Math.round(root.getBoundingClientRect().height) : -1,
        textLength: (document.body.innerText || "").trim().length,
      };
    });
    if (state.rootHeight < 300 || state.textLength < 80) problems.push(`blank page (rootHeight=${state.rootHeight}, text=${state.textLength})`);
    for (const l of logs) if (HYDRATION_RE.test(l)) problems.push("hydration: " + l.replace(/\n/g, " ⏎ ").slice(0, 300));
  } catch (e) {
    problems.push("navigation: " + String(e.message).slice(0, 200));
  } finally {
    await ctx.close();
  }
  return problems;
}

let failed = 0;
for (const width of WIDTHS) {
  for (const path of PAGES) {
    let problems = await probe(path, width);
    let attempt = 1;
    while (problems.length && attempt <= RETRIES) {
      attempt += 1;
      problems = await probe(path, width);
    }
    const label = `${String(width).padStart(4)}px ${path}`;
    if (problems.length) {
      failed += 1;
      console.log(`FAIL ${label} (reproduced ${attempt}/${attempt})`);
      for (const p of [...new Set(problems)].slice(0, 8)) console.log(`     - ${p}`);
    } else {
      console.log(`ok   ${label}`);
    }
  }
}
await browser.close();

if (failed) {
  console.error(`\nhydration_guard: ${failed} page/width combination(s) failed on ${BASE}`);
  process.exit(1);
}
console.log(`\nhydration_guard: all ${PAGES.length * WIDTHS.length} checks clean on ${BASE}`);
