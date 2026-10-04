/**
 * Purge auto-generated QA test accounts (@dynopay-test.com / @dynopaytest.com).
 * ─────────────────────────────────────────────────────────────────────────────
 * Reuses the app's OWN tested cascade logic — softDeleteAccount() then
 * purgeAccount() from services/accountPurgeService — so every built-in guard
 * runs (ownsSafeDealBrand refusal on soft-delete, canPurgeAccount refusal on
 * purge) and the cascade order matches production exactly.
 *
 * SAFETY:
 *   - DRY-RUN by default: prints the vetted targets + blast radius, writes NOTHING.
 *   - Pass --apply to actually soft-delete + hard-purge.
 *   - Per-account guards (defence in depth, on top of the service guards):
 *       • email MUST end with an allowed test domain
 *       • cumulative_volume_usd MUST be 0
 *       • user_id !== 1 (owner) is always skipped
 *   - Before applying, a JSON record of every target identity is written to
 *     scripts/purge_test_accounts_backup_<ts>.json
 *   - DISABLE_OUTBOUND_EMAIL=true in this env, so the "account deleted" email
 *     fired inside purgeAccount() is suppressed (no mail leaves the box).
 *
 * Usage:
 *   cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/purge_test_accounts.ts           # dry-run
 *   cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/purge_test_accounts.ts --apply   # execute
 */
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import sequelize from "../utils/dbInstance";
import { QueryTypes, Op } from "sequelize";
import { userModel } from "../models";
import { softDeleteAccount, purgeAccount } from "../services/accountPurgeService";

const APPLY = process.argv.includes("--apply");
const ALLOWED_DOMAINS = ["@dynopay-test.com", "@dynopaytest.com"];

const isAllowed = (email: string | null | undefined): boolean => {
  const e = (email || "").toLowerCase().trim();
  return ALLOWED_DOMAINS.some((d) => e.endsWith(d));
};

async function main() {
  console.log("\n🧹 Purge QA test accounts (" + ALLOWED_DOMAINS.join(", ") + ")");
  console.log("Mode:", APPLY ? "APPLY — will soft-delete + hard-purge" : "DRY-RUN — no writes");
  console.log("=".repeat(72));

  const users = await userModel.findAll({
    where: {
      deleted_at: null,
      [Op.or]: ALLOWED_DOMAINS.map((d) => ({ email: { [Op.iLike]: "%" + d } })),
    },
    attributes: ["user_id", "email", "name", "language", "cumulative_volume_usd", "status"],
    order: [["user_id", "ASC"]],
  });

  const targets: Array<{ user_id: number; email: string; name: string; language: string }> = [];
  for (const u of users) {
    const d = u.dataValues as any;
    const uid = Number(d.user_id);
    const vol = parseFloat(d.cumulative_volume_usd ?? 0) || 0;
    if (uid === 1) { console.log(`SKIP  #1 (protected owner)`); continue; }
    if (!isAllowed(d.email)) { console.log(`SKIP  #${uid} ${d.email} (domain not allowed)`); continue; }
    if (vol !== 0) { console.log(`SKIP  #${uid} ${d.email} (volume=${vol} > 0)`); continue; }
    targets.push({ user_id: uid, email: d.email, name: d.name, language: d.language });
  }

  console.log(`\nVetted targets: ${targets.length}`);
  for (const t of targets) {
    const rows: any[] = await sequelize.query(
      `SELECT
         (SELECT count(*) FROM tbl_company      WHERE user_id = :uid) AS companies,
         (SELECT count(*) FROM tbl_payment_link WHERE user_id = :uid) AS paylinks`,
      { replacements: { uid: t.user_id }, type: QueryTypes.SELECT },
    );
    const c = rows[0] || {};
    console.log(`  #${t.user_id}  ${t.email}  companies=${c.companies} paylinks=${c.paylinks}`);
  }

  if (!APPLY) {
    console.log(`\nDRY-RUN complete. ${targets.length} accounts WOULD be soft-deleted + purged.`);
    console.log("Re-run with --apply to execute.");
    await sequelize.close();
    return;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(__dirname, `purge_test_accounts_backup_${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(targets, null, 2));
  console.log(`\nBackup of target identities -> ${backupPath}`);

  let purged = 0, softOnly = 0, failed = 0;
  for (const t of targets) {
    try {
      const soft = await softDeleteAccount(t.user_id, t.user_id);
      if (!soft.ok) { console.log(`  FAIL      #${t.user_id} soft-delete refused (guard / already deleted)`); failed++; continue; }
      const ok = await purgeAccount(t);
      if (ok) { console.log(`  PURGED    #${t.user_id} ${t.email}`); purged++; }
      else { console.log(`  SOFT-ONLY #${t.user_id} purge guard refused — left soft-deleted`); softOnly++; }
    } catch (e: any) {
      console.log(`  ERROR     #${t.user_id}: ${e?.message || e} — left soft-deleted for safety`);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log(`Done. purged=${purged}  soft-only=${softOnly}  failed=${failed}  (of ${targets.length})`);
  await sequelize.close();
}

main().catch(async (e) => {
  console.error("FATAL", e);
  try { await sequelize.close(); } catch { /* noop */ }
  process.exit(1);
});
