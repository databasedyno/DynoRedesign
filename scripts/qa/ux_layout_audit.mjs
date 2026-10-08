// UX layout / hierarchy / usability audit harness (2026-10-08).
// Device matrix (desktop → ultra-wide, iPad/Android tablets, iPhone via WebKit, Android via Chromium)
// × in-app routes → fold + scrolled screenshots, shell overlays, and a DOM metrics JSON per device.
//
// READ-ONLY on the LIVE prod DB: every non-GET /api request is answered with a local mock and logged.
// API calls from localhost:3000 are re-targeted to the local backend (:8001) — no Cloudflare in the loop.
//
// Usage:
//   node scripts/qa/ux_layout_audit.mjs --devices=desktop-1440,iphone-15-pro [--pages=dashboard,wallet]
//        [--themes=light|dark] [--overlays=1] [--out=/app/test_reports/ux_layout_audit_2026-10-08]
import { chromium, webkit, devices } from "playwright";
import fs from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const k = a.replace(/^--/, "");
    const i = k.indexOf("=");
    return i < 0 ? [k, "1"] : [k.slice(0, i), k.slice(i + 1)];
  }),
);
const BASE = args.base || "http://localhost:3000";
const API = args.api || "http://localhost:8001";
const OUT = args.out || "/app/test_reports/ux_layout_audit_2026-10-08";
const THEME = args.themes || "light";
const OVERLAYS = args.overlays !== "0";
const DELAY = Number(args.delay || 1200);
const TOKEN = fs.readFileSync("/app/memory/tmp/merchant_token.txt", "utf8").trim();
fs.mkdirSync(OUT, { recursive: true });

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const strip = (d) => {
  const { defaultBrowserType, ...rest } = d;
  return rest;
};
const DEVICES = {
  "desktop-1280": { engine: "chromium", cls: "desktop", ctx: { viewport: { width: 1280, height: 800 }, userAgent: DESKTOP_UA } },
  "desktop-1440": { engine: "chromium", cls: "desktop", ctx: { viewport: { width: 1440, height: 900 }, userAgent: DESKTOP_UA } },
  "desktop-1920": { engine: "chromium", cls: "desktop", ctx: { viewport: { width: 1920, height: 1080 }, userAgent: DESKTOP_UA } },
  "desktop-2560": { engine: "chromium", cls: "desktop", ctx: { viewport: { width: 2560, height: 1440 }, userAgent: DESKTOP_UA } },
  "ipad-mini-portrait": { engine: "webkit", cls: "tablet", ctx: strip(devices["iPad Mini"]) },
  "ipad-mini-landscape": { engine: "webkit", cls: "tablet", ctx: strip(devices["iPad Mini landscape"]) },
  "ipad-pro11-portrait": { engine: "webkit", cls: "tablet", ctx: strip(devices["iPad Pro 11"]) },
  "ipad-pro11-landscape": { engine: "webkit", cls: "tablet", ctx: strip(devices["iPad Pro 11 landscape"]) },
  "galaxy-tab-s4": { engine: "chromium", cls: "tablet", ctx: strip(devices["Galaxy Tab S4"]) },
  "iphone-se3": { engine: "webkit", cls: "phone", ctx: strip(devices["iPhone SE (3rd gen)"]) },
  "iphone-15-pro": { engine: "webkit", cls: "phone", ctx: strip(devices["iPhone 15 Pro"]) },
  "iphone-16-pro-max": { engine: "webkit", cls: "phone", ctx: strip(devices["iPhone 16 Pro Max"]) },
  "pixel-8": { engine: "chromium", cls: "phone", ctx: strip(devices["Pixel 8"]) },
  "galaxy-s24": { engine: "chromium", cls: "phone", ctx: strip(devices["Galaxy S24"]) },
};

