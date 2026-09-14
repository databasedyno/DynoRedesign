// Iteration 155 alignment/auth-boundary test suite
// Frontend-only, read-only against preview (production DB).
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "https://speedup-check.preview.emergentagent.com";
const EMAIL = "onarrival21@gmail.com";
const PASSWORD = "Katiekendra123@";

const EXE = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell";

const results = [];
const record = (name, ok, details) => {
  const line = { name, ok, details };
  results.push(line);
  console.log(`${ok ? "PASS" : "FAIL"} :: ${name} :: ${JSON.stringify(details).slice(0, 500)}`);
};

const browser = await chromium.launch({ executablePath: EXE });

async function newMobileCtx() {
  return await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
}
async function newDesktopCtx() {
  return await browser.newContext({ viewport: { width: 1920, height: 900 } });
}

async function attachLogs(page, tag) {
  const bag = { console: [], pageerror: [], http4xx5xx: [] };
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) bag.console.push(`${m.type()}: ${m.text().slice(0,200)}`); });
  page.on("pageerror", (e) => bag.pageerror.push(String(e.message).slice(0, 200)));
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/")) bag.http4xx5xx.push(`${r.status()} ${r.request().method()} ${r.url().slice(0,140)}`); });
  return bag;
}

async function ownerLogin(page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="login-email-input"]', { timeout: 30000 });
  await page.fill('[data-testid="login-email-input"]', EMAIL);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForSelector('[data-testid="password-input"]', { timeout: 30000 });
  await page.fill('[data-testid="password-input"]', PASSWORD);
  await page.click('[data-testid="signin-submit-btn"]');
  await page.waitForURL(/\/dashboard/, { timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
}

async function noOverflow(page) {
  return await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
}

// =========================================================================
// TEST 1 & 2: Blog posts at 390 - no horizontal overflow
// =========================================================================
async function testBlogPosts() {
  const ctx = await newMobileCtx();
  const page = await ctx.newPage();
  await attachLogs(page, "blog");
  try {
    for (const slug of ["how-to-accept-crypto-payments-on-your-website", "userless-payment-api-simplest-crypto-integration"]) {
      await page.goto(`${BASE}/blog/${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(600);
      const m = await noOverflow(page);
      const codeBlocks = await page.$$('[data-testid="blog-code-block"]');
      let codeScrollOk = true;
      const codeInfo = [];
      for (const el of codeBlocks) {
        const info = await el.evaluate((n) => {
          const cs = getComputedStyle(n);
          return { sw: n.scrollWidth, cw: n.clientWidth, overflowX: cs.overflowX };
        });
        codeInfo.push(info);
        // Any block wider than container should scroll internally (overflow-x auto/scroll)
        if (info.sw > info.cw && !["auto", "scroll"].includes(info.overflowX)) codeScrollOk = false;
      }
      record(`blog[${slug}] no-h-overflow @390`, m.sw === m.iw, m);
      record(`blog[${slug}] code blocks scroll internally`, codeScrollOk, { codeInfo });
    }
  } finally {
    await ctx.close();
  }
}

// =========================================================================
// TEST 3: Public auth boundary - checkout token isolation
// =========================================================================
async function testAuthBoundaryPublic() {
  const ctx = await newMobileCtx();
  const page = await ctx.newPage();
  const logs = await attachLogs(page, "auth-boundary");
  try {
    // Go to /pay?d=rNtQRX, DO NOT click Continue.
    await page.goto(`${BASE}/pay?d=rNtQRX`, { waitUntil: "domcontentloaded", timeout: 60000 });
    // Wait for checkout to load — either header text or a currency button
    await page.waitForTimeout(3500);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const ls = await page.evaluate(() => ({
      keys: Object.keys(localStorage),
      hasCheckout: !!localStorage.getItem("checkout_session_token"),
      hasToken: !!localStorage.getItem("token"),
    }));
    record("public /pay stores checkout_session_token only", ls.hasCheckout && !ls.hasToken, ls);

    // Navigate to /devhub → must NOT redirect to /auth/login
    await page.goto(`${BASE}/devhub`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    const url1 = page.url();
    // Look for "session has timed out" toast
    const timedOut = await page.evaluate(() => document.body.innerText.toLowerCase().includes("session has timed out") || document.body.innerText.toLowerCase().includes("sitzung ist abgelaufen"));
    record("public /devhub after /pay stays on /devhub", /\/devhub/.test(url1) && !/\/auth\/login/.test(url1), { url: url1, timedOut });

    // Navigate to / → must stay on landing (not redirect to /dashboard or /auth/login)
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    const url2 = page.url();
    const okLanding = !/\/auth\/login/.test(url2) && !/\/dashboard/.test(url2);
    record("public / lands on landing (no auth redirect)", okLanding, { url: url2 });
  } finally {
    await ctx.close();
  }
}

// =========================================================================
// TEST 4: Merchant regression - visiting /pay does not clobber owner token
// =========================================================================
async function testMerchantTokenPreserved() {
  const ctx = await newDesktopCtx();
  const page = await ctx.newPage();
  await attachLogs(page, "merchant-pay");
  try {
    await ownerLogin(page);
    const tokBefore = await page.evaluate(() => localStorage.getItem("token"));
    record("owner login sets token", !!tokBefore && tokBefore.length > 20, { len: tokBefore ? tokBefore.length : 0 });

    // Same tab -> /pay?d=rNtQRX
    await page.goto(`${BASE}/pay?d=rNtQRX`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const mid = await page.evaluate(() => ({
      token: localStorage.getItem("token"),
      checkout: localStorage.getItem("checkout_session_token"),
    }));
    record("merchant token unchanged after visiting /pay", mid.token === tokBefore, { equal: mid.token === tokBefore, hasCheckout: !!mid.checkout });

    // Back to /dashboard
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    const url = page.url();
    const tokAfter = await page.evaluate(() => localStorage.getItem("token"));
    record("merchant /dashboard renders after /pay round-trip", /\/dashboard/.test(url) && tokAfter === tokBefore, { url, tokenEqual: tokAfter === tokBefore });
  } finally {
    await ctx.close();
  }
}

// =========================================================================
// TEST 5: Checkout flow at 390 with mocked addPayment
// =========================================================================
async function testCheckoutMockedFlow() {
  const ctx = await newMobileCtx();
  const page = await ctx.newPage();
  const logs = await attachLogs(page, "checkout-flow");
  // Mock addPayment
  await ctx.route("**/api/pay/addPayment", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "ok",
        data: {
          address: "ltc1qmockaddressxxxxxxxxxxxxxxxxxxxxxxxxx",
          amount: 0.2,
          currency: "LTC",
          qr_code: "",
          expires_in: 1800,
        },
      }),
    });
  });

  // Capture getCurrencyRates request/response
  let getRatesInfo = null;
  page.on("request", (req) => {
    if (req.url().includes("/api/pay/getCurrencyRates")) {
      getRatesInfo = getRatesInfo || {};
      getRatesInfo.reqAuth = req.headers()["authorization"] || null;
      getRatesInfo.url = req.url();
    }
  });
  page.on("response", async (r) => {
    if (r.url().includes("/api/pay/getCurrencyRates")) {
      getRatesInfo = getRatesInfo || {};
      getRatesInfo.status = r.status();
    }
  });

  try {
    await page.goto(`${BASE}/pay?d=rNtQRX`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const ov = await noOverflow(page);
    record("checkout /pay no h-overflow @390", ov.sw === ov.iw, ov);

    record("getCurrencyRates 200 + Bearer auth", !!getRatesInfo && getRatesInfo.status === 200 && typeof getRatesInfo.reqAuth === "string" && getRatesInfo.reqAuth.startsWith("Bearer "), getRatesInfo || { note: "not seen" });

    // Find LTC continue button
    const ltcBtn = page.getByRole("button", { name: /Continue with LTC/i }).first();
    const ltcCount = await ltcBtn.count();
    if (ltcCount === 0) {
      // Fallback: any "Continue with" button
      const anyBtn = page.getByRole("button", { name: /Continue with/i }).first();
      if (await anyBtn.count()) {
        await anyBtn.scrollIntoViewIfNeeded();
        await anyBtn.click({ force: true });
      } else {
        record("LTC continue button present", false, { ltcCount });
      }
    } else {
      await ltcBtn.scrollIntoViewIfNeeded();
      await ltcBtn.click({ force: true });
    }
    await page.waitForTimeout(3500);

    // Waiting for payment state
    const bodyTxt = await page.evaluate(() => document.body.innerText.slice(0, 5000));
    const waitingSeen = /Waiting for your payment|Warte auf Ihre Zahlung|Waiting for payment/i.test(bodyTxt);
    const addrSeen = bodyTxt.includes("ltc1qmockaddress");
    record("waiting-for-payment state shows mocked address", waitingSeen && addrSeen, { waitingSeen, addrSeen });

    // Sticky bar above language chooser bar
    const rects = await page.evaluate(() => {
      const s = document.querySelector('[data-testid="checkout-sticky-bar"]');
      const l = document.querySelector('[data-testid="language-onboarding-bar"]');
      return {
        sticky: s ? s.getBoundingClientRect().toJSON() : null,
        lang: l ? l.getBoundingClientRect().toJSON() : null,
      };
    });
    let stickyOk = null;
    if (rects.sticky && rects.lang) {
      stickyOk = rects.sticky.bottom <= rects.lang.top + 1;
    }
    record("checkout sticky bar above language bar", stickyOk === true, rects);

    // Desktop overflow check
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.waitForTimeout(700);
    const ov1920 = await noOverflow(page);
    record("checkout no h-overflow @1920", ov1920.sw <= ov1920.iw, ov1920);
  } finally {
    await ctx.close();
  }
}

// =========================================================================
// TEST 6: Creator page /astrix at 390 - sticky CTA above lang bar, FAB above CTA
// =========================================================================
async function testCreatorPage() {
  const ctx = await newMobileCtx();
  const page = await ctx.newPage();
  await attachLogs(page, "creator");
  try {
    await page.goto(`${BASE}/astrix`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const ov = await noOverflow(page);
    record("creator /astrix no h-overflow @390", ov.sw === ov.iw, ov);

    const rects = await page.evaluate(() => {
      const q = (s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect().toJSON() : null; };
      return {
        cta: q('[data-testid="creator-sticky-cta"]'),
        lang: q('[data-testid="language-onboarding-bar"]'),
        fab: q('[data-testid="support-chat-button"]'),
      };
    });
    const ctaAboveLang = rects.cta && rects.lang ? rects.cta.bottom <= rects.lang.top + 1 : null;
    const fabAboveCta = rects.fab && rects.cta ? rects.fab.bottom <= rects.cta.top + 1 : null;
    record("creator sticky CTA above language bar", ctaAboveLang === true, rects);
    record("creator support FAB above sticky CTA", fabAboveCta === true, { fab: rects.fab, cta: rects.cta });

    // Dismiss lang bar
    const closeBtn = page.locator('[data-testid="language-onboarding-close"]').first();
    if (await closeBtn.count()) {
      await closeBtn.click({ force: true });
      await page.waitForTimeout(700);
      const after = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="creator-sticky-cta"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { bottom: r.bottom, ih: window.innerHeight };
      });
      const dropped = after && Math.abs(after.bottom - after.ih) <= 4;
      record("after lang dismiss, CTA drops to viewport bottom", dropped === true, after);
    } else {
      record("language-onboarding-close present", false, { note: "close button not found — lang bar may already be dismissed" });
    }
  } finally {
    await ctx.close();
  }
}

// =========================================================================
// TEST 7: /wallet at 390 - header buttons non-overlapping
// =========================================================================
async function testWallet() {
  const ctx = await newMobileCtx();
  const page = await ctx.newPage();
  await attachLogs(page, "wallet");
  try {
    await ownerLogin(page);
    // Ensure company 1
    await page.evaluate(() => localStorage.setItem("last_company_id", "1"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/wallet`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const ov = await noOverflow(page);
    record("/wallet no h-overflow @390", ov.sw === ov.iw, ov);

    const rects = await page.evaluate(() => {
      const g = (s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect().toJSON() : null; };
      return {
        sec: g('[data-testid="wallet-security-btn"]'),
        mng: g('[data-testid="wallet-manage-btn"]'),
        add: g('[data-testid="wallet-add-btn"]'),
        iw: window.innerWidth,
      };
    });
    const overlap = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    const anyOverlap = overlap(rects.sec, rects.mng) || overlap(rects.mng, rects.add) || overlap(rects.sec, rects.add);
    // add-wallet full width row
    const addFullWidth = rects.add ? rects.add.width >= rects.iw * 0.85 : false;
    record("/wallet header actions non-overlapping @390", !anyOverlap, rects);
    record("/wallet Add wallet full-width row @390", addFullWidth, { add: rects.add, iw: rects.iw });
  } finally {
    await ctx.close();
  }
}

// =========================================================================
// TEST 8: /developer-keys at 390 - Test API card badge placement
// =========================================================================
async function testDeveloperKeys() {
  const ctx = await newMobileCtx();
  const page = await ctx.newPage();
  await attachLogs(page, "devkeys");
  try {
    await ownerLogin(page);
    await page.evaluate(() => localStorage.setItem("last_company_id", "1"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/developer-keys`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const ov = await noOverflow(page);
    record("/developer-keys no h-overflow @390", ov.sw === ov.iw, ov);

    const info = await page.evaluate(() => {
      const sandbox = document.querySelector('[data-testid="sandbox-badge"]');
      if (!sandbox) return { found: false };
      // walk up to find a card container
      let card = sandbox.closest('[class*="MuiCard"], [class*="Card"], article, section') || sandbox.parentElement.parentElement.parentElement;
      const cardRect = card ? card.getBoundingClientRect() : null;
      const title = card ? card.querySelector('h1,h2,h3,h4,h5,h6') : null;
      const titleRect = title ? title.getBoundingClientRect() : null;
      const sbRect = sandbox.getBoundingClientRect();
      // find Active badge sibling
      const badges = card ? Array.from(card.querySelectorAll('[class*="MuiChip"], [role="status"]')) : [];
      const badgeInfo = badges.map(b => ({ text: b.textContent.trim().slice(0, 20), r: b.getBoundingClientRect().toJSON() }));
      const overlap = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      const badgesOverlapTitle = titleRect ? badgeInfo.some(b => overlap(b.r, titleRect)) : null;
      return { found: true, titleRect, sbRect, badgeInfo, badgesOverlapTitle };
    });
    record("/developer-keys badges do not overlap title @390", info.found && info.badgesOverlapTitle === false, info);
    await page.screenshot({ path: "/app/test_reports/dev_keys_390.png", quality: 40, fullPage: false, type: "jpeg" }).catch(() => {});
  } finally {
    await ctx.close();
  }
}

// =========================================================================
// TEST 9: /storefront at 390
// =========================================================================
async function testStorefront() {
  const ctx = await newMobileCtx();
  const page = await ctx.newPage();
  await attachLogs(page, "storefront");
  try {
    await ownerLogin(page);
    await page.evaluate(() => localStorage.setItem("last_company_id", "1"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/storefront`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const ov = await noOverflow(page);
    record("/storefront no h-overflow @390", ov.sw === ov.iw, ov);

    const info = await page.evaluate(() => {
      const open = document.querySelector('[data-testid="storefront-open-page"]');
      const subtitle = document.querySelector('h1,h2,h3,h4,h5,h6');
      // find subtitle (paragraph near heading)
      let sub = null;
      if (subtitle) {
        let n = subtitle.nextElementSibling;
        while (n && !sub) {
          if (n.tagName === "P" || (n.textContent && n.textContent.trim().length > 5)) sub = n;
          n = n.nextElementSibling;
        }
      }
      const openR = open ? open.getBoundingClientRect().toJSON() : null;
      const subR = sub ? sub.getBoundingClientRect().toJSON() : null;
      const tiles = Array.from(document.querySelectorAll('[data-testid^="creator-stat-"]')).map(t => ({ id: t.getAttribute("data-testid"), r: t.getBoundingClientRect().toJSON() }));
      const tips = document.querySelector('[data-testid="creator-view-tips-link"]');
      const tipsR = tips ? tips.getBoundingClientRect().toJSON() : null;
      return { openR, subR, tiles, tipsR, iw: window.innerWidth, ih: window.innerHeight };
    });
    const openBelowSub = info.openR && info.subR ? info.openR.top >= info.subR.bottom - 1 : null;
    const tilesInside = info.tiles.length >= 3 && info.tiles.every(t => t.r.right <= info.iw + 0.5 && t.r.left >= -0.5);
    const tipsVisible = info.tipsR && info.tipsR.right <= info.iw + 0.5 && info.tipsR.width > 0 && info.tipsR.height > 0;
    record("/storefront View my page below subtitle @390", openBelowSub === true, { openR: info.openR, subR: info.subR });
    record("/storefront 3 stat tiles fully inside viewport @390", tilesInside, { tiles: info.tiles, iw: info.iw });
    record("/storefront View tip transactions fully visible @390", tipsVisible === true, info.tipsR);
  } finally {
    await ctx.close();
  }
}

// =========================================================================
// TEST 10: /pay-links at 1920 - table width, headers, description truncation
// =========================================================================
async function testPayLinksTable() {
  const ctx = await newDesktopCtx();
  const page = await ctx.newPage();
  await attachLogs(page, "pay-links");
  try {
    await ownerLogin(page);
    await page.goto(`${BASE}/pay-links`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4500);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const ov = await noOverflow(page);
    record("/pay-links no h-overflow @1920", ov.sw <= ov.iw, ov);

    const info = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return { found: false };
      // container = closest overflow-x scroller
      let container = table.parentElement;
      while (container && container !== document.body) {
        const cs = getComputedStyle(container);
        if (["auto", "scroll"].includes(cs.overflowX)) break;
        container = container.parentElement;
      }
      const tw = table.getBoundingClientRect().width;
      const ccw = container ? container.clientWidth : null;
      const csw = container ? container.scrollWidth : null;
      const heads = Array.from(table.querySelectorAll('thead th')).map(th => ({ txt: th.textContent.trim().slice(0, 30), r: th.getBoundingClientRect().toJSON() }));
      // find truncated cells
      const cells = Array.from(table.querySelectorAll('tbody td'));
      const truncatedRows = cells.filter(c => {
        const cs = getComputedStyle(c);
        // check inner span with overflow ellipsis
        if (cs.textOverflow === "ellipsis" && c.scrollWidth > c.clientWidth) return true;
        const spans = c.querySelectorAll('span,div');
        for (const s of spans) {
          const scs = getComputedStyle(s);
          if (scs.textOverflow === "ellipsis" && s.scrollWidth > s.clientWidth + 1) return true;
        }
        return false;
      }).length;
      return { found: true, tw, ccw, csw, heads, truncatedRows };
    });
    if (!info.found) {
      record("/pay-links table present", false, info);
    } else {
      const tableFits = info.tw <= info.ccw + 1 && info.csw === info.ccw;
      record("/pay-links table fits container @1920", tableFits, { tw: info.tw, ccw: info.ccw, csw: info.csw });
      // last two headers should be within viewport (Payments & Actions)
      const last2 = info.heads.slice(-2);
      const headersVisible = last2.every(h => h.r.right <= 1920 + 0.5 && h.r.width > 0);
      record("/pay-links Payments & Actions headers fully visible @1920", headersVisible, { last2 });
      record("/pay-links has truncated description cells @1920", info.truncatedRows > 0, { truncatedRows: info.truncatedRows });
    }

    // Click first row to open detail panel
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.count()) {
      await firstRow.click({ force: true });
      await page.waitForTimeout(1500);
      const panelOpen = await page.evaluate(() => {
        // detect any drawer/dialog/side-panel visible
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="presentation"] .MuiDrawer-paper, .MuiDrawer-paper'));
        return dialogs.some(d => {
          const r = d.getBoundingClientRect();
          const cs = getComputedStyle(d);
          return r.width > 100 && r.height > 100 && cs.visibility !== "hidden" && cs.display !== "none";
        });
      });
      record("/pay-links row click opens detail panel", panelOpen, {});
    }
  } finally {
    await ctx.close();
  }
}

// =========================================================================
// TEST 11: Regression smoke - dashboard/transactions/customers/settings
// =========================================================================
async function testRegressionSmoke() {
  const ctx = await newDesktopCtx();
  const page = await ctx.newPage();
  const logs = await attachLogs(page, "smoke");
  try {
    await ownerLogin(page);
    for (const path of ["/dashboard", "/transactions", "/customers", "/settings"]) {
      for (const [w, h] of [[1920, 900], [390, 844]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(2500);
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        const ov = await noOverflow(page);
        record(`smoke ${path} @${w} no h-overflow`, ov.sw <= ov.iw, ov);
      }
    }
    // Filter to hydration / real errors (ignore known dev warnings)
    const bad = logs.console.filter(l =>
      /hydration|Cannot read|is not a function|Uncaught|Error:/i.test(l) &&
      !/fetchPriority|Cloudflare|non-boolean attribute/i.test(l)
    );
    record("smoke no console hydration/JS errors", bad.length === 0 && logs.pageerror.length === 0, { console: bad.slice(0, 5), pageerror: logs.pageerror.slice(0, 5) });
  } finally {
    await ctx.close();
  }
}

// =========================================================================
// Run all
// =========================================================================
const suites = [
  ["blog", testBlogPosts],
  ["auth-boundary-public", testAuthBoundaryPublic],
  ["merchant-token-preserved", testMerchantTokenPreserved],
  ["checkout-mocked-flow", testCheckoutMockedFlow],
  ["creator-page", testCreatorPage],
  ["wallet", testWallet],
  ["developer-keys", testDeveloperKeys],
  ["storefront", testStorefront],
  ["pay-links", testPayLinksTable],
  ["regression-smoke", testRegressionSmoke],
];

for (const [name, fn] of suites) {
  console.log(`\n===== ${name} =====`);
  try {
    await fn();
  } catch (e) {
    record(`suite:${name} threw`, false, { error: String(e.message).slice(0, 300) });
  }
}

await browser.close();

fs.writeFileSync("/app/test_reports/iter155_raw.json", JSON.stringify(results, null, 2));
const passed = results.filter(r => r.ok).length;
console.log(`\n\n====== SUMMARY ${passed}/${results.length} passed ======`);
for (const r of results.filter(x => !x.ok)) console.log("FAIL:", r.name, JSON.stringify(r.details).slice(0, 300));
process.exit(0);
