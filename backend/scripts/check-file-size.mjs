#!/usr/bin/env node
/**
 * R2 lint budget — max 500 lines for NEW backend TypeScript files.
 *
 * Source: memory/ENGINEERING_STRATEGY_REVIEW_2026-08.md, risk R2 ("god files"):
 *   "add a max-500-line lint budget for NEW files; strangler-pattern, never big-bang."
 *
 * Rules:
 *  - Any backend .ts file NOT listed in file-size-baseline.json must be <= 500 lines. (BLOCKS)
 *  - Files in the baseline are grandfathered legacy files; if one GROWS past its
 *    recorded size we warn (extract, don't extend), but do not block.
 *  - When a legacy file is refactored below 500 lines, remove it from the baseline
 *    so it can never regress.
 *
 * Usage:  node scripts/check-file-size.mjs   (run from /app/backend; also wired
 *         into the repo husky pre-commit and `yarn lint:size`).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_LINES = 500;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "public", "assets"]);

const baseline = JSON.parse(
  readFileSync(join(BACKEND_ROOT, "scripts", "file-size-baseline.json"), "utf8")
);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) yield* walk(full);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      yield full;
    }
  }
}

const violations = [];
const warnings = [];

for (const file of walk(BACKEND_ROOT)) {
  const rel = relative(BACKEND_ROOT, file).replace(/\\/g, "/");
  const lines = readFileSync(file, "utf8").split("\n").length;
  if (rel in baseline) {
    if (lines > baseline[rel]) {
      warnings.push(`  ${rel}: ${lines} lines (baseline ${baseline[rel]}) — legacy file grew; extract a module instead of extending`);
    }
  } else if (lines > MAX_LINES) {
    violations.push(`  ${rel}: ${lines} lines (max ${MAX_LINES} for new files)`);
  }
}

if (warnings.length) {
  console.warn(`[file-size] WARN — grandfathered legacy files grew:\n${warnings.join("\n")}`);
}
if (violations.length) {
  console.error(
    `[file-size] FAIL — new backend files exceed the ${MAX_LINES}-line budget (R2):\n` +
    violations.join("\n") +
    `\n  Split the file into domain modules (see controller/user/, controller/wallet/, services/email/ for the pattern).`
  );
  process.exit(1);
}
console.log(`[file-size] OK — no new backend file exceeds ${MAX_LINES} lines (${Object.keys(baseline).length} legacy files grandfathered).`);
