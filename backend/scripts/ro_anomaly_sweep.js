#!/usr/bin/env node
/** READ-ONLY 48h anomaly sweep over persisted prod logs/tables. Usage: node scripts/ro_anomaly_sweep.js [hours] */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

const H = Number(process.argv[2] || 48);
const W = `now() - interval '${H} hours'`;
const P = `now() - interval '${2 * H} hours'`;

const Q = {
  service_health_fail: `select service_name, status, count(*) n, min(check_timestamp) first, max(check_timestamp) last, max(left(error_message,120)) sample from tbl_service_health where check_timestamp > ${W} and status <> 'healthy' group by 1,2 order by n desc limit 20`,
  service_health_latency: `select service_name, round(avg(latency_ms)) avg_ms, max(latency_ms) max_ms, count(*) checks from tbl_service_health where check_timestamp > ${W} group by 1 order by avg_ms desc limit 15`,
  incidents: `select * from tbl_incident where coalesce("updatedAt","createdAt") > ${W} order by 1 desc limit 10`,
  nexus_alerts: `select level, threshold_key, count(*) n, max(notified_at) last from tbl_nexus_alert where notified_at > ${W} group by 1,2 order by n desc limit 15`,
  security_events: `select type, severity, count(*) n, count(*) filter (where resolved_at is null) open, max(created_at) last, max(left(summary,100)) sample from tbl_security_event where created_at > ${W} group by 1,2 order by n desc limit 20`,
  security_log_status: `select event_type, status, count(*) n, count(distinct ip_address) ips, count(distinct user_id) users from tbl_security_log where "createdAt" > ${W} group by 1,2 order by n desc limit 25`,
  security_log_prev: `select event_type, status, count(*) n from tbl_security_log where "createdAt" between ${P} and ${W} group by 1,2 order by n desc limit 25`,
  failed_login_ips: `select ip_address, count(*) n, count(distinct user_id) users, max("createdAt") last from tbl_security_log where "createdAt" > ${W} and status in ('failed','failure','FAILED','blocked') group by 1 order by n desc limit 10`,
  login_flagged: `select count(*) logins, count(*) filter (where flagged) flagged, count(distinct user_id) users, count(distinct ip_address) ips from tbl_login_activities where "createdAt" > ${W}`,
  login_history_fail: `select status, count(*) n, count(distinct ip_address) ips from tbl_login_history where "createdAt" > ${W} group by 1 order by n desc limit 10`,
  api_usage_errors: `select status_code, count(*) n from tbl_api_usage_log where "createdAt" > ${W} group by 1 order by n desc limit 12`,
  api_usage_top_paths_5xx: `select endpoint, method, status_code, count(*) n from tbl_api_usage_log where "createdAt" > ${W} and status_code >= 500 group by 1,2,3 order by n desc limit 12`,
  api_usage_top_4xx: `select endpoint, status_code, count(*) n from tbl_api_usage_log where "createdAt" > ${W} and status_code in (401,403,429) group by 1,2 order by n desc limit 12`,
  webhook_delivery: `select status, count(*) n, avg(retry_count)::numeric(6,2) avg_retry, max(created_at) last from tbl_webhook_delivery_log where created_at > ${W} group by 1 order by n desc`,
  webhook_failures: `select company_id, left(webhook_url,60) url, event_type, response_status, left(error_message,90) err, count(*) n, max(created_at) last from tbl_webhook_delivery_log where created_at > ${W} and status not in ('success','delivered','SUCCESS') group by 1,2,3,4,5 order by n desc limit 12`,
  inbound_events: `select provider, status, count(*) n, max(received_at) last from tbl_inbound_events where received_at > ${W} group by 1,2 order by n desc`,
  inbound_errors: `select provider, event_type, left(error,120) err, count(*) n, max(received_at) last from tbl_inbound_events where received_at > ${W} and (status not in ('processed','duplicate','ignored') or error is not null) group by 1,2,3 order by n desc limit 12`,
  inbound_backlog: `select count(*) unprocessed, min(received_at) oldest from tbl_inbound_events where processed_at is null and status not in ('duplicate','ignored')`,
  outbox: `select status, count(*) n, max(attempts) max_attempts, min(created_at) oldest, max(left(last_error,100)) sample_err from tbl_outbox where created_at > ${W} or status not in ('dispatched','done','completed') group by 1 order by n desc`,
  outbox_dead: `select event_type, attempts, left(last_error,120) err, created_at from tbl_outbox where status not in ('dispatched','done','completed') order by created_at asc limit 10`,
  payment_journal_events: `select event, to_state, count(*) n from tbl_payment_journal where created_at > ${W} group by 1,2 order by n desc limit 20`,
  payment_journal_prev: `select event, to_state, count(*) n from tbl_payment_journal where created_at between ${P} and ${W} group by 1,2 order by n desc limit 20`,
  tx_status_48h: `select environment, status, count(*) n, sum(coalesce(usd_value,0))::numeric(14,2) usd from tbl_user_transaction where "createdAt" > ${W} group by 1,2 order by 1, n desc`,
  tx_status_prev: `select environment, status, count(*) n, sum(coalesce(usd_value,0))::numeric(14,2) usd from tbl_user_transaction where "createdAt" between ${P} and ${W} group by 1,2 order by 1, n desc`,
  tx_stuck: `select status, count(*) n, min("updatedAt") oldest from tbl_user_transaction where environment='live' and status not in ('completed','paid','success','failed','expired','cancelled','refunded','underpaid','partial') and "updatedAt" < now() - interval '2 hours' and "createdAt" > now() - interval '30 days' group by 1 order by n desc limit 15`,
  conversions: `select status, count(*) n, sum(coalesce(source_amount_usd,0))::numeric(14,2) usd, max("updatedAt") last, max(left(coalesce(error_message,''),100)) err from tbl_stablecoin_conversion where "createdAt" > ${W} or (status not in ('completed','settled','paid_out','failed') and "createdAt" > now() - interval '30 days') group by 1 order by n desc`,
  gas_audit: `select status, count(*) n, sum(coalesce(variance_usd,0))::numeric(12,2) variance_usd, max("updatedAt") last from tbl_payout_gas_audit where "createdAt" > ${W} group by 1 order by n desc`,
  key_access: `select purpose, actor, success, count(*) n, max(left(error,100)) err from tbl_key_access_audit where created_at > ${W} group by 1,2,3 order by n desc limit 15`,
  refunds: `select status, count(*) n, max("updatedAt") last from tbl_refund where "createdAt" > ${W} group by 1`,
  customer_withdrawals: `select status, count(*) n, max("updatedAt") last from tbl_customer_withdrawal where "createdAt" > ${W} or status in ('pending','processing','failed') group by 1`,
  referral_payouts: `select status, count(*) n from tbl_referral_payout where "createdAt" > ${W} group by 1`,
  team_activity_errors: `select action, status_code, count(*) n from tbl_team_activity where "createdAt" > ${W} and status_code >= 400 group by 1,2 order by n desc limit 10`,
  signups: `select count(*) filter (where "createdAt" > ${W}) new_users_48h, count(*) filter (where "createdAt" between ${P} and ${W}) prev_48h from tbl_user`,
  companies: `select count(*) filter (where "createdAt" > ${W}) new_brands_48h, count(*) filter (where "createdAt" between ${P} and ${W}) prev_48h from tbl_company`,
  sessions: `select count(*) n, count(distinct user_id) users from tbl_user_session where "createdAt" > ${W}`,
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
