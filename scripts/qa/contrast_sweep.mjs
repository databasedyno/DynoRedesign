// White-on-gold contrast sweep + brand colour leftovers, across public / checkout / in-app / admin routes.
//   PLAYWRIGHT_CHROME_EXECUTABLE_PATH=... node scripts/qa/contrast_sweep.mjs --base=<url> [--token=<merchant jwt>] [--admin=<admin jwt>] [--mode=light|dark] [--out=memory/reports]
// Flags any element whose EFFECTIVE background (walking up ancestors, incl. gradients) is yellow/gold while its
// text colour / SVG fill is near-white (or the WCAG contrast is < 2.0). Also lists indigo/blue brand leftovers.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "1"]; }));
const BASE = (args.base || "").replace(/\/+$/, "");
const MODE = args.mode || "light";
const OUT = path.resolve(args.out || "memory/reports");
fs.mkdirSync(OUT, { recursive: true });

const PUBLIC = ["/", "/fees", "/documentation", "/about", "/press", "/blog", "/how-to", "/referral-program", "/system-status", "/help-support", "/for/creators", "/for/ecommerce", "/auth/login", "/auth/register", "/pay/demo", "/pay/donation-demo", "/pay?d=rNtQRX", "/receipt/oN7U2knyNnaQ3NBrfNXL3F", "/devhub", "/devhub/shop", "/safedeal", "/safedeal/signin", "/safedeal/deals/new"];
const INAPP = ["/dashboard", "/pay-links", "/create-pay-link", "/transactions", "/invoices", "/wallet", "/payouts", "/customers", "/brands", "/storefront", "/settings", "/profile", "/notifications", "/developer-keys", "/referrals", "/get-started", "/help-support/getting-started-with-dynopay"];
const ADMIN = ["/admin", "/admin/merchants", "/admin/transactions", "/admin/escrow", "/admin/support"];

const SCAN = `(() => {
  const parse = (c) => { const m = c && c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/); if (!m) return null; return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }; };
  const hsl = (p) => { let r = p.r / 255, g = p.g / 255, b = p.b / 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2; if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; default: h = (r - g) / d + 4; } h *= 60; } return [h, s, l]; };
  const lum = (p) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(p.r) + 0.7152 * f(p.g) + 0.0722 * f(p.b); };
  const contrast = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const isGold = (p) => { if (!p || p.a < 0.75) return false; const [h, s, l] = hsl(p); return h >= 38 && h <= 58 && s > 0.75 && l > 0.42 && l < 0.68; };
  const isBlueBrand = (p) => { if (!p || p.a < 0.4) return false; const [h, s, l] = hsl(p); return h >= 215 && h <= 265 && s > 0.35 && l > 0.2 && l < 0.85; };
  const gradColors = (bgImg) => (bgImg && bgImg !== 'none' ? (bgImg.match(/rgba?\\([^)]*\\)/g) || []).map(parse).filter(Boolean) : []);
  // Effective background: nearest ancestor (incl. self) with an opaque-ish bg colour or a gradient.
  const effBg = (el) => { let n = el; while (n && n !== document.documentElement) { const cs = getComputedStyle(n); const p = parse(cs.backgroundColor); if (p && p.a >= 0.75) return { color: p, via: n }; const g = gradColors(cs.backgroundImage); if (g.length) return { color: g[0], colors: g, via: n }; n = n.parentElement; } return { color: { r: 255, g: 255, b: 255, a: 1 }, via: document.body }; };
  const desc = (el) => { const t = el.getAttribute && el.getAttribute('data-testid'); const cls = typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''; const txt = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40); return el.tagName.toLowerCase() + (t ? '[testid=' + t + ']' : '') + (cls ? '.' + cls : '') + (txt ? ' "' + txt + '"' : ''); };
  const excluded = (el) => !!el.closest('[data-merchant-branded], [data-coin-icon], iframe, .recharts-wrapper, video, canvas, [data-testid="storefront-live-preview"]');
  const whiteOnGold = [], lowContrast = [], blue = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'IMG' || el.tagName === 'NEXTJS-PORTAL') continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    if (excluded(el)) continue;
    const isSvg = el instanceof SVGElement;
    const hasOwnText = !isSvg && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length);
    const isSvgRoot = el.tagName.toLowerCase() === 'svg';
    if (!hasOwnText && !isSvgRoot) continue;
    const bg = effBg(el);
    const golds = (bg.colors || [bg.color]).filter(isGold);
    let fg = parse(cs.color);
    if (isSvgRoot) { const fill = cs.fill && cs.fill !== 'none' ? parse(cs.fill) : null; const path = el.querySelector('path,rect,circle'); const pf = path ? parse(getComputedStyle(path).fill) : null; fg = (pf && pf.a > 0) ? pf : (fill || fg); }
    if (!fg || fg.a < 0.5) continue;
    if (golds.length) {
      const c = Math.min(...golds.map((g) => contrast(fg, g)));
      const key = desc(el) + '|' + cs.color;
      if (seen.has(key)) continue; seen.add(key);
      if (fg.r > 225 && fg.g > 225 && fg.b > 225) whiteOnGold.push({ el: desc(el), fg: cs.color, bg: JSON.stringify(golds[0]), via: desc(bg.via), contrast: +c.toFixed(2) });
      else if (c < 2.0) lowContrast.push({ el: desc(el), fg: cs.color, bg: JSON.stringify(golds[0]), via: desc(bg.via), contrast: +c.toFixed(2) });
    }
    const bgp = parse(cs.backgroundColor);
    if (isBlueBrand(bgp) && !el.closest('svg')) blue.push({ prop: 'background', value: cs.backgroundColor, el: desc(el) });
    if (hasOwnText && isBlueBrand(fg)) blue.push({ prop: 'color', value: cs.color, el: desc(el) });
  }
  return { whiteOnGold: whiteOnGold.slice(0, 40), lowContrast: lowContrast.slice(0, 40), blue: blue.slice(0, 30), title: document.title, url: location.pathname + location.search };
})()`;

