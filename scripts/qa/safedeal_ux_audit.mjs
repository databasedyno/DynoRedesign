// SafeDeal UX audit: screenshots (fold + full) + layout/hierarchy/usability metrics across
// desktop / large-screen / tablet / iOS / Android, guest + signed-in (buyer & seller), light + dark.
// Usage: AUDIT_BASE=<host> IDS=/app/memory/tmp/sd_audit/identities.json node scripts/qa/safedeal_ux_audit.mjs
import { chromium, webkit, devices } from "playwright";
import fs from "fs";

const BASE = process.env.AUDIT_BASE || "https://a81d8386-57ce-4f3b-b71d-dfd38e2158f0.preview.emergentagent.com";
const OUT = process.env.OUT || "/app/test_reports/safedeal_ux_audit";
const IDS = JSON.parse(fs.readFileSync(process.env.IDS || "/app/memory/tmp/sd_audit/identities.json", "utf8"));
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
fs.mkdirSync(OUT, { recursive: true });

const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const DEVICES = {
  "desktop-1440": { engine: "chromium", ctx: { viewport: { width: 1440, height: 900 }, userAgent: DESKTOP_UA, deviceScaleFactor: 1 } },
  "desktop-1920": { engine: "chromium", ctx: { viewport: { width: 1920, height: 1080 }, userAgent: DESKTOP_UA, deviceScaleFactor: 1 } },
  "desktop-2560": { engine: "chromium", ctx: { viewport: { width: 2560, height: 1440 }, userAgent: DESKTOP_UA, deviceScaleFactor: 1 } },
  "ipad-pro11-portrait": { engine: "webkit", ctx: devices["iPad Pro 11"] },
  "ipad-pro11-landscape": { engine: "webkit", ctx: devices["iPad Pro 11 landscape"] },
  "iphone-15-pro": { engine: "webkit", ctx: devices["iPhone 15 Pro"] },
  "iphone-se3": { engine: "webkit", ctx: devices["iPhone SE (3rd gen)"] },
  "pixel-8": { engine: "chromium", ctx: devices["Pixel 8"] },
  "android-360": { engine: "chromium", ctx: { viewport: { width: 360, height: 800 }, userAgent: ANDROID_UA, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
};
const ALL = Object.keys(DEVICES);
const CORE = ["desktop-1440", "desktop-2560", "ipad-pro11-portrait", "iphone-15-pro", "iphone-se3", "pixel-8", "android-360"];
const LITE = ["desktop-1440", "iphone-15-pro", "android-360"];
const MIN = ["desktop-1440", "iphone-15-pro"];

const tA = IDS.dealA.deal_token, tB = IDS.dealB.deal_token;
// id, path, role (guest|buyer|seller), devices, opts
const PAGES = [
  ["landing", "/safedeal", "guest", ALL],
  ["signin", "/safedeal/signin", "guest", CORE],
  ["signin-invite", `/safedeal/signin?next=/deal/${tB}`, "guest", LITE],
  ["deal-public-preview", `/safedeal/deal/${tB}`, "guest", LITE],
  ["home", "/safedeal/deals", "buyer", ALL],
  ["new-deal-step1", "/safedeal/deals/new", "buyer", CORE],
  ["new-deal-step2", "/safedeal/deals/new", "buyer", LITE, { fill: true }],
  ["deal-buyer-fund", `/safedeal/deal/${tA}`, "buyer", ALL],
  ["deal-seller-wait", `/safedeal/deal/${tA}`, "seller", LITE],
  ["deal-seller-openseat", `/safedeal/deal/${tB}`, "seller", LITE],
  ["wallet", "/safedeal/wallet", "buyer", CORE],
  ["rewards", "/safedeal/rewards", "buyer", CORE],
  ["help", "/safedeal/help", "guest", LITE],
  ["terms", "/safedeal/terms", "guest", MIN],
  ["landing-dark", "/safedeal", "guest", MIN, { dark: true }],
  ["home-dark", "/safedeal/deals", "buyer", MIN, { dark: true }],
  ["deal-buyer-fund-dark", `/safedeal/deal/${tA}`, "buyer", MIN, { dark: true }],
  ["signin-dark", "/safedeal/signin", "guest", ["iphone-15-pro"], { dark: true }],
];

const METRICS = `(() => {
  const iw = innerWidth, ih = innerHeight;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return false; const r = el.getBoundingClientRect(); return r.width>0 && r.height>0; };
  const desc = (el) => { const id = el.getAttribute('data-testid'); const t = (el.innerText||el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,30); return el.tagName.toLowerCase()+(id?'['+id+']':'')+(t?' "'+t+'"':''); };
  const out = { iw, ih, dpr: devicePixelRatio, coarse, dark: matchMedia('(prefers-color-scheme: dark)').matches };
  const vm = document.querySelector('meta[name=viewport]'); out.viewportMeta = vm ? vm.getAttribute('content') : null;
  out.themeColor = document.querySelector('meta[name=theme-color]')?.getAttribute('content') || null;
  out.manifest = document.querySelector('link[rel=manifest]')?.getAttribute('href') || null;
  out.bodyBg = getComputedStyle(document.body).backgroundColor;
  const sw = document.documentElement.scrollWidth; out.scrollWidth = sw; out.docOverflowX = sw > iw + 1; out.overflowPx = Math.max(0, sw - iw);
  out.pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  out.folds = +(out.pageHeight / ih).toFixed(1);
  out.clippedRight = [];
  for (const el of document.body.querySelectorAll('*')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.right > iw + 2 && r.left < iw - 2 && r.width < iw) { out.clippedRight.push(desc(el).slice(0,56)+' r='+Math.round(r.right)); } }
  out.clippedRightCount = out.clippedRight.length; out.clippedRight = [...new Set(out.clippedRight)].slice(0,8);
  // content column utilisation: widest MuiContainer in main
  const main = document.querySelector('main'); out.mainWidth = main ? Math.round(main.getBoundingClientRect().width) : null;
  const conts = main ? [...main.querySelectorAll('.MuiContainer-root')].filter(vis) : [];
  const widest = conts.reduce((m, c) => Math.max(m, c.getBoundingClientRect().width), 0);
  out.contentColPx = Math.round(widest); out.contentColPct = iw ? Math.round(widest / iw * 100) : null;
  // typography
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const fontSizes = {}; let tiny=0, textNodes=0, truncN=0; const longLines=[]; const seen=new Set(); const trunc=[]; const tinyList=[];
  while (tw.nextNode()) { const n=tw.currentNode; const txt=n.textContent.trim(); if(!txt) continue; const el=n.parentElement; if(!el||seen.has(el)||!vis(el)) continue; seen.add(el);
    const cs=getComputedStyle(el); const fz=Math.round(parseFloat(cs.fontSize)*2)/2; fontSizes[fz]=(fontSizes[fz]||0)+1; textNodes++; if(fz<12){ tiny++; tinyList.push(fz+'px "'+txt.slice(0,28)+'"'); }
    if (el.clientWidth>0 && el.scrollWidth>el.clientWidth+1 && (cs.overflowX==='hidden'||cs.textOverflow==='ellipsis')) { truncN++; trunc.push('"'+txt.slice(0,34)+'" '+el.clientWidth+'/'+el.scrollWidth); }
    const w=el.getBoundingClientRect().width;
    if (txt.length>90 && cs.display!=='inline') { const cpl=Math.round(w/(parseFloat(cs.fontSize)*0.5)); if(cpl>95) longLines.push({t:txt.slice(0,30),cpl,w:Math.round(w)}); }
  }
  out.distinctFontSizes = Object.keys(fontSizes).length; out.fontSizes = fontSizes; out.tinyTextUnder12 = tiny; out.tinyList=[...new Set(tinyList)].slice(0,10); out.textNodes = textNodes;
  out.truncatedCount = truncN; out.truncated = [...new Set(trunc)].slice(0,8);
  out.longLines = longLines.sort((a,b)=>b.cpl-a.cpl).slice(0,4);
  // headings
  out.h1 = [...document.querySelectorAll('h1')].filter(vis).map(h=>h.innerText.trim().slice(0,60));
  out.h1Count = out.h1.length;
  out.headingOrder = [...document.querySelectorAll('h1,h2,h3,h4')].filter(vis).slice(0,20).map(h=>h.tagName+':'+h.innerText.trim().slice(0,32));
  // landmarks
  out.landmarks = { header: !!document.querySelector('header'), nav: document.querySelectorAll('nav').length, main: !!main, footer: !!document.querySelector('footer') };
  // tap targets
  const INTER='a[href],button,[role=button],[role=link],[role=tab],[role=radio],[role=option],input:not([type=hidden]),select,textarea,[tabindex="0"]';
  const all=[...document.querySelectorAll(INTER)].filter(vis);
  out.interactiveCount = all.length; out.small44=[]; let s44=0, s24=0; const s24l=[];
  for (const el of all) { if (el.parentElement && el.parentElement.closest(INTER)) continue; const field=el.closest('.MuiInputBase-root'); const r=(field||el).getBoundingClientRect(); if(r.width<2||r.height<2) continue; const m=Math.min(r.width,r.height); const lb=desc(el).slice(0,46)+' '+Math.round(r.width)+'x'+Math.round(r.height); if(m<24){s24++;s24l.push(lb);} else if(m<44){s44++;out.small44.push(lb);} }
  out.small44Count = coarse ? s44 : 0; out.small24Count = s24; out.small44=[...new Set(out.small44)].slice(0,14); out.small24=[...new Set(s24l)].slice(0,8);
  out.inputsUnder16 = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select')].filter(vis).filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).map(e=>desc(e).slice(0,36)+' '+getComputedStyle(e).fontSize).slice(0,6);
  // CTAs above the fold
  out.ctasAboveFold = [...document.querySelectorAll('button,a[href],[role=button]')].filter(vis).filter(e=>{const r=e.getBoundingClientRect();return r.top<ih&&r.bottom>0&&r.width>40;}).map(e=>(e.innerText||e.getAttribute('aria-label')||'').trim().replace(/\\s+/g,' ').slice(0,24)).filter(Boolean).slice(0,12);
  // fixed / sticky chrome
  out.fixed=[]; for (const el of document.body.querySelectorAll('*')) { const cs=getComputedStyle(el); if((cs.position!=='fixed'&&cs.position!=='sticky')||!vis(el)) continue; const r=el.getBoundingClientRect(); if(r.width<8||r.height<8) continue; if(r.width>=iw-2&&r.height>=ih-2) continue; out.fixed.push(cs.position+' '+desc(el).slice(0,46)+' '+Math.round(r.width)+'x'+Math.round(r.height)+' top='+Math.round(r.top)); }
  out.fixed=[...new Set(out.fixed)].slice(0,8);
  // 100vh usage (iOS URL-bar jump)
  out.vhUsers = [...document.body.querySelectorAll('*')].filter(vis).filter(el=>{const cs=getComputedStyle(el);return /100vh/.test(el.getAttribute('style')||'')||cs.minHeight==='100vh'||cs.height===ih+'px'&&el.tagName!=='HTML';}).length;
  // images
  const imgs=[...document.querySelectorAll('img')].filter(vis); out.imgCount=imgs.length;
  out.imgsNoAlt = imgs.filter(i=>!i.hasAttribute('alt')).length;
  out.bodyStart=(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,160);
  out.gateway=/Bad gateway|Application error|Something went wrong|Error code 5|not found/i.test((document.body.innerText||'').slice(0,400));
  out.skeletons = document.querySelectorAll('.MuiSkeleton-root').length;
  return out;
})()`;

// After scrolling to the bottom: does a fixed bottom bar cover the last content?
const BOTTOM_OVERLAP = `(() => {
  const ih = innerHeight; const vis = (el) => { const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden') return false; const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
  const fixedBottom = [...document.body.querySelectorAll('*')].filter(vis).filter(el=>{const cs=getComputedStyle(el); const r=el.getBoundingClientRect(); return cs.position==='fixed' && r.bottom>=ih-2 && r.height<ih*0.6 && r.width>innerWidth*0.5;});
  if (!fixedBottom.length) return { fixedBottom: 0 };
  const bar = fixedBottom[0]; const br = bar.getBoundingClientRect();
  const covered = [];
  const legal = document.querySelector('[data-testid=sd-footer-legal]'); const links = [...document.querySelectorAll('[data-testid^=sd-footer-]')];
  for (const el of [legal, ...links].filter(Boolean)) { const r = el.getBoundingClientRect(); if (r.bottom > br.top && r.top < br.bottom) covered.push((el.getAttribute('data-testid')||'')+' '+Math.round(r.top)+'-'+Math.round(r.bottom)); }
  return { fixedBottom: fixedBottom.length, barTop: Math.round(br.top), barH: Math.round(br.height), covered, barTestId: bar.getAttribute('data-testid') };
})()`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const launchers = {};
async function getBrowser(engine) {
  if (!launchers[engine]) launchers[engine] = engine === "webkit" ? await webkit.launch() : await chromium.launch({ executablePath: CHROME });
  return launchers[engine];
}

async function fillNewDeal(page) {
  await page.fill('[data-testid=sd-new-title]', "Logo + brand kit design (3 concepts)");
  await page.fill('[data-testid=sd-new-amount]', "320");
  await page.click('[data-testid=sd-new-role-seller]').catch(() => {});
  await wait(900);
  await page.click('[data-testid=sd-new-continue]');
  await wait(900);
  await page.click('[data-testid=sd-new-terms-template]').catch(() => {});
  await wait(500);
}

const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const results = ONLY && fs.existsSync(`${OUT}/metrics.json`) ? JSON.parse(fs.readFileSync(`${OUT}/metrics.json`, "utf8")) : {};
for (const devId of ALL) {
  const todo = PAGES.filter(([id, , , devs]) => devs.includes(devId) && (!ONLY || ONLY.has(id + "__" + devId)));
  if (!todo.length) continue;
  const dev = DEVICES[devId];
  const browser = await getBrowser(dev.engine);
  for (const [id, path, role, , opts = {}] of todo) {
    const key = id + "__" + devId;
    const ctx = await browser.newContext({ ...dev.ctx, colorScheme: opts.dark ? "dark" : "light" });
    if (role !== "guest") {
      const who = IDS[role];
      await ctx.addInitScript(({ token, email, cid }) => {
        localStorage.setItem("sd_token", token);
        localStorage.setItem("sd_user", JSON.stringify({ email, customer_id: cid }));
      }, { token: who.token, email: who.email, cid: who.customer_id });
    }
    const page = await ctx.newPage();
    const consoleErrs = [];
    page.on("pageerror", (e) => consoleErrs.push(String(e.message).slice(0, 120)));
    try {
      // The preview host occasionally serves a bot-check interstitial ("Performing security
      // verification") on the first hit of a fresh context; wait it out and reload (≤3 tries).
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await wait(800);
        const body = await page.evaluate(() => (document.body.innerText || "").slice(0, 300)).catch(() => "");
        const url = page.url();
        const bounced = role !== "guest" && (/\/safedeal\/signin/.test(url) || /^\/safedeal\/?$/.test(new URL(url).pathname));
        if (!/security verification/i.test(body) && !bounced) break;
        await wait(5000);
      }
      if (opts.fill) await fillNewDeal(page);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
      await wait(900);
      const bottom = await page.evaluate(BOTTOM_OVERLAP).catch(() => ({}));
      await page.screenshot({ path: `${OUT}/${key}__bottom.jpg`, type: "jpeg", quality: 40, fullPage: false }).catch(() => {});
      await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
      await wait(600);
      const m = await page.evaluate(METRICS).catch((e) => ({ err: String(e).slice(0, 120) }));
      m.bottom = bottom; m.pageErrors = consoleErrs.slice(0, 4); m.role = role; m.path = path;
      results[key] = m;
      await page.screenshot({ path: `${OUT}/${key}__fold.jpg`, type: "jpeg", quality: 45, fullPage: false }).catch(() => {});
      await page.screenshot({ path: `${OUT}/${key}__full.jpg`, type: "jpeg", quality: 40, fullPage: true }).catch(() => {});
      const flags = [];
      if (m.docOverflowX) flags.push("H-OVERFLOW+" + m.overflowPx);
      if (m.clippedRightCount) flags.push("CLIP-R=" + m.clippedRightCount);
      if (m.tinyTextUnder12) flags.push("tiny<12=" + m.tinyTextUnder12);
      if (m.small44Count) flags.push("tap<44=" + m.small44Count);
      if (m.small24Count) flags.push("tap<24=" + m.small24Count);
      if (m.inputsUnder16 && m.inputsUnder16.length) flags.push("input<16=" + m.inputsUnder16.length);
      if (m.truncatedCount) flags.push("trunc=" + m.truncatedCount);
      if (m.h1Count !== 1) flags.push("h1=" + m.h1Count);
      if (bottom && bottom.covered && bottom.covered.length) flags.push("BAR-COVERS=" + bottom.covered.length);
      if (m.pageErrors.length) flags.push("JS-ERR=" + m.pageErrors.length);
      flags.push("col=" + m.contentColPct + "%", "fs=" + m.distinctFontSizes);
      console.log(`${key}  h=${m.pageHeight}(${m.folds}f)  ${flags.join(" ")}`);
    } catch (e) {
      results[key] = { err: String(e).slice(0, 140), role, path };
      console.log(`${key}  ERROR ${String(e).slice(0, 80)}`);
    }
    await ctx.close();
  }
}
for (const e of Object.values(launchers)) await e.close();
fs.writeFileSync(`${OUT}/metrics.json`, JSON.stringify(results, null, 2));
console.log("\nDONE -> " + OUT + "/metrics.json");
