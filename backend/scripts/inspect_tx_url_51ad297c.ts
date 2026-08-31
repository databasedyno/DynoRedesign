/** READ-ONLY: what URL was attached to the $26 BTC payment, and why nothing fired. */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import { getRedisItem } from "../utils/redisInstance";
import { connectRedis } from "../utils/redisInstance";

const PAYMENT = "51ad297c-8932-4f07-821c-7ce8e62cb77e";

(async () => {
  try {
    await connectRedis();
    const tx = await sequelize.query(
      `SELECT transaction_id, transaction_reference, company_id, payment_mode, status,
              base_amount, base_currency, crypto_currency, crypto_amount,
              usd_value, webhook_url, callback_url, "createdAt", "updatedAt"
         FROM tbl_user_transaction WHERE transaction_reference = :p`,
      { replacements: { p: PAYMENT }, type: QueryTypes.SELECT }
    );
    console.log("\n===== USER TRANSACTION =====");
    console.log(JSON.stringify(tx, null, 2));

    // company saved webhook for comparison
    const co = await sequelize.query(
      `SELECT company_id, webhook_url AS company_webhook_url, webhook_disabled, webhook_disabled_at, webhook_disabled_reason
         FROM tbl_company WHERE company_id = 1`,
      { type: QueryTypes.SELECT }
    );
    console.log("\n===== COMPANY 1 WEBHOOK =====");
    console.log(JSON.stringify(co, null, 2));

    // redis payment session (may be expired) — where per-request webhook_url is stored for delivery
    for (const k of [`payment:${PAYMENT}`, `crypto_payment:${PAYMENT}`, `payment_data:${PAYMENT}`, PAYMENT]) {
      try {
        const v = await getRedisItem(k);
        if (v && Object.keys(v).length > 0) {
          console.log(`\n===== REDIS ${k} (webhook fields) =====`);
          const o = v as Record<string, unknown>;
          console.log(JSON.stringify({ webhook_url: o.webhook_url, callback_url: o.callback_url, company_id: o.company_id }, null, 2));
        }
      } catch { /* ignore */ }
    }
  } catch (e) {
    console.error("ERR:", e);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
})();
