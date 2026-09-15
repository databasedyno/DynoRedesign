/**
 * Part F — sticky page header must never eat clicks/focus meant for controls under it.
 *   node scripts/qa/sticky_header_probe.mjs [--base=<url>]
 * Logs in, opens /pay-links/products/new, parks the currency <Select> right under the
 * sticky header, then (a) focuses it via keyboard-style focus() and (b) clicks it WITHOUT
 * force — both must leave the control fully below the header and open the listbox.
 */
import { chromium } from "playwright";
import fs from "fs";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const BASE = arg("base", fs.readFileSync("/app/.env", "utf8").match(/NEXT_PUBLIC_SERVER_URL=(\S+)/)?.[1]).replace(/\/$/, "");
const creds = fs.readFileSync("/app/memory/test_credentials.md", "utf8");
const EMAIL = creds.match(/([\w.+-]+@gmail\.com)/)?.[1];
const PASS = creds.match(/Katiekendra[^\s`|]*/)?.[0];

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 700 } });
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"} ${msg}`); if (!ok) failures++; };

await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
await page.evaluate(() => sessionStorage.setItem("mfa_interstitial_seen", "1"));
await page.fill('[data-testid="login-email-input"]', EMAIL);
await page.getByRole("button", { name: "Continue", exact: true }).click({ force: true });
await page.fill('[data-testid="password-input"]', PASS);
await page.click('[data-testid="signin-submit-btn"]', { force: true });
await page.waitForURL("**/dashboard**", { timeout: 60000 });
await page.evaluate(() => sessionStorage.setItem("mfa_interstitial_seen", "1"));

await page.goto(`${BASE}/pay-links/products/new`, { waitUntil: "load" });
await page.waitForSelector('[data-testid="main-page-header"]');
const sel = page.locator('[data-testid="product-editor-layout"] .MuiSelect-select').first();
await sel.waitFor();

const header = page.locator('[data-testid="main-page-header"]');
const geometry = async () => {
  const h = await header.boundingBox();
  const s = await sel.boundingBox();
  return { headerBottom: h.y + h.height, selTop: s.y, selBottom: s.y + s.height };
};

// Find the scroll container that owns the sticky header and park the select under it.
await page.evaluate(() => {
  const el = document.querySelector('[data-testid="product-editor-layout"] .MuiSelect-select');
  let sc = el.parentElement;
  while (sc && !(sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
  const hdr = document.querySelector('[data-testid="main-page-header"]');
  const hb = hdr.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  // put the select's centre ~10px inside the header's footprint
  (sc || window).scrollBy(0, r.top + r.height / 2 - (hb.top + hb.height - 10));
  return { scrollPaddingTop: sc ? sc.style.scrollPaddingTop : "n/a" };
}).then((r) => console.log("scroll-padding-top on container:", r.scrollPaddingTop));
await page.waitForTimeout(300);
let g = await geometry();
check(g.selTop < g.headerBottom, `setup: select parked under header (selTop ${g.selTop.toFixed(0)} < headerBottom ${g.headerBottom.toFixed(0)})`);

// (a) keyboard focus must scroll the control clear of the header
await sel.focus();
await page.waitForTimeout(400);
g = await geometry();
check(g.selTop >= g.headerBottom - 1, `focus(): select clear of header (selTop ${g.selTop.toFixed(0)} >= headerBottom ${g.headerBottom.toFixed(0)})`);
const focused = await page.evaluate(() => document.activeElement?.classList.contains("MuiSelect-select"));
check(focused, "focus(): select actually holds focus");
await page.keyboard.press("Escape");

// (b) a plain (non-forced) click must open the listbox
await page.evaluate(() => {
  const el = document.querySelector('[data-testid="product-editor-layout"] .MuiSelect-select');
  let sc = el.parentElement;
  while (sc && !(sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
  const hb = document.querySelector('[data-testid="main-page-header"]').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  (sc || window).scrollBy(0, r.top + r.height / 2 - (hb.top + hb.height - 10));
});
await page.waitForTimeout(300);
let opened = false;
try {
  await sel.click({ timeout: 8000 });
  opened = await page.locator('[role="listbox"]').first().isVisible({ timeout: 3000 }).catch(() => false);
} catch (e) {
  console.log("click error:", String(e.message).split("\n")[0]);
}
check(opened, "click(): listbox opened without force");
if (opened) await page.keyboard.press("Escape");

console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CHECKS PASSED");
await browser.close();
process.exit(failures ? 1 : 0);