const PAGES = [
  ["dashboard", "/dashboard"],
  ["pay-links", "/pay-links"],
  ["create-pay-link", "/create-pay-link"],
  ["products", "/pay-links/products"],
  ["storefront", "/storefront"],
  ["payouts", "/payouts"],
  ["transactions", "/transactions"],
  ["invoices", "/invoices"],
  ["wallet", "/wallet"],
  ["wallet-security", "/wallet-security"],
  ["customers", "/customers"],
  ["referrals", "/referrals"],
  ["settings", "/settings"],
  ["developer-keys", "/developer-keys"],
  ["notifications", "/notifications"],
  ["help-support", "/help-support"],
  ["brands", "/brands"],
  ["kyc", "/kyc"],
  ["saved", "/saved"],
];
// Second pass (--extra=1): settings sections, nested pages, first-run wizard.
const EXTRA_PAGES = [
  ["settings-security", "/settings?section=security"],
  ["settings-company", "/settings?section=company"],
  ["settings-payments", "/settings?section=payments"],
  ["settings-team", "/settings?section=team"],
  ["settings-notifications", "/settings?section=notifications"],
  ["wallet-security-page", "/wallet/security"],
  ["get-started", "/get-started"],
];
// Row → detail drawers (--drawers=1)
const DRAWERS = [
  ["paylink-drawer", "/pay-links", '[data-testid="paylink-row"], [data-testid="paylink-card"]'],
  ["tx-drawer", "/transactions", '[data-testid^="tx-row-"]'],
];

