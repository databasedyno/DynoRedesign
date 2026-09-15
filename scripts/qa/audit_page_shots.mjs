// Phase-1 audit page sweep: every route × 390/820/1366/1920 × light/dark → full-page JPEG + overflow/clipped/raw-key/JS-error audit.
// Usage: PLAYWRIGHT_CHROME_EXECUTABLE_PATH=... node scripts/qa/audit_page_shots.mjs --base=<url> --set=public|inapp [--widths=390,820,1366,1920] [--themes=light,dark] [--routes=/,/fees] --out=/app/public/audit/pages
import { chromium } from "playwright";
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const k = a.replace(/^--/, ""); const i = k.indexOf("="); return i < 0 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)]; }));
const BASE = args.base || process.env.SWEEP_BASE_URL;
const SET = args.set || "public";
const OUT = args.out || "/app/public/audit/pages";
const EMAIL = process.env.SWEEP_EMAIL || "onarrival21@gmail.com";
const PASS = process.env.SWEEP_PASS || "Katiekendra123@";
fs.mkdirSync(OUT, { recursive: true });

const WIDTHS = (args.widths ? args.widths.split(",") : ["390", "820", "1366", "1920"]).map(Number);
const THEMES = args.themes ? args.themes.split(",") : ["light", "dark"];
const HEIGHT = { 390: 844, 820: 1180, 1366: 768, 1440: 900, 1920: 1080 };
const CART = JSON.stringify({ devhub: { items: [{ product_id: 9, variant_id: null, quantity: 1, added_at: 0 }] } });

// id → { path, group, prep?, act? }
const ROUTES = {
  public: [
    ["landing", "/", "public"], ["fees", "/fees", "public"], ["about", "/about", "public"], ["company", "/company", "public"], ["how-to", "/how-to", "public"],
    ["for-creators", "/for/creators", "public"], ["compare-coingate", "/compare/coingate", "public"], ["documentation", "/documentation", "public"],
    ["help-support", "/help-support", "public"], ["help-article", "/help-support/getting-started-with-dynopay", "public"], ["system-status", "/system-status", "public"],
    ["blog", "/blog", "public"], ["blog-post", "/blog/how-to-accept-crypto-payments-on-your-website", "public"], ["press", "/press", "public"], ["referral-program", "/referral-program", "public"],
    ["terms", "/terms-conditions", "public"], ["privacy", "/privacy-policy", "public"], ["aml", "/aml-policy", "public"],
    ["signup", "/signup", "public"], ["auth-login", "/auth/login", "public"], ["auth-register", "/auth/register", "public"], ["reset-password", "/reset-password", "public"],
    ["accept-invite", "/auth/accept-invite?token=demo", "public"], ["reset-2fa", "/auth/reset-2fa?token=demo", "public"], ["secure-account", "/auth/secure-account?token=demo", "public"],
    ["not-found", "/this-page-does-not-exist", "public"], ["unsubscribe", "/unsubscribe?token=demo", "public"],
    ["checkout-coins", "/pay?d=rNtQRX", "checkout"], ["checkout-awaiting", "/pay?d=rNtQRX", "checkout", null, "awaiting"],
    ["pay-demo", "/pay/demo", "checkout"], ["donation-demo", "/pay/donation-demo", "checkout"], ["payment-states-demo", "/pay/payment-states-demo", "checkout"], ["state-demo", "/pay/state-demo", "checkout"], ["success-demo", "/pay/success-demo", "checkout"],
    ["payment-success", "/payment/success?transaction_id=9f2c1e7a&status=success&payment_type=crypto", "checkout"], ["payment-failed", "/payment/failed?status=expired&error=Payment%20window%20expired", "checkout"], ["payment-verify", "/payment/verify", "checkout"],
    ["order-status", "/order/ab28e53da29ba70b6266b0e0", "checkout"], ["receipt", "/receipt/oN7U2knyNnaQ3NBrfNXL3F", "checkout"], ["saved", "/saved", "checkout"],
    ["pay-terms", "/pay/terms-of-service", "checkout"], ["pay-aml", "/pay/aml-policy", "checkout"], ["wallet-security-public", "/wallet-security?token=demo", "checkout"],
    ["creator", "/devhub", "creator"], ["creator-shop", "/devhub/shop", "creator"], ["creator-product", "/devhub/p/talk-to-a-developer", "creator"],
    ["creator-cart", "/devhub/cart", "creator", "cart"], ["creator-checkout", "/devhub/checkout", "creator", "cart"],
  ],
  inapp: [
    ["create-pay-link", "/create-pay-link", "inapp"], ["pay-link-detail", "/pay-links/rNtQRX", "inapp"], ["products", "/pay-links/products", "inapp"], ["product-new", "/pay-links/products/new", "inapp"],
    ["product-edit", "/pay-links/products/9/edit", "inapp"], ["product-orders", "/pay-links/products/9/orders", "inapp"], ["storefront-page-tab", "/storefront?tab=page", "inapp"],
    ["profile", "/profile", "inapp"], ["kyc", "/kyc", "inapp"], ["kyc-complete", "/kyc/complete", "inapp"], ["help-support-inapp", "/help-support", "inapp"],
    ["wallet-legacy", "/wallet", "inapp"], ["creator-redirect", "/creator", "inapp"], ["wallet-security-redirect", "/wallet/security", "inapp"],
    ["get-started", "/get-started", "inapp"], ["qa", "/QA", "inapp"], ["quality", "/quality", "inapp"],
  ],
};

