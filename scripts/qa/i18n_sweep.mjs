// Checkpoint 4.4 six-language sweep: per page × language → untranslated (identical-to-EN) strings, raw keys, overflow/clipped text at phone width.
// Usage: node scripts/qa/i18n_sweep.mjs [--pages=/dashboard,/kyc] [--langs=de,fr] [--width=390] [--company=1]
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SWEEP_BASE_URL || "https://speedup-check.preview.emergentagent.com";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const W = Number(args.width || 390);
const H = W <= 500 ? 844 : 800;
const LANGS = (args.langs || "de,fr,es,pt,nl").split(",");
const PAGES = (args.pages ? args.pages.split(",") : [
  "/dashboard", "/pay-links", "/create-pay-link", "/transactions", "/payouts", "/wallet", "/wallet/security",
  "/invoices", "/customers", "/referrals", "/storefront", "/settings", "/settings?section=notifications", "/developer-keys", "/notifications", "/help-support", "/kyc", "/get-started",
]);

const TEXTS = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0 && !el.closest('[aria-hidden="true"]') && !el.closest('script,style,noscript'); };
  const out = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = walker.nextNode())) { const t = n.textContent.replace(/\\s+/g, ' ').trim(); if (t.length < 4 || !/[A-Za-zÀ-ÿ]{3}/.test(t)) continue; const el = n.parentElement; if (!el || !vis(el)) continue; if (el.closest('[data-i18n-skip], code, pre, [data-testid*="address"], [data-testid*="url"], [data-testid*="email"]')) continue; out.add(t); }
  const de = document.documentElement;
  const clipped = []; for (const el of document.body.querySelectorAll('*')) { if (!vis(el)) continue; const cs = getComputedStyle(el); const hasText = [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()); if (!hasText) continue; if (el.scrollWidth > el.clientWidth + 2 && (cs.overflowX === 'hidden' || cs.overflowX === 'clip') && cs.textOverflow !== 'ellipsis' && cs.webkitLineClamp === 'none' && el.clientWidth > 4) clipped.push((el.getAttribute('data-testid') || el.tagName.toLowerCase()) + ' "' + el.textContent.trim().slice(0, 40) + '"'); }
  const rawKeys = [...out].filter((t) => /^[a-z][a-zA-Z0-9]*(\\.[a-zA-Z0-9_]+){1,4}$/.test(t));
  return { texts: [...out], overflow: de.scrollWidth > innerWidth + 1, clipped: [...new Set(clipped)].slice(0, 10), rawKeys };
})()`;

const ALLOW = /^(\d|[$€£]|https?:|www\.|[A-Z0-9_]{2,}$|[A-Z]{2,6}-[A-Z0-9]+|INV-|@|\+\d|Dynopay|DynoPay|The Dev Store|Kendra|USDT|USDC|BTC|ETH|SOL|TRX|LTC|DOGE|BNB|MATIC|XRP|XLM|Bitcoin|Ethereum|Tron|Solana|Polygon|Litecoin|Dogecoin|Stellar|Ripple|Binance|Tatum|Veriff|WhatsApp|Telegram|Twitter|GitHub|Google|Apple|API|Webhook|Webhooks|Stripe|OTP|PDF|CSV|JSON|QR|KYC|2FA|TOTP|URL|ID|UTC|OK|Pro|Plus|Premium|Standard|Free|Starter|Business|Individual|Email|Status|Total|Team|Admin|Support|Blog|Info|Login|Dashboard|Storefront|Widget|Web3)/;
const looksLikeName = (t) => /^[A-Z][a-z]+( [A-Z][a-z]+){0,2}$/.test(t) && t.split(" ").length <= 2;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForSelector('[data-testid="login-email-input"]', { timeout: 60000 });
await page.fill('[data-testid="login-email-input"]', process.env.SWEEP_EMAIL || "onarrival21@gmail.com");
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.waitForSelector('[data-testid="password-input"]', { timeout: 30000 });
await page.fill('[data-testid="password-input"]', process.env.SWEEP_PASS || "Katiekendra123@");
await page.click('[data-testid="signin-submit-btn"]');
await page.waitForURL("**/dashboard**", { timeout: 90000 });
await page.evaluate((c) => { localStorage.setItem("last_company_id", c); localStorage.setItem("theme-mode-inapp", "light"); }, args.company || "1");
await page.setViewportSize({ width: W, height: H });

const setLang = async (l) => {
  await page.evaluate((l) => { localStorage.setItem("lang", l); localStorage.removeItem("lang_manual"); document.cookie = `dp_lang=${l}; path=/`; }, l);
  current = l;
};
// The signed-in account's language is the source of truth (reconcileLanguageOnAuth) — make the profile
// report the swept language, and swallow any PUT so the sweep never mutates the owner account.
let current = "en";
await page.route(/\/api\/user\/profile(\?|$)/, async (route) => {
  const req = route.request();
  if (req.method() === "PUT") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  const res = await route.fetch();
  let body = await res.text();
  try { const j = JSON.parse(body); if (j?.data) { j.data.language = current; body = JSON.stringify(j); } } catch {}
  return route.fulfill({ response: res, body });
});
const EN_SKIP = "Skip to main content";
const capture = async (p, lang) => {
  await page.goto(`${BASE}${p}${p.includes("?") ? "&" : "?"}lang=${lang}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  // Wait until the shell rendered real content AND the locale chunk landed (skip link is translated in every locale).
  await page.waitForFunction(({ lang, EN_SKIP }) => {
    const skip = document.querySelector('[data-testid="skip-to-content"]');
    const main = document.querySelector("main");
    const langOk = lang === "en" ? true : !!skip && skip.textContent.trim() !== EN_SKIP;
    return langOk && !!main && main.innerText.trim().length > 200;
  }, { lang, EN_SKIP }, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return page.evaluate(TEXTS);
};

const report = {};
for (const p of PAGES) {
  try {
    await setLang("en");
    const en = await capture(p, "en");
    const enSet = new Set(en.texts);
    report[p] = { en: { count: en.texts.length, overflow: en.overflow, clipped: en.clipped } };
    for (const l of LANGS) {
      await setLang(l);
      const r = await capture(p, l);
      const same = r.texts.filter((t) => enSet.has(t) && !ALLOW.test(t) && !looksLikeName(t) && /[a-z]{3}/.test(t) && t.split(" ").length >= 2);
      report[p][l] = { count: r.texts.length, same: same.slice(0, 40), overflow: r.overflow, clipped: r.clipped, rawKeys: r.rawKeys };
      console.log(`${p} ${l}: texts=${r.texts.length} sameAsEN=${same.length}${r.overflow ? " OVERFLOW" : ""}${r.clipped.length ? " CLIPPED " + r.clipped.join(" | ") : ""}${r.rawKeys.length ? " RAWKEYS " + r.rawKeys.join(",") : ""}`);
      if (same.length) console.log("    " + same.slice(0, 25).join(" || "));
    }
  } catch (e) { console.log(`XX ${p} ${String(e.message).slice(0, 100)}`); }
}
await setLang("en");
fs.mkdirSync("/app/memory/reports/i18n", { recursive: true });
fs.writeFileSync(`/app/memory/reports/i18n/sweep-${W}.json`, JSON.stringify(report, null, 1));
await browser.close();