// ---------------------------------------------------------------- in-page metrics
const AUDIT = `(() => {
  const iw = innerWidth, ih = innerHeight;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return false; const r = el.getBoundingClientRect(); return r.width>0 && r.height>0; };
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const desc = (el) => { const id = el.getAttribute('data-testid'); const al = el.getAttribute('aria-label'); const t = (el.innerText || el.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 36); return el.tagName.toLowerCase() + (id ? '['+id+']' : '') + (al ? '{'+al.slice(0,28)+'}' : '') + (t ? ' "'+t+'"' : ''); };
  const q = (s) => document.querySelector(s);
  const shell = q('[data-testid="app-shell"]');
  const topbar = q('[data-testid="app-topbar"]');
  const main = q('#main-content');
  const ph = q('[data-testid="main-page-header"]');
  const bnav = q('[data-testid="mobile-navigation-bar"]');
  const nav = shell ? shell.querySelector('nav') : null;
  const out = { iw, ih, coarse, url: location.pathname + location.search, hasShell: !!shell };
  out.topbarH = topbar && vis(topbar) ? R(topbar).h : 0;
  out.banners = [];
  if (shell) { for (const c of shell.children) { if (c === topbar || !vis(c)) continue; if (main && c.contains(main)) break; const r = R(c); if (r.h > 0) out.banners.push({ d: desc(c).slice(0, 90), h: r.h }); } }
  out.mainTop = main ? R(main).y : 0;
  out.pageHeaderH = ph && vis(ph) ? R(ph).h : 0;
  out.pageHeaderPos = ph ? getComputedStyle(ph).position : null;
  out.bottomNavTop = bnav && vis(bnav) ? Math.round(bnav.getBoundingClientRect().top) : ih;
  out.bottomNavH = bnav && vis(bnav) ? R(bnav).h : 0;
  out.fixed = [];
  for (const el of document.body.querySelectorAll('*')) { const cs = getComputedStyle(el); if (cs.position !== 'fixed' || !vis(el)) continue; const r = R(el); if (r.w < 8 || r.h < 8) continue; if (r.w >= iw - 2 && r.h >= ih - 2) continue; out.fixed.push({ d: desc(el).slice(0,70), ...r }); }
  out.fixed = out.fixed.slice(0, 12);
  const contentTop = out.mainTop + (out.pageHeaderPos === 'sticky' ? out.pageHeaderH : 0);
  out.contentViewportPx = Math.max(0, out.bottomNavTop - contentTop);
  out.contentViewportPct = Math.round(100 * out.contentViewportPx / ih);
  out.chromeTopPx = contentTop;
  if (main) {
    out.mainW = main.clientWidth; out.mainScrollH = main.scrollHeight; out.mainClientH = main.clientHeight;
    const kids = [...main.children].filter(vis);
    out.mainStack = kids.slice(0, 7).map((k) => ({ d: desc(k).slice(0, 70), ...R(k) }));
    out.contentColW = kids.length ? Math.max(...kids.map((k) => Math.round(k.getBoundingClientRect().width))) : 0;
    const cs = getComputedStyle(main); out.mainPadX = [cs.paddingLeft, cs.paddingRight].join('/');
  }
  out.sidebarW = nav && vis(nav) ? R(nav).w : 0;
  out.docOverflowX = document.documentElement.scrollWidth > iw + 1;
  const mainRight = main ? main.getBoundingClientRect().right : iw;
  const inScroller = (el) => { let p = el.parentElement; while (p && p !== main) { const cs = getComputedStyle(p); if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return p; p = p.parentElement; } return null; };
  out.clippedRight = []; out.hScrollers = [];
  const seenScroll = new Set();
  if (main) for (const el of main.querySelectorAll('*')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.right > mainRight + 1 && r.left < mainRight - 1) { const s = inScroller(el); if (s) { if (!seenScroll.has(s)) { seenScroll.add(s); out.hScrollers.push({ d: desc(s).slice(0,60), sw: s.scrollWidth, cw: s.clientWidth }); } } else out.clippedRight.push(desc(el).slice(0,60) + ' r=' + Math.round(r.right)); } }
  out.clippedRightCount = out.clippedRight.length;
  out.clippedRight = [...new Set(out.clippedRight)].slice(0, 8);
  out.hScrollers = out.hScrollers.slice(0, 6);
  out.truncated = [];
  const tw = document.createTreeWalker(main || document.body, NodeFilter.SHOW_TEXT);
  const fontSizes = {}; let tiny = 0, small = 0, textNodes = 0; const longLines = []; const seenEl = new Set(); let truncN = 0;
  while (tw.nextNode()) {
    const n = tw.currentNode; const txt = n.textContent.trim(); if (!txt) continue;
    const el = n.parentElement; if (!el || seenEl.has(el) || !vis(el)) continue; seenEl.add(el);
    const cs = getComputedStyle(el); const fz = Math.round(parseFloat(cs.fontSize) * 2) / 2;
    fontSizes[fz] = (fontSizes[fz] || 0) + 1; textNodes++;
    if (fz < 11) tiny++; else if (fz < 12) small++;
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && (cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis')) { truncN++; out.truncated.push('"' + txt.slice(0, 38) + '" ' + el.clientWidth + '/' + el.scrollWidth); }
    const w = el.getBoundingClientRect().width;
    if (txt.length > 90 && cs.display !== 'inline') { const cpl = Math.round(w / (parseFloat(cs.fontSize) * 0.5)); if (cpl > 95) longLines.push({ t: txt.slice(0, 36), cpl, w: Math.round(w) }); }
  }
  out.fontSizes = fontSizes; out.distinctFontSizes = Object.keys(fontSizes).length; out.tinyText = tiny; out.smallText = small; out.textNodes = textNodes;
  out.truncatedCount = truncN; out.truncated = [...new Set(out.truncated)].slice(0, 10);
  out.longLines = longLines.sort((a, b) => b.cpl - a.cpl).slice(0, 4);
  const INTER = 'a[href], button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"], input:not([type="hidden"]), select, textarea, [tabindex="0"]';
  const all = [...document.querySelectorAll(INTER)].filter(vis);
  const hitExempt = (el) => el.classList.contains('MuiButtonBase-root') && !el.matches('.MuiMenuItem-root, .MuiListItemButton-root, .MuiTab-root, .MuiAccordionSummary-root, .MuiToggleButton-root, .MuiBottomNavigationAction-root, .MuiCardActionArea-root, [data-no-hit-area]');
  out.interactiveInMain = main ? all.filter((e) => main.contains(e)).length : 0;
  out.interactiveTotal = all.length;
  out.small44 = []; out.small24 = []; let s44 = 0, s24 = 0;
  for (const el of all) {
    if (el.parentElement && el.parentElement.closest(INTER)) continue;
    // Skip-to-content links sit off-screen until focused — not a resting target.
    if (el.matches('a[data-testid="skip-to-content"], a[href="#main-content"]')) continue;
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) continue;
    // A text field / select is the whole field box (clicking its padding focuses it), not the
    // bare <input> / select <div> inside it — measuring the inner node reported 40px fields as 22px.
    const field = el.closest('.MuiInputBase-root');
    const r = (field || el).getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const ex = coarse && hitExempt(el);
    const m = Math.min(ex ? Math.max(r.width, 44) : r.width, ex ? Math.max(r.height, 44) : r.height);
    const label = desc(el).slice(0, 56) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
    if (m < 24) { s24++; out.small24.push(label); } else if (m < 44) { s44++; out.small44.push(label); }
  }
  out.small24Count = s24; out.small44Count = s44;
  out.small24 = [...new Set(out.small24)].slice(0, 12); out.small44 = [...new Set(out.small44)].slice(0, 12);
  out.inputsUnder16 = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select')].filter(vis).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => desc(e).slice(0, 44) + ' ' + getComputedStyle(e).fontSize).slice(0, 6);
  out.containedAboveFold = [...document.querySelectorAll('.MuiButton-contained')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.top < ih && r.bottom > 0; }).map((e) => (e.innerText || '').trim().slice(0, 28));
  out.h1 = [...document.querySelectorAll('h1')].filter(vis).map((h) => h.innerText.trim().slice(0, 50));
  out.navActive = [...document.querySelectorAll('[aria-current="page"]')].filter(vis).map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 40));
  out.skeletons = [...document.querySelectorAll('.MuiSkeleton-root')].filter(vis).length;
  out.dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="presentation"].MuiModal-root')].filter(vis).map((d) => desc(d).slice(0, 80));
  const pa = q('.pageAction'); out.pageAction = pa && vis(pa) ? R(pa) : null;
  out.footer = !!q('footer');
  out.bodyStart = (document.body.innerText || '').slice(0, 160).replace(/\\s+/g, ' ');
  out.gateway = /Bad gateway|Application error|Something went wrong|Error code 5/.test((document.body.innerText || '').slice(0, 1500));
  return out;
})()`;