const AUDIT = `(() => {
  const iw = window.innerWidth; const de = document.documentElement;
  const sw = Math.max(de.scrollWidth, document.body.scrollWidth);
  const out = { scrollWidth: sw, innerWidth: iw, overflow: sw > iw + 1, offenders: [], clipped: [], smallTaps: 0, h1: (document.querySelector('h1')||{}).innerText || '' };
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const desc = (el) => { const id = el.getAttribute('data-testid'); const t = (el.textContent || '').trim().slice(0, 40); return el.tagName.toLowerCase() + (id ? '[' + id + ']' : '') + (t ? ' "' + t + '"' : ''); };
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width > 0 && r.right > iw + 1 && cs.position !== 'fixed' && r.left < iw && cs.display !== 'none') out.offenders.push(desc(el) + ' right=' + Math.round(r.right));
    if (!vis(el)) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText && el.scrollWidth > el.clientWidth + 2 && (cs.overflowX === 'hidden' || cs.overflowX === 'clip') && cs.textOverflow !== 'ellipsis' && cs.webkitLineClamp === 'none') out.clipped.push(desc(el) + ' sw=' + el.scrollWidth + ' cw=' + el.clientWidth);
    if (iw <= 420 && (el.tagName === 'BUTTON' || el.tagName === 'A' && el.getAttribute('href')) && r.width > 0 && (r.height < 32 || r.width < 32)) out.smallTaps++;
  }
  out.offenders = [...new Set(out.offenders)].slice(0, 8); out.clipped = [...new Set(out.clipped)].slice(0, 10);
  out.gateway = /Bad gateway|Error code 5\\d\\d|Application error/.test((document.body.innerText || '').slice(0, 600));
  out.rawKeys = [...document.body.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^(common|landing|pageTips|transactions|payments|walletScreen|notifications|settingsPage|v5|v3|checkout|storefront|shop)\\.[a-zA-Z0-9_.]+$/.test((e.textContent || '').trim())).map((e) => e.textContent.trim()).slice(0, 5);
  out.textLen = (document.body.innerText || '').length;
  return out;
})()`;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
const MERGE = process.argv.includes("--merge");
const prevPath = `${OUT}/results_${SET}.json`;
const results = [];
const routes = (args.routes ? ROUTES[SET].filter((r) => args.routes.split(",").includes(r[1]) || args.routes.split(",").includes(r[0])) : ROUTES[SET]);

