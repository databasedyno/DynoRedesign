#!/usr/bin/env node
// Email dark-mode guard — fails when an email builder reintroduces a pattern that
// breaks in dark inboxes (Gmail forced inversion / Apple Mail prefers-color-scheme):
//   1. CSS gradients (Gmail cannot recolour them → light text on a light box)
//   2. Light inline backgrounds on elements WITHOUT a dark-mode class
//      (the shared <style> only overrides known classes)
//   3. Hand-rolled buttons (inline-block + background) without class="btn"/"pill"
//   4. Greeting a buyer by the e-mail local part ("Hey moxxcompany,")
// Usage: node backend/scripts/check-email-dark-mode.mjs [--hook]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, "..");
const hook = process.argv.includes("--hook");

const globs = [
  ["services/email", /\.ts$/],
  ["services/refund", /Email.*\.ts$/],
  ["services", /^(payoutDigestService|overpaymentNotifier|feeWalletMonitor|errorMonitoringService)\.ts$/],
  ["controller/wallet", /^walletOtp\.ts$/],
  ["utils", /^email(Template|Button)\.ts$/],
];
const files = [];
for (const [dir, re] of globs) {
  const abs = path.join(backend, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) if (re.test(f)) files.push(path.join(abs, f));
}

// Classes that have an explicit dark-mode override in utils/emailTemplate.ts <style>.
const DARK_SAFE = new Set([
  "bg", "card", "outer", "hdr-bar", "ftr-bg", "btn", "pill", "chip", "chip-success", "info-box", "success-box",
  "alert-box", "error-box", "neutral-box", "stat-card", "hl-box", "tbl-surface", "tbl-head", "track",
  "otp-code", "addr-box", "status-success", "status-pending", "status-error",
]);
// Files that are standalone documents (no shared <style>) — gradient rule only.
const STANDALONE = new Set(["errorMonitoringService.ts"]);

const lum = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

const problems = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(backend, file);
  const base = path.basename(file);

  for (const m of src.matchAll(/(linear|radial|conic)-gradient\(/g)) {
    problems.push(`${rel}:${lineOf(src, m.index)} CSS gradient — use a solid colour (Gmail dark mode cannot recolour gradients)`);
  }
  if (STANDALONE.has(base)) continue;

  // Every opening tag with an inline style (may span lines).
  for (const tag of src.matchAll(/<(a|div|span|td|table|p|strong|tr|th|section)\b[^>]*?style\s*=\s*"([^"]*)"[^>]*>/gs)) {
    const [whole, name, style] = tag;
    const classAttr = /class\s*=\s*"([^"]*)"/.exec(whole);
    const classes = classAttr ? classAttr[1].split(/\s+/).filter(Boolean) : [];
    // Template-literal class names (class="${...}") are trusted.
    const dynamicClass = classAttr && classAttr[1].includes("${");
    const safe = dynamicClass || classes.some((c) => DARK_SAFE.has(c));

    const bg = /background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})\b/.exec(style);
    if (bg && lum(bg[1]) > 0.55 && !safe) {
      problems.push(`${rel}:${lineOf(src, tag.index)} <${name}> light background ${bg[1]} without a dark-mode class (use infoBox/successBox/neutralBox/chip… or add a class with an override in utils/emailTemplate.ts)`);
    }
    if (name === "a" && /display\s*:\s*inline-block/.test(style) && /background/.test(style) && !classes.includes("btn") && !classes.includes("pill")) {
      problems.push(`${rel}:${lineOf(src, tag.index)} hand-rolled button — use ctaButton() from utils/emailTemplate.ts`);
    }
  }

  // Greeting by e-mail local part.
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=[^;\n]*split\(['"]@['"]\)\[0\]/g)) {
    const v = m[1];
    const used =
      new RegExp(`common\\.greeting['"]\\s*,\\s*\\w+\\s*,\\s*\\{\\s*name:\\s*${v}\\b`).test(src) ||
      new RegExp(`Hey \\$\\{(?:firstNameOnly\\()?${v}\\b`).test(src);
    if (used) problems.push(`${rel}:${lineOf(src, m.index)} greets by e-mail local part (${v}) — use greetingLine(lang, realNameOrNull)`);
  }
}

if (problems.length) {
  console.error(`\n[email-dark-mode] ${problems.length} problem(s):`);
  for (const p of problems) console.error("  - " + p);
  console.error("");
  process.exit(hook ? 1 : 1);
}
console.log(`[email-dark-mode] OK — ${files.length} email source files clean`);
