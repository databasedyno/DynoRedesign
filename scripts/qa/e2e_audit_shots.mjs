// E2E experience audit harness: persona × surface × viewport × theme → screenshots + DOM audit JSON.
// Usage: node scripts/qa/e2e_audit_shots.mjs --set=checkout|merchant|safedeal|admin [--widths=390,1440] [--themes=light,dark] [--routes=id1,id2] [--out=/tmp/e2e_audit]
// Tokens: /tmp/e2e_audit/owner_token.txt, admin_token.txt, sd.json (seeded by /tmp/e2e_audit/sd_seed.sh)
import { chromium } from "playwright";
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const k = a.replace(/^--/, ""); const i = k.indexOf("="); return i < 0 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)]; }));
const BASE = args.base || "http://localhost:3000";
const API = args.api || "http://localhost:8001";
const SET = args.set || "checkout";
const OUT = args.out || "/tmp/e2e_audit";
fs.mkdirSync(`${OUT}/${SET}`, { recursive: true });
const WIDTHS = (args.widths ? args.widths.split(",") : ["390", "1440"]).map(Number);
const THEMES = args.themes ? args.themes.split(",") : ["light", "dark"];
const HEIGHT = { 390: 844, 768: 1024, 1440: 900 };
const rd = (p) => { try { return fs.readFileSync(p, "utf8").trim(); } catch { return ""; } };
const OWNER = rd(`${OUT}/owner_token.txt`);
const ADMIN = rd(`${OUT}/admin_token.txt`);
const SD = (() => { try { return JSON.parse(rd(`${OUT}/sd.json`)); } catch { return null; } })();

const ADDR = "0x8a3f1c2e9b7d4f60a1b2c3d4e5f60718293a4b5c";
const QR = rd(`${OUT}/qr.txt`);
const addPayment = { success: true, data: { address: ADDR, qr_code: QR, remaining_minutes: 30, amount: 12.0, merchant_amount: 11.82, fees: 0.18, fee_payer: "company", transaction_id: "qa-audit" } };
const verify = (data) => ({ message: "ok", data });
const CHECKOUT_STATES = {
  waiting: verify({ status: "waiting", remaining_seconds: 1790 }),
  mempool: verify({ status: "pending", unconfirmed: true, remaining_seconds: 1700 }),
  confirming: verify({ status: "pending", remaining_seconds: 1600 }),
  underpaid: verify({ status: "underpaid", paidAmount: 8.0, remainingAmount: 4.0, remainingAmountUsd: 4.0, currency: "USDT", baseCurrency: "USD", remaining_seconds: 1500 }),
  confirmed: verify({ status: "confirmed", paidAmount: 12.0, paidAmountUsd: 12, baseCurrency: "USD", merchantAmount: 11.82, feeAmount: 0.18, feePayer: "company" }),
  overpaid: verify({ status: "overpaid", paidAmount: 15.0, paidAmountUsd: 15, excessAmount: 3.0, excessAmountUsd: 3.0, baseCurrency: "USD", merchantAmount: 14.82, feeAmount: 0.18, feePayer: "company" }),
  expired: verify({ status: "expired", remaining_seconds: 0 }),
};

