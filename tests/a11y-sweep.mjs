/**
 * Part F — WCAG AA sweep (axe-core 4.13 via Playwright + system Chrome).
 *   node tests/a11y-sweep.mjs [--auth] [--out plan/audit/a11y]
 * Checks: color-contrast (AA), focusable/keyboard rules, names/labels, landmarks.
 * Writes a JSON + markdown summary per page. Read-only against the live preview.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = (process.env.BASE_URL || fs.readFileSync("/app/.env", "utf8").match(/NEXT_PUBLIC_SERVER_URL=(\S+)/)?.[1] || "").replace(/\/$/, "");
const OUT = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "/app/plan/audit/a11y";
const AUTH = process.argv.includes("--auth");
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const AXE = fs.readFileSync("/app/node_modules/axe-core/axe.min.js", "utf8");

const PUBLIC = [
  ["home", "/"], ["about", "/about"], ["fees", "/fees"], ["docs", "/documentation"],
  ["creator", "/devhub"], ["shop", "/devhub/shop"], ["product", "/devhub/p/talk-to-a-developer"],
  ["checkout", "/pay?d=rNtQRX"], ["receipt", "/receipt/oN7U2knyNnaQ3NBrfNXL3F"], ["order", "/order/ab28e53da29ba70b6266b0e0"],
  ["login", "/auth/login"], ["signup", "/auth/signup"], ["unsubscribe", "/unsubscribe?token=bad"],
];
const DASH = [
  ["dashboard", "/dashboard"], ["transactions", "/transactions"], ["payouts", "/payouts"], ["wallet", "/wallet"],
  ["paylinks", "/pay-links"], ["create-pay-link", "/create-pay-link"], ["storefront", "/storefront"], ["products-new", "/pay-links/products/new"],
  ["invoices", "/invoices"], ["customers", "/customers"], ["settings", "/settings"], ["settings-security", "/settings?section=security"],
  ["notifications", "/notifications"], ["developer-keys", "/developer-keys"], ["kyc", "/kyc"], ["referrals", "/referrals"],
];
const RULES = ["color-contrast", "link-name", "button-name", "label", "image-alt", "aria-allowed-attr", "aria-required-attr", "aria-valid-attr-value",
  "focus-order-semantics", "tabindex", "scrollable-region-focusable", "nested-interactive", "aria-hidden-focus", "html-has-lang", "landmark-one-main",
  "page-has-heading-one", "region", "select-name", "input-button-name", "aria-command-name", "aria-input-field-name", "aria-toggle-field-name", "duplicate-id-active", "heading-order", "link-in-text-block"];

const login = async (page) => {
  const creds = fs.readFileSync("/app/memory/test_credentials.md", "utf8");
  const email = creds.match(/([\w.+-]+@gmail\.com)/)?.[1];
  const pass = creds.match(/Katiekendra[^\s`|]*/)?.[0];
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.setItem("mfa_interstitial_seen", "1"));
  await page.fill('[data-testid="login-email-input"]', email);
  await page.getByRole("button", { name: "Continue", exact: true }).click({ force: true });
  await page.waitForSelector('[data-testid="password-input"]', { timeout: 20000 });
  await page.fill('[data-testid="password-input"]', pass);
  await page.click('[data-testid="signin-submit-btn"]', { force: true });
  await page.waitForURL("**/dashboard**", { timeout: 60000 });
  await page.evaluate(() => sessionStorage.setItem("mfa_interstitial_seen", "1"));
};

const focusSweep = async (page) => {
  // Tab through the first 40 focusable elements and flag any with no visible focus indication.
  return page.evaluate(() => {
    const bad = [];
    const els = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter((e) => !e.disabled && e.offsetParent !== null).slice(0, 60);
    for (const el of els) {
      el.focus({ preventScroll: true });
      if (document.activeElement !== el) continue;
      const cs = getComputedStyle(el);
      const outlineOk = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      const shadowOk = cs.boxShadow && cs.boxShadow !== "none";
      const fv = el.matches(":focus-visible");
      if (fv && !outlineOk && !shadowOk) {
        bad.push({ tag: el.tagName.toLowerCase(), testid: el.getAttribute("data-testid"), text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40), cls: (el.className || "").toString().slice(0, 60) });
      }
    }
    if (document.activeElement) document.activeElement.blur();
    return bad;
  });
};

const run = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  if (AUTH) await login(page);
  const list = (AUTH ? DASH : PUBLIC).filter(([n]) => !ONLY || ONLY.includes(n));
  const summary = [];
  for (const [name, route] of list) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 90000 });
      await page.waitForTimeout(3500);
      await page.addScriptTag({ content: AXE });
      const res = await page.evaluate(async (rules) => {
        // eslint-disable-next-line no-undef
        return axe.run(document, { runOnly: { type: "rule", values: rules }, resultTypes: ["violations"] });
      }, RULES);
      const focus = await focusSweep(page);
      const viol = res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 12).map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 160), msg: n.failureSummary?.split("\n").slice(1, 3).join(" ").trim() })), count: v.nodes.length }));
      fs.writeFileSync(path.join(OUT, `${AUTH ? "dash-" : ""}${name}.json`), JSON.stringify({ route, violations: viol, focus }, null, 2));
      const c = viol.find((v) => v.id === "color-contrast")?.count || 0;
      summary.push({ name, route, violations: viol.length, contrast: c, focus: focus.length, ids: viol.map((v) => `${v.id}(${v.count})`).join(" ") });
      console.log(`${name.padEnd(18)} rules:${String(viol.length).padStart(2)} contrast:${String(c).padStart(3)} focus:${String(focus.length).padStart(2)}  ${viol.map((v) => `${v.id}(${v.count})`).join(" ")}`);
    } catch (e) {
      console.log(`${name.padEnd(18)} ERR ${String(e.message).split("\n")[0].slice(0, 100)}`);
      summary.push({ name, route, error: String(e.message).slice(0, 120) });
    }
  }
  fs.writeFileSync(path.join(OUT, `${AUTH ? "dash" : "public"}-summary.json`), JSON.stringify(summary, null, 2));
  await browser.close();
};
run();
