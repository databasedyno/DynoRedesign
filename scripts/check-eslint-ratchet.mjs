#!/usr/bin/env node
/**
 * check-eslint-ratchet.mjs — ESLint warning RATCHET (Phase 4 "Guards on", FP3-1).
 *
 * WHY: `next.config.mjs` keeps `eslint.ignoreDuringBuilds:false`, which fails a
 * build only on ESLint ERRORS — WARNINGS are allowed, so the ~dozens of existing
 * `react-hooks/exhaustive-deps` warnings would silently multiply over time. This
 * ratchet locks the warning count so it can only go DOWN: a commit that ADDS
 * warnings fails the gate; fixing warnings (and re-baselining) lowers the ceiling.
 *
 * It runs the SAME invocation as `yarn lint` (`eslint . --ext .ts,.tsx`) so the
 * numbers always match what the build/editor see. Errors are a HARD 0 (any error
 * fails), mirroring the tsc gate.
 *
 * USAGE:
 *   node scripts/check-eslint-ratchet.mjs                  # strict (CI / `yarn lint`): exit 1 if errors>0 or warnings>baseline
 *   node scripts/check-eslint-ratchet.mjs --hook           # warn-only (git pre-commit): always exit 0
 *   node scripts/check-eslint-ratchet.mjs --update-baseline # rewrite the baseline to CURRENT counts (use after fixing warnings)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const BASELINE_PATH = join(REPO_ROOT, "scripts", "eslint-warning-baseline.json");
const ESLINT_BIN = join(REPO_ROOT, "node_modules", ".bin", "eslint");

const hookMode = process.argv.includes("--hook");
const updateBaseline = process.argv.includes("--update-baseline");

// Run eslint exactly as `yarn lint` does and capture its JSON report. ESLint
// exits non-zero when errors exist but STILL prints the JSON to stdout, so we
// read stdout from the thrown error too.
function runEslint() {
  try {
    return execFileSync(ESLINT_BIN, [".", "--ext", ".ts,.tsx", "-f", "json"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
    });
  } catch (e) {
    if (e.stdout) return e.stdout;
    console.error("[eslint-ratchet] FAILED to run eslint:\n", e.stderr || e.message);
    process.exit(hookMode ? 0 : 1);
  }
}

const report = JSON.parse(runEslint());

let errors = 0;
let warnings = 0;
const byRule = {};
const errorSamples = [];
for (const file of report) {
  errors += file.errorCount;
  warnings += file.warningCount;
  for (const m of file.messages) {
    const rule = m.ruleId || "(syntax)";
    if (m.severity === 2 && errorSamples.length < 15) {
      errorSamples.push(`  ${file.filePath.replace(REPO_ROOT + "/", "")}:${m.line}  ${rule} — ${m.message}`);
    }
    if (m.severity === 1) byRule[rule] = (byRule[rule] || 0) + 1;
  }
}

const sortedByRule = Object.fromEntries(Object.entries(byRule).sort((a, b) => b[1] - a[1]));

if (updateBaseline) {
  const baseline = {
    maxErrors: 0,
    maxWarnings: warnings,
    byRule: sortedByRule,
    note:
      "ESLint warning RATCHET — this count may only go DOWN. Fixing warnings? re-baseline with " +
      "`node scripts/check-eslint-ratchet.mjs --update-baseline`. Do NOT raise these numbers to land new warnings.",
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`✓ eslint baseline written: 0 errors / ${warnings} warnings -> scripts/eslint-warning-baseline.json`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
} catch {
  console.error(
    "[eslint-ratchet] no baseline found — create one with: node scripts/check-eslint-ratchet.mjs --update-baseline"
  );
  process.exit(hookMode ? 0 : 1);
}

const maxWarnings = baseline.maxWarnings ?? 0;
const problems = [];

// HARD gate: zero errors (mirrors the tsc gate).
if (errors > (baseline.maxErrors ?? 0)) {
  problems.push(
    `ESLint ERRORS: ${errors} (allowed ${baseline.maxErrors ?? 0}). Errors always block.\n` +
      errorSamples.join("\n")
  );
}

// Ratchet gate: warnings may not exceed the baseline.
if (warnings > maxWarnings) {
  const worse = Object.entries(sortedByRule)
    .filter(([rule, n]) => n > (baseline.byRule?.[rule] ?? 0))
    .map(([rule, n]) => `    ${rule}: ${n} (baseline ${baseline.byRule?.[rule] ?? 0})`);
  problems.push(
    `ESLint WARNINGS: ${warnings} > baseline ${maxWarnings} (+${warnings - maxWarnings}). ` +
      `New warnings must be fixed, not ratcheted up.\n  Rules that grew:\n${worse.join("\n")}`
  );
}

if (problems.length) {
  const header = hookMode
    ? "⚠ eslint-ratchet (warn-only in hook) — new lint problems introduced:"
    : "✗ eslint-ratchet FAILED — new lint problems introduced:";
  console.error(`\n${header}\n${problems.join("\n\n")}\n`);
  console.error(
    "Fix the new warnings/errors. Intentionally REDUCED the count and want to lock it in? " +
      "run: node scripts/check-eslint-ratchet.mjs --update-baseline\n"
  );
  process.exit(hookMode ? 0 : 1);
}

if (warnings < maxWarnings) {
  console.log(
    `✓ eslint-ratchet: 0 errors, ${warnings} warnings — DOWN from baseline ${maxWarnings} (-${maxWarnings - warnings}). ` +
      `Nice — lock it in with: node scripts/check-eslint-ratchet.mjs --update-baseline`
  );
} else {
  console.log(`✓ eslint-ratchet: 0 errors, ${warnings} warnings (baseline ${maxWarnings}, holding).`);
}
process.exit(0);
