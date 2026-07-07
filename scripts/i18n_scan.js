/* Heuristic scan for likely-hardcoded English UI strings.
 * Flags: JSX text nodes + string props (label/placeholder/title/subTitle/helper/text/heading/description)
 * that contain 2+ English words and are NOT wrapped in t(...).
 * Not perfect — meant to gauge scope & prioritize.
 */
const fs = require("fs");
const path = require("path");

const ROOTS = ["pages", "Components", "Containers"];
const SKIP_DIRS = new Set(["node_modules", ".next", "Home", "Page/Home", "landing"]);
const results = {};

function walk(dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full);
    } else if (/\.tsx$/.test(e.name)) {
      scan(full);
    }
  }
}

const propRe = /\b(label|placeholder|title|subTitle|subtitle|helper|helperText|heading|description|text|tooltip|ctaLabel|buttonText|emptyText)\s*=\s*"([A-Z][^"]{3,})"/g;
const jsxTextRe = />\s*([A-Z][a-zA-Z][a-zA-Z ,.'&!?:%()\/-]{4,})\s*</g;
const looksEnglish = (s) => {
  const words = s.trim().split(/\s+/);
  if (words.length < 2) return /^[A-Z][a-z]{3,}/.test(s.trim()) && s.length > 5;
  return true;
};
const isNoise = (s) =>
  /Urbanist|fontFamily|rgba|#[0-9a-fA-F]{3,}|https?:|data-testid|\$\{|USD|<|>|px$|Mui|palette/.test(s);

function scan(file) {
  const src = fs.readFileSync(file, "utf8");
  const hits = new Set();
  let m;
  while ((m = propRe.exec(src))) {
    const val = m[2];
    if (!isNoise(val) && looksEnglish(val)) hits.add(`[${m[1]}] ${val}`);
  }
  while ((m = jsxTextRe.exec(src))) {
    const val = m[1];
    if (!isNoise(val) && looksEnglish(val) && !/^(true|false|null|undefined)$/.test(val)) hits.add(`[jsx] ${val}`);
  }
  if (hits.size) results[file] = [...hits];
}

for (const r of ROOTS) walk(r);

const sorted = Object.entries(results).sort((a, b) => b[1].length - a[1].length);
let total = 0;
for (const [f, arr] of sorted) {
  total += arr.length;
  console.log(`\n### ${f}  (${arr.length})`);
  for (const h of arr.slice(0, 12)) console.log("   " + h);
  if (arr.length > 12) console.log(`   ... +${arr.length - 12} more`);
}
console.log(`\n===== FILES: ${sorted.length}  TOTAL HITS: ${total} =====`);
