#!/usr/bin/env node
/*
 * i18n completeness guardrail.
 * Fails (exit 1) if any non-English locale is missing a key that exists in
 * the English source. This prevents shipping copy that silently falls back to
 * English — the class of bug that caused untranslated pages.
 *
 * Usage:  node scripts/check-i18n.mjs
 * CI:     add "i18n:check": "node scripts/check-i18n.mjs" to package.json scripts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, "..", "langs", "locales");
const SOURCE = "en";

function flatten(obj, prefix = "") {
  const keys = new Set();
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      if (v && typeof v === "object") for (const k of flatten(v, `${prefix}[${i}]`)) keys.add(k);
      else keys.add(`${prefix}[${i}]`);
    });
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const nk = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object") for (const kk of flatten(v, nk)) keys.add(kk);
      else keys.add(nk);
    }
  }
  return keys;
}

const langs = fs
  .readdirSync(LOCALES_DIR)
  .filter((d) => fs.statSync(path.join(LOCALES_DIR, d)).isDirectory() && d !== SOURCE);

const sourceFiles = fs
  .readdirSync(path.join(LOCALES_DIR, SOURCE))
  .filter((f) => f.endsWith(".json"));

let missingTotal = 0;
const report = [];

for (const file of sourceFiles) {
  const enKeys = flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, SOURCE, file), "utf-8")));
  for (const lang of langs) {
    const p = path.join(LOCALES_DIR, lang, file);
    if (!fs.existsSync(p)) {
      report.push(`  [${lang}] MISSING FILE: ${file}`);
      missingTotal += enKeys.size;
      continue;
    }
    const langKeys = flatten(JSON.parse(fs.readFileSync(p, "utf-8")));
    const missing = [...enKeys].filter((k) => !langKeys.has(k));
    if (missing.length) {
      missingTotal += missing.length;
      report.push(`  [${lang}] ${file}: ${missing.length} missing → ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? " …" : ""}`);
    }
  }
}

if (missingTotal === 0) {
  console.log(`✅ i18n check passed — all ${langs.length} locales complete against "${SOURCE}".`);
  process.exit(0);
} else {
  console.error(`❌ i18n check failed — ${missingTotal} missing translation key(s):`);
  console.error(report.join("\n"));
  console.error(`\nAdd the missing keys to the locale files above (source of truth: langs/locales/${SOURCE}).`);
  process.exit(1);
}
