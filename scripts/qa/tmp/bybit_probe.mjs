import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" });
const page = await ctx.newPage();
try {
  await page.goto("https://www.bybit.com/en/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(8000);
  const out = await page.evaluate(() => {
    const cs = (el) => el ? getComputedStyle(el) : null;
    const r = {};
    r.theme = document.documentElement.getAttribute("data-theme");
    r.bodyBg = cs(document.body).backgroundColor;
    r.htmlBg = cs(document.documentElement).backgroundColor;
    r.bodyFont = cs(document.body).fontFamily;
    const h1 = document.querySelector("h1"); r.h1 = h1 && { color: cs(h1).color, font: cs(h1).fontFamily, size: cs(h1).fontSize, weight: cs(h1).fontWeight };
    const btn = document.querySelector("button.moly-btn"); r.btn = btn && { bg: cs(btn).backgroundColor, color: cs(btn).color, radius: cs(btn).borderRadius, font: cs(btn).fontFamily, pad: cs(btn).padding };
    const sec = [...document.querySelectorAll("section")].map(s => ({ type: s.dataset.type, bg: cs(s.firstElementChild||s).backgroundColor }));
    r.sections = sec;
    const card = document.querySelector(".HotCoins_smallCard__kMbNZ"); r.card = card && { bg: cs(card).backgroundColor, border: cs(card).border, radius: cs(card).borderRadius };
    const sub = document.querySelector(".HotCoins_subtitle__lczuc"); r.sub = sub && { color: cs(sub).color, size: cs(sub).fontSize };
    const t = document.querySelector(".HotCoins_title__rq9GX"); r.h2 = t && { color: cs(t).color, size: cs(t).fontSize, weight: cs(t).fontWeight };
    const root = cs(document.documentElement);
    const vars = {};
    for (const sheet of document.styleSheets) { try { for (const rule of sheet.cssRules) { if (rule.style && (rule.selectorText||"").includes(":root") || (rule.selectorText||"").includes("data-theme")) { for (const p of rule.style) if (p.startsWith("--bds")) vars[p] = rule.style.getPropertyValue(p).trim(); } } } catch(e){} }
    r.vars = vars;
    const header = document.querySelector("#by-header-outer"); r.header = header && { bg: cs(header.firstElementChild||header).backgroundColor };
    const footer = document.querySelector("#by-landing-page-footer"); r.footer = footer && { bg: cs(footer).backgroundColor };
    const earnSmall = document.querySelector(".Earn_smallCard__WgH6W"); r.earnCard = earnSmall && { bg: cs(earnSmall).backgroundColor, radius: cs(earnSmall).borderRadius };
    const outline = document.querySelector(".Earn_cta__2yz34"); r.outlineBtn = outline && { border: cs(outline).border, color: cs(outline).color, bg: cs(outline).backgroundColor };
    const cardTitle = document.querySelector(".Earn_cardTitle__St7PE"); r.cardTitle = cardTitle && { color: cs(cardTitle).color };
    return r;
  });
  console.log(JSON.stringify(out, null, 1));
  await page.screenshot({ path: "/tmp/bybit.jpg", type: "jpeg", quality: 40, fullPage: false });
} catch (e) { console.log("ERR", e.message); }
await browser.close();
