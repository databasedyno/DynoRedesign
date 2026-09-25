// Theme Memory regression — surfaces × scenarios × desktop/mobile.
//   node scripts/qa/theme_memory_regression.mjs --base=<url> [--email=.. --password=..] [--out=test_reports/theme_memory_regression]
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "1"]; }));
const BASE = (args.base || "").replace(/\/+$/, "");
const OUT = args.out || "test_reports/theme_memory_regression";
const EMAIL = args.email || "onarrival21@gmail.com";
const PASSWORD = args.password || "Katiekendra123@";
const exe = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
if (!BASE) { console.error("--base required"); process.exit(2); }

const ORDER_REF = args.orderRef || "b4b93fc0357f559af54b7095";
const SURFACES = {
  marketing: ["/", "/fees", "/for/freelancers", "/products", "/blog", "/about", "/privacy-policy"],
  checkout: ["/pay?d=jgQQzL", "/pay/demo", "/devhub/checkout", `/order/${ORDER_REF}`],
  auth: ["/auth/login", "/signup", "/reset-password"],
  dashboard: ["/dashboard", "/transactions", "/settings", "/notifications", "/help-support"],
  safedeal: ["/safedeal", "/safedeal/signin", "/safedeal/deals", "/safedeal/deals/new", "/safedeal/wallet", "/safedeal/help"],
};
const PUBLIC = [...SURFACES.marketing, ...SURFACES.checkout, ...SURFACES.auth];
const CART = JSON.stringify({ devhub: { items: [{ product_id: 9, variant_id: null, quantity: 1, added_at: 0 }] } });

const rows = [];
const add = (scenario, surface, width, expected, info, note = "") => {
  const pass = info.final === expected && (info.first == null || info.first === expected) && (info.ssr == null || info.ssr === expected) && (info.status || 200) < 400;
  rows.push({ scenario, surface, width, expected, first: info.first, final: info.final, ssr: info.ssr, status: info.status, pass, note });
  console.log(`${pass ? "PASS" : "FAIL"} [${scenario}] ${width} ${surface} exp=${expected} first=${info.first} final=${info.final} ssr=${info.ssr} ${note}`);
};
const check = (scenario, surface, width, pass, note) => {
  rows.push({ scenario, surface, width, pass, note });
  console.log(`${pass ? "PASS" : "FAIL"} [${scenario}] ${width} ${surface} ${note}`);
};

async function apiLogin() {
  const post = async (p, body) => {
    let last = "";
    for (let i = 0; i < 20; i++) {
      const res = await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": UA }, body: JSON.stringify(body) }).catch((e) => ({ status: 0, text: async () => String(e) }));
      const txt = await res.text();
      last = `HTTP ${res.status}: ${txt.slice(0, 200).replace(/\s+/g, " ")}`;
      if (res.status && res.status < 500) { try { return JSON.parse(txt); } catch {} }
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error("API unavailable: " + p + " — last=" + last);
  };
  const j = await post("/api/user/login", { email: EMAIL, password: PASSWORD });
  if (j?.data?.accessToken) return j.data.accessToken;
  if (j?.data?.requires_2fa) {
    const code = execSync("node /app/backend/scripts/print_totp.cjs 1").toString().trim().split("\n").pop();
    const v = await post("/api/user/2fa/validate", { challenge_token: j.data.challenge_token, token: code });
    if (v?.data?.accessToken) return v.data.accessToken;
    throw new Error("2fa validate failed: " + JSON.stringify(v).slice(0, 200));
  }
  throw new Error("login failed: " + JSON.stringify(j).slice(0, 200));
}

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const TOKEN = await apiLogin();
console.log("logged in, token length", TOKEN.length);

async function newCtx({ scheme = "light", mobile = false, ls = {}, cookies = {}, authed = false } = {}) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    colorScheme: scheme, isMobile: mobile, hasTouch: mobile,
  });
  const seed = { ls: { dynopay_lang_onboarded: "1", cookie_consent: "accepted", dynopay_cart_v1: CART, ...ls }, cookies };
  if (authed) Object.assign(seed.ls, { token: TOKEN, refreshToken: "", last_company_id: "1" });
  await ctx.addInitScript((s) => {
    window.__firstTheme = null;
    document.addEventListener("DOMContentLoaded", () => { window.__firstTheme = document.documentElement.dataset.theme || null; });
    try { for (const [k, v] of Object.entries(s.ls)) localStorage.setItem(k, v); sessionStorage.setItem("mfa_interstitial_seen", "1"); } catch {}
    try { for (const [k, v] of Object.entries(s.cookies)) document.cookie = `${k}=${v}; path=/`; } catch {}
  }, seed);
  return ctx;
}

