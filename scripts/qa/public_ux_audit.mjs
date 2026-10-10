// Public-pages UX audit: screenshots (fold + full) + layout/hierarchy/usability metrics
// across desktop / large-screen / tablet / iOS / Android. Runs against the EXTERNAL
// preview host (creator pages canonicalise there). No auth (true public visitor).
import { chromium, webkit, devices } from "playwright";
import fs from "fs";

const BASE = process.env.AUDIT_BASE || "https://vault-setup-21.preview.emergentagent.com";
const OUT = process.env.OUT || "/app/test_reports/public_ux_audit";
fs.mkdirSync(OUT, { recursive: true });

const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const DEVICES = {
  "desktop-1440":      { engine: "chromium", ctx: { viewport: { width: 1440, height: 900 }, userAgent: DESKTOP_UA, deviceScaleFactor: 1 } },
  "desktop-2560":      { engine: "chromium", ctx: { viewport: { width: 2560, height: 1440 }, userAgent: DESKTOP_UA, deviceScaleFactor: 1 } },
  "ipad-pro11-portrait": { engine: "webkit", ctx: devices["iPad Pro 11"] },
  "iphone-15-pro":     { engine: "webkit", ctx: devices["iPhone 15 Pro"] },
  "iphone-se3":        { engine: "webkit", ctx: devices["iPhone SE (3rd gen)"] },
  "pixel-8":           { engine: "chromium", ctx: devices["Pixel 8"] },
  "galaxy-s24":        { engine: "chromium", ctx: devices["Galaxy S24"] },
};

// page id, path, [device ids], fullPage?
const ALL = ["desktop-1440","desktop-2560","ipad-pro11-portrait","iphone-15-pro","iphone-se3","pixel-8","galaxy-s24"];
const CORE = ["desktop-1440","desktop-2560","ipad-pro11-portrait","iphone-15-pro","iphone-se3","pixel-8"];
const LITE = ["desktop-1440","iphone-15-pro","pixel-8"];
const PAGES = [
  ["landing",           "/",                                 ALL],
  ["creator-storefront","/devhub",                           CORE],
  ["product-detail",    "/devhub/p/talk-to-a-developer",     LITE],
  ["checkout-hosted",   "/pay/demo",                         CORE],
  ["checkout-donation", "/pay/donation-demo",                LITE],
  ["pricing-fees",      "/fees",                             LITE],
  ["about",             "/about",                            ["desktop-1440","iphone-15-pro"]],
  ["trust",             "/trust",                            ["desktop-1440","iphone-15-pro"]],
  ["system-status",     "/system-status",                    ["desktop-1440","iphone-15-pro"]],
  ["safedeal",          "/safedeal",                         ["desktop-1440","iphone-15-pro"]],
  ["documentation",     "/documentation",                    ["desktop-1440","iphone-15-pro"]],
];

