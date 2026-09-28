// SafeDeal Batch 3 QA harness: mint sessions for the audit fixtures, shoot key screens at 390/1440, report overflow.
// Usage: node scripts/qa/sd_batch3_shots.mjs [--out=/tmp/sd_b3] [--only=overview,preview,new,deal]
import { chromium } from "playwright";
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const k = a.replace(/^--/, ""); const i = k.indexOf("="); return i < 0 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)]; }));
const BASE = "http://localhost:3000", API = "http://localhost:8001";
const OUT = args.out || "/tmp/sd_b3";
fs.mkdirSync(OUT, { recursive: true });
const ONLY = args.only ? args.only.split(",") : null;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const SELLER = "sd-audit-seller-1790570923@example.com", BUYER = "sd-audit-buyer-1790570923@example.com";
const EMAIL_DEAL = "bfdd8f76429be0ef77804ea6f7038917a3caaec3b35f641e", LINK_DEAL = "98d9f2ba0ccd4188c66f9c9e7e030a7c39c172a41b27e61f";

async function mint(email) {
  const h = { "Content-Type": "application/json", "User-Agent": UA };
  const r1 = await fetch(`${API}/api/safedeal/auth/send-code`, { method: "POST", headers: h, body: JSON.stringify({ email }) }).then((r) => r.json());
  const code = r1?.data?.preview_code;
  if (!code) throw new Error("no preview_code for " + email + " " + JSON.stringify(r1).slice(0, 200));
  const r2 = await fetch(`${API}/api/safedeal/auth/verify-code`, { method: "POST", headers: h, body: JSON.stringify({ email, code }) }).then((r) => r.json());
  return { token: r2.data.token, cid: r2.data.user?.customer_id, email };
}

const seller = await mint(SELLER);
const buyer = await mint(BUYER);
console.log("sessions", seller.cid, buyer.cid);

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell" });
const SHOTS = [
  ["overview", "/safedeal/deals", { sd: seller }],
  ["deals-tab", "/safedeal/deals?tab=deals", { sd: seller }],
  ["preview-email", `/safedeal/deal/${EMAIL_DEAL}`, {}],
  ["preview-link", `/safedeal/deal/${LINK_DEAL}`, {}],
  ["deal-invitee", `/safedeal/deal/${EMAIL_DEAL}`, { sd: buyer }],
  ["deal-creator", `/safedeal/deal/${EMAIL_DEAL}`, { sd: seller }],
  ["deal-link-creator", `/safedeal/deal/${LINK_DEAL}?created=1`, { sd: buyer }],
  ["new", "/safedeal/deals/new", { sd: seller }],
  ["signin-invite", `/safedeal/signin?next=${encodeURIComponent(`/deal/${EMAIL_DEAL}`)}`, {}],
];
const results = [];
for (const w of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, isMobile: w < 500, hasTouch: w < 500, userAgent: w < 500 ? UA : undefined });
  for (const [id, path, opts] of SHOTS) {
    if (ONLY && !ONLY.includes(id)) continue;
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));
    await page.addInitScript((s) => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, opts.sd ? { sd_token: opts.sd.token, sd_user: JSON.stringify({ email: opts.sd.email, customer_id: opts.sd.cid }) } : {});
    await page.route(`${BASE}/api/**`, (r) => r.continue({ url: r.request().url().replace(BASE, API) }));
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1200);
      if (id === "new" && args.newfill) {
        await page.fill('[data-testid="sd-new-title"]', "Logo pack");
        await page.fill('[data-testid="sd-new-amount"]', "120");
        await page.waitForTimeout(900);
      }
      const a = await page.evaluate(() => {
        const de = document.documentElement;
        const overflow = de.scrollWidth > de.clientWidth + 1;
        const offenders = overflow ? [...document.body.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().right > de.clientWidth + 1 && e.children.length === 0).slice(0, 5).map((e) => `${e.tagName}.${(e.className || "").toString().slice(0, 30)}:${(e.textContent || "").trim().slice(0, 40)}`) : [];
        return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, overflow, offenders, textLen: (document.body.innerText || "").length, h1: document.querySelector("h1")?.textContent?.trim().slice(0, 50) || "" };
      });
      await page.screenshot({ path: `${OUT}/${id}__${w}.jpg`, type: "jpeg", quality: 55, fullPage: true });
      results.push({ id, w, ...a, errors });
      console.log(`${a.overflow ? "!! OVERFLOW" : "ok"} ${w} ${id} sw=${a.scrollWidth}/${a.clientWidth} h1="${a.h1}" ${a.offenders.join(" | ")} ${errors.length ? "JSERR " + errors[0] : ""}`);
    } catch (e) {
      console.log(`XX ${w} ${id} ${String(e.message).slice(0, 120)}`);
    }
    await page.close();
  }
  await ctx.close();
}
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
await browser.close();
