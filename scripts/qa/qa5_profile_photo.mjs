// QA #5 — Profile photo upload UI verification (local, against localhost:3000).
// Proxies /api -> localhost:8001 (real backend) and mocks GET /user/profile so we
// can screenshot BOTH avatar states: initials fallback and rendered photo.
// Run: PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell \
//      node scripts/qa/qa5_profile_photo.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const TOKEN = fs.readFileSync("/app/memory/tmp/dp_token.txt", "utf8").trim();
const BASE = "http://localhost:3000";
const BACKEND = "http://localhost:8001";
const OUT = "/app/memory/tmp/qa5";
const PHOTO_URL = "/favicon-192.png"; // any real path proves the <Image> (photo) branch
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH });

async function shoot(withPhoto) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => {
    localStorage.setItem("token", t);
    localStorage.setItem("last_company_id", "1");
    localStorage.setItem("mfa_interstitial_seen", "1");
  }, TOKEN);

  const page = await ctx.newPage();

  // Proxy every /api call to the real backend; override /user/profile.photo when withPhoto.
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const target = BACKEND + u.pathname + u.search;
    const headers = { ...req.headers(), authorization: "Bearer " + TOKEN };
    const opts = { method: req.method(), headers };
    const body = req.postDataBuffer();
    if (body) opts.data = body;
    let resp;
    try {
      resp = await ctx.request.fetch(target, opts);
    } catch (e) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {} }) });
    }
    let out = await resp.body();
    const rh = resp.headers();
    if (u.pathname.replace(/\/+$/, "").endsWith("/user/profile")) {
      try {
        const j = JSON.parse(out.toString());
        const d = j.data || j;
        d.photo = withPhoto ? PHOTO_URL : "";
        if (j.data) j.data = d;
        out = Buffer.from(JSON.stringify(j.data ? j : d));
      } catch {}
      delete rh["content-length"];
      delete rh["content-encoding"];
      return route.fulfill({ status: resp.status(), headers: rh, body: out });
    }
    delete rh["content-length"];
    delete rh["content-encoding"];
    return route.fulfill({ status: resp.status(), headers: rh, body: out });
  });

  await page.goto(BASE + "/settings?section=profile", { waitUntil: "domcontentloaded", timeout: 90000 });
  const ok = await page.waitForSelector('[data-testid="profile-avatar"]', { timeout: 60000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(3000);

  const kind = await page.getAttribute('[data-testid="profile-avatar-image"]', "data-avatar-kind").catch(() => null);
  const uploadBtn = await page.isVisible('[data-testid="profile-photo-upload-btn"]').catch(() => false);
  const removeBtn = await page.isVisible('[data-testid="profile-photo-remove-btn"]').catch(() => false);
  const hint = await page.isVisible('[data-testid="profile-avatar-hint"]').catch(() => false);
  console.log(`[withPhoto=${withPhoto}] avatarFound=${ok} avatar-kind=${kind} uploadBtn=${uploadBtn} removeBtn=${removeBtn} hint=${hint}`);

  await page.locator('[data-testid="profile-avatar"]').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/profile_${withPhoto ? "photo" : "initials"}.jpg`, type: "jpeg", quality: 45 });
  await ctx.close();
}

await shoot(false);
await shoot(true);
await browser.close();
console.log("DONE -> " + OUT);
