#!/usr/bin/env bash
# Render every email (+3 SafeDeal samples) to backend/public/_email_preview_tmp for visual QA.
set -e
cd /app/backend
export SERVER_URL=https://vault-setup-21.preview.emergentagent.com
OUT=/app/backend/public/_email_preview_tmp
EMAIL_DUMP_DIR=$OUT timeout 200 node_modules/.bin/ts-node --transpile-only scripts/audit_render_all_emails.ts > /app/memory/tmp/email_render.log 2>&1
cat > scripts/_tmp_sd_render.ts <<'EOF'
process.env.DISABLE_OUTBOUND_EMAIL = "true";
process.env.EMAIL_DUMP_DIR = "/app/backend/public/_email_preview_sd";
import * as fs from "fs";
const dir = process.env.EMAIL_DUMP_DIR;
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
(async () => {
  const sd = await import("../services/email/safedealEmails");
  const es = await import("../services/email/escrowEmails");
  const deal = { title: "Calling log", amount: "70.00", currency: "USD", deal_token: "tok123", source: "safedeal" };
  const step = async (name: string, fn: () => Promise<unknown>) => {
    const before = new Set(fs.readdirSync(dir));
    await fn(); await new Promise((r) => setTimeout(r, 100));
    const f = fs.readdirSync(dir).find((x) => !before.has(x) && x.endsWith(".html") && !x.startsWith("sd_"));
    if (f) fs.renameSync(`${dir}/${f}`, `${dir}/sd_${name}.html`);
  };
  await step("code", () => sd.sendSafeDealCodeEmail("buyer@example.com", "482913", "signin"));
  await step("funded", () => es.sendEscrowFundedEmail("seller@example.com", "Sam", deal));
  await step("receipt", () => es.sendEscrowFundingReceiptEmail("buyer@example.com", "Jamie", deal, { paidUsd: 80, method: "balance" } as any, "https://safedeal.sh/deal/tok123"));
  console.log(fs.readdirSync(dir));
  process.exit(0);
})();
EOF
timeout 100 node_modules/.bin/ts-node --transpile-only scripts/_tmp_sd_render.ts 2>&1 | tail -1
rm -f scripts/_tmp_sd_render.ts
grep -c "!!" /app/memory/tmp/email_render.log || true
