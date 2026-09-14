/**
 * One-time backfill: give every LEGACY company that has an active LIVE key but
 * NO active SANDBOX key a `dpk_test_` sandbox key, via the shared idempotent
 * ensureSandboxApiKey() helper.
 *
 * Scope rationale: a company only has a LIVE key AFTER adding a wallet
 * (ensureLiveApiKey mints on wallet-add), so "has live key" guarantees the
 * account has >=1 wallet — this never touches wallet-less accounts. Companies
 * without a live key are intentionally excluded.
 *
 * SAFE: idempotent (helper no-ops when a sandbox key already exists), logs COUNTS
 * only (never plaintext keys). Manually invoked — NOT a background job.
 *
 *   Dry run (default):  cd /app/backend && npx ts-node scripts/backfill_sandbox_keys.ts
 *   Apply:              cd /app/backend && npx ts-node scripts/backfill_sandbox_keys.ts --apply
 */
import "dotenv/config";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import { ensureSandboxApiKey } from "../controller/api/ensureSandboxApiKey";

interface Candidate {
  company_id: number;
  company_name: string | null;
  user_id: number;
  company_email: string | null;
  owner_email: string | null;
}

const APPLY = process.argv.includes("--apply");

(async () => {
  const candidates = await sequelize.query<Candidate>(
    `SELECT c.company_id, c.company_name, c.user_id,
            c.email AS company_email, u.email AS owner_email
       FROM tbl_company c
       JOIN tbl_user u ON u.user_id = c.user_id
      WHERE EXISTS (SELECT 1 FROM tbl_api a
                     WHERE a.company_id = c.company_id
                       AND a.environment = 'production' AND a.status = 'active')
        AND NOT EXISTS (SELECT 1 FROM tbl_api a
                         WHERE a.company_id = c.company_id
                           AND a.environment = 'development' AND a.status = 'active')
      ORDER BY c.company_id ASC`,
    { type: QueryTypes.SELECT }
  );

  console.log(`\n${APPLY ? "APPLY" : "DRY-RUN"} — sandbox-key backfill`);
  console.log(`candidates (active live key, no active sandbox key): ${candidates.length}`);
  console.log(candidates.map((c) => c.company_id).join(", "));

  if (!APPLY) {
    console.log(`\nDry run only — pass --apply to create the sandbox keys.`);
    await sequelize.close();
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;
  let errored = 0;
  for (const c of candidates) {
    try {
      const didCreate = await ensureSandboxApiKey(
        c.company_id,
        c.user_id,
        c.owner_email || c.company_email || "",
        c.company_name,
        c.company_email,
      );
      if (didCreate) {
        created += 1;
        console.log(`  created  company_id=${c.company_id}`);
      } else {
        skipped += 1;
        console.log(`  skipped  company_id=${c.company_id} (already had an active sandbox key)`);
      }
    } catch (e) {
      errored += 1;
      console.log(`  ERROR    company_id=${c.company_id}: ${(e as Error)?.message}`);
    }
  }

  // Post-run audit: recompute how many candidates remain + confirm no dup active groups.
  const [{ remaining }] = await sequelize.query<{ remaining: number }>(
    `SELECT count(*)::int AS remaining FROM tbl_company c
      WHERE EXISTS (SELECT 1 FROM tbl_api a WHERE a.company_id=c.company_id AND a.environment='production' AND a.status='active')
        AND NOT EXISTS (SELECT 1 FROM tbl_api a WHERE a.company_id=c.company_id AND a.environment='development' AND a.status='active')`,
    { type: QueryTypes.SELECT }
  );
  const dups = await sequelize.query<{ company_id: number; environment: string; c: number }>(
    `SELECT company_id, environment, count(*)::int c FROM tbl_api
      WHERE status='active' GROUP BY 1,2 HAVING count(*)>1`,
    { type: QueryTypes.SELECT }
  );

  console.log(`\n=== BACKFILL SUMMARY ===`);
  console.log(`candidates=${candidates.length} created=${created} skipped=${skipped} errored=${errored}`);
  console.log(`candidates still remaining after run: ${remaining}`);
  console.log(`duplicate active (company_id, environment) groups: ${dups.length}`);

  await sequelize.close();
  process.exit(errored === 0 ? 0 : 1);
})().catch((e) => {
  console.error("BACKFILL ERROR:", e?.message || e);
  process.exit(1);
});
