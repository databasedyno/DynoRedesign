/* Backfill: give every account-less user a personal Account.
 *
 * WHY
 * ---
 * A company is never created at signup, but invoices/customers/webhooks/api-usage
 * are company-scoped only, and the frontend's CompanyDataContext leaves
 * selectedCompanyId null forever when the list is empty. Result: an individual
 * creator can never reach those features. See docs/IA_AUDIT_2026-08.md §1.
 *
 * DRY RUN BY DEFAULT. Nothing is written unless you pass --apply.
 *
 *   node scripts/backfill_personal_accounts.js                  # show the plan
 *   node scripts/backfill_personal_accounts.js --apply          # write it
 *   node scripts/backfill_personal_accounts.js --include-test   # also QA/test accounts
 *   node scripts/backfill_personal_accounts.js --apply --include-test
 *
 * TEST ACCOUNTS ARE EXCLUDED BY DEFAULT — and that matters. Of the 11 account-less
 * users on production, 10 are QA/test rows (@dynopaytest.com, @dynopay-test.com,
 * testdyno@dyno.pt, plus one row with a NULL email) and exactly one is a real
 * human. Backfilling all of them would add ~10 junk companies to production.
 *
 * WHAT IT WRITES (per eligible user, inside ONE transaction)
 *   1. tbl_company  { user_id, company_name, email, account_type: 'individual' }
 *   2. tbl_account_member { company_id, user_id, role: 'owner', status: 'active' }
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   - No wallets / xpubs / KMS keys / blockchain calls (those mint separately via
 *     verifyOtp / copyWalletAddresses — a backfill must never touch chain state).
 *   - No test API key provisioning (addCompany does that for NEW signups; it would
 *     mean extra customer+api rows per user here for no benefit).
 *   - No VAT/tax lookups (no external API calls).
 *
 * SAFETY: idempotent (skips any user who already owns a company), single
 * transaction, prints exactly what it will do before doing it.
 *
 * Prerequisite: node scripts/add_account_model.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const INCLUDE_TEST = process.argv.includes("--include-test");

// Emails that are clearly not real merchants.
const TEST_EMAIL_PATTERNS = ["%@dynopaytest.com", "%@dynopay-test.com", "%@dyno.pt"];

(async () => {
  const client = new Client({
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Guard: the schema foundation must exist first.
  const pre = await client.query(`
    SELECT (SELECT COUNT(*)::int FROM information_schema.columns
             WHERE table_name='tbl_company' AND column_name='account_type') AS has_account_type,
           (SELECT COUNT(*)::int FROM information_schema.tables
             WHERE table_name='tbl_account_member') AS has_member_table
  `);
  if (!pre.rows[0].has_account_type || !pre.rows[0].has_member_table) {
    console.error(
      "ABORT: run `node scripts/add_account_model.js` first (missing account_type column or tbl_account_member)."
    );
    process.exit(1);
  }

  // Candidates: users with no company at all.
  const testFilter = INCLUDE_TEST
    ? ""
    : `AND u.email IS NOT NULL
       AND ${TEST_EMAIL_PATTERNS.map((_, i) => `u.email NOT ILIKE $${i + 1}`).join("\n       AND ")}`;

  const candidates = await client.query(
    `SELECT u.user_id,
            u.email,
            u.name,
            u.handle,
            COALESCE(NULLIF(TRIM(u.name), ''),
                     NULLIF(TRIM(u.handle), ''),
                     NULLIF(SPLIT_PART(COALESCE(u.email, ''), '@', 1), '')) AS account_name
       FROM tbl_user u
      WHERE NOT EXISTS (SELECT 1 FROM tbl_company c WHERE c.user_id = u.user_id)
        ${testFilter}
      ORDER BY u.user_id`,
    INCLUDE_TEST ? [] : TEST_EMAIL_PATTERNS
  );

  const skippedNoName = candidates.rows.filter((r) => !r.account_name);
  const eligible = candidates.rows.filter((r) => !!r.account_name);

  console.log("\n=== BACKFILL PLAN ===");
  console.log(`mode              : ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"}`);
  console.log(`test accounts     : ${INCLUDE_TEST ? "INCLUDED" : "EXCLUDED (default)"}`);
  console.log(`candidates found  : ${candidates.rowCount}`);
  console.log(`eligible          : ${eligible.length}`);
  console.log(`skipped (no name) : ${skippedNoName.length}`);
  if (eligible.length) {
    console.table(
      eligible.map((r) => ({
        user_id: r.user_id,
        email: r.email,
        will_create_account_named: r.account_name,
        account_type: "individual",
      }))
    );
  }
  if (skippedNoName.length) {
    console.log("Skipped — no name/handle/email to derive an account name from:");
    console.table(skippedNoName.map((r) => ({ user_id: r.user_id, email: r.email })));
  }

  if (!APPLY) {
    console.log("\nDRY RUN complete — nothing was written. Re-run with --apply to execute.");
    await client.end();
    return;
  }

  if (!eligible.length) {
    console.log("\nNothing to do.");
    await client.end();
    return;
  }

  const created = [];
  try {
    await client.query("BEGIN");
    for (const row of eligible) {
      // Re-check inside the transaction so a concurrent signup can't double-create.
      const ins = await client.query(
        `INSERT INTO tbl_company (user_id, company_name, email, account_type, "createdAt", "updatedAt")
         SELECT $1, $2, $3, 'individual', NOW(), NOW()
          WHERE NOT EXISTS (SELECT 1 FROM tbl_company c WHERE c.user_id = $1)
         RETURNING company_id, user_id, company_name, account_type`,
        [row.user_id, row.account_name, row.email]
      );
      if (ins.rowCount === 0) {
        console.log(`  - user ${row.user_id}: already had an account, skipped`);
        continue;
      }
      const company = ins.rows[0];
      await client.query(
        `INSERT INTO tbl_account_member (company_id, user_id, role, status)
         VALUES ($1, $2, 'owner', 'active')
         ON CONFLICT (company_id, user_id) DO NOTHING`,
        [company.company_id, row.user_id]
      );
      created.push(company);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("\nBACKFILL FAILED — transaction rolled back, nothing was written.");
    console.error(e.message);
    await client.end();
    process.exit(1);
  }

  console.log(`\nOK: created ${created.length} personal account(s) + owner membership row(s).`);
  if (created.length) console.table(created);

  const after = await client.query(`
    SELECT (SELECT COUNT(*)::int FROM tbl_user) AS users,
           (SELECT COUNT(*)::int FROM tbl_company) AS accounts,
           (SELECT COUNT(*)::int FROM tbl_user u
             WHERE NOT EXISTS (SELECT 1 FROM tbl_company c WHERE c.user_id = u.user_id)) AS users_without_account,
           (SELECT COUNT(*)::int FROM tbl_account_member) AS member_rows
  `);
  console.table(after.rows);

  await client.end();
  console.log("DONE");
})().catch((e) => {
  console.error("BACKFILL FAILED:", e.message);
  process.exit(1);
});