const BOTTOM = `(() => {
  const main = document.querySelector('#main-content'); const bnav = document.querySelector('[data-testid="mobile-navigation-bar"]');
  if (!main) return null;
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden') return false; const r = el.getBoundingClientRect(); return r.width>0 && r.height>0; };
  let maxBottom = 0;
  for (const el of main.querySelectorAll('*')) { if (!vis(el) || el.children.length) continue; const r = el.getBoundingClientRect(); if (r.bottom > maxBottom && r.top < innerHeight) maxBottom = r.bottom; }
  const navTop = bnav && vis(bnav) ? bnav.getBoundingClientRect().top : innerHeight;
  return { lastContentBottom: Math.round(maxBottom), bottomNavTop: Math.round(navTop), gap: Math.round(navTop - maxBottom) };
})()`;

// ---------------------------------------------------------------- helpers
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const launchers = {};
async function getBrowser(engine) {
  if (!launchers[engine]) {
    launchers[engine] =
      engine === "webkit"
        ? await webkit.launch()
        : await chromium.launch({
            executablePath:
              process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH ||
              "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell",
          });
  }
  return launchers[engine];
}
const API_RX = /^https?:\/\/(localhost:3000|[^/]+\.preview\.emergentagent\.com)\/api\//;

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  // let skeletons resolve (cap 8s)
  for (let i = 0; i < 16; i++) {
    const sk = await page.locator(".MuiSkeleton-root:visible").count().catch(() => 0);
    if (!sk) break;
    await wait(500);
  }
  await wait(900);
}

