// Rebrand visual smoke probe
// node rebrand_probe.mjs <BASE> <TOKEN> <OUT>
import { chromium } from "playwright";
import fs from "node:fs";

const [BASE, TOKEN, OUT = "/tmp/rebrand_out"] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const exe = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/usr/bin/google-chrome";

const routes = ["/dashboard", "/pay-links", "/transactions", "/settings", "/wallet", "/customers"];
const BAD_HEX = ["#4f46e5","#6366f1","#818cf8","#3b82f6","#2563eb","#4338ca","#4c1d95","#5b21b6","#7c3aed","#6d28d9"];
// approximate rgb versions
const badRgb = BAD_HEX.map(h => {
  const n = parseInt(h.slice(1),16); return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
});

async function checkPage(page, route, mode, report) {
  const errors = [];
  page.removeAllListeners("pageerror"); page.removeAllListeners("console");
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type()==="error") errors.push(m.text()); });

  const resp = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 60000 }).catch(e => ({ err: String(e) }));
  await page.waitForTimeout(2500);
  const status = resp && resp.status ? resp.status() : (resp?.err || "unknown");

  // Sample DOM
  const info = await page.evaluate((bad) => {
    const out = {};
    const rgbOf = el => getComputedStyle(el);
    // sidebar nav
    const nav = document.querySelector('nav[aria-label]');
    out.sidebarBg = nav ? getComputedStyle(nav).backgroundColor : null;
    out.sidebarAria = nav ? nav.getAttribute('aria-label') : null;
    // brand cell
    const brandCell = document.querySelector('[data-testid="app-brand-cell"]');
    out.brandCellBg = brandCell ? getComputedStyle(brandCell).backgroundColor : null;
    out.brandCellHTML = brandCell ? brandCell.innerHTML.slice(0,200) : null;
    // brand mark (collapsed)
    out.brandMarkPresent = !!document.querySelector('[data-testid="app-brand-mark"]');
    // active nav
    const active = document.querySelector('nav [aria-current="page"], nav a.active, nav [class*="Mui-selected"]');
    out.activeColor = active ? getComputedStyle(active).color : null;
    // + New button
    const newBtn = Array.from(document.querySelectorAll('button, a')).find(b => /(\+\s*)?new/i.test(b.textContent||""));
    if (newBtn) { const cs = getComputedStyle(newBtn); out.newBtn = { bg: cs.backgroundColor, color: cs.color, text: newBtn.textContent.trim().slice(0,30) }; }
    // canvas bg
    out.bodyBg = getComputedStyle(document.body).backgroundColor;
    out.htmlBg = getComputedStyle(document.documentElement).backgroundColor;
    // scan for bad colors
    const all = document.querySelectorAll("body *");
    const hits = [];
    let scanned = 0;
    for (const el of all) {
      scanned++;
      if (scanned > 2500) break;
      const cs = getComputedStyle(el);
      const props = [cs.color, cs.backgroundColor, cs.borderColor, cs.fill, cs.stroke];
      for (const p of props) {
        if (!p || p === "rgba(0, 0, 0, 0)" || p === "transparent") continue;
        for (const b of bad) {
          if (p.replace(/\s/g,"").includes(b.replace(/\s/g,""))) {
            hits.push({ tag: el.tagName, testid: el.getAttribute('data-testid')||null, cls: (el.className+"").slice(0,60), prop: p, match: b });
            break;
          }
        }
        if (hits.length > 20) break;
      }
      if (hits.length > 20) break;
    }
    out.badColorHits = hits;
    // white-on-yellow scan: look for elements with color rgb(255,255,255) and backgroundColor containing yellow-ish (r>240,g>190,b<80)
    const wonyel = [];
    for (const el of all) {
      const cs = getComputedStyle(el);
      const c = cs.color, bg = cs.backgroundColor;
      if (c === "rgb(255, 255, 255)" && bg && bg.startsWith("rgb")) {
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
          const [r,g,b] = [+m[1],+m[2],+m[3]];
          if (r>230 && g>180 && b<100) wonyel.push({ tag: el.tagName, testid: el.getAttribute('data-testid')||null, cls: (el.className+"").slice(0,60), bg, text: (el.textContent||"").trim().slice(0,40) });
        }
      }
      if (wonyel.length > 10) break;
    }
    out.whiteOnYellow = wonyel;
    return out;
  }, badRgb);

  report.push({ route, mode, status, errors, info });
  try { await page.screenshot({ path: `${OUT}/${route.replace(/[^a-z0-9]/gi,'_')}_${mode}.jpg`, type:"jpeg", quality: 45 }); } catch {}
}

const browser = await chromium.launch({ executablePath: exe, args:["--no-sandbox"] });
const report = [];

for (const mode of ["light","dark"]) {
  const ctx = await browser.newContext({ viewport:{width:1600,height:900}, colorScheme: mode });
  const page = await ctx.newPage();
  // Auth page first (no token)
  await page.goto(`${BASE}/auth/login`, { waitUntil:"domcontentloaded", timeout:60000 });
  await page.evaluate(([t,m])=>{
    if (t && t!=="-") localStorage.setItem("token", t);
    sessionStorage.setItem("mfa_interstitial_seen","1");
    localStorage.setItem("theme-mode-inapp", m);
    localStorage.setItem("theme-mode-public", m);
    localStorage.setItem("theme-mode", m);
    document.cookie = `theme-mode-inapp=${m}; path=/`;
  }, [TOKEN, mode]);
  await page.waitForTimeout(500);
  // Check auth login (log out state) — reload without token first
  await page.evaluate(()=>localStorage.removeItem("token"));
  await page.goto(`${BASE}/auth/login`, { waitUntil:"networkidle", timeout:60000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  const authInfo = await page.evaluate(()=>{
    const logo = document.querySelector('[data-testid="auth-shell-logo"]');
    const submit = document.querySelector('button[type="submit"]');
    const body = getComputedStyle(document.body);
    const toggle = document.querySelector('[data-testid="auth-header-controls"] button, [data-testid="auth-header-controls"] [role="button"]');
    return {
      logoPresent: !!logo,
      logoHTML: logo? logo.innerHTML.slice(0,200): null,
      submitBg: submit? getComputedStyle(submit).backgroundColor : null,
      submitColor: submit? getComputedStyle(submit).color : null,
      submitText: submit? submit.textContent.trim().slice(0,30): null,
      bodyBg: body.backgroundColor,
      toggleFound: !!toggle,
    };
  });
  report.push({ route: "/auth/login", mode, authInfo });
  try { await page.screenshot({ path:`${OUT}/auth_login_${mode}.jpg`, type:"jpeg", quality:45 }); } catch {}

  // Restore token
  await page.evaluate((t)=>{ if(t && t!=="-") localStorage.setItem("token", t); }, TOKEN);

  for (const r of routes) {
    await checkPage(page, r, mode, report);
  }

  // Favicon assets (only once)
  if (mode === "light") {
    const assets = ["/favicon.svg","/favicon.ico","/apple-touch-icon.png","/site.webmanifest"];
    const assetResults = {};
    for (const a of assets) {
      const r = await page.goto(`${BASE}${a}`, { waitUntil:"domcontentloaded", timeout:30000 }).catch(e=>({err:String(e)}));
      assetResults[a] = r && r.status ? r.status() : (r?.err||"unknown");
      if (a === "/site.webmanifest" && r && r.status && r.status() === 200) {
        try { assetResults[a+"_body"] = (await r.text()).slice(0,400); } catch {}
      }
    }
    report.push({ assets: assetResults });
  }

  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
