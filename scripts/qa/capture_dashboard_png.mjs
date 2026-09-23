// Re-capture the merchant dashboard for the Help-centre "Getting started" article.
//   PLAYWRIGHT_CHROME_EXECUTABLE_PATH=... node scripts/qa/capture_dashboard_png.mjs --base=<url> --token=<merchant jwt> [--out=assets/Images/home/Dashboard.png]
import { chromium } from "playwright";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "1"]; }));
const BASE = (args.base || "").replace(/\/+$/, "");
const OUT = path.resolve(args.out || "assets/Images/home/Dashboard.png");
const exe = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell";

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2, colorScheme: "light" });
const page = await ctx.newPage();
// Inside the pod the public preview origin can be unreachable from headless Chrome: rewrite API calls to the local backend.
const PUBLIC_API = (process.env.NEXT_PUBLIC_SERVER_URL || args.publicApi || "").replace(/\/+$/, "");
if (PUBLIC_API) await page.route(`${PUBLIC_API}/api/**`, (route) => route.continue({ url: route.request().url().replace(PUBLIC_API, "http://localhost:8001") }));
// Same-origin /api calls on the dev server (no ingress locally) → local backend.
if (BASE.includes("localhost:3000")) await page.route(`${BASE}/api/**`, (route) => route.continue({ url: route.request().url().replace(BASE, "http://localhost:8001") }));
page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 120)));
if (args.debug) page.on("response", (r) => { if (r.url().includes("/api/")) console.log("API", r.status(), r.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 90)); });
if (args.debug) page.on("requestfailed", (r) => { if (r.url().includes("/api/")) console.log("FAILED", r.failure()?.errorText, r.url().slice(0, 100)); });
await page.addInitScript((t) => { try { localStorage.setItem("token", t); localStorage.setItem("last_company_id", "1"); localStorage.setItem("theme-mode-inapp", "light"); localStorage.setItem("dynopay_lang_onboarded", "1"); sessionStorage.setItem("mfa_interstitial_seen", "1"); localStorage.setItem("cookie_consent", "accepted"); } catch {} }, args.token);
await page.goto(`${BASE}/dashboard`, { waitUntil: "load", timeout: 120000 });
await page.waitForSelector('[data-testid="dash2026-root"]', { timeout: 60000 }).catch(() => {});
await page.waitForFunction(() => !document.querySelector(".MuiSkeleton-root"), null, { timeout: 45000 }).catch(() => console.log("skeleton wait 1 timed out"));
await page.click('[data-testid="dash2026-range-1y"]', { timeout: 15000 }).catch((e) => console.log("1y click:", e.message.slice(0, 60)));
await page.waitForFunction(() => !document.querySelector(".MuiSkeleton-root") && !/no payments yet/i.test(document.body.innerText), null, { timeout: 40000 }).catch((e) => console.log("wait:", e.message.slice(0, 80)));
await page.waitForTimeout(2500);
// Hide transient chrome that should not ship in a help-article screenshot.
await page.addStyleTag({ content: "nextjs-portal, [data-testid='mfa-soft-banner'], [data-testid='mfa-interstitial'], .Toastify, [role='alertdialog'] { display: none !important; }" });
await page.waitForTimeout(500);
await page.screenshot({ path: OUT, type: "png", fullPage: false });
console.log("saved", OUT);
await browser.close();