const METRICS = `(() => {
  const iw = innerWidth, ih = innerHeight;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return false; const r = el.getBoundingClientRect(); return r.width>0 && r.height>0; };
  const desc = (el) => { const id = el.getAttribute('data-testid'); const t = (el.innerText||el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,30); return el.tagName.toLowerCase()+(id?'['+id+']':'')+(t?' "'+t+'"':''); };
  const out = { iw, ih, dpr: devicePixelRatio, coarse };
  // viewport meta (mobile correctness)
  const vm = document.querySelector('meta[name=viewport]'); out.viewportMeta = vm ? vm.getAttribute('content') : null;
  // horizontal overflow / clipping
  const sw = document.documentElement.scrollWidth; out.scrollWidth = sw; out.docOverflowX = sw > iw + 1; out.overflowPx = Math.max(0, sw - iw);
  out.pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  out.folds = +(out.pageHeight / ih).toFixed(1);
  // offenders sticking out past the viewport right edge
  out.clippedRight = []; 
  for (const el of document.body.querySelectorAll('*')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.right > iw + 2 && r.left < iw - 2 && r.width < iw) { out.clippedRight.push(desc(el).slice(0,56)+' r='+Math.round(r.right)); } }
  out.clippedRightCount = out.clippedRight.length; out.clippedRight = [...new Set(out.clippedRight)].slice(0,8);
  // typography
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const fontSizes = {}; let tiny=0, textNodes=0, truncN=0; const longLines=[]; const seen=new Set(); const trunc=[];
  while (tw.nextNode()) { const n=tw.currentNode; const txt=n.textContent.trim(); if(!txt) continue; const el=n.parentElement; if(!el||seen.has(el)||!vis(el)) continue; seen.add(el);
    const cs=getComputedStyle(el); const fz=Math.round(parseFloat(cs.fontSize)*2)/2; fontSizes[fz]=(fontSizes[fz]||0)+1; textNodes++; if(fz<12) tiny++;
    if (el.clientWidth>0 && el.scrollWidth>el.clientWidth+1 && (cs.overflowX==='hidden'||cs.textOverflow==='ellipsis')) { truncN++; trunc.push('"'+txt.slice(0,34)+'" '+el.clientWidth+'/'+el.scrollWidth); }
    const w=el.getBoundingClientRect().width;
    if (txt.length>90 && cs.display!=='inline') { const cpl=Math.round(w/(parseFloat(cs.fontSize)*0.5)); if(cpl>95) longLines.push({t:txt.slice(0,30),cpl,w:Math.round(w)}); }
  }
  out.distinctFontSizes = Object.keys(fontSizes).length; out.fontSizes = fontSizes; out.tinyTextUnder12 = tiny; out.textNodes = textNodes;
  out.truncatedCount = truncN; out.truncated = [...new Set(trunc)].slice(0,8);
  out.longLines = longLines.sort((a,b)=>b.cpl-a.cpl).slice(0,4);
  // headings / hierarchy
  out.h1 = [...document.querySelectorAll('h1')].filter(vis).map(h=>h.innerText.trim().slice(0,60));
  out.h1Count = out.h1.length;
  out.headingOrder = [...document.querySelectorAll('h1,h2,h3')].filter(vis).slice(0,16).map(h=>h.tagName+':'+h.innerText.trim().slice(0,32));
  // tap targets (coarse) < 44
  const INTER='a[href],button,[role=button],[role=link],[role=tab],input:not([type=hidden]),select,textarea,[tabindex="0"]';
  const all=[...document.querySelectorAll(INTER)].filter(vis);
  out.interactiveCount = all.length; out.small44=[]; let s44=0, s24=0; const s24l=[];
  for (const el of all) { if (el.parentElement && el.parentElement.closest(INTER)) continue; const field=el.closest('.MuiInputBase-root'); const r=(field||el).getBoundingClientRect(); if(r.width<2||r.height<2) continue; const m=Math.min(r.width,r.height); const lb=desc(el).slice(0,46)+' '+Math.round(r.width)+'x'+Math.round(r.height); if(m<24){s24++;s24l.push(lb);} else if(m<44){s44++;out.small44.push(lb);} }
  out.small44Count = coarse ? s44 : 0; out.small24Count = s24; out.small44=[...new Set(out.small44)].slice(0,12); out.small24=[...new Set(s24l)].slice(0,8);
  // inputs < 16px => iOS zoom-on-focus
  out.inputsUnder16 = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select')].filter(vis).filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).map(e=>desc(e).slice(0,36)+' '+getComputedStyle(e).fontSize).slice(0,6);
  // primary CTAs above the fold
  out.ctasAboveFold = [...document.querySelectorAll('button,a[href],[role=button]')].filter(vis).filter(e=>{const r=e.getBoundingClientRect();return r.top<ih&&r.bottom>0&&r.width>40;}).map(e=>(e.innerText||'').trim().replace(/\\s+/g,' ').slice(0,24)).filter(Boolean).slice(0,10);
  // fixed/sticky chrome
  out.fixed=[]; for (const el of document.body.querySelectorAll('*')) { const cs=getComputedStyle(el); if((cs.position!=='fixed'&&cs.position!=='sticky')||!vis(el)) continue; const r=el.getBoundingClientRect(); if(r.width<8||r.height<8) continue; if(r.width>=iw-2&&r.height>=ih-2) continue; out.fixed.push(cs.position+' '+desc(el).slice(0,46)+' '+Math.round(r.width)+'x'+Math.round(r.height)); }
  out.fixed=[...new Set(out.fixed)].slice(0,8);
  // images: count + any oversized (natural >> displayed * dpr)
  const imgs=[...document.querySelectorAll('img')].filter(vis); out.imgCount=imgs.length;
  out.oversizedImgs = imgs.filter(i=>i.naturalWidth && i.getBoundingClientRect().width && i.naturalWidth > i.getBoundingClientRect().width*devicePixelRatio*1.5).map(i=>(i.getAttribute('alt')||i.src.split('/').pop()||'').slice(0,24)+' nat='+i.naturalWidth+' disp='+Math.round(i.getBoundingClientRect().width)).slice(0,6);
  out.cookieBanner = !!document.querySelector('[data-testid*=cookie],[class*=cookie],[id*=cookie]');
  out.bodyStart=(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,140);
  out.gateway=/Bad gateway|Application error|Something went wrong|Error code 5|404|not found/i.test((document.body.innerText||'').slice(0,400));
  return out;
})()`;

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const launchers = {};
async function getBrowser(engine) { if (!launchers[engine]) launchers[engine] = engine==='webkit' ? await webkit.launch() : await chromium.launch(); return launchers[engine]; }

