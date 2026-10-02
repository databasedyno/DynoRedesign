// Mobile/PWA regression — install prompt (iOS hint + Android native prompt), safe-area bars,
// 44px touch targets, manifests, theme-color. Both brands.
//   node scripts/qa/mobile_pwa_check.mjs --base=<url> [--email=onarrival21@gmail.com] [--out=/app/tmp/mobile_pwa]
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "1"]; }));
const BASE = (args.base || "").replace(/\/+$/, "");
const OUT = args.out || "/app/tmp/mobile_pwa";
const EMAIL = args.email || "onarrival21@gmail.com";
const PASSWORD = args.password || "Katiekendra123@";
const exe = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell";
if (!BASE) { console.error("--base required"); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const AND_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

const rows = [];
const check = (name, pass, note = "") => { rows.push({ name, pass, note }); console.log(`${pass ? "PASS" : "FAIL"} ${name}${note ? " — " + note : ""}`); };

async function post(p, body) {
  let last = "";
  for (let i = 0; i < 12; i++) {
    const res = await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": IOS_UA }, body: JSON.stringify(body) }).catch((e) => ({ status: 0, text: async () => String(e) }));
    const txt = await res.text(); last = `HTTP ${res.status}: ${txt.slice(0, 160)}`;
    if (res.status && res.status < 500) { try { return JSON.parse(txt); } catch {} }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("API unavailable: " + p + " — " + last);
}
async function dynoLogin() {
  const j = await post("/api/user/login", { email: EMAIL, password: PASSWORD });
  if (j?.data?.accessToken) return j.data.accessToken;
  if (j?.data?.requires_2fa) {
    const code = execSync("node /app/backend/scripts/print_totp.cjs 1").toString().trim().split("\n").pop();
    const v = await post("/api/user/2fa/validate", { challenge_token: j.data.challenge_token, token: code });
    if (v?.data?.accessToken) return v.data.accessToken;
  }
  throw new Error("dynopay login failed: " + JSON.stringify(j).slice(0, 200));
}
async function sdLogin() {
  const email = `sd-pwa-check-${Date.now()}@example.com`;
  const s = await post("/api/safedeal/auth/send-code", { email });
  const v = await post("/api/safedeal/auth/verify-code", { email, code: s?.data?.preview_code });
  if (!v?.data?.token) throw new Error("sd login failed: " + JSON.stringify(v).slice(0, 200));
  return { token: v.data.token, user: v.data.user, email };
}

// ── manifests / head
for (const [label, path, expect] of [["dynopay manifest", "/site.webmanifest", (m) => m.scope === "/" && m.start_url.startsWith("/dashboard") && m.icons.some((i) => i.purpose === "maskable") && m.shortcuts?.length >= 3],
  ["safedeal manifest (preview host)", "/safedeal/manifest.webmanifest", (m) => m.scope === "/safedeal/" && m.start_url.startsWith("/safedeal/deals") && m.icons.some((i) => i.purpose === "maskable") && m.shortcuts?.length >= 3]]) {
  try { const r = await fetch(BASE + path, { headers: { "user-agent": IOS_UA } }); const m = await r.json(); check(label, r.ok && expect(m), `${r.status} scope=${m.scope} start=${m.start_url}`); } catch (e) { check(label, false, String(e.message)); }
}
for (const [label, path, color, title] of [["theme-color+title /auth/login", "/auth/login", "#FFFFFF", "Dynopay"], ["theme-color+title /safedeal", "/safedeal", "#FFC61A", "SafeDeal"], ["theme-color /pay", "/pay/demo", "#121214", "Dynopay"]]) {
  const html = await (await fetch(BASE + path, { headers: { "user-agent": IOS_UA } })).text();
  const tc = [...html.matchAll(/<meta name="theme-color" content="([^"]+)"/g)].map((m) => m[1]);
  const at = html.match(/<meta name="apple-mobile-web-app-title" content="([^"]+)"/)?.[1];
  check(label, tc.length === 1 && tc[0] === color && at === title, `theme-color=${tc.join(",")} title=${at}`);
}
{ const r = await fetch(BASE + "/safedeal/favicon-maskable-512.png"); check("safedeal maskable icon 200", r.ok, String(r.status)); }

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
let dyno = null, sd = null;
try { dyno = await dynoLogin(); console.log("dynopay login ok"); } catch (e) { console.log(e.message); }
try { sd = await sdLogin(); console.log("safedeal login ok", sd.email); } catch (e) { console.log(e.message); }

async function ctx({ ua, visits = 2, width = 390, height = 844 }) {
  const c = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ua });
  await c.addInitScript((s) => {
    try {
      localStorage.setItem("dynopay_lang_onboarded", "1"); localStorage.setItem("cookie_consent", "accepted"); sessionStorage.setItem("mfa_interstitial_seen", "1");
      if (s.visits != null) { localStorage.setItem("dp_pwa:visits", String(s.visits)); localStorage.setItem("sd_pwa:visits", String(s.visits)); }
      if (s.dyno) { localStorage.setItem("token", s.dyno); localStorage.setItem("last_company_id", "1"); }
      if (s.sd) { localStorage.setItem("sd_token", s.sd.token); localStorage.setItem("sd_user", JSON.stringify(s.sd.user)); }
    } catch {}
  }, { visits, dyno, sd });
  return c;
}
async function open(page, path) {
  for (let i = 0; i < 3; i++) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 300));
    if (!/Bad gateway|Backend starting|Error code 5\d\d/.test(txt)) return;
    await page.waitForTimeout(5000);
  }
}

