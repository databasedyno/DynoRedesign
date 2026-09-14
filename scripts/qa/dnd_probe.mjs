// Self-test: drag-and-drop image upload on the in-app surfaces (no real upload:
// multipart requests are aborted and counted). Usage:
//   PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell \
//   node scripts/qa/dnd_probe.mjs --base=<url> --email=... --password=...
import { chromium } from "playwright";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const base = arg("base", "http://localhost:3000");
const email = arg("email");
const password = arg("password");

// 1x1 PNG
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const results = [];
const ok = (name, pass, info = "") => { results.push({ name, pass, info }); console.log(`${pass ? "PASS" : "FAIL"}  ${name} ${info}`); };

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
let uploads = [];
await page.route("**/api/**", async (route) => {
  const req = route.request();
  const ct = (req.headers()["content-type"] || "").toLowerCase();
  if ((req.method() === "POST" || req.method() === "PUT") && ct.includes("multipart/form-data")) {
    uploads.push(req.url());
    return route.abort();
  }
  return route.continue();
});

// login (2-step)
await page.goto(`${base}/auth/login`, { waitUntil: "domcontentloaded" });
await page.fill('[data-testid="login-email-input"]', email);
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.waitForSelector('[data-testid="password-input"]', { timeout: 20000 });
await page.fill('[data-testid="password-input"]', password);
await page.click('[data-testid="signin-submit-btn"]');
await page.waitForURL("**/dashboard**", { timeout: 60000 });
await page.waitForSelector('[data-testid="dash2026-root"]', { timeout: 60000 });
// dismiss celebration modal if any
const keep = page.getByRole("button", { name: /keep going/i });
if (await keep.count()) await keep.first().click().catch(() => {});

async function dnd(selector, { kind = "png" } = {}) {
  await page.waitForSelector(selector, { timeout: 30000 });
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  // dragenter -> active
  await el.evaluate((node) => {
    const dt = new DataTransfer();
    node.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }));
    node.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(150);
  const activeAttr = await el.getAttribute("data-drag-active");
  const overlay = await page.locator(selector.replace('"]', '-overlay"]')).count();
  // drop
  await el.evaluate((node, { b64, kind }) => {
    const dt = new DataTransfer();
    if (kind === "png") {
      const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      dt.items.add(new File([arr], "probe.png", { type: "image/png" }));
    } else if (kind === "txt") {
      dt.items.add(new File(["hello"], "probe.txt", { type: "text/plain" }));
    } else if (kind === "url") {
      dt.setData("text/uri-list", "https://example.com/a.png");
    }
    node.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, { b64: PNG_B64, kind });
  await page.waitForTimeout(700);
  const afterAttr = await el.getAttribute("data-drag-active");
  return { activeAttr, overlay, afterAttr };
}

const toastText = async () => (await page.locator('[data-testid="app-toast"]').allInnerTexts()).join(" | ");