const results = {};
for (const devId of ALL) {
  const todo = PAGES.filter(([, , devs]) => devs.includes(devId));
  if (!todo.length) continue;
  const dev = DEVICES[devId];
  const browser = await getBrowser(dev.engine);
  const ctx = await browser.newContext(dev.ctx);
  const page = await ctx.newPage();
  for (const [id, path] of todo) {
    const key = id + "__" + devId;
    try {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      // trigger lazy content
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(()=>{});
      await wait(900);
      await page.evaluate(() => window.scrollTo(0, 0)).catch(()=>{});
      await wait(600);
      const m = await page.evaluate(METRICS).catch((e) => ({ err: String(e).slice(0,120) }));
      results[key] = m;
      await page.screenshot({ path: `${OUT}/${key}__fold.jpg`, type: "jpeg", quality: 45, fullPage: false }).catch(()=>{});
      await page.screenshot({ path: `${OUT}/${key}__full.jpg`, type: "jpeg", quality: 42, fullPage: true }).catch(()=>{});
      const flags = [];
      if (m.docOverflowX) flags.push("H-OVERFLOW+" + m.overflowPx);
      if (m.clippedRightCount) flags.push("CLIP-R=" + m.clippedRightCount);
      if (m.tinyTextUnder12) flags.push("tiny<12=" + m.tinyTextUnder12);
      if (m.small44Count) flags.push("tap<44=" + m.small44Count);
      if (m.inputsUnder16 && m.inputsUnder16.length) flags.push("input<16=" + m.inputsUnder16.length);
      if (m.truncatedCount) flags.push("trunc=" + m.truncatedCount);
      if (m.distinctFontSizes) flags.push("fs=" + m.distinctFontSizes);
      console.log(`${key}  h=${m.pageHeight}(${m.folds}f)  ${flags.join(" ")}`);
    } catch (e) {
      results[key] = { err: String(e).slice(0, 140) };
      console.log(`${key}  ERROR ${String(e).slice(0,80)}`);
    }
  }
  await ctx.close();
}
for (const e of Object.values(launchers)) await e.close();
fs.writeFileSync(`${OUT}/metrics.json`, JSON.stringify(results, null, 2));
console.log("\nDONE -> " + OUT + "/metrics.json");