// [id, path, opts]
const ROUTES = {
  checkout: [
    ["coins", "/pay?d=jgQQzL", {}],
    ["deleted-link-session", "/pay?d=rNtQRX", { checkout: "waiting" }],
    ...Object.keys(CHECKOUT_STATES).map((s) => [`state-${s}`, "/pay?d=jgQQzL", { checkout: s }]),
    ["expired-link", "/pay?d=pTQPn4", {}],
    ["bad-link", "/pay?d=zzzzzz", {}],
    ["demo", "/pay/demo", {}],
    ["donation-demo", "/pay/donation-demo", {}],
    ["receipt", "/receipt/oN7U2knyNnaQ3NBrfNXL3F", {}],
  ],
  merchant: [
    ["dashboard-rich", "/dashboard", { company: 1 }],
    ["dashboard-empty", "/dashboard", { company: 345 }],
    ["pay-links", "/pay-links", { company: 1 }],
    ["pay-links-empty", "/pay-links", { company: 345 }],
    ["pay-link-detail", "/pay-links/rNtQRX", { company: 1 }],
    ["create-pay-link", "/create-pay-link", { company: 1 }],
    ["transactions", "/transactions", { company: 1 }],
    ["transactions-empty", "/transactions", { company: 345 }],
    ["invoices", "/invoices", { company: 1 }],
    ["invoices-empty", "/invoices", { company: 345 }],
    ["payouts", "/payouts", { company: 1 }],
    ["payouts-empty", "/payouts", { company: 345 }],
    ["wallet", "/wallet", { company: 1 }],
    ["wallet-empty", "/wallet", { company: 345 }],
    ["customers", "/customers", { company: 1 }],
    ["customers-empty", "/customers", { company: 345 }],
    ["products", "/pay-links/products", { company: 1 }],
    ["storefront", "/storefront", { company: 1 }],
    ["settings", "/settings", { company: 1 }],
    ["developer-keys", "/developer-keys", { company: 1 }],
    ["notifications", "/notifications", { company: 1 }],
    ["brands", "/brands", { company: 1 }],
    ["referrals", "/referrals", { company: 1 }],
    ["get-started", "/get-started", { company: 345 }],
  ],
  safedeal: [
    ["landing", "/safedeal", {}],
    ["signin", "/safedeal/signin", {}],
    ["help", "/safedeal/help", {}],
    ["deal-guest-email", () => `/safedeal/deal/${SD.deal_email.token}`, {}],
    ["deal-guest-link", () => `/safedeal/deal/${SD.deal_link.token}`, {}],
    ["deals-seller", "/safedeal/deals", { sd: "seller" }],
    ["deals-buyer", "/safedeal/deals", { sd: "buyer" }],
    ["new-deal", "/safedeal/deals/new", { sd: "seller" }],
    ["new-deal-guest", "/safedeal/deals/new", {}],
    ["deal-seller-invited", () => `/safedeal/deal/${SD.deal_email.token}`, { sd: "seller" }],
    ["deal-buyer-invited", () => `/safedeal/deal/${SD.deal_email.token}`, { sd: "buyer" }],
    ["deal-link-creator", () => `/safedeal/deal/${SD.deal_link.token}`, { sd: "buyer" }],
    ["deal-link-claimer", () => `/safedeal/deal/${SD.deal_link.token}`, { sd: "seller" }],
    ["wallet-seller", "/safedeal/wallet", { sd: "seller" }],
    ["wallet-buyer", "/safedeal/wallet", { sd: "buyer" }],
  ],
  admin: [
    ["login", "/admin/login", {}],
    ["overview", "/admin", { admin: true }],
    ["transactions", "/admin/transactions", { admin: true }],
    ["merchants", "/admin/merchants", { admin: true }],
    ["escrow", "/admin/escrow", { admin: true }],
    ["escrow-withdrawals", "/admin/escrow?tab=withdrawals", { admin: true }],
    ["fee-recon", "/admin/fee-reconciliation", { admin: true }],
    ["live-console", "/admin/live-console", { admin: true }],
    ["support", "/admin/support", { admin: true }],
  ],
};

const AUDIT = `(() => {
  const iw = window.innerWidth, ih = window.innerHeight; const de = document.documentElement;
  const sw = Math.max(de.scrollWidth, document.body.scrollWidth);
  const out = { scrollWidth: sw, innerWidth: iw, pageHeight: Math.max(de.scrollHeight, document.body.scrollHeight), overflow: sw > iw + 1, offenders: [], clipped: [], smallTaps: [], h1: (document.querySelector('h1')||{}).innerText || '', unlabeledInputs: 0, iconOnlyButtons: 0, tinyText: 0 };
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const desc = (el) => { const id = el.getAttribute('data-testid'); const t = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40); return el.tagName.toLowerCase() + (id ? '[' + id + ']' : '') + (t ? ' "' + t + '"' : ''); };
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width > 0 && r.right > iw + 1 && cs.position !== 'fixed' && r.left < iw && cs.display !== 'none') out.offenders.push(desc(el) + ' right=' + Math.round(r.right));
    if (!vis(el)) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText && el.scrollWidth > el.clientWidth + 2 && (cs.overflowX === 'hidden' || cs.overflowX === 'clip') && cs.textOverflow !== 'ellipsis' && cs.webkitLineClamp === 'none') out.clipped.push(desc(el) + ' sw=' + el.scrollWidth + ' cw=' + el.clientWidth);
    if (hasText && parseFloat(cs.fontSize) < 11) out.tinyText++;
    const interactive = el.tagName === 'BUTTON' || (el.tagName === 'A' && el.getAttribute('href')) || el.getAttribute('role') === 'button';
    if (interactive && iw <= 420 && (r.height < 36 || r.width < 36)) out.smallTaps.push(desc(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if (interactive && !(el.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title') && !el.closest('[aria-label]')) out.iconOnlyButtons++;
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') && el.type !== 'hidden' && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.id) out.unlabeledInputs++;
  }
  out.offenders = [...new Set(out.offenders)].slice(0, 6); out.clipped = [...new Set(out.clipped)].slice(0, 8); out.smallTaps = [...new Set(out.smallTaps)].slice(0, 12);
  out.gateway = /Bad gateway|Error code 5\\d\\d|Application error|Wake up/.test((document.body.innerText || '').slice(0, 800));
  out.rawKeys = [...document.body.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^[a-zA-Z]+\\.[a-zA-Z0-9_]+(\\.[a-zA-Z0-9_]+)+$/.test((e.textContent || '').trim())).map((e) => e.textContent.trim()).slice(0, 5);
  out.emptyCopy = /No data|Nothing here|No results|Get started|Create your first|nothing to show/i.test(document.body.innerText || '');
  out.textLen = (document.body.innerText || '').length;
  out.buttons = [...document.querySelectorAll('button, a[href], [role=button]')].filter(vis).filter((b) => b.getBoundingClientRect().top < ih).map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim().replace(/\\s+/g,' ').slice(0, 40)).filter(Boolean).slice(0, 40);
  return out;
})()`;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
const results = [];
const routes = args.routes ? ROUTES[SET].filter((r) => args.routes.split(",").includes(r[0])) : ROUTES[SET];