// ── iOS: install hint on dashboard + safedeal, dismiss persists
{
  const c = await ctx({ ua: IOS_UA, visits: 2 });
  const page = await c.newPage();
  if (dyno) {
    await open(page, "/dashboard");
    const banner = page.locator('[data-testid="pwa-install-banner"]');
    const vis = await banner.isVisible().catch(() => false);
    check("iOS: dynopay install hint visible on /dashboard (2nd visit)", vis, vis ? `platform=${await banner.getAttribute("data-platform")} body="${(await page.locator('[data-testid="pwa-install-body"]').innerText()).slice(0, 60)}"` : "not visible");
    if (vis) {
      check("iOS: no Install button (Share hint instead)", (await page.locator('[data-testid="pwa-install-btn"]').count()) === 0);
      await page.screenshot({ path: `${OUT}/ios_dashboard_install.png` });
      await page.locator('[data-testid="pwa-install-dismiss"]').tap();
      await page.waitForTimeout(400);
      check("iOS: dismiss hides banner", !(await banner.isVisible().catch(() => false)));
      await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(2500);
      check("iOS: stays hidden after reload (30-day snooze)", (await banner.count()) === 0);
    }
    // touch hit-area pseudo on a MUI button + no double top inset
    await open(page, "/transactions");
    const hit = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="transactions-range-7d"]');
      if (!el) return null;
      const cs = getComputedStyle(el, "::after");
      const r = el.getBoundingClientRect();
      return { content: cs.content, pos: cs.position, h: Math.round(r.height), coarse: matchMedia("(pointer: coarse)").matches };
    });
    check("touch: MUI PillButton gets ::after hit-area (pointer:coarse)", !!hit && hit.coarse && hit.content === '""' && hit.pos === "absolute", JSON.stringify(hit));
    const shellPt = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="app-shell"]')).paddingTop);
    check("shell: no duplicate status-bar padding on app-shell", shellPt === "0px", `pt=${shellPt}`);
  }
  if (sd) {
    await open(page, "/safedeal/deals");
    // Wait for the SafeDeal shell to render before measuring (avoids flaky null/0 reads).
    await page.locator('[data-testid="sd-nav-deals"]').waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
    const banner = page.locator('[data-testid="pwa-install-banner"][data-brand="safedeal"]');
    const vis = await banner.isVisible().catch(() => false);
    check("iOS: safedeal install hint visible on /safedeal/deals", vis, vis ? `body="${(await page.locator('[data-testid="pwa-install-body"]').innerText()).slice(0, 70)}"` : "not visible");
    if (vis) await page.screenshot({ path: `${OUT}/ios_safedeal_install.png` });
    const nav = await page.evaluate(() => ["sd-nav-deals", "sd-nav-wallet", "sd-nav-signout"].map((id) => { const el = document.querySelector(`[data-testid="${id}"]`); const r = el?.getBoundingClientRect(); return { id, h: r ? Math.round(r.height) : null }; }));
    check("safedeal: header nav tap targets ≥36px (links 44)", nav.every((n) => n.h && (n.id === "sd-nav-signout" ? n.h >= 36 : n.h >= 44)), JSON.stringify(nav));
    const tabH = await page.evaluate(() => Math.round(document.querySelector('[data-testid="sd-home-tab-overview"]')?.getBoundingClientRect().height || 0));
    check("safedeal: home tabs ≥40px on phones", tabH >= 40, `h=${tabH}`);
    if (vis) { await page.locator('[data-testid="pwa-install-dismiss"]').tap(); await page.waitForTimeout(400); check("safedeal: dismiss hides banner", !(await banner.isVisible().catch(() => false))); }
  }
  // public page: language bar safe-area padding + chip height
  const c2 = await ctx({ ua: IOS_UA, visits: 2 }); const p2 = await c2.newPage();
  await p2.addInitScript(() => { try { localStorage.removeItem("token"); localStorage.removeItem("lang_onboard"); localStorage.removeItem("lang_manual"); } catch {} });
  await open(p2, "/fees");
  const lb = await p2.evaluate(() => { const el = document.querySelector('[data-testid="language-onboarding-bar"]'); if (!el) return null; const chip = el.querySelector('[data-testid="lang-onboard-en"]'); const close = el.querySelector('[data-testid="language-onboarding-close"]'); return { pb: getComputedStyle(el).paddingBottom, chipH: Math.round(chip.getBoundingClientRect().height), closeH: Math.round(close.getBoundingClientRect().height), v: getComputedStyle(document.documentElement).getPropertyValue("--dp-lang-bar").trim() }; });
  check("public: language bar chips ≥40px + close 40px + safe-area pb", !!lb && lb.chipH >= 40 && lb.closeH >= 40 && parseFloat(lb.pb) >= 10, JSON.stringify(lb));
  await p2.screenshot({ path: `${OUT}/ios_fees_langbar.png` });
  await c2.close();
  await c.close();
}

