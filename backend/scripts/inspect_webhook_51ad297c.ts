/**
 * READ-ONLY forensic query for payment 51ad297c (tx c3d269d8…) — why no webhook
 * reached Hostbay (company 1). No writes.
 */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const PAYMENT = "51ad297c-8932-4f07-821c-7ce8e62cb77e";
const COMPANY = 1;

const run = async (label: string, sql: string, repl: Record<string, unknown> = {}) => {
  try {
    const rows = await sequelize.query(sql, { type: QueryTypes.SELECT, replacements: repl });
    console.log(`\n===== ${label} (${(rows as unknown[]).length} rows) =====`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.log(`\n===== ${label} — QUERY ERROR: ${(e as Error).message} =====`);
  }
};

(async () => {
  try {
    await run(
      "COMPANY (Hostbay) webhook config + circuit breaker",
      `SELECT company_id, company_name, webhook_url,
              (webhook_secret IS NOT NULL AND webhook_secret <> '') AS has_secret,
              webhook_disabled, webhook_disabled_at
         FROM tbl_company WHERE company_id = :c`,
      { c: COMPANY }
    );

    await run(
      "OUTBOX rows for this payment",
      `SELECT id, event_id, event_type, aggregate_type, status, attempts, max_attempts,
              last_error, available_at, dispatched_at, created_at
         FROM tbl_outbox WHERE aggregate_id = :p ORDER BY id`,
      { p: PAYMENT }
    );

    await run(
      "OUTBOX — any merchant.webhook rows recently (company-agnostic, last 20)",
      `SELECT id, event_type, aggregate_id, status, attempts, last_error, created_at, dispatched_at
         FROM tbl_outbox WHERE event_type = 'merchant.webhook'
        ORDER BY id DESC LIMIT 20`
    );

    await run(
      "WEBHOOK DELIVERY LOG for company 1 (last 25)",
      `SELECT event_type, webhook_id, status, response_status, response_time_ms,
              LEFT(COALESCE(error_message,''), 160) AS error_message, retry_count,
              created_at, completed_at, LEFT(COALESCE(webhook_url,''), 80) AS webhook_url
         FROM tbl_webhook_delivery_log WHERE company_id = :c
        ORDER BY created_at DESC LIMIT 25`,
      { c: COMPANY }
    );

    await run(
      "USER TRANSACTION for this payment",
      `SELECT transaction_id, company_id, status, base_amount, base_currency,
              crypto_currency, webhook_url, callback_url, created_at, updated_at
         FROM tbl_user_transaction WHERE transaction_id = :p`,
      { p: PAYMENT }
    );
  } catch (e) {
    console.error("HARNESS ERROR:", e);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
})();
