/* One-off additive migration + backfill: tbl_company.display_currency.
 * Adds the merchant dashboard DISPLAY currency (decoupled from the API key's
 * pricing base_currency). Safe: ADD COLUMN IF NOT EXISTS + idempotent backfill
 * (only rows where display_currency IS NULL). No table rewrite/lock.
 *
 * Backfill: seed each company's display_currency from its current API-key
 * base_currency IFF that value is a supported display currency, else 'USD',
 * so no merchant's dashboard visibly changes on release.
 *
 * Run: cd /app/backend && node scripts/add_company_display_currency.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

const SUPPORTED = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD"];

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

  // 1) Add column (idempotent, nullable, no default → resolver handles fallback)
  await client.query(
    "ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS display_currency VARCHAR(3)"
  );
  console.log("OK: column display_currency ensured on tbl_company");

  // 2) Backfill NULLs from the company's API-key base_currency (clamped to supported).
  const supportedList = SUPPORTED.map((c) => `'${c}'`).join(",");
  const backfillSql = `
    UPDATE tbl_company c
    SET display_currency = COALESCE(
      (SELECT UPPER(a.base_currency) FROM tbl_api a
        WHERE a.company_id = c.company_id
          AND UPPER(a.base_currency) IN (${supportedList})
        ORDER BY (CASE WHEN a.status = 'active' THEN 0 ELSE 1 END),
                 (CASE WHEN a.environment = 'production' THEN 0 ELSE 1 END),
                 a."createdAt" DESC
        LIMIT 1),
      'USD')
    WHERE c.display_currency IS NULL;`;
  const res = await client.query(backfillSql);
  console.log(`OK: backfilled display_currency for ${res.rowCount} company row(s)`);

  // 3) Report distribution
  const dist = await client.query(
    "SELECT COALESCE(display_currency,'(null)') AS display_currency, COUNT(*)::int AS n FROM tbl_company GROUP BY 1 ORDER BY 2 DESC"
  );
  console.table(dist.rows);

  await client.end();
})().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
