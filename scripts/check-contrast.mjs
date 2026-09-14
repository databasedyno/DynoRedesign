#!/usr/bin/env node
/**
 * check-contrast.mjs — Dark-mode brand-foreground contrast guardrail.
 *
 * WHY: The in-app dark theme aliases `primary.main` to the solid brand indigo
 * `#4F46E5`, which fails WCAG AA as a TEXT/ICON colour on dark surfaces
 * (~2.6:1 on #141417). The fix is the theme-aware `brandFg(isDark)` helper in
 * `constants/theme.ts` (#4F46E5 light / #818CF8 dark). This script fails the
 * build if anyone reintroduces a raw `primary.main` or `#4F46E5` as a
 * FOREGROUND colour (`color:` / `color=`), so the dark-mode contrast rollout
 * can't silently regress.
 *
 * WHAT IT FLAGS (foreground only — never backgrounds/borders):
 *   color: theme.palette.primary.main        color: "primary.main"
 *   color: '#4F46E5'                          color={theme.palette.primary.main}
 *   color="#4F46E5"                           color="primary.main"
 * It deliberately does NOT flag `bgcolor`, `backgroundColor`, `borderColor`,
 * `border-color`, `boxShadow`, `outline`, etc. — those legitimately use the
 * solid brand indigo (they pair with white contrastText).
 *
 * ESCAPE HATCH: add `contrast-ok` in a comment on the offending line to allow
 * a deliberate exception.
 *
 * USAGE:
 *   node scripts/check-contrast.mjs           # strict: exit 1 on any finding (CI / `yarn lint:contrast`)
 *   node scripts/check-contrast.mjs --hook    # warn-only: prints findings, exit 0 (git pre-commit)
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCAN_DIRS = ["pages", "Components"];
const EXTS = new Set([".ts", ".tsx"]);

// Paths (substring match, POSIX) intentionally exempt — documented reasons:
const ALLOWLIST = [
  "constants/theme.ts",              // defines brandFg / BRAND_ACCENT (the SOT itself)
  "Components/Layout/AdminHeader/",  // admin panel: primary.main is readable text on a fixed light AppBar (not dark-aware)
  "Components/UI/DatePicker/",       // light-only widget (hardcoded #F5F5F5 backgrounds)
  "pages/QA.tsx",                    // internal QA / dev harness page
];

// Foreground brand-colour patterns, value bounded to the property so a later
// `bgcolor: ...primary.main` on the same line can't trip a `color:` match.
const BRAND = String.raw`(?:primary\.main|#4[fF]46[eE]5)`;
const RE_STYLE = new RegExp(String.raw`(?:^|[^A-Za-z-])color\s*:\s*["']?[^,;}\n]*?${BRAND}`);
const RE_JSX = new RegExp(String.raw`(?:^|[^A-Za-z-])color\s*=\s*[{"']?[^}"'\n]*?${BRAND}`);

const isAllowlisted = (rel) => ALLOWLIST.some((p) => rel.includes(p));

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(name.slice(name.lastIndexOf(".")))) out.push(full);
  }
}

const files = [];
for (const d of SCAN_DIRS) walk(join(REPO_ROOT, d), files);

const findings = [];
for (const file of files) {
  const rel = relative(REPO_ROOT, file).split("\\").join("/");
  if (isAllowlisted(rel)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.includes("contrast-ok")) return;
    if (RE_STYLE.test(line) || RE_JSX.test(line)) {
      findings.push({ rel, line: i + 1, text: line.trim().slice(0, 140) });
    }
  });
}

const hookMode = process.argv.includes("--hook");
const updateBaseline = process.argv.includes("--update-baseline");

// Baseline: pre-existing offenders are grandfathered so the guardrail only
// FAILS on NEW regressions. Keyed by `file::code` (line-shift resilient).
const BASELINE_PATH = join(REPO_ROOT, "scripts", "contrast-baseline.json");
const keyOf = (f) => `${f.rel}::${f.text}`;

if (updateBaseline) {
  const keys = [...new Set(findings.map(keyOf))].sort();
  writeFileSync(BASELINE_PATH, JSON.stringify(keys, null, 2) + "\n");
  console.log(`✓ contrast baseline written: ${keys.length} grandfathered entries -> scripts/contrast-baseline.json`);
  process.exit(0);
}

let baseline = new Set();
try {
  baseline = new Set(JSON.parse(readFileSync(BASELINE_PATH, "utf8")));
} catch {
  /* no baseline yet — treat all findings as new */
}

const newFindings = findings.filter((f) => !baseline.has(keyOf(f)));
const grandfathered = findings.length - newFindings.length;

if (newFindings.length === 0) {
  console.log(
    `✓ contrast guardrail: no NEW raw brand foreground colours ` +
      `(${files.length} files scanned, ${grandfathered} known/grandfathered).`
  );
  process.exit(0);
}

const header = hookMode
  ? "⚠ contrast guardrail (warn-only in hook) — NEW raw brand FOREGROUND colour introduced:"
  : "✗ contrast guardrail FAILED — NEW raw brand FOREGROUND colour introduced:";
console.error(`\n${header}`);
for (const f of newFindings) {
  console.error(`  ${f.rel}:${f.line}  ${f.text}`);
}
console.error(
  `\nFix: use the theme-aware helper — color: brandFg(isDark)  (import { brandFg } from "@/constants/theme").` +
    `\n     brandFg => #4F46E5 (light) / #818CF8 (dark, WCAG AA on dark surfaces).` +
    `\n     Backgrounds/borders may keep the solid brand indigo. Deliberate exception? add "contrast-ok" on the line.` +
    `\n     (Intentionally migrating a grandfathered file? re-baseline with: node scripts/check-contrast.mjs --update-baseline)\n`
);
process.exit(hookMode ? 0 : 1);
