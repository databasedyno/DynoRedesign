// Iteration 156 comprehensive suite: empty cart, hosted checkout success (mocked),
// save merchant toggle, receipt buttons, inline tip checkout, /saved page, i18n, regression.
import { chromium } from "playwright";

const BASE = "https://speedup-check.preview.emergentagent.com";
const EXE = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell";

const results = [];
function log(name, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} :: ${name}${detail ? " :: " + detail : ""}`;
  console.log(line);
  results.push({ name, ok, detail });
}

async function newCtx(browser, width, opts = {}) {
  return browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1000 },
    isMobile: width < 600,
    hasTouch: width < 600,
    permissions: ["clipboard-read", "clipboard-write"],
    acceptDownloads: true,
    ...opts,
  });
}

async function installMocks(ctx) {
  await ctx.route("**/api/pay/addPayment", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok", data: { address: "ltc1qmockaddressxxxxxxxxxxxxxxxxxxxxxxxxx", amount: 0.2, currency: "LTC", qr_code: "", expires_in: 1800 } }) })
  );
  await ctx.route("**/api/pay/verifyCryptoPayment", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok", data: { status: "confirmed", paidAmount: 0.2, paidAmountUsd: 15, baseCurrency: "USD", currency: "LTC", merchantAmount: 0.197, feeAmount: 0.003, feePayer: "company" } }) })
  );
  await ctx.route("**/api/pay/receipt/link", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok", data: { url: `${BASE}/receipt/mocktoken123`, token: "mocktoken123" } }) })
  );
  await ctx.route("**/api/pay/receipt", (r) =>
    r.fulfill({ status: 200, contentType: "application/pdf", headers: { "content-disposition": 'attachment; filename="receipt-mock.pdf"' }, body: "%PDF-1.4 mock" })
  );
  await ctx.route("**/api/pay/stream**", (r) => r.abort());
  await ctx.route("**/api/pay/tip", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok", data: { d: "rNtQRX" } }) })
  );
}

async function overflow(page) {
  return page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
}

// ----------------- TEST 1: EMPTY CART -----------------
async function testEmptyCart(browser, width) {
  const ctx = await newCtx(browser, width);
  const page = await ctx.newPage();
  await ctx.addInitScript(() => {
    try { for (const k of Object.keys(localStorage)) if (/cart/i.test(k)) localStorage.removeItem(k); } catch {}
  });
  try {
    await page.goto(`${BASE}/devhub/checkout`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    // clear cart keys after load in case
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/cart/i.test(k)) localStorage.removeItem(k); });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const empty = page.locator('[data-testid="checkout-empty-state"]');
    const emptyCount = await empty.count();
    log(`empty-cart[${width}] empty-state visible`, emptyCount > 0);
    if (emptyCount > 0) {
      const title = await page.locator('[data-testid="checkout-empty-title"]').innerText().catch(() => "");
      log(`empty-cart[${width}] title text`, /Your cart is empty/i.test(title), title);
      const btn = page.locator('[data-testid="checkout-empty-browse-btn"]');
      const href = await btn.getAttribute("href").catch(() => null);
      log(`empty-cart[${width}] browse-btn href /devhub/shop`, href === "/devhub/shop" || href?.endsWith("/devhub/shop"), href || "");
    }
    const o = await overflow(page);
    log(`empty-cart[${width}] no horizontal overflow`, o.sw === o.iw, JSON.stringify(o));
    // Navigation click
    if (emptyCount > 0) {
      await Promise.all([
        page.waitForURL(/\/devhub\/shop/, { timeout: 15000 }).catch(() => {}),
        page.locator('[data-testid="checkout-empty-browse-btn"]').click({ force: true }),
      ]);
      log(`empty-cart[${width}] navigates to /devhub/shop`, /\/devhub\/shop/.test(page.url()), page.url());
    }
  } catch (e) { log(`empty-cart[${width}]`, false, String(e).slice(0, 200)); }
  await ctx.close();
}

// ----------------- TEST 2: HOSTED CHECKOUT SUCCESS + SAVE + RECEIPT -----------------
async function testHostedCheckout(browser) {
  const width = 1920;
  const ctx = await newCtx(browser, width);
  await installMocks(ctx);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", String(e.message).slice(0, 160)));
  try {
    await page.goto(`${BASE}/pay?d=rNtQRX`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(3500);
    const btn = page.getByRole("button", { name: /Continue with LTC/i }).first();
    let clicked = false;
    if (await btn.count()) { await btn.scrollIntoViewIfNeeded(); await btn.click({ force: true }); clicked = true; }
    log("hosted success LTC button clicked", clicked);
    await page.waitForTimeout(6500);

    const saveBtn = page.locator('[data-testid="save-merchant-btn"]');
    const rcpt = page.locator('[data-testid="clean-checkout-receipt-btn"]');
    const rcptLink = page.locator('[data-testid="clean-checkout-receipt-link-btn"]');
    log("hosted receipt btn present", (await rcpt.count()) > 0);
    log("hosted receipt link btn present", (await rcptLink.count()) > 0);
    log("hosted save-merchant-btn present", (await saveBtn.count()) > 0);
    if (await saveBtn.count()) {
      const t = (await saveBtn.innerText()).trim();
      log("hosted save-merchant-btn text 'Save The Dev Store for next time'", /Save The Dev Store for next time/i.test(t), t);
      log("hosted save data-saved=false initial", (await saveBtn.getAttribute("data-saved")) === "false");
      // save
      await saveBtn.click({ force: true });
      await page.waitForTimeout(500);
      const t2 = (await saveBtn.innerText()).trim();
      log("hosted after save text 'Saved on this device'", /Saved on this device/i.test(t2), t2);
      log("hosted after save data-saved=true", (await saveBtn.getAttribute("data-saved")) === "true");
      log("hosted after save aria-pressed=true", (await saveBtn.getAttribute("aria-pressed")) === "true");
      const link = page.locator('[data-testid="saved-merchants-link"]');
      log("hosted saved-merchants-link visible", (await link.count()) > 0);
      if (await link.count()) {
        const href = await link.getAttribute("href");
        log("hosted saved-merchants-link href=/saved", href === "/saved" || href?.endsWith("/saved"), href || "");
      }
      const ls = await page.evaluate(() => localStorage.getItem("dynopay_saved_merchants_v1"));
      let parsed = [];
      try { parsed = JSON.parse(ls || "[]"); } catch {}
      log("hosted localStorage has 1 entry", Array.isArray(parsed) && parsed.length === 1, ls || "");
      if (parsed[0]) {
        log("hosted localStorage entry handle=devhub", parsed[0].handle === "devhub", JSON.stringify(parsed[0]).slice(0, 200));
        log("hosted localStorage entry name=The Dev Store", parsed[0].name === "The Dev Store");
      }
      // unsave
      await saveBtn.click({ force: true });
      await page.waitForTimeout(400);
      log("hosted after unsave data-saved=false", (await saveBtn.getAttribute("data-saved")) === "false");
      const ls2 = await page.evaluate(() => localStorage.getItem("dynopay_saved_merchants_v1"));
      let parsed2 = [];
      try { parsed2 = JSON.parse(ls2 || "[]"); } catch {}
      log("hosted after unsave localStorage empty", parsed2.length === 0, ls2 || "");
    }

    // Copy receipt link
    if (await rcptLink.count()) {
      await rcptLink.click({ force: true });
      await page.waitForTimeout(1000);
      const bodyText = await page.evaluate(() => document.body.innerText);
      log("hosted 'Receipt link copied' shown", /Receipt link copied/i.test(bodyText));
    }
    // Download receipt
    if (await rcpt.count()) {
      const dlP = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);
      await rcpt.click({ force: true });
      const dl = await dlP;
      log("hosted download event fired", !!dl, dl ? dl.suggestedFilename() : "no dl");
      if (dl) log("hosted download filename receipt-mock.pdf", dl.suggestedFilename() === "receipt-mock.pdf", dl.suggestedFilename());
      await page.waitForTimeout(700);
      const bodyText = await page.evaluate(() => document.body.innerText);
      log("hosted 'Receipt downloaded' shown", /Receipt downloaded/i.test(bodyText));
    }
    const o = await overflow(page);
    log(`hosted no overflow[${width}]`, o.sw === o.iw, JSON.stringify(o));
  } catch (e) { log("hosted checkout", false, String(e).slice(0, 200)); }
  await ctx.close();
}

// ----------------- TEST 3: INLINE TIP CHECKOUT -----------------
async function testInlineTip(browser, width) {
  const ctx = await newCtx(browser, width);
  await installMocks(ctx);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", String(e.message).slice(0, 160)));
  try {
    await page.goto(`${BASE}/devhub`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector('[data-testid="support-widget-submit"]', { timeout: 60000 });
    await page.locator('[data-testid="support-preset-10"]').click({ force: true });
    await page.locator('[data-testid="support-widget-submit"]').scrollIntoViewIfNeeded();
    await page.locator('[data-testid="support-widget-submit"]').click({ force: true });
    await page.waitForTimeout(4500);
    const ltc = page.locator('[data-testid="inline-tip-currency-LTC"]').first();
    if (await ltc.count()) { await ltc.scrollIntoViewIfNeeded(); await ltc.click({ force: true }); }
    else { log(`inline-tip[${width}] LTC currency btn`, false); await ctx.close(); return; }
    await page.waitForSelector('[data-testid="inline-tip-receipt-row"]', { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const row = page.locator('[data-testid="inline-tip-receipt-row"]');
    log(`inline-tip[${width}] receipt row visible`, (await row.count()) > 0);
    const rBtn = page.locator('[data-testid="inline-tip-receipt-btn"]');
    const lBtn = page.locator('[data-testid="inline-tip-receipt-link-btn"]');
    log(`inline-tip[${width}] download btn present`, (await rBtn.count()) > 0);
    log(`inline-tip[${width}] copy link btn present`, (await lBtn.count()) > 0);
    const sBtn = page.locator('[data-testid="save-merchant-btn"]');
    log(`inline-tip[${width}] save-merchant-btn present`, (await sBtn.count()) > 0);
    if (await sBtn.count()) {
      const t = (await sBtn.innerText()).trim();
      log(`inline-tip[${width}] save btn text`, /Save The Dev Store for next time/i.test(t), t);
    }
    // Copy link
    if (await lBtn.count()) {
      await lBtn.click({ force: true });
      await page.waitForTimeout(800);
      const bodyText = await page.evaluate(() => document.body.innerText);
      log(`inline-tip[${width}] 'Receipt link copied' shown`, /Receipt link copied/i.test(bodyText));
    }
    // Download
    if (await rBtn.count()) {
      const dlP = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);
      await rBtn.click({ force: true });
      const dl = await dlP;
      log(`inline-tip[${width}] download event`, !!dl, dl ? dl.suggestedFilename() : "");
      if (dl) log(`inline-tip[${width}] filename receipt-mock.pdf`, dl.suggestedFilename() === "receipt-mock.pdf");
      await page.waitForTimeout(600);
      log(`inline-tip[${width}] 'Receipt downloaded' shown`, /Receipt downloaded/i.test(await page.evaluate(() => document.body.innerText)));
    }
    // Save
    if (await sBtn.count()) {
      await sBtn.click({ force: true });
      await page.waitForTimeout(500);
      const t2 = (await sBtn.innerText()).trim();
      log(`inline-tip[${width}] after save 'Saved on this device'`, /Saved on this device/i.test(t2), t2);
      const ls = await page.evaluate(() => localStorage.getItem("dynopay_saved_merchants_v1"));
      let parsed = [];
      try { parsed = JSON.parse(ls || "[]"); } catch {}
      log(`inline-tip[${width}] localStorage entry created`, parsed.length === 1 && parsed[0]?.handle === "devhub", ls || "");
    }
    const o = await overflow(page);
    log(`inline-tip[${width}] no overflow`, o.sw === o.iw, JSON.stringify(o));
  } catch (e) { log(`inline-tip[${width}]`, false, String(e).slice(0, 200)); }
  await ctx.close();
}

// ----------------- TEST 4: /saved populated -----------------
async function testSavedPopulated(browser, width) {
  const ctx = await newCtx(browser, width);
  await ctx.addInitScript(() => {
    localStorage.setItem("dynopay_saved_merchants_v1", JSON.stringify([{ handle: "devhub", name: "The Dev Store", avatar: null, savedAt: Date.now() }]));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
  try {
    await page.goto(`${BASE}/saved`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(3000);
    log(`/saved[${width}] saved-page present`, (await page.locator('[data-testid="saved-page"]').count()) > 0);
    const h1 = await page.locator('h1').first().innerText().catch(() => "");
    log(`/saved[${width}] h1 'Your saved merchants'`, /Your saved merchants/i.test(h1), h1);
    log(`/saved[${width}] saved-subtitle`, (await page.locator('[data-testid="saved-subtitle"]').count()) > 0);
    log(`/saved[${width}] saved-list`, (await page.locator('[data-testid="saved-list"]').count()) > 0);
    const card = page.locator('[data-testid="saved-merchant-devhub"]');
    log(`/saved[${width}] devhub card`, (await card.count()) > 0);
    if (await card.count()) {
      const name = await page.locator('[data-testid="saved-merchant-name"]').first().innerText().catch(() => "");
      log(`/saved[${width}] name The Dev Store`, /The Dev Store/i.test(name), name);
      const meta = await page.locator('[data-testid="saved-merchant-meta"]').first().innerText().catch(() => "");
      log(`/saved[${width}] meta has @devhub`, /@devhub/i.test(meta), meta);
      log(`/saved[${width}] meta has Saved`, /Saved/i.test(meta));
      const visit = page.locator('[data-testid="saved-merchant-visit"]').first();
      const href = await visit.getAttribute("href").catch(() => null);
      log(`/saved[${width}] visit href=/devhub`, href === "/devhub" || href?.endsWith("/devhub"), href || "");
      log(`/saved[${width}] remove btn`, (await page.locator('[data-testid="saved-merchant-remove"]').count()) > 0);
    }
    // Header icon
    if (width >= 768) {
      const hdr = page.locator('[data-testid="header-saved-merchants"]');
      log(`/saved[${width}] header-saved-merchants present`, (await hdr.count()) > 0);
      if (await hdr.count()) {
        log(`/saved[${width}] header data-count=1`, (await hdr.getAttribute("data-count")) === "1");
      }
    } else {
      // Mobile: check drawer via hamburger
      const hamburger = page.locator('button[aria-label*="menu" i], [data-testid*="hamburger"], [data-testid*="mobile-menu"]').first();
      if (await hamburger.count()) {
        await hamburger.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
      }
      const m = page.locator('[data-testid="mobile-saved-merchants"]');
      log(`/saved[${width}] mobile-saved-merchants present`, (await m.count()) > 0);
    }
    // No raw i18n keys
    const bodyTxt = await page.evaluate(() => document.body.innerText);
    log(`/saved[${width}] no raw i18n keys`, !/\bsaved\.title\b|\bsaved\.subtitle\b/.test(bodyTxt));
    const o = await overflow(page);
    log(`/saved[${width}] no overflow`, o.sw === o.iw, JSON.stringify(o));
    log(`/saved[${width}] no page errors`, errors.length === 0, errors.join(" | "));
  } catch (e) { log(`/saved[${width}]`, false, String(e).slice(0, 200)); }
  await ctx.close();
}

// ----------------- TEST 5: /saved remove + empty -----------------
async function testSavedRemove(browser) {
  const width = 1920;
  const ctx = await newCtx(browser, width);
  await ctx.addInitScript(() => {
    localStorage.setItem("dynopay_saved_merchants_v1", JSON.stringify([{ handle: "devhub", name: "The Dev Store", avatar: null, savedAt: Date.now() }]));
  });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/saved`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    const rm = page.locator('[data-testid="saved-merchant-remove"]').first();
    if (await rm.count()) { await rm.click({ force: true }); await page.waitForTimeout(600); }
    log("/saved remove: card gone", (await page.locator('[data-testid="saved-merchant-devhub"]').count()) === 0);
    log("/saved remove: empty-state shown", (await page.locator('[data-testid="saved-empty-state"]').count()) > 0);
    const bodyTxt = await page.evaluate(() => document.body.innerText);
    log("/saved remove: 'Nothing saved yet' text", /Nothing saved yet/i.test(bodyTxt));
    const home = page.locator('[data-testid="saved-empty-home-btn"]');
    log("/saved remove: home btn present", (await home.count()) > 0);
    if (await home.count()) {
      const h = await home.getAttribute("href");
      log("/saved remove: home btn href=/", h === "/" || h?.endsWith("/"), h || "");
    }
    log("/saved remove: header-saved-merchants gone", (await page.locator('[data-testid="header-saved-merchants"]').count()) === 0);
    const ls = await page.evaluate(() => localStorage.getItem("dynopay_saved_merchants_v1"));
    let parsed = []; try { parsed = JSON.parse(ls || "[]"); } catch {}
    log("/saved remove: localStorage empty", parsed.length === 0, ls || "");
  } catch (e) { log("/saved remove", false, String(e).slice(0, 200)); }
  await ctx.close();
}