for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, colorScheme: theme });
  await ctx.addCookies([{ name: "theme-mode-public", value: theme, url: BASE }, { name: "theme-mode-inapp", value: theme, url: BASE }]);
  const page = await ctx.newPage();
  await page.addInitScript((t) => { try { localStorage.setItem("theme-mode-public", t); localStorage.setItem("theme-mode-inapp", t); localStorage.setItem("dynopay_lang_onboarded", "1"); sessionStorage.setItem("mfa_interstitial_seen", "1"); localStorage.setItem("cookie_consent", "accepted"); } catch {} }, theme);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

  if (SET === "inapp") {
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForSelector('[data-testid="login-email-input"]', { timeout: 60000 });
        await page.fill('[data-testid="login-email-input"]', EMAIL);
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await page.waitForSelector('[data-testid="password-input"]', { timeout: 60000 });
        await page.fill('[data-testid="password-input"]', PASS);
        await page.click('[data-testid="signin-submit-btn"]');
        await page.waitForURL("**/dashboard**", { timeout: 90000 });
        await page.evaluate(() => localStorage.setItem("last_company_id", "1"));
        ok = true;
        console.log(`[${theme}] logged in`);
      } catch (e) { console.log(`[${theme}] login attempt ${attempt} failed: ${String(e.message).slice(0, 100)}`); }
    }
    if (!ok) { await ctx.close(); continue; }
  }

  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: HEIGHT[w] || 900 });
    for (const [id, p, group, prep, act] of routes) {
      errors.length = 0;
      const label = `${theme} ${w} ${id}`;
      const file = `${group}__${id}__${w}__${theme}.jpg`;
      try {
        await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
        if (prep === "cart") await page.addInitScript((c) => { try { localStorage.setItem("dynopay_cart_v1", c); } catch {} }, CART);
        if (act === "awaiting") {
          await page.route("**/api/pay/addPayment", (r) => r.fulfill({ json: { success: true, data: { address: "0x8a3f1c2e9b7d4f60a1b2c3d4e5f60718293a4b5c", qr_code: "", remaining_minutes: 30, amount: 0.0061, merchant_amount: 0.006, fees: 0.0001, fee_payer: "company" } } }));
          await page.route("**/api/pay/verifyCryptoPayment*", (r) => r.fulfill({ json: { message: "ok", data: { status: "waiting", remaining_seconds: 1790 } } }));
        }
        await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1500);
        if (act === "awaiting") {
          const sel = page.locator('[data-testid="currency-select"]');
          if (await sel.count()) { await sel.first().click({ force: true }); await page.waitForTimeout(400); }
          const coin = page.locator('[data-testid="clean-checkout-coin-ETH"]');
          if (await coin.count()) { await coin.first().click({ force: true }); await page.waitForTimeout(400); }
          const cont = page.locator('[data-testid="clean-checkout-continue-btn"]');
          if (await cont.count()) { await cont.first().click({ force: true }); await page.waitForTimeout(2500); }
        }
        const dismiss = page.locator('[data-testid^="page-tip-dismiss-"]');
        if (await dismiss.count()) await dismiss.first().click({ force: true }).catch(() => {});
        const a = await page.evaluate(AUDIT);
        const finalUrl = page.url().replace(BASE, "");
        await page.screenshot({ path: `${OUT}/${file}`, fullPage: true, type: "jpeg", quality: 55 });
        const bad = a.overflow || a.clipped.length || a.rawKeys.length || errors.length || a.gateway;
        results.push({ id, path: p, group, theme, w, file, finalUrl, ...a, errors: [...errors] });
        console.log(`${bad ? "!! " : "ok "}${label} sw=${a.scrollWidth}/${a.innerWidth}${finalUrl !== p ? " →" + finalUrl : ""}${a.gateway ? " GATEWAY" : ""}${a.overflow ? " OVERFLOW " + a.offenders.join(" | ") : ""}${a.clipped.length ? " CLIPPED " + a.clipped.join(" | ") : ""}${a.rawKeys.length ? " RAWKEYS " + a.rawKeys.join(",") : ""}${errors.length ? " JSERR " + errors.join(" | ") : ""}`);
      } catch (e) {
        console.log(`XX ${label} ${String(e.message).slice(0, 120)}`);
        results.push({ id, path: p, group, theme, w, file, error: String(e.message).slice(0, 200) });
      }
    }
  }
  await ctx.close();
}
const writeOut = () => {
  let all = results;
  if (MERGE && fs.existsSync(prevPath)) { const ids = new Set(results.map((r) => r.id)); all = [...JSON.parse(fs.readFileSync(prevPath, "utf8")).filter((r) => !ids.has(r.id)), ...results]; }
  fs.writeFileSync(prevPath, JSON.stringify(all, null, 1));
};
writeOut();
await browser.close();