async function visit(page, path, { settle = true } = {}) {
  let status = 0;
  try {
    const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 120000 });
    status = res?.status() || 0;
  } catch (e) { return { status: 0, first: null, final: null, ssr: null, err: String(e).slice(0, 80) }; }
  if (settle) await page.waitForFunction(() => document.documentElement.style.backgroundColor === "", null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => ({
    first: window.__firstTheme,
    final: document.documentElement.dataset.theme || null,
    ssr: (window.__NEXT_DATA__ && window.__NEXT_DATA__.props && window.__NEXT_DATA__.props.initialThemeMode) || null,
    hydrated: document.documentElement.style.backgroundColor === "",
    ls: localStorage.getItem("dyno-theme"),
    cookie: document.cookie,
  }));
  return { status, ...info };
}
const theme = (page) => page.evaluate(() => document.documentElement.dataset.theme || null);
const lsTheme = (page) => page.evaluate(() => localStorage.getItem("dyno-theme"));
const fixedCanvases = (page) => page.evaluate(() => [...document.querySelectorAll("canvas")].filter((c) => getComputedStyle(c).position === "fixed").length);

async function clickToggle(page, mobile) {
  const sels = mobile
    ? ['[data-testid="mobile-theme-toggle-button"]', '[data-testid="theme-toggle-drawer"]', '[data-testid="theme-toggle-button"]', '[aria-label="Toggle theme"]']
    : ['[data-testid="theme-toggle-button"]', '[data-testid="theme-toggle-header"]', '[aria-label="Toggle theme"]', '[data-testid="mobile-theme-toggle-button"]'];
  for (const s of sels) {
    const loc = page.locator(s).first();
    if (await loc.count() && await loc.isVisible().catch(() => false)) { await loc.click({ force: true }); await page.waitForTimeout(400); return s; }
  }
  // Mobile marketing header: toggle lives in the drawer.
  for (const opener of ['[data-testid="mobile-menu-button"]', '[aria-label="Open menu"]', '[aria-label="menu"]', 'button[aria-label*="enu"]']) {
    const o = page.locator(opener).first();
    if (await o.count() && await o.isVisible().catch(() => false)) {
      await o.click({ force: true }); await page.waitForTimeout(500);
      for (const s of sels) { const loc = page.locator(s).first(); if (await loc.count() && await loc.isVisible().catch(() => false)) { await loc.click({ force: true }); await page.waitForTimeout(400); return `${opener} > ${s}`; } }
    }
  }
  return null;
}
async function dashToggle(page) {
  await page.locator('[data-testid="dash2026-settings"]').first().click({ force: true, timeout: 20000 });
  await page.waitForTimeout(400);
  await page.locator('[data-testid="dash2026-toggle-theme"]').first().click({ force: true, timeout: 10000 });
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
}

// ── S1 / S2: fresh visitor follows the device on every surface ──────────────
for (const scheme of ["dark", "light"]) {
  for (const mobile of [false, true]) {
    const w = mobile ? "mobile" : "desktop";
    const ctx = await newCtx({ scheme, mobile });
    const page = await ctx.newPage();
    for (const s of PUBLIC) add(`S${scheme === "dark" ? 1 : 2}-fresh-${scheme}`, s, w, scheme, await visit(page, s));
    for (const s of SURFACES.safedeal) add(`S${scheme === "dark" ? 1 : 2}-fresh-${scheme}`, s, w, "light", await visit(page, s), "safedeal fixed light");
    const stored = await lsTheme(page);
    check(`S${scheme === "dark" ? 1 : 2}-fresh-${scheme}`, "storage", w, stored === null, `no manual choice written (dyno-theme=${stored})`);
    await ctx.close();
    const actx = await newCtx({ scheme, mobile, authed: true });
    const apage = await actx.newPage();
    for (const s of SURFACES.dashboard) add(`S${scheme === "dark" ? 1 : 2}-fresh-${scheme}`, s, w, scheme, await visit(apage, s));
    await actx.close();
  }
}

