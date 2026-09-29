#!/usr/bin/env node
/** READ-ONLY 48h anomaly sweep, part 2 (schema-corrected). Usage: node scripts/ro_anomaly_sweep2.js [hours] */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const H = Number(process.argv[2] || 48);
const W = `now() - interval '${H} hours'`;
const Q = {
  service_health_status: `select service_name, status, count(*) n, max(check_timestamp) last, max(left(error_message,120)) err from tbl_service_health where check_timestamp > ${W} group by 1,2 order by 1,2`,
  service_health_gaps: `with t as (select check_timestamp, lag(check_timestamp) over (order by check_timestamp) prev from (select distinct check_timestamp from tbl_service_health where check_timestamp > ${W}) x) select prev, check_timestamp, extract(epoch from check_timestamp-prev)/60 gap_min from t where check_timestamp-prev > interval '20 minutes' order by 3 desc limit 10`,
  incidents: `select incident_id, title, status, severity, auto_generated, created_at, resolved_at from tbl_incident where created_at > ${W} or resolved_at is null order by created_at desc limit 10`,
  conversions: `select status, count(*) n, sum(coalesce(source_amount_usd,0))::numeric(14,2) usd, max("updatedAt") last from tbl_stablecoin_conversion where "createdAt" > ${W} group by 1 order by n desc`,
  conversions_open: `select conversion_id, status, source_currency, source_amount_usd, target_currency, "createdAt", "updatedAt" from tbl_stablecoin_conversion where "createdAt" > now() - interval '30 days' and status::text not in ('completed','settled','paid_out','failed','cancelled','payout_complete','converted') order by "createdAt" desc limit 10`,
  gas_audit: `select status, count(*) n, sum(coalesce(variance_usd,0))::numeric(12,2) variance_usd, max(created_at) last from tbl_payout_gas_audit where created_at > ${W} group by 1 order by n desc`,
  customer_withdrawals: `select status, count(*) n, max(created_at) last from tbl_customer_withdrawal where created_at > ${W} or status::text in ('pending','processing','failed','approved') group by 1`,
  team_activity_errors: `select action, status_code, count(*) n from tbl_team_activity where created_at > ${W} and status_code >= 400 group by 1,2 order by n desc limit 10`,
  sessions: `select count(*) n, count(distinct user_id) users, count(*) filter (where revoked_at is not null) revoked from tbl_user_session where created_at > ${W}`,
  login_activities: `select count(*) logins, count(*) filter (where flagged) flagged, count(distinct user_id) users, count(distinct ip_address) ips from tbl_login_activities where login_at > ${W}`,
  login_flagged_rows: `select user_id, ip_address, location, device, login_at from tbl_login_activities where login_at > ${W} and flagged order by login_at desc limit 10`,
  webhook_fail_real: `select company_id, left(webhook_url,70) url, event_type, response_status, left(error_message,80) err, count(*) n, max(created_at) last from tbl_webhook_delivery_log where created_at > ${W} and status <> 'success' and event_type <> 'webhook.test' group by 1,2,3,4,5 order by n desc limit 12`,
  webhook_test_origin: `select company_id, count(*) n, min(created_at) first, max(created_at) last from tbl_webhook_delivery_log where created_at > ${W} and event_type='webhook.test' group by 1`,
  outbox_processing_stuck: `select id, event_type, aggregate_type, aggregate_id, attempts, created_at, available_at, correlation_id from tbl_outbox where status='processing' order by created_at limit 5`,
  outbox_failed_recent: `select event_type, attempts, left(last_error,110) err, created_at from tbl_outbox where status='failed' and created_at > now() - interval '14 days' order by created_at desc limit 10`,
  tx_statuses_30d: `select status, count(*) n from tbl_user_transaction where "createdAt" > now() - interval '30 days' group by 1 order by n desc`,
  tx_stuck_real: `select status, count(*) n, min("updatedAt") oldest, max("updatedAt") newest from tbl_user_transaction where status::text not in ('successful','completed','pending','failed','expired','cancelled','refunded') and "createdAt" > now() - interval '30 days' group by 1 order by n desc`,
  journal_open_payments: `with last as (select distinct on (payment_id) payment_id, to_state, created_at from tbl_payment_journal where created_at > now() - interval '14 days' order by payment_id, created_at desc) select to_state, count(*) n, min(created_at) oldest from last where to_state not in ('payout_complete','completed','expired','failed','refunded') group by 1 order by n desc`,
  journal_open_detail: `with last as (select distinct on (payment_id) payment_id, to_state, created_at, company_id, amount, currency from tbl_payment_journal where created_at > now() - interval '14 days' order by payment_id, created_at desc) select * from last where to_state not in ('payout_complete','completed','expired','failed','refunded') and created_at < now() - interval '2 hours' order by created_at limit 12`,
  tatum_events_per_hour: `select date_trunc('hour', received_at) h, count(*) n from tbl_inbound_events where received_at > ${W} group by 1 order by 1`,
  api_usage_48h: `select count(*) n, count(distinct company_id) companies from tbl_api_usage_log where "createdAt" > ${W}`,
  nexus_alerts_7d: `select level, threshold_key, count(*) n, max(notified_at) last from tbl_nexus_alert where notified_at > now() - interval '7 days' group by 1,2 order by last desc limit 10`,
  security_events_7d: `select type, severity, count(*) n, max(created_at) last from tbl_security_event where created_at > now() - interval '7 days' group by 1,2 order by last desc limit 10`,
  security_log_7d: `select event_type, status, count(*) n, max("createdAt") last from tbl_security_log where "createdAt" > now() - interval '7 days' group by 1,2 order by n desc limit 10`,
  big_payments_48h: `select transaction_id, company_id, status, currency, amount, usd_value, "createdAt" from tbl_user_transaction where "createdAt" > ${W} and coalesce(usd_value,0) >= 500 order by usd_value desc limit 10`,
  admin_wallet_low: `select * from (select wallet_id, coin, chain, balance, min_balance, "updatedAt" from tbl_admin_wallet) w where balance is not null and min_balance is not null and balance::numeric < min_balance::numeric limit 10`,
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
