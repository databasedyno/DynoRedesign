/**
 * Device Matrix Sweep — repeatable responsive/layout regression check.
 *
 * Loads the key pages at several real device sizes (iPhone SE, iPhone 14 Pro
 * Max, iPad, desktop) and asserts:
 *   • no horizontal overflow (the #1 cause of "cut off" mobile bugs)
 *   • the mobile header shows the hamburger (fully inside the viewport) and
 *     hides the inline "Sign in" / "Get started" CTAs
 *   • the desktop header hides the hamburger and shows the nav links
 * A screenshot of every page × device combo is written to tests/screenshots/.
 *
 * Usage:
 *   1) once:  npx playwright install chromium
 *   2) run:   yarn test:devices                 # defaults to http://localhost:3000
 *             yarn test:devices https://your-preview-url.com
 *
 * Exit code is non-zero when any check fails (CI-friendly).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = (
  process.argv[2] ||
  process.env.DEVICE_MATRIX_BASE_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

const OUT_DIR = path.join(__dirname, "screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const DEVICES = [
  { name: "iphone-se", width: 375, height: 667, mobile: true, dsf: 2 },
  { name: "iphone-14-pro-max", width: 430, height: 932, mobile: true, dsf: 3 },
  { name: "ipad", width: 820, height: 1180, mobile: true, dsf: 2 },
  { name: "desktop", width: 1920, height: 1080, mobile: false, dsf: 1 },
];

const PAGES = [
  { name: "home", path: "/" },
  { name: "login", path: "/auth/login" },
  { name: "fees", path: "/fees" },
  { name: "checkout", path: "/pay/demo" },
];

// ── CTA CONTRAST GUARDRAIL ───────────────────────────────────────────────────
// Any visible, enabled button whose LABEL text falls below this WCAG contrast
// ratio (against its alpha-composited, gradient-aware background) HARD-FAILS the
// sweep. 3:1 is the AA bar for large/bold UI text and reliably catches the
// "dark-text-on-dark-CTA" regression (the invisible-CTA bug measured ~1.3:1)
// without flagging the many legible-but-sub-4.5 secondary buttons (those warn).
const CONTRAST_HARD_FAIL = 3.0;

// Runs inside the browser. Returns { fails, warns } lists of button records.
function contrastAudit(hardFail) {
  const parseRGB = (s) => {
    if (!s) return null;
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: p.length > 3 ? p[3] : 1 };
  };
  const hexToRgb = (h) => {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
  };
  const composite = (fg, bg) => {
    const a = fg.a + bg.a * (1 - fg.a);
    const bl = (f, b) => (a === 0 ? 0 : (f * fg.a + b * bg.a * (1 - fg.a)) / a);
    return { r: bl(fg.r, bg.r), g: bl(fg.g, bg.g), b: bl(fg.b, bg.b), a };
  };
  const gradientColor = (img) => {
    const cm = img.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/);
    if (!cm) return null;
    return cm[0].startsWith("#") ? hexToRgb(cm[0]) : parseRGB(cm[0]);
  };
  const resolveBg = (el, depth) => {
    if (!el || el.nodeType !== 1 || depth > 12) return { r: 255, g: 255, b: 255, a: 1 };
    const cs = getComputedStyle(el);
    let self = parseRGB(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 };
    if (cs.backgroundImage && /gradient/i.test(cs.backgroundImage)) {
      const c = gradientColor(cs.backgroundImage);
      if (c) self = { r: c.r, g: c.g, b: c.b, a: c.a == null ? 1 : c.a };
    }
    if (self.a >= 0.999) return self;
    return composite(self, resolveBg(el.parentElement, depth + 1));
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b), hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05); };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity || "1") < 0.1) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  };
  const disabled = (el) => el.disabled || el.getAttribute("aria-disabled") === "true" || getComputedStyle(el).pointerEvents === "none";
  // The element that OWNS the visible text is often an inner <span>/<Typography>
  // with its own `color`, not the <button> wrapper (which may inherit a color
  // from a themed header that applies to no real text). Measure the actual
  // text-bearing leaves so we don't false-fail a legible label. Returns [el] if
  // the button holds its text directly.
  const textOwners = (root) => {
    const owners = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3 && child.textContent.trim()) {
          owners.push(node);
          break;
        }
      }
      for (const child of node.children) walk(child);
    };
    walk(root);
    return owners.length ? owners : [root];
  };
  const nodes = Array.from(document.querySelectorAll("button, [role='button'], a.MuiButton-root, .MuiButton-root"));
  const seen = new Set();
  const fails = [], warns = [];
  for (const el of nodes) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (!visible(el) || disabled(el)) continue;
    const text = (el.innerText || "").trim();
    if (!text || text.length > 60) continue; // skip icon-only / non-label buttons
    // Evaluate each text-bearing leaf; the button "fails" on its WORST leaf.
    let worst = null;
    for (const o of textOwners(el)) {
      if (!visible(o)) continue;
      const ocs = getComputedStyle(o);
      const bg = resolveBg(o, 0);
      let fg = parseRGB(ocs.color) || { r: 0, g: 0, b: 0, a: 1 };
      if (fg.a < 0.999) fg = composite(fg, bg);
      const cr = ratio(fg, bg);
      if (worst === null || cr < worst.cr) {
        worst = {
          cr,
          fg: ocs.color,
          bg,
          size: parseFloat(ocs.fontSize) || 14,
          weight: parseInt(ocs.fontWeight) || 400,
        };
      }
    }
    if (worst === null) continue;
    const cr = Math.round(worst.cr * 100) / 100;
    const large = worst.size >= 24 || (worst.size >= 18.66 && worst.weight >= 700);
    const aa = large ? 3.0 : 4.5;
    const rec = {
      text: text.slice(0, 40).replace(/\s+/g, " "),
      ratio: cr,
      fg: worst.fg,
      bg: `rgb(${Math.round(worst.bg.r)},${Math.round(worst.bg.g)},${Math.round(worst.bg.b)})`,
    };
    if (cr < hardFail) fails.push(rec);
    else if (cr < aa) warns.push(rec);
  }
  return { fails, warns };
}

const results = [];
function record(device, page, check, pass, detail = "") {
  results.push({ device, page, check, pass, detail });
  console.log(
    `[${pass ? "PASS" : "FAIL"}] ${device} · ${page} · ${check}${detail ? " — " + detail : ""}`
  );
}

const browser = await chromium.launch();
try {
  for (const d of DEVICES) {
    const context = await browser.newContext({
      viewport: { width: d.width, height: d.height },
      deviceScaleFactor: d.dsf,
      isMobile: d.mobile,
      hasTouch: d.mobile,
    });
    for (const p of PAGES) {
      const page = await context.newPage();
      const url = BASE_URL + p.path;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        // this app has a live-price stream, so networkidle never settles
        await page.waitForTimeout(4500);

        // 1) No horizontal overflow
        const o = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          iw: window.innerWidth,
        }));
        record(
          d.name,
          p.name,
          "no-horizontal-overflow",
          o.sw <= o.iw + 2,
          `scrollWidth=${o.sw} innerWidth=${o.iw}`
        );

        // 2) Header behaviour (only meaningful on the marketing home page)
        if (p.name === "home") {
          if (d.mobile) {
            const info = await page.evaluate(() => {
              const btn = document.querySelector("[data-testid='mobile-menu-toggle']");
              const r = btn ? btn.getBoundingClientRect() : null;
              const header = document.querySelector("header");
              const headerButtons = header
                ? Array.from(header.querySelectorAll("button,a"))
                    .filter((b) => {
                      const cs = getComputedStyle(b);
                      const rr = b.getBoundingClientRect();
                      return (
                        cs.display !== "none" &&
                        cs.visibility !== "hidden" &&
                        rr.width > 0 &&
                        rr.height > 0
                      );
                    })
                    .map((b) => (b.innerText || "").trim())
                    .filter(Boolean)
                : [];
              return {
                hasBtn: !!btn,
                right: r ? Math.round(r.right) : null,
                inView: r ? r.right <= window.innerWidth + 1 && r.left >= -1 : false,
                headerButtons,
              };
            });
            record(
              d.name,
              p.name,
              "hamburger-visible-in-viewport",
              info.hasBtn && info.inView,
              `right=${info.right}`
            );
            const authInHeader = info.headerButtons.some((t) => /sign in|get started/i.test(t));
            record(
              d.name,
              p.name,
              "no-auth-buttons-in-mobile-header",
              !authInHeader,
              `headerButtons=[${info.headerButtons.join(", ")}]`
            );
          } else {
            const info = await page.evaluate(() => {
              const btn = document.querySelector("[data-testid='mobile-menu-toggle']");
              const vis = btn
                ? getComputedStyle(btn).display !== "none" &&
                  btn.getBoundingClientRect().width > 0
                : false;
              return { hamburgerVisible: vis, hasNav: /features/i.test(document.body.innerText) };
            });
            record(d.name, p.name, "hamburger-hidden-on-desktop", !info.hamburgerVisible);
            record(d.name, p.name, "nav-links-visible-on-desktop", info.hasNav);
          }
        }

        // 3) CTA contrast guardrail — HARD-FAIL any visible button whose label
        //    text falls below CONTRAST_HARD_FAIL:1 against its (gradient-aware)
        //    background. Sub-AA-but-legible buttons are reported as warnings.
        const audit = await page.evaluate(contrastAudit, CONTRAST_HARD_FAIL);
        record(
          d.name,
          p.name,
          "cta-contrast-guardrail",
          audit.fails.length === 0,
          audit.fails.length
            ? `${audit.fails.length} FAIL(S): ` +
              audit.fails
                .map((f) => `"${f.text}" ${f.ratio}:1 (${f.fg} on ${f.bg})`)
                .join(" | ")
            : `${audit.warns.length} sub-AA warn(s)` +
              (audit.warns.length
                ? ": " +
                  audit.warns
                    .slice(0, 3)
                    .map((w) => `"${w.text}" ${w.ratio}:1`)
                    .join(", ")
                : "")
        );

        await page.screenshot({
          path: path.join(OUT_DIR, `${p.name}-${d.name}.png`),
          fullPage: false,
        });
      } catch (e) {
        record(d.name, p.name, "load", false, e.message);
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const failures = results.filter((r) => !r.pass);
console.log(
  `\n==== Device Matrix: ${results.length - failures.length}/${results.length} checks passed · base=${BASE_URL} ====`
);
console.log(`Screenshots → ${OUT_DIR}`);
if (failures.length) {
  console.log(`\n${failures.length} FAILURE(S):`);
  failures.forEach((f) => console.log(`  - ${f.device} · ${f.page} · ${f.check} ${f.detail}`));
  process.exit(1);
}
process.exit(0);