const exe = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: MODE === "dark" ? "dark" : "light" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push({ url: page.url(), text: "PAGEERROR " + String(e).slice(0, 200) }));

await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.evaluate(([t, a, m]) => {
  if (t) localStorage.setItem("token", t);
  if (a) localStorage.setItem("admin_token", a);
  sessionStorage.setItem("mfa_interstitial_seen", "1");
  localStorage.setItem("theme-mode-inapp", m);
  localStorage.setItem("theme-mode-public", m);
  document.cookie = `theme-mode-inapp=${m}; path=/`;
  document.cookie = `theme-mode-public=${m}; path=/`;
}, [args.token || "", args.admin || "", MODE]);

const routes = args.routes ? args.routes.split(",") : [...PUBLIC, ...(args.token ? INAPP : []), ...(args.admin ? ADMIN : [])];
const TAG = args.tag ? `_${args.tag}` : "";
const results = [];
for (const r of routes) {
  const t0 = Date.now();
  const resp = await page.goto(`${BASE}${r}`, { waitUntil: "load", timeout: 120000 }).catch((e) => ({ status: () => "nav-error " + String(e.message).slice(0, 60) }));
  await page.waitForTimeout(r === "/" ? 4500 : 2500);
  // Scroll through so lazy sections mount, then back to top.
  await page.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((res) => setTimeout(res, 120)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(600);
  const scan = await page.evaluate(SCAN);
  const name = r.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "root";
  await page.screenshot({ path: `${OUT}/shot_${name}_${MODE}.jpg`, type: "jpeg", quality: 45 });
  const status = typeof resp.status === "function" ? resp.status() : "?";
  results.push({ route: r, status, ...scan, ms: Date.now() - t0 });
  console.log(MODE, r, "status", status, "white/gold", scan.whiteOnGold.length, "low", scan.lowContrast.length, "blue", scan.blue.length);
  fs.writeFileSync(`${OUT}/contrast_${MODE}${TAG}.json`, JSON.stringify({ mode: MODE, base: BASE, results, errors }, null, 2));
}
await browser.close();
const flagged = results.filter((x) => x.whiteOnGold.length || x.lowContrast.length || x.blue.length);
console.log("\n=== FLAGGED ROUTES:", flagged.length);
for (const f of flagged) {
  console.log("--", f.route);
  for (const w of f.whiteOnGold) console.log("   WHITE-ON-GOLD", w.el, "fg", w.fg, "via", w.via, "c", w.contrast);
  for (const w of f.lowContrast) console.log("   LOW-CONTRAST ", w.el, "fg", w.fg, "via", w.via, "c", w.contrast);
  for (const b of f.blue) console.log("   BLUE", b.prop, b.value, b.el);
}
console.log("report:", `${OUT}/contrast_${MODE}${TAG}.json`);
