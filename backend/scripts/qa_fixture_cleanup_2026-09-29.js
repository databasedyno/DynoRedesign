#!/usr/bin/env node
// One-off PROD cleanup of throwaway QA fixtures (user-approved 2026-09-29).
// Usage: node scripts/qa_fixture_cleanup_2026-09-29.js [--apply]   (default = dry run, rolls back)
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const LINKS = [612, 611]; // child first
const BRAND = 345;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 60000 });
  await c.connect();
  await c.query("BEGIN");
  try {
    // Guards: refuse if anything real is attached.
    const g = async (sql, params, label) => {
      const n = Number((await c.query(sql, params)).rows[0].n);
      if (n) throw new Error(`guard failed: ${label} has ${n} rows`);
    };
    await g(`select count(*)::int n from tbl_payment_link where parent_link_id = any($1::int[]) and link_id <> all($1::int[])`, [LINKS], "grandchild links");
    await g(`select count(*)::int n from tbl_user_transaction where transaction_reference in (select transaction_reference from tbl_payment_link where link_id = any($1::int[]) and transaction_reference is not null)`, [LINKS], "transactions on links");
    await g(`select count(*)::int n from tbl_donation_tier where parent_link_id = any($1::int[])`, [LINKS], "donation tiers");
    await g(`select count(*)::int n from tbl_donation_update where campaign_link_id = any($1::int[])`, [LINKS], "donation updates");
    await g(`select count(*)::int n from tbl_product_order where payment_link_id = any($1::int[])`, [LINKS], "orders");
    await g(`select count(*)::int n from tbl_user_transaction where company_id=$1`, [BRAND], "brand transactions");
    await g(`select count(*)::int n from tbl_customer_transaction where company_id=$1`, [BRAND], "brand customer transactions");
    await g(`select count(*)::int n from tbl_user_wallet where company_id=$1`, [BRAND], "brand wallets");
    await g(`select count(*)::int n from tbl_payment_link where company_id=$1`, [BRAND], "brand payment links");
    await g(`select count(*)::int n from tbl_account_member where company_id=$1`, [BRAND], "brand members");
    await g(`select count(*)::int n from tbl_user where last_company_id=$1`, [BRAND], "users parked on brand");
    const brand = (await c.query(`select company_name from tbl_company where company_id=$1`, [BRAND])).rows[0];
    if (!brand || brand.company_name !== "QA Audit Empty Brand") throw new Error(`brand ${BRAND} is not the QA brand: ${JSON.stringify(brand)}`);
    const custs = (await c.query(`select customer_id, email from tbl_customer where company_id=$1`, [BRAND])).rows;
    for (const cu of custs) {
      if (!/@example\.com$/.test(cu.email || "")) throw new Error(`customer ${cu.customer_id} (${cu.email}) is not a throwaway`);
      for (const t of ["tbl_customer_payout_address", "tbl_customer_withdrawal", "tbl_safedeal_profile", "tbl_user_transaction", "tbl_safedeal_topup"]) {
        await g(`select count(*)::int n from ${t} where customer_id=$1`, [cu.customer_id], `${t} for customer ${cu.customer_id}`);
      }
      await g(`select count(*)::int n from tbl_customer_wallet where customer_id=$1 and (amount <> 0 or held_amount <> 0)`, [cu.customer_id], `non-empty wallet for customer ${cu.customer_id}`);
    }
    const custIds = custs.map((x) => x.customer_id);

    const del = async (label, sql, params) => {
      const r = await c.query(sql, params);
      console.log(`  ${label}: ${r.rowCount} row(s) → ${JSON.stringify(r.rows)}`);
    };
    console.log(APPLY ? "APPLYING" : "DRY RUN (will roll back)");
    await del("payment links", `delete from tbl_payment_link where link_id = any($1::int[]) returning link_id, link_type, title`, [LINKS]);
    await del("team activity", `delete from tbl_team_activity where company_id=$1 returning company_id`, [BRAND]);
    await del("api keys", `delete from tbl_api where company_id=$1 returning company_id`, [BRAND]);
    await del("empty customer wallets", `delete from tbl_customer_wallet where customer_id = any($1::int[]) returning wallet_id, customer_id, amount`, [custIds]);
    await del("customers", `delete from tbl_customer where company_id=$1 returning customer_id, email`, [BRAND]);
    for (const t of ["tbl_notification", "tbl_notification_preferences", "tbl_api_usage_log", "tbl_publishable_key", "tbl_kyc", "tbl_invoice", "tbl_product", "tbl_buy_button", "tbl_user_addresses", "tbl_user_temp_address"]) {
      await del(t, `delete from ${t} where company_id=$1 returning company_id`, [BRAND]);
    }
    await del("company", `delete from tbl_company where company_id=$1 returning company_id, company_name`, [BRAND]);

    const left = (await c.query(`select (select count(*) from tbl_payment_link where link_id = any($1::int[]))::int links, (select count(*) from tbl_company where company_id=$2)::int brand`, [LINKS, BRAND])).rows[0];
    console.log("  remaining:", left);
    if (APPLY) { await c.query("COMMIT"); console.log("✅ COMMITTED"); }
    else { await c.query("ROLLBACK"); console.log("↩️  rolled back (dry run)"); }
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("❌ aborted, rolled back:", e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
