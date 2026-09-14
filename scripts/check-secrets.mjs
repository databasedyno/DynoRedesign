#!/usr/bin/env node
/**
 * Pre-commit secrets guard — blocks commits containing high-confidence credential
 * patterns that GitHub push protection would reject anyway (better to fail fast
 * locally with a clear message than have "Save to GitHub" silently fail).
 *
 * Added 2026-08 after live provider keys in tracked docs/test files blocked pushes
 * (GH013 push protection). Scans STAGED files only, so it is fast.
 *
 * False positive? Redact the value (replace with a REDACTED placeholder or an
 * env-var reference) — real credentials must only ever live in gitignored .env files.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  [/sk-proj-[A-Za-z0-9_-]{20,}/, "OpenAI API key"],
  [/sk-[A-Za-z0-9]{40,}/, "OpenAI legacy API key"],
  [/GOCSPX-[A-Za-z0-9_-]{10,}/, "Google OAuth client secret"],
  [/xkeysib-[a-f0-9]{16,}/, "Brevo API key"],
  [/FLWSECK-[A-Za-z0-9-]{10,}/, "Flutterwave secret key"],
  [/\b[0-9]{8,}:AA[A-Za-z0-9_-]{20,}/, "Telegram bot token"],
  [/KEY019[A-F0-9]{16,}[A-Za-z0-9_]*/, "Telnyx/DynoPay API key"],
  [/t-[a-f0-9]{24}-[a-z0-9]{10,}/, "Tatum API key"],
  [/-----BEGIN[ A-Z]*PRIVATE KEY-----(?![-]*REDACTED)/, "Private key material"],
  [/ghp_[A-Za-z0-9]{30,}/, "GitHub personal access token"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key id"],
];
const SKIP = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|pdf|lock|zip)$|(^|\/)\.env/i;

let staged = [];
try {
  staged = execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" })
    .split("\n").filter(Boolean);
} catch {
  process.exit(0); // not a git context — never block
}

const hits = [];
for (const f of staged) {
  if (SKIP.test(f)) continue;
  let content;
  try { content = readFileSync(f, "utf8"); } catch { continue; }
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("REDACTED")) continue;
    for (const [rx, label] of PATTERNS) {
      if (rx.test(lines[i])) { hits.push(`  ${f}:${i + 1}  (${label})`); break; }
    }
  }
}

if (hits.length) {
  console.error(
    "[secrets] FAIL — staged files contain live credential patterns (GitHub push protection WILL reject this push):\n" +
    hits.join("\n") +
    "\n  Move real values to gitignored .env files and replace these with REDACTED placeholders."
  );
  process.exit(1);
}
console.log(`[secrets] OK — no credential patterns in ${staged.length} staged files.`);
