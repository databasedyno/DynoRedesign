// Find gold-bg elements with light text/icon. Usage:
// node scripts/qa/goldcontrast.mjs <base> <route> <light|dark>
import { chromium } from "playwright";
const [BASE, ROUTE = "/", MODE = "light"] = process.argv.slice(2);
const exe = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || "/usr/bin/google-chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, colorScheme: MODE === "dark" ? "dark" : "light" });
const page = await ctx.newPage();
await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate((m) => {
  localStorage.setItem("theme-mode-inapp", m);
  localStorage.setItem("theme-mode-public", m);
  localStorage.setItem("theme-mode", m);
  document.cookie = `theme-mode-inapp=${m}; path=/`;
}, MODE);
await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2000);
const hits = await page.evaluate(() => {
  const parse = (s) => (s.match(/\d+(\.\d+)?/g) || []).map(Number);
  const isGold = (r, g, b, a = 1) => a > 0.5 && r > 195 && g > 160 && b < 90;
  const isLight = (r, g, b) => r > 195 && g > 195 && b > 195;
  const out = [];
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const cs = getComputedStyle(el);
    const bg = parse(cs.backgroundColor);
    const bgi = cs.backgroundImage || "";
    const goldBg = (bg.length >= 3 && isGold(bg[0], bg[1], bg[2], bg.length > 3 ? bg[3] : 1)) ||
                   /rgb\(\s*2[0-5]\d/.test(bgi) && /255,\s*2\d\d|255,\s*1[6-9]\d/.test(bgi.replace(/\s/g, " "));
    // gold via gradient: crude — check for #FFD100-ish in backgroundImage
    const goldGrad = /255,\s*209,\s*0|255,\s*179,\s*0|#ffd100|#ffb300/i.test(bgi);
    if (!(goldBg || goldGrad)) continue;
    const col = parse(cs.color);
    const txt = (el.textContent || "").trim().slice(0, 40);
    const hasDirectText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    const rect = el.getBoundingClientRect();
    const lightText = col.length >= 3 && isLight(col[0], col[1], col[2]);
    // svg/icon child with light fill
    const svg = el.querySelector(":scope > svg");
    let iconLight = false;
    if (svg) { const f = parse(getComputedStyle(svg).color); iconLight = f.length >= 3 && isLight(f[0], f[1], f[2]); }
    if ((hasDirectText && lightText) || iconLight) {
      out.push({
        tag: el.tagName.toLowerCase(),
        testid: el.getAttribute("data-testid") || "",
        cls: (el.className && el.className.toString ? el.className.toString() : "").slice(0, 50),
        color: cs.color, bg: cs.backgroundColor, grad: goldGrad,
        text: hasDirectText ? txt : (iconLight ? "[icon]" : ""),
        w: Math.round(rect.width), h: Math.round(rect.height),
      });
    }
  }
  return out;
});
console.log(JSON.stringify(hits, null, 2));
console.log("COUNT", hits.length);
await browser.close();
