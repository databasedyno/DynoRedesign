// Mobile (iOS/Android) audit — Dynopay + SafeDeal pages × phone viewports.
//   node scripts/qa/mobile_audit.mjs --base=<url> [--shots] [--out=/tmp/mobile_audit] [--only=dynopay|safedeal|public]
// Reports: horizontal overflow, clipped text, tap targets <40px, inputs <16px (iOS zoom), tiny text, JS errors.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "1"]; }));
const BASE = (args.base || "").replace(/\/+$/, "");
const OUT = args.out || "/tmp/mobile_audit";
const SHOTS = "shots" in args;
const EMAIL = args.email || "moxxcompany@gmail.com";
const PASSWORD = args.password || "Katiekendra123@";
const exe = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell";
if (!BASE) { console.error("--base required"); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const DEVICES = {
  iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  android: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36" },
};
const DYNO_PUBLIC = ["/", "/auth/login", "/signup", "/fees", "/pay?d=jgQQzL", "/pay/demo"];
const DYNO_AUTH = ["/dashboard", "/transactions", "/pay-links", "/create-pay-link", "/invoices", "/customers", "/wallet", "/payouts", "/settings", "/notifications", "/storefront", "/developer-keys"];
const SD_PUBLIC = ["/safedeal", "/safedeal/signin", "/safedeal/help"];
const SD_AUTH = ["/safedeal/deals", "/safedeal/deals/new", "/safedeal/wallet"];

const AUDIT = `(() => {
  const iw = window.innerWidth;
  const de = document.documentElement;
  const out = { scrollWidth: de.scrollWidth, innerWidth: iw, overflow: de.scrollWidth > iw + 1, offenders: [], clipped: [], smallTaps: [], smallInputs: [], tinyText: 0 };
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const desc = (el) => { const id = el.getAttribute('data-testid'); const t = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30); return el.tagName.toLowerCase() + (id ? '[' + id + ']' : '') + (t ? ' "' + t + '"' : ''); };
  const inline = (el) => { const p = el.parentElement; if (!p) return false; const cs = getComputedStyle(el); return cs.display === 'inline' && ['P','SPAN','LI','TD','LABEL','H1','H2','H3','H4','H5','H6'].includes(p.tagName); };
  for (const el of document.body.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (out.overflow && r.right > iw + 1 && cs.position !== 'fixed' && r.left < iw) out.offenders.push(desc(el) + ' right=' + Math.round(r.right));
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText && el.scrollWidth > el.clientWidth + 2 && (cs.overflowX === 'hidden' || cs.overflowX === 'clip') && cs.textOverflow !== 'ellipsis' && cs.webkitLineClamp === 'none') out.clipped.push(desc(el) + ' sw=' + el.scrollWidth + ' cw=' + el.clientWidth);
    if (hasText && parseFloat(cs.fontSize) < 11) out.tinyText++;
    const tag = el.tagName;
    const interactive = (tag === 'A' && el.hasAttribute('href')) || tag === 'BUTTON' || (tag === 'INPUT' && !['hidden','checkbox','radio'].includes(el.type)) || tag === 'SELECT' || tag === 'TEXTAREA' || ['button','tab','menuitem','switch','checkbox'].includes(el.getAttribute('role'));
    if (interactive && !inline(el) && r.top < window.innerHeight * 3) {
      const h = Math.round(r.height), w = Math.round(r.width);
      if (h < 36 || (w < 36 && h < 44)) out.smallTaps.push(desc(el) + ' ' + w + 'x' + h);
    }
    if ((tag === 'INPUT' && !['hidden','checkbox','radio','range','file'].includes(el.type)) || tag === 'TEXTAREA' || tag === 'SELECT') {
      const fs = parseFloat(cs.fontSize);
      if (fs < 16) out.smallInputs.push(desc(el) + ' fs=' + fs);
    }
  }
  out.offenders = [...new Set(out.offenders)].slice(0, 8);
  out.clipped = [...new Set(out.clipped)].slice(0, 8);
  out.smallTaps = [...new Set(out.smallTaps)].slice(0, 12);
  out.smallInputs = [...new Set(out.smallInputs)].slice(0, 8);
  out.gateway = /Bad gateway|Error code 5\\d\\d|Application error/.test((document.body.innerText || '').slice(0, 600));
  const fixedBottom = [...document.body.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); return (cs.position === 'fixed' || cs.position === 'sticky') && vis(e) && e.getBoundingClientRect().bottom >= window.innerHeight - 2 && e.getBoundingClientRect().height < 200; });
  out.fixedBottom = fixedBottom.map((e) => { const cs = getComputedStyle(e); return desc(e) + ' pb=' + cs.paddingBottom + ' b=' + cs.bottom; }).slice(0, 4);
  return out;
})()`;

async function post(p, body, headers = {}) {
  let last = "";
  for (let i = 0; i < 12; i++) {
    const res = await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": DEVICES.iphone.ua, ...headers }, body: JSON.stringify(body) }).catch((e) => ({ status: 0, text: async () => String(e) }));
    const txt = await res.text();
    last = `HTTP ${res.status}: ${txt.slice(0, 200)}`;
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
    throw new Error("2fa failed: " + JSON.stringify(v).slice(0, 200));
  }
  throw new Error("login failed: " + JSON.stringify(j).slice(0, 200));
}

async function sdLogin() {
  const email = `sd-mobile-audit-${Date.now()}@example.com`;
  const s = await post("/api/safedeal/auth/send-code", { email });
  const code = s?.data?.preview_code;
  if (!code) throw new Error("no preview_code: " + JSON.stringify(s).slice(0, 200));
  const v = await post("/api/safedeal/auth/verify-code", { email, code });
  if (!v?.data?.token) throw new Error("sd verify failed: " + JSON.stringify(v).slice(0, 200));
  return { token: v.data.token, user: v.data.user, email };
}

const only = args.only || "all";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
let dynoToken = null, sd = null;
if (only === "all" || only === "dynopay") { try { dynoToken = await dynoLogin(); console.log("dynopay login ok"); } catch (e) { console.log("dynopay login FAILED:", e.message); } }
if (only === "all" || only === "safedeal") { try { sd = await sdLogin(); console.log("safedeal login ok", sd.email); } catch (e) { console.log("safedeal login FAILED:", e.message); } }

const results = [];
for (const [devName, dev] of Object.entries(DEVICES)) {
  const ctx = await browser.newContext({ viewport: dev.viewport, deviceScaleFactor: dev.deviceScaleFactor, isMobile: true, hasTouch: true, userAgent: dev.ua });
  await ctx.addInitScript((s) => {
    try {
      localStorage.setItem("dynopay_lang_onboarded", "1"); localStorage.setItem("cookie_consent", "accepted");
      sessionStorage.setItem("mfa_interstitial_seen", "1");
      if (s.dynoToken) { localStorage.setItem("token", s.dynoToken); localStorage.setItem("last_company_id", "1"); }
      if (s.sd) { localStorage.setItem("sd_token", s.sd.token); localStorage.setItem("sd_user", JSON.stringify(s.sd.user)); }
    } catch {}
  }, { dynoToken, sd });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));

  let pages = [];
  if (only === "all" || only === "public") pages.push(...DYNO_PUBLIC, ...SD_PUBLIC);
  if (only === "dynopay") pages.push(...DYNO_PUBLIC);
  if (only === "safedeal") pages.push(...SD_PUBLIC);
  if (dynoToken) pages.push(...DYNO_AUTH);
  if (sd) pages.push(...SD_AUTH);

  for (const p of pages) {
    errors.length = 0;
    const label = `${devName} ${p}`;
    try {
      await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const dismiss = page.locator('[data-testid^="page-tip-dismiss-"]');
      if (await dismiss.count()) await dismiss.first().click({ force: true }).catch(() => {});
      const a = await page.evaluate(AUDIT);
      const url = page.url().replace(BASE, "");
      const bad = a.overflow || a.clipped.length || a.gateway || errors.length;
      results.push({ device: devName, page: p, landed: url, ...a, errors: [...errors] });
      console.log(`${bad ? "!! " : "ok "}${label}${url !== p ? " → " + url : ""} sw=${a.scrollWidth}/${a.innerWidth}${a.gateway ? " GATEWAY" : ""}${a.overflow ? " OVERFLOW " + a.offenders.join(" | ") : ""}${a.clipped.length ? " CLIPPED " + a.clipped.join(" | ") : ""}${a.smallTaps.length ? " SMALLTAP(" + a.smallTaps.length + ") " + a.smallTaps.slice(0, 5).join(" | ") : ""}${a.smallInputs.length ? " INPUT<16 " + a.smallInputs.slice(0, 4).join(" | ") : ""}${a.tinyText ? " TINYTEXT=" + a.tinyText : ""}${a.fixedBottom.length ? " FIXEDBOTTOM " + a.fixedBottom.join(" | ") : ""}${errors.length ? " JSERR " + errors.join(" | ") : ""}`);
      if (SHOTS) await page.screenshot({ path: `${OUT}/${devName}${p.replace(/[\/?=]/g, "_")}.png`, fullPage: true });
    } catch (e) {
      console.log(`XX ${label} ${String(e.message).slice(0, 120)}`);
      results.push({ device: devName, page: p, error: String(e.message).slice(0, 200) });
    }
  }
  await ctx.close();
}
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
await browser.close();
if (sd) console.log("NOTE: SafeDeal throwaway identity", sd.email, "— purge with: cd /app/backend && node scripts/purge_test_data.js --apply");