// ----------------- TEST 6: /saved empty fresh -----------------
async function testSavedEmptyFresh(browser) {
  const width = 1920;
  const ctx = await newCtx(browser, width);
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/saved`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    log("/saved fresh: empty-state shown", (await page.locator('[data-testid="saved-empty-state"]').count()) > 0);
    log("/saved fresh: saved-list absent", (await page.locator('[data-testid="saved-list"]').count()) === 0);
    log("/saved fresh: header icon absent", (await page.locator('[data-testid="header-saved-merchants"]').count()) === 0);
  } catch (e) { log("/saved fresh", false, String(e).slice(0, 200)); }
  await ctx.close();
}

// ----------------- TEST 7: Language DE -----------------
async function testLanguageDE(browser) {
  const width = 1920;
  const ctx = await newCtx(browser, width);
  await ctx.addInitScript(() => {
    localStorage.setItem("dynopay_saved_merchants_v1", JSON.stringify([{ handle: "devhub", name: "The Dev Store", avatar: null, savedAt: Date.now() }]));
  });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/saved`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    // Try to switch to DE
    const deBtn = page.locator('[data-testid="header-lang-de"], [data-testid="footer-lang-de"]').first();
    if (await deBtn.count()) {
      await deBtn.scrollIntoViewIfNeeded();
      await deBtn.click({ force: true });
      await page.waitForTimeout(1200);
    } else {
      log("lang DE: DE toggle present", false, "no header-lang-de/footer-lang-de");
      await ctx.close();
      return;
    }
    const h1 = await page.locator('h1').first().innerText().catch(() => "");
    log("lang DE /saved: title 'Deine gespeicherten Händler'", /Deine gespeicherten H(ä|a)ndler/i.test(h1), h1);
    const visit = await page.locator('[data-testid="saved-merchant-visit"]').first().innerText().catch(() => "");
    log("lang DE /saved: visit btn 'Seite öffnen'", /Seite (ö|o)ffnen/i.test(visit), visit);
    // Now /devhub/checkout empty state German
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/cart/i.test(k)) localStorage.removeItem(k); });
    await page.goto(`${BASE}/devhub/checkout`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    const title = await page.locator('[data-testid="checkout-empty-title"]').innerText().catch(() => "");
    log("lang DE checkout empty: German text (Warenkorb ist leer)", /Warenkorb ist leer|Warenkorb leer/i.test(title), title);
    const noRaw = !/checkout\.empty|saved\./i.test(await page.evaluate(() => document.body.innerText));
    log("lang DE: no raw i18n keys visible", noRaw);
    // Switch back to EN
    const enBtn = page.locator('[data-testid="header-lang-en"], [data-testid="footer-lang-en"]').first();
    if (await enBtn.count()) { await enBtn.click({ force: true }); await page.waitForTimeout(500); }
  } catch (e) { log("lang DE", false, String(e).slice(0, 200)); }
  await ctx.close();
}