// ── S3: device preference changes live while nothing is remembered ─────────
for (const mobile of [false, true]) {
  const w = mobile ? "mobile" : "desktop";
  const ctx = await newCtx({ scheme: "dark", mobile, authed: true });
  const page = await ctx.newPage();
  for (const s of ["/", "/pay?d=jgQQzL", "/auth/login", "/dashboard"]) {
    await visit(page, s);
    await page.emulateMedia({ colorScheme: "light" }); await page.waitForTimeout(500);
    const a = await theme(page);
    await page.emulateMedia({ colorScheme: "dark" }); await page.waitForTimeout(500);
    const b = await theme(page);
    check("S3-live-device", s, w, a === "light" && b === "dark" && (await lsTheme(page)) === null, `dark→light=${a}, light→dark=${b}, manual=${await lsTheme(page)}`);
  }
  await ctx.close();
}

// ── S4: toggle on marketing → checkout, auth, dashboard follow ─────────────
for (const mobile of [false, true]) {
  const w = mobile ? "mobile" : "desktop";
  const ctx = await newCtx({ scheme: "dark", mobile });
  const page = await ctx.newPage();
  await visit(page, "/");
  const used = await clickToggle(page, mobile);
  const t = await theme(page);
  check("S4-toggle-marketing", "/", w, used != null && t === "light" && (await lsTheme(page)) === "light", `toggle=${used} → ${t}, dyno-theme=${await lsTheme(page)}`);
  for (const s of ["/fees", "/pay?d=jgQQzL", "/devhub/checkout", "/auth/login"]) add("S4-toggle-marketing", s, w, "light", await visit(page, s));
  await page.evaluate((tk) => { localStorage.setItem("token", tk); localStorage.setItem("last_company_id", "1"); }, TOKEN);
  for (const s of ["/dashboard", "/transactions"]) add("S4-toggle-marketing", s, w, "light", await visit(page, s), "after login");
  await ctx.close();
}

// ── S5: toggle on checkout → marketing and auth follow ─────────────────────
for (const mobile of [false, true]) {
  const w = mobile ? "mobile" : "desktop";
  const ctx = await newCtx({ scheme: "light", mobile });
  const page = await ctx.newPage();
  await visit(page, "/pay?d=jgQQzL");
  const used = await clickToggle(page, mobile);
  const t = await theme(page);
  check("S5-toggle-checkout", "/pay?d=jgQQzL", w, used != null && t === "dark" && (await lsTheme(page)) === "dark", `toggle=${used} → ${t}`);
  for (const s of ["/", "/fees", "/auth/login", "/signup"]) add("S5-toggle-checkout", s, w, "dark", await visit(page, s));
  await ctx.close();
}

// ── S6: toggle inside dashboard → sign-out, marketing, checkout follow; toggle back respected ──
for (const mobile of [false, true]) {
  const w = mobile ? "mobile" : "desktop";
  const ctx = await newCtx({ scheme: "light", mobile, authed: true });
  const page = await ctx.newPage();
  await visit(page, "/dashboard");
  await page.waitForSelector('[data-testid="dash2026-root"]', { timeout: 60000 }).catch(() => {});
  let ok = true, note = "";
  try { await dashToggle(page); } catch (e) { ok = false; note = "dash toggle: " + String(e).slice(0, 80); }
  const t = await theme(page);
  check("S6-toggle-dashboard", "/dashboard", w, ok && t === "dark" && (await lsTheme(page)) === "dark", `${note} → ${t}, dyno-theme=${await lsTheme(page)}`);
  for (const s of ["/settings", "/notifications", "/help-support"]) add("S6-toggle-dashboard", s, w, "dark", await visit(page, s));
  await page.evaluate(() => { localStorage.removeItem("token"); localStorage.removeItem("refreshToken"); });
  for (const s of ["/auth/login", "/", "/pay?d=jgQQzL"]) add("S6-toggle-dashboard", s, w, "dark", await visit(page, s), "signed out");
  await page.evaluate((tk) => localStorage.setItem("token", tk), TOKEN);
  await visit(page, "/dashboard");
  await page.waitForSelector('[data-testid="dash2026-root"]', { timeout: 60000 }).catch(() => {});
  try { await dashToggle(page); } catch (e) { note = "dash toggle back: " + String(e).slice(0, 80); }
  const back = await theme(page);
  check("S6-toggle-dashboard", "/dashboard toggle back", w, back === "light" && (await lsTheme(page)) === "light", `→ ${back}`);
  for (const s of ["/", "/pay?d=jgQQzL", "/auth/login"]) add("S6-toggle-dashboard", s, w, "light", await visit(page, s), "after toggle back");
  await ctx.close();
}