async function closeOverlays(page) {
  for (let i = 0; i < 3; i++) {
    const open = await page.locator('[role="dialog"]:visible, [role="presentation"].MuiModal-root:visible').count().catch(() => 0);
    if (!open) return;
    await page.keyboard.press("Escape").catch(() => {});
    await wait(350);
  }
}

async function shot(page, devId, name) {
  const p = `${OUT}/${devId}/${name}.jpg`;
  await page.screenshot({ path: p, fullPage: false, type: "jpeg", quality: 55 }).catch((e) => console.log("   shot fail", name, e.message.slice(0, 80)));
  return p.replace(OUT + "/", "");
}

// ---------------------------------------------------------------- main
const devIds = args.devices ? args.devices.split(",") : Object.keys(DEVICES);
const PAGE_SET = args.extra === "1" ? EXTRA_PAGES : PAGES;
const pages = args.pages ? PAGE_SET.filter(([id]) => args.pages.split(",").includes(id)) : PAGE_SET;

for (const devId of devIds) {
  const dev = DEVICES[devId];
  if (!dev) { console.log("unknown device", devId); continue; }
  const tag = THEME === "dark" ? `${devId}-dark` : devId;
  fs.mkdirSync(`${OUT}/${tag}`, { recursive: true });
  const browser = await getBrowser(dev.engine);
  const ctx = await browser.newContext({ ...dev.ctx, colorScheme: THEME, locale: "en-US", timezoneId: "America/New_York" });
  const blocked = new Set();
  await ctx.route((url) => API_RX.test(url.href), async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.pathname.startsWith("/api/auth/")) return route.continue();
    const m = req.method();
    // Verified read-only POST endpoints (no DB writes in their controllers).
    const READ_POSTS = [/^\/api\/wallet\/getAllTransactions$/];
    if (!["GET", "HEAD", "OPTIONS"].includes(m) && !READ_POSTS.some((rx) => rx.test(u.pathname))) {
      blocked.add(`${m} ${u.pathname}`);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, message: "ux-audit mock (write blocked)", data: {} }) });
    }
    if (u.host.startsWith("localhost:3000")) return route.continue({ url: API + u.pathname + u.search });
    // absolute preview-host call (NEXT_PUBLIC_SERVER_URL) → local backend with permissive CORS
    try {
      const resp = await route.fetch({ url: API + u.pathname + u.search });
      const headers = { ...resp.headers(), "access-control-allow-origin": BASE, "access-control-allow-credentials": "true" };
      return route.fulfill({ response: resp, headers });
    } catch {
      return route.abort();
    }
  });
  await ctx.addInitScript(({ token, theme }) => {
    try {
      localStorage.setItem("token", token);
      localStorage.setItem("last_company_id", "1");
      localStorage.setItem("auth_persistent", "1");
      localStorage.setItem("dyno-theme", theme);
      localStorage.setItem("dynopay_lang_onboarded", "1");
      localStorage.setItem("cookie_consent", "accepted");
      document.cookie = `dyno-theme=${theme}; path=/`;
      sessionStorage.setItem("mfa_interstitial_seen", "1");
    } catch {}
  }, { token: TOKEN, theme: THEME });

  const page = await ctx.newPage();
  const results = { device: devId, theme: THEME, cls: dev.cls, engine: dev.engine, viewport: dev.ctx.viewport, ua: dev.ctx.userAgent || DESKTOP_UA, pages: {}, overlays: {}, firstVisit: null };
  let errors = [], apiErr = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push("console: " + msg.text().slice(0, 140)); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/")) apiErr.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname.slice(0, 90)}`); });

  for (let pi = 0; pi < pages.length; pi++) {
    const [id, path] = pages[pi];
    errors = []; apiErr = [];
    const t0 = Date.now();
    try {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
      await settle(page);
      const loadMs = Date.now() - t0;
      if (pi === 0 && !results.firstVisit) {
        // First visit on a fresh device: record the interruption stack before dismissing it.
        const fv = await page.evaluate(AUDIT);
        results.firstVisit = { page: id, dialogs: fv.dialogs, banners: fv.banners, mainStack: fv.mainStack, fixed: fv.fixed, shot: await shot(page, tag, `${id}__first-visit`) };
        await closeOverlays(page);
        await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
        await settle(page);
      }
      await closeOverlays(page);
      const a = await page.evaluate(AUDIT);
      a.loadMs = loadMs;
      a.shotFold = await shot(page, tag, `${id}__fold`);
      // scroll one viewport down inside the app's scroll container (pinned header / chrome behaviour)
      const scrollable = await page.evaluate(() => { const m = document.querySelector("#main-content"); if (!m) return false; const can = m.scrollHeight > m.clientHeight + 40; if (can) m.scrollTop = Math.round(m.clientHeight * 0.85); return can; });
      if (scrollable) {
        await wait(500);
        a.shotScrolled = await shot(page, tag, `${id}__scrolled`);
        if (dev.cls === "phone") {
          await page.evaluate(() => { const m = document.querySelector("#main-content"); m.scrollTop = m.scrollHeight; });
          await wait(500);
          a.bottom = await page.evaluate(BOTTOM);
          a.shotBottom = await shot(page, tag, `${id}__bottom`);
        }
      }
      a.errors = [...new Set(errors)].slice(0, 5);
      a.apiErr = [...new Set(apiErr)].slice(0, 6);
      results.pages[id] = { path, ...a };
      const flags = [
        a.gateway && "GATEWAY",
        !a.hasShell && "NO-SHELL",
        a.docOverflowX && "DOC-OVERFLOW-X",
        a.clippedRightCount && `CLIPPED-RIGHT=${a.clippedRightCount}`,
        a.hScrollers.length && `HSCROLL=${a.hScrollers.length}`,
        a.truncatedCount && `trunc=${a.truncatedCount}`,
        a.small24Count && `tap<24=${a.small24Count}`,
        dev.cls !== "desktop" && a.small44Count && `tap<44=${a.small44Count}`,
        a.inputsUnder16.length && dev.cls !== "desktop" && `iosZoom=${a.inputsUnder16.length}`,
        a.errors.length && `JSERR=${a.errors.length}`,
        a.apiErr.length && `API=${a.apiErr.join(" | ").slice(0, 120)}`,
      ].filter(Boolean);
      console.log(`${devId}${THEME === "dark" ? "(dark)" : ""} ${id} ${a.url !== path ? "→" + a.url + " " : ""}${loadMs}ms chromeTop=${a.chromeTopPx} content=${a.contentViewportPct}% fs=${a.distinctFontSizes} ${flags.join(" ; ")}`);
    } catch (e) {
      console.log(`XX ${devId} ${id} ${String(e.message).slice(0, 140)}`);
      results.pages[id] = { path, error: String(e.message).slice(0, 200) };
    }
    await wait(DELAY);
  }

  // ------------------------------------------------------------ shell overlays (on /dashboard)
  if (OVERLAYS && THEME === "light") {
    try {
      await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded", timeout: 90000 });
      await settle(page);
      await closeOverlays(page);
      const vw = dev.ctx.viewport.width;
      const tryOverlay = async (name, selector, measure) => {
        const loc = page.locator(selector).first();
        if (!(await loc.count()) || !(await loc.isVisible().catch(() => false))) { results.overlays[name] = { missing: selector }; return; }
        await loc.click({ timeout: 5000 }).catch(() => {});
        await wait(1800);
        const m = measure ? await page.evaluate(measure).catch(() => null) : null;
        results.overlays[name] = { shot: await shot(page, tag, `overlay__${name}`), m };
        await page.keyboard.press("Escape").catch(() => {});
        await wait(400);
        await closeOverlays(page);
      };
      const MEASURE_DRAWER = `(() => { const d = document.querySelector('[data-testid="mobile-nav-drawer"] .MuiDrawer-paper'); if (!d) return null; const r = d.getBoundingClientRect(); const items = d.querySelectorAll('[data-testid^="sidebar-item-"]').length; const sc = [...d.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY === 'auto'); return { w: Math.round(r.width), h: Math.round(r.height), items, innerScroll: sc ? { sh: sc.scrollHeight, ch: sc.clientHeight } : null }; })()`;
      const MEASURE_BNAV = `(() => { const b = document.querySelector('[data-testid="mobile-navigation-bar"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), pct: Math.round(100 * r.height / innerHeight), items: b.querySelectorAll('[data-testid^="mobile-nav-"]').length }; })()`;
      const MEASURE_MORE = `(() => { const d = document.querySelector('[data-testid="mobile-more-sheet"]'); if (!d) return null; const rows = [...d.querySelectorAll('button, a')].filter(e => e.getBoundingClientRect().width > 0); const clipped = rows.filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).length; const small = rows.filter(e => e.getBoundingClientRect().height < 44 && e.tagName !== 'A').length; return { rows: rows.length, clipped, small, h: Math.round(d.getBoundingClientRect().height) }; })()`;
      if (vw < 600) {
        await tryOverlay("bottom-more", '[data-testid="mobile-nav-more"]', MEASURE_MORE);
        await tryOverlay("create", '[data-testid="mobile-nav-create-slot"] button');
      } else {
        await tryOverlay("create", '[data-testid="header-create-new"]');
        await tryOverlay("search", '[data-testid="header-global-search"]');
        await tryOverlay("company", '[data-testid="company-selector-trigger"]');
      }
      await tryOverlay("user-menu", '[data-testid="user-menu-trigger"]');
    } catch (e) {
      console.log(`XX overlays ${devId} ${String(e.message).slice(0, 120)}`);
    }
  }
  // ------------------------------------------------------------ row → detail drawers
  if (args.drawers === "1") {
    for (const [name, path, sel] of DRAWERS) {
      try {
        await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
        await settle(page);
        await closeOverlays(page);
        const row = page.locator(sel).first();
        if (!(await row.count())) { results.overlays[name] = { missing: sel }; continue; }
        await row.click({ timeout: 5000, position: { x: 40, y: 20 } }).catch(() => {});
        await wait(1200);
        const m = await page.evaluate(`(() => { const d = [...document.querySelectorAll('.MuiDrawer-paper, [role="dialog"]')].find(e => e.getBoundingClientRect().width > 0); if (!d) return { url: location.pathname + location.search }; const r = d.getBoundingClientRect(); return { url: location.pathname + location.search, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), sh: d.scrollHeight }; })()`);
        results.overlays[name] = { shot: await shot(page, tag, `overlay__${name}`), m };
        console.log(`${devId} drawer ${name} ${JSON.stringify(m)}`);
      } catch (e) {
        console.log(`XX drawer ${devId} ${name} ${String(e.message).slice(0, 100)}`);
      }
    }
  }
  results.blockedWrites = [...blocked];
  const resFile = args.extra === "1" || args.drawers === "1" ? `results_extra.json` : `results.json`;
  fs.writeFileSync(`${OUT}/${tag}/${resFile}`, JSON.stringify(results, null, 1));
  console.log(`== ${tag} done; blocked writes: ${[...blocked].join(", ") || "none"}`);
  await ctx.close();
}
for (const b of Object.values(launchers)) await b.close();