const only = arg("only", "");
let r;
try {
  if (!only || only.includes("b")) {
  // (b) product editor
  await page.goto(`${base}/pay-links/products/new`, { waitUntil: "domcontentloaded" });
  r = await dnd('[data-testid="product-cover-dropzone"]');
  const cropper = await page.locator('[data-testid="image-cropper-dialog"]').count();
  ok("product-cover drag-active + overlay", r.activeAttr === "true" && r.overlay === 1, JSON.stringify(r));
  ok("product-cover drop opens cropper (png)", cropper === 1);
  if (cropper) await page.click('[data-testid="image-cropper-cancel"]');
  await page.waitForTimeout(300);
  uploads = [];
  r = await dnd('[data-testid="product-gallery-dropzone"]');
  const cropper2 = await page.locator('[data-testid="image-cropper-dialog"]').count();
  ok("product-gallery drag-active", r.activeAttr === "true", JSON.stringify(r));
  ok("product-gallery drop → cropper or upload attempt", cropper2 === 1 || uploads.length > 0, `cropper=${cropper2} uploads=${uploads.length}`);
  if (cropper2) await page.click('[data-testid="image-cropper-cancel"]');
  // negative: text file
  r = await dnd('[data-testid="product-cover-dropzone"]', { kind: "txt" });
  await page.waitForTimeout(400);
  const t1 = await toastText();
  ok("product-cover text/plain drop rejected with toast", /only image files/i.test(t1) && (await page.locator('[data-testid="image-cropper-dialog"]').count()) === 0, t1.slice(0, 80));
  await page.waitForTimeout(3500);
  r = await dnd('[data-testid="product-cover-dropzone"]', { kind: "url" });
  await page.waitForTimeout(400);
  const t2 = await toastText();
  ok("product-cover uri-list drop rejected with 'links' toast", /links/i.test(t2), t2.slice(0, 80));

  }
  if (!only || only.includes("c")) {
  // (c) crowdfunding campaign image
  await page.goto(`${base}/create-pay-link`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="link-type-donation"]', { timeout: 30000 });
  await page.click('[data-testid="link-type-donation"]');
  await page.waitForSelector('[data-testid="donation-section-story-media"]', { timeout: 30000 });
  await page.locator('[data-testid="donation-section-story-media"] > summary').click();
  await page.waitForTimeout(400);
  uploads = [];
  r = await dnd('[data-testid="donation-image-dropzone"]');
  await page.waitForTimeout(800);
  ok("donation-image drag-active + overlay", r.activeAttr === "true" && r.overlay === 1, JSON.stringify(r));
  ok("donation-image drop triggers upload request (aborted)", uploads.length > 0, uploads.join(","));

  }
  if (!only || only.includes("d")) {
  // (d) brand logo in company settings dialog
  await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="company-selector-trigger"]', { timeout: 30000 });
  await page.click('[data-testid="company-selector-trigger"]');
  await page.waitForSelector('[data-testid="company-edit-1"]', { timeout: 15000 });
  await page.click('[data-testid="company-edit-1"]');
  r = await dnd('[data-testid="brand-logo-dropzone"]');
  const blobImg = await page.locator('[data-testid="brand-logo-dropzone"] img[src^="blob:"]').count();
  ok("brand-logo drag-active + overlay", r.activeAttr === "true" && r.overlay === 1, JSON.stringify(r));
  ok("brand-logo drop shows pending preview (no save)", blobImg > 0 || uploads.length > 0, `blobImg=${blobImg} uploads=${uploads.length}`);
  }
  if (!only || only.includes("e")) {
  // (e) create-company modal logo (fresh load closes the settings dialog)
  await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="company-selector-trigger"]', { timeout: 30000 });
  await page.click('[data-testid="company-selector-trigger"]');
  await page.waitForSelector('[data-testid="add-company-btn"]', { timeout: 15000 });
  await page.click('[data-testid="add-company-btn"]');
  await page.waitForSelector('[data-testid="create-company-modal"]', { timeout: 15000 });
  const typeBtn = page.locator('[data-testid^="createbrand-account-type-"]').first();
  if (await typeBtn.count()) await typeBtn.click();
  await page.waitForTimeout(400);
  r = await dnd('[data-testid="create-company-logo-dropzone"]');
  const preview = await page.locator('[data-testid="create-company-logo-preview"]').count();
  ok("create-company-logo drag-active + overlay", r.activeAttr === "true" && r.overlay === 1, JSON.stringify(r));
  ok("create-company-logo drop shows preview", preview === 1);
  await page.click('[data-testid="close-company-modal-btn"]').catch(() => {});

  }
  if (!only || only.includes("f")) {
  // (f) get-started about you
  await page.goto(`${base}/get-started?step=about`, { waitUntil: "domcontentloaded" });
  r = await dnd('[data-testid="gs-logo-dropzone"]');
  const gsPrev = await page.locator('[data-testid="gs-logo-dropzone"] img[src^="blob:"]').count();
  const changeBtn = await page.getByText(/change logo/i).count();
  ok("gs-logo drag-active + overlay", r.activeAttr === "true" && r.overlay === 1, JSON.stringify(r));
  ok("gs-logo drop shows preview", gsPrev > 0 || changeBtn > 0, `blobImg=${gsPrev} change=${changeBtn}`);
  }
} catch (e) {
  console.log("ERROR", e.message);
  await page.screenshot({ path: "/tmp/dnd_err.png" });
}
await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