// ── S7: reload / new tab / back-forward → unchanged, no first-paint flash ───
for (const mobile of [false, true]) {
  const w = mobile ? "mobile" : "desktop";
  const ctx = await newCtx({ scheme: "light", mobile, authed: true });
  const page = await ctx.newPage();
  await visit(page, "/");
  await clickToggle(page, mobile); // light device → manual dark
  for (const s of ["/", "/pay?d=jgQQzL", "/auth/login", "/dashboard"]) {
    await visit(page, s);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.style.backgroundColor === "", null, { timeout: 60000 }).catch(() => {});
    const info = await page.evaluate(() => ({ first: window.__firstTheme, final: document.documentElement.dataset.theme, ssr: window.__NEXT_DATA__?.props?.initialThemeMode || null, status: 200 }));
    add("S7-reload", s, w, "dark", info, "hard reload");
  }
  const tab = await ctx.newPage();
  add("S7-new-tab", "/fees", w, "dark", await visit(tab, "/fees"));
  await tab.close();
  await visit(page, "/"); await visit(page, "/fees"); await visit(page, "/about");
  await page.goBack({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(600);
  const b1 = await theme(page);
  await page.goBack({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(600);
  const b2 = await theme(page);
  await page.goForward({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(600);
  const f1 = await theme(page);
  check("S7-back-forward", "/ ↔ /fees ↔ /about", w, b1 === "dark" && b2 === "dark" && f1 === "dark", `back=${b1},${b2} forward=${f1}`);
  await ctx.close();
}

// ── S8: returning visitor with legacy per-context keys ─────────────────────
for (const mobile of [false, true]) {
  const w = mobile ? "mobile" : "desktop";
  // dashboard choice (dark) + conflicting public choice (light) on a light device → dark everywhere
  let ctx = await newCtx({ scheme: "light", mobile, authed: true, ls: { "theme-mode-inapp": "dark", "theme-mode-public": "light" }, cookies: { "theme-mode-inapp": "dark", "theme-mode-public-v2": "light" } });
  let page = await ctx.newPage();
  for (const s of ["/dashboard", "/", "/pay?d=jgQQzL", "/auth/login"]) add("S8-legacy-dashboard-wins", s, w, "dark", await visit(page, s));
  const mig = await page.evaluate(() => ({ dyno: localStorage.getItem("dyno-theme"), inapp: localStorage.getItem("theme-mode-inapp"), pub: localStorage.getItem("theme-mode-public"), ck: document.cookie }));
  check("S8-legacy-dashboard-wins", "migration", w, mig.dyno === "dark" && mig.inapp === null && mig.pub === null && /dyno-theme=dark/.test(mig.ck) && !/theme-mode-inapp=/.test(mig.ck), JSON.stringify(mig).slice(0, 160));
  await ctx.close();
  // public-only legacy choice (dark) on a light device → dark everywhere
  ctx = await newCtx({ scheme: "light", mobile, ls: { "theme-mode-public": "dark" } });
  page = await ctx.newPage();
  for (const s of ["/", "/auth/login", "/pay?d=jgQQzL"]) add("S8-legacy-public", s, w, "dark", await visit(page, s));
  await ctx.close();
}

// ── S9: SafeDeal identical regardless of remembered choice; never alters it ─
for (const mobile of [false, true]) {
  const w = mobile ? "mobile" : "desktop";
  const sample = async (page) => page.evaluate(() => {
    const h = document.querySelector("h1, h2");
    const root = document.querySelector("main") || document.body;
    const cs = (el) => el ? getComputedStyle(el) : null;
    return { html: document.documentElement.dataset.theme, bodyBg: cs(document.body)?.backgroundColor, rootBg: cs(root)?.backgroundColor, hColor: cs(h)?.color, scheme: document.documentElement.style.colorScheme };
  });
  const snaps = {};
  for (const choice of ["dark", "light"]) {
    const ctx = await newCtx({ scheme: choice === "dark" ? "light" : "dark", mobile, ls: { "dyno-theme": choice } });
    const page = await ctx.newPage();
    snaps[choice] = {};
    for (const s of SURFACES.safedeal) { add(`S9-safedeal-choice-${choice}`, s, w, "light", await visit(page, s)); snaps[choice][s] = await sample(page); }
    check(`S9-safedeal-choice-${choice}`, "choice untouched", w, (await lsTheme(page)) === choice, `dyno-theme=${await lsTheme(page)}`);
    add(`S9-safedeal-choice-${choice}`, "/fees", w, choice, await visit(page, "/fees"), "leaving safedeal");
    await ctx.close();
  }
  for (const s of SURFACES.safedeal) {
    const a = snaps.dark[s], b = snaps.light[s];
    check("S9-safedeal-identical", s, w, JSON.stringify(a) === JSON.stringify(b), `dark-choice=${JSON.stringify(a)} light-choice=${JSON.stringify(b)}`);
  }
}

// ── S10: toggling has no side-effects (confetti, brand switch, request loops) ─
{
  const ctx = await newCtx({ scheme: "light", authed: true });
  const page = await ctx.newPage();
  await visit(page, "/dashboard");
  await page.waitForSelector('[data-testid="dash2026-root"]', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const before = await page.evaluate(() => localStorage.getItem("last_company_id"));
  let reqs = 0; const onReq = (r) => { if (r.url().includes("/api/")) reqs++; };
  page.on("request", onReq);
  await dashToggle(page); await page.waitForTimeout(3000);
  page.off("request", onReq);
  const after = await page.evaluate(() => localStorage.getItem("last_company_id"));
  const canv = await fixedCanvases(page);
  check("S10-no-side-effects", "/dashboard", "desktop", canv === 0 && before === after && reqs <= 3, `fixedCanvas=${canv} company ${before}→${after} apiRequestsIn3s=${reqs}`);
  await visit(page, "/");
  reqs = 0; page.on("request", onReq);
  await clickToggle(page, false); await page.waitForTimeout(3000);
  page.off("request", onReq);
  check("S10-no-side-effects", "/", "desktop", (await fixedCanvases(page)) === 0 && reqs <= 3, `fixedCanvas=${await fixedCanvases(page)} apiRequestsIn3s=${reqs}`);
  await ctx.close();
}

await browser.close();

const total = rows.length, passed = rows.filter((r) => r.pass).length;
const md = [
  `# Theme Memory regression — ${new Date().toISOString()}`, ``,
  `Base: ${BASE}  ·  **${passed}/${total} passed**`, ``,
  `Boundary note (expected, not a defect): \`dynopay.com\`, \`checkout.dynopay.com\` and \`safedeal.sh\` are separate origins — localStorage/cookies do not cross, so each remembers independently. SafeDeal is a fixed-brand surface (always light, never persists).`, ``,
  `| Scenario | Surface | Width | Expected | First paint | Final | SSR | Result | Note |`, `|---|---|---|---|---|---|---|---|---|`,
  ...rows.map((r) => `| ${r.scenario} | ${r.surface} | ${r.width} | ${r.expected ?? ""} | ${r.first ?? ""} | ${r.final ?? ""} | ${r.ssr ?? ""} | ${r.pass ? "PASS" : "**FAIL**"} | ${(r.note || "").replace(/\|/g, "/")} |`),
].join("\n");
fs.writeFileSync(`${OUT}.md`, md);
fs.writeFileSync(`${OUT}.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), passed, total, rows }, null, 2));
console.log(`\nDONE ${passed}/${total} passed → ${OUT}.md`);
process.exit(passed === total ? 0 : 1);
