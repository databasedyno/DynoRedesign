#!/usr/bin/env node
/** READ-ONLY 48h anomaly sweep, part 3 (drill-downs). */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const Q = {
  outbox_612: `select id, event_type, status, attempts, created_at, payload->>'event' evt, payload->>'event_type' evt2, payload->>'company_id' company, left(payload::text, 300) payload from tbl_outbox where id=612`,
  outbox_612_deliveries: `select event_type, status, response_status, created_at from tbl_webhook_delivery_log where payload::text like '%f8e1ca0e-19f1-46a9-b54f-5fdbd5b4ca08%' order by created_at`,
  tx_f8e1: `select transaction_id, company_id, status, amount, usd_value, "createdAt", "updatedAt" from tbl_user_transaction where transaction_id::text like 'f8e1ca0e%' or payment_id::text like 'f8e1ca0e%'`,
  api_usage_last: `select max("createdAt") last_row, count(*) total from tbl_api_usage_log`,
  security_last: `select (select max(created_at) from tbl_security_event) sec_event_last, (select max("createdAt") from tbl_security_log) sec_log_last, (select max(notified_at) from tbl_nexus_alert) nexus_last, (select max(login_at) from tbl_login_activities) login_act_last, (select max(created_at) from tbl_incident) incident_last`,
  new_users_48h: `select user_id, split_part(email,'@',2) domain, login_type, email_verified, purpose_vertical, signup_country, "createdAt" from tbl_user where "createdAt" > now() - interval '48 hours' order by "createdAt" desc`,
  new_users_domains_7d: `select split_part(email,'@',2) domain, count(*) n from tbl_user where "createdAt" > now() - interval '7 days' group by 1 order by n desc limit 12`,
  new_brands_48h: `select company_id, user_id, company_name, handle, "createdAt" from tbl_company where "createdAt" > now() - interval '48 hours' order by "createdAt" desc`,
  stuck_journal_tx: `select t.transaction_id, t.company_id, t.status tx_status, t.amount, t.usd_value, t."createdAt", t."updatedAt" from tbl_user_transaction t where t.transaction_id::text in ('e9c49a93-4aa5-478c-8c5b-130549602835','67c8619b-4914-4f25-b474-8a3e8a4d45a1','208f21c1-6936-40df-9440-faf41be70a0f','10904ba9-a83c-4ee4-9d23-a9ba9af4cddd','e745ed45-5d3e-4329-80bd-de94070c7cb2','26c51f17-9bc3-4f80-a782-28d578b69374','fddf8b00-1328-4042-a933-937aa4afea74','8bd8b770-83b1-436a-902b-52c02dc44203')`,
  tx_cols: `select column_name from information_schema.columns where table_name='tbl_user_transaction' and column_name ~* 'id$|status|coin|curr|amount|usd|hash|address|pool|settle|payout' order by ordinal_position`,
  health_cadence: `select date_trunc('hour', check_timestamp) h, count(distinct check_timestamp) runs from tbl_service_health where check_timestamp > now() - interval '48 hours' group by 1 order by 1`,
  sessions_revoked_reason: `select column_name from information_schema.columns where table_name='tbl_user_session' order by ordinal_position`,
  webhook_404_stores: `select company_id, webhook_url, count(*) n, min(created_at) first, max(created_at) last, max(response_status) st from tbl_webhook_delivery_log where webhook_url like '%crypto-webhook%' and created_at > now() - interval '14 days' group by 1,2 order by last desc`,
  webhook_404_stores_success: `select company_id, webhook_url, status, count(*) n, max(created_at) last from tbl_webhook_delivery_log where webhook_url like '%crypto-webhook%' and created_at > now() - interval '30 days' group by 1,2,3 order by 1,2,3`,
  outbox_pending_now: `select status, count(*) n, min(available_at) oldest_due from tbl_outbox where status in ('pending','processing') group by 1`,
};
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 60000 });
  await c.connect();
  await c.query("BEGIN READ ONLY");
  for (const [name, sql] of Object.entries(Q)) {
    try {
      const r = await c.query(sql);
      console.log(`\n### ${name} (${r.rowCount} rows)`);
      for (const row of r.rows) console.log("  " + JSON.stringify(row));
    } catch (e) {
      console.log(`\n### ${name} — ERR ${e.message.split("\n")[0]}`);
      await c.query("ROLLBACK"); await c.query("BEGIN READ ONLY");
    }
  }
  await c.query("ROLLBACK");
  await c.end();
})();