for (const theme of THEMES) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT[w] || 900 }, colorScheme: theme, isMobile: w < 500, hasTouch: w < 500, userAgent: w < 500 ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" : undefined });
    for (const [id, p, opts] of routes) {
      const path = typeof p === "function" ? p() : p;
      const page = await ctx.newPage();
      const errors = [], apiErr = [];
      page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
      page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
      page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/")) apiErr.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, "").slice(0, 120)}`); });
      const storage = { "theme-mode-public": theme, "theme-mode-inapp": theme, dynopay_lang_onboarded: "1", cookie_consent: "accepted" };
      if (opts.company) { storage.token = OWNER; storage.last_company_id = String(opts.company); storage.auth_persistent = "1"; }
      if (opts.admin) storage.admin_token = ADMIN;
      if (opts.sd && SD) { storage.sd_token = SD[opts.sd].token; storage.sd_user = JSON.stringify({ email: SD[opts.sd].email, customer_id: Number(SD[opts.sd].cid) }); }
      await page.addInitScript((s) => { try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem("mfa_interstitial_seen", "1"); } catch {} }, storage);
      const label = `${theme} ${w} ${id}`;
      const file = `${SET}/${id}__${w}__${theme}`;
      try {
        if (BASE.startsWith("http://localhost")) await page.route(`${BASE}/api/**`, (r) => r.continue({ url: r.request().url().replace(BASE, API) }));
        if (opts.checkout) {
          await page.route("**/api/pay/addPayment", (r) => r.fulfill({ json: addPayment }));
          await page.route("**/api/pay/verifyCryptoPayment*", (r) => r.fulfill({ json: CHECKOUT_STATES[opts.checkout] }));
          await page.route("**/api/pay/stream*", (r) => r.abort());
        }
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(Number(args.settle || 1200));
        if (opts.checkout) {
          const cont = page.locator('[data-testid="clean-checkout-continue-btn"]');
          if (await cont.count()) { await cont.first().click({ force: true }); }
          await page.waitForTimeout(opts.checkout === "confirmed" || opts.checkout === "overpaid" ? 9000 : 3500);
        }
        const dismiss = page.locator('[data-testid^="page-tip-dismiss-"]');
        if (await dismiss.count()) await dismiss.first().click({ force: true }).catch(() => {});
        const a = await page.evaluate(AUDIT);
        const finalUrl = page.url().replace(BASE, "");
        await page.screenshot({ path: `${OUT}/${file}__fold.jpg`, fullPage: false, type: "jpeg", quality: 60 });
        if (a.pageHeight > (HEIGHT[w] || 900) + 40) await page.screenshot({ path: `${OUT}/${file}__full.jpg`, fullPage: true, type: "jpeg", quality: 50 });
        results.push({ id, path, theme, w, finalUrl, ...a, errors: [...new Set(errors)].slice(0, 6), apiErr: [...new Set(apiErr)].slice(0, 8) });
        const flags = [a.gateway && "GATEWAY", a.overflow && "OVERFLOW " + a.offenders.join(" | "), a.clipped.length && "CLIPPED " + a.clipped.slice(0, 3).join(" | "), a.rawKeys.length && "RAWKEYS " + a.rawKeys.join(","), errors.length && "JSERR " + [...new Set(errors)].slice(0, 2).join(" | "), apiErr.length && "API " + [...new Set(apiErr)].slice(0, 3).join(" | "), a.smallTaps.length && `smallTaps=${a.smallTaps.length}`, a.iconOnlyButtons && `iconOnly=${a.iconOnlyButtons}`, a.unlabeledInputs && `unlabeled=${a.unlabeledInputs}`, a.tinyText && `tiny=${a.tinyText}`].filter(Boolean);
        console.log(`${flags.length ? "!! " : "ok "}${label}${finalUrl !== path ? " →" + finalUrl : ""} h1="${a.h1.slice(0, 40)}" ph=${a.pageHeight} ${flags.join(" ; ")}`);
      } catch (e) {
        console.log(`XX ${label} ${String(e.message).slice(0, 120)}`);
        results.push({ id, path, theme, w, error: String(e.message).slice(0, 200) });
      }
      await page.close();
      await new Promise((r) => setTimeout(r, Number(args.delay || 2500)));
    }
    await ctx.close();
  }
}
fs.writeFileSync(`${OUT}/results_${SET}.json`, JSON.stringify(results, null, 1));
await browser.close();
