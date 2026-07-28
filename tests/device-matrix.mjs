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
