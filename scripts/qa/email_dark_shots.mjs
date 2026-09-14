// Screenshot email HTML files in three inbox modes:
//   light  — default rendering
//   dark   — prefers-color-scheme: dark (Apple Mail / Outlook / Gmail web honouring the media query)
//   gmail  — Gmail-app style FORCED inversion: light backgrounds darkened, dark text lightened,
//            gradients / images left untouched (this is what broke the "welcome gift" email)
// Usage: PLAYWRIGHT_CHROME_EXECUTABLE_PATH=... node scripts/qa/email_dark_shots.mjs --in=/tmp/email_dark/html --out=/tmp/email_dark/shots
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const IN = arg("in", "/tmp/email_dark/html");
const OUT = arg("out", "/tmp/email_dark/shots");
fs.mkdirSync(OUT, { recursive: true });

// Approximation of Gmail's dark-mode colour transform.
const GMAIL_INVERT = `
(() => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const toHsl = ({ r, g, b }) => { r/=255; g/=255; b/=255; const mx=Math.max(r,g,b), mn=Math.min(r,g,b); let h=0,s=0; const l=(mx+mn)/2; if (mx!==mn){ const d=mx-mn; s=l>0.5?d/(2-mx-mn):d/(mx+mn); switch(mx){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;} h/=6;} return {h,s,l}; };
  const flip = (c) => { const p = parse(c); if (!p || p.a === 0) return null; const {h,s,l} = toHsl(p); const nl = 1 - l; return 'hsl(' + Math.round(h*360) + ',' + Math.round(s*100) + '%,' + Math.round(nl*100) + '%)'; };
  document.querySelectorAll('body, body *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return; // gradients/images: Gmail leaves them
    const bg = parse(cs.backgroundColor);
    if (bg && bg.a > 0) { const {l} = toHsl(bg); if (l > 0.5) el.style.setProperty('background-color', flip(cs.backgroundColor), 'important'); }
    const fg = parse(cs.color);
    if (fg) { const {l} = toHsl(fg); if (l < 0.5) el.style.setProperty('color', flip(cs.color), 'important'); }
  });
})();`;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH });
const files = fs.readdirSync(IN).filter((f) => f.endsWith(".html")).sort();
for (const f of files) {
  const slug = f.replace(/^\d+_/, "").replace(/\.html$/, "");
  // Point asset URLs at the local backend so hero/logo PNGs render in the shots.
  const html = fs.readFileSync(path.join(IN, f), "utf8").replace(/https:\/\/dynopay\.com\/api\/static\//g, (arg("assets", "http://localhost:8001") + "/api/static/"));
  for (const mode of ["light", "dark", "gmail"]) {
    const ctx = await browser.newContext({ viewport: { width: 700, height: 900 }, colorScheme: mode === "dark" ? "dark" : "light" });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => Promise.all([...document.images].map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))));
    await page.waitForTimeout(200);
    if (mode === "gmail") { await page.evaluate(GMAIL_INVERT); await page.waitForTimeout(100); }
    await page.screenshot({ path: path.join(OUT, `${slug}__${mode}.png`), fullPage: true, type: "png" });
    await ctx.close();
  }
  console.log("shot", slug);
}
await browser.close();