// ── Android: no banner without beforeinstallprompt; synthetic event → Install button → prompt() called
if (dyno) {
  const c = await ctx({ ua: AND_UA, visits: 2, width: 360, height: 780 });
  const page = await c.newPage();
  await open(page, "/dashboard");
  check("android: no banner before beforeinstallprompt fires", (await page.locator('[data-testid="pwa-install-banner"]').count()) === 0);
  await page.evaluate(() => {
    const ev = new Event("beforeinstallprompt", { cancelable: true });
    window.__promptCalled = 0;
    ev.prompt = async () => { window.__promptCalled++; };
    ev.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(ev);
  });
  const btn = page.locator('[data-testid="pwa-install-btn"]');
  const shown = await btn.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
  check("android: Install button appears after beforeinstallprompt", shown);
  if (shown) {
    await page.screenshot({ path: `${OUT}/android_dashboard_install.png` });
    await btn.tap();
    await page.waitForTimeout(500);
    const called = await page.evaluate(() => window.__promptCalled);
    check("android: Install tap calls native prompt() and hides banner", called === 1 && (await page.locator('[data-testid="pwa-install-banner"]').count()) === 0, `prompt calls=${called}`);
  }
  // first visit → no banner even with prompt
  const c1 = await ctx({ ua: AND_UA, visits: 0, width: 360, height: 780 }); const p1 = await c1.newPage();
  await open(p1, "/dashboard");
  await p1.evaluate(() => { const ev = new Event("beforeinstallprompt", { cancelable: true }); ev.prompt = async () => {}; ev.userChoice = Promise.resolve({ outcome: "dismissed" }); window.dispatchEvent(ev); });
  await p1.waitForTimeout(500);
  check("android: no banner on the very first visit", (await p1.locator('[data-testid="pwa-install-banner"]').count()) === 0);
  await c1.close();
  await c.close();
}

// ── standalone (installed) mode → never show
if (dyno) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IOS_UA });
  await c.addInitScript((s) => { try { localStorage.setItem("token", s.dyno); localStorage.setItem("last_company_id", "1"); localStorage.setItem("dp_pwa:visits", "5"); sessionStorage.setItem("mfa_interstitial_seen", "1"); Object.defineProperty(navigator, "standalone", { get: () => true }); } catch {} }, { dyno });
  const page = await c.newPage();
  await open(page, "/dashboard");
  check("standalone: banner never shown inside installed app", (await page.locator('[data-testid="pwa-install-banner"]').count()) === 0);
  await c.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(rows, null, 1));
const fails = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - fails}/${rows.length} passed`);
if (sd) console.log("NOTE: SafeDeal throwaway identity", sd.email, "— purge with: cd /app/backend && node scripts/purge_test_data.js --apply");
process.exit(fails ? 1 : 0);