// ----------------- TEST 8: Regression /pay?d=rNtQRX no mocks -----------------
async function testRegression(browser, width) {
  const ctx = await newCtx(browser, width);
  const page = await ctx.newPage();
  const errors = [], consoleErrors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
  try {
    await page.goto(`${BASE}/pay?d=rNtQRX`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(4000);
    const body = await page.evaluate(() => document.body.innerText);
    log(`regression[${width}] amount $15.00 shown`, /\$15\.00/.test(body));
    // coin buttons
    const coins = await page.locator('button:has-text("Continue with")').count();
    log(`regression[${width}] coin buttons present`, coins > 0, `count=${coins}`);
    const o = await overflow(page);
    log(`regression[${width}] no overflow`, o.sw === o.iw, JSON.stringify(o));
    log(`regression[${width}] no page errors`, errors.length === 0, errors.join(" | "));
    log(`regression[${width}] no console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  } catch (e) { log(`regression[${width}]`, false, String(e).slice(0, 200)); }
  await ctx.close();
}

// -------- MAIN --------
const browser = await chromium.launch({ executablePath: EXE });
try {
  await testEmptyCart(browser, 390);
  await testEmptyCart(browser, 1920);
  await testHostedCheckout(browser);
  await testInlineTip(browser, 390);
  await testSavedPopulated(browser, 390);
  await testSavedPopulated(browser, 1920);
  await testSavedRemove(browser);
  await testSavedEmptyFresh(browser);
  await testLanguageDE(browser);
  await testRegression(browser, 390);
  await testRegression(browser, 1920);
} finally {
  await browser.close();
}

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
console.log(`\n===== SUMMARY: ${passed}/${results.length} passed =====`);
console.log("FAILED:");
for (const f of failed) console.log(" -", f.name, "::", f.detail);
