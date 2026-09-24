// T10 mandatory cleanup - throwaway example.com identities only.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await client.connect();
  const ids = process.argv.slice(2).map((s) => parseInt(s, 10)).filter(Boolean);
  if (!ids.length) { console.error("no ids"); process.exit(2); }
  const inList = ids.join(",");
  // Sanity check: only allow example.com throwaways
  const chk = await client.query(
    `SELECT customer_id, email FROM tbl_customer WHERE customer_id IN (${inList})`
  );
  for (const row of chk.rows) {
    if (!/^sd-(sec|buyer|rl|sec-lockout|sec-t8)-\d+@example\.com$/i.test(row.email)) {
      console.error("REFUSING: non-throwaway", row);
      process.exit(3);
    }
  }
  console.log("cleaning up", chk.rows);

  const emails = chk.rows.map((r) => r.email);
  const emailPlaceholders = emails.map((_, i) => `$${i + 1}`).join(",");

  await client.query("BEGIN");
  try {
    const q = async (sql, params) => {
      const r = await client.query(sql, params || []);
      console.log(sql.slice(0, 90), "->", r.rowCount);
    };
    await q(`DELETE FROM tbl_customer_transaction WHERE customer_id IN (${inList})`);
    await q(`DELETE FROM tbl_customer_withdrawal WHERE customer_id IN (${inList})`);
    await q(`DELETE FROM tbl_customer_wallet WHERE customer_id IN (${inList})`);
    await q(`DELETE FROM tbl_customer_payout_address WHERE customer_id IN (${inList})`);
    await q(`DELETE FROM tbl_safedeal_topup WHERE customer_id IN (${inList})`);
    if (emails.length) {
      const half = emails.length;
      const p1 = emails.map((_, i) => `$${i + 1}`).join(",");
      const p2 = emails.map((_, i) => `$${i + 1 + half}`).join(",");
      await q(
        `DELETE FROM tbl_escrow_deal WHERE source='safedeal' AND (creator_email IN (${p1}) OR counterparty_email IN (${p2}))`,
        [...emails, ...emails]
      );
    }
    await q(`DELETE FROM tbl_safedeal_profile WHERE customer_id IN (${inList})`);
    await q(`DELETE FROM tbl_customer WHERE customer_id IN (${inList})`);
    await client.query("COMMIT");
    console.log("PURGED ids", ids);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ERR", e);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
