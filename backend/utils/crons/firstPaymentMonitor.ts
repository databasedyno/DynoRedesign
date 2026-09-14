/**
 * First Payment Monitor Cron
 * Schedule: Every 15 minutes at :05 / :20 / :35 / :50
 *
 * Detects when a merchant receives their very first successful payment.
 * Queries companies that have exactly 1 successful transaction created in the
 * last 24 hours (slow-confirming payments settle well after createdAt; the
 * Redis dedup below makes the wide window safe). Redis dedup ensures one
 * notification per company (1-year TTL).
 *
 * Extracted from `utils/cronJobs.ts` (2026-08-23n) so cronJobs stays under
 * the file-size baseline.
 */
import cron from "node-cron";
import { QueryTypes } from "sequelize";
import sequelize from "../dbInstance";
import { log } from "../loggers";
import { captureError } from "../../services/errorMonitoringService";
import { toFixedStr } from "../money";

export const setupFirstPaymentMonitorCron = () => {
  // Run every 15 minutes at minute 5, 20, 35, 50
  cron.schedule("5,20,35,50 * * * *", async () => {
    try {
      const { getRedisItem, setRedisItemWithTTL } = await import("../redisInstance");
      const { sendFirstPaymentAdminEmail } = await import("../../services/emailService");

      // Find companies whose first successful transaction happened in the last 30 minutes
      const firstPayments = await sequelize.query<{
        company_id: number;
        user_id: number;
        company_name: string;
        merchant_name: string | null;
        merchant_email: string | null;
        registered_at: string;
        tx_id: string;
        amount: string;
        currency: string;
        base_amount: string;
        base_currency: string | null;
        customer_email: string | null;
        tx_created_at: string;
      }>(
        `SELECT
          c.company_id,
          c.user_id,
          c.company_name,
          u.name as merchant_name,
          u.email as merchant_email,
          u."createdAt" as registered_at,
          t.transaction_id as tx_id,
          t.paid_amount as amount,
          t.paid_currency as currency,
          t.base_amount,
          t.base_currency,
          cust.email as customer_email,
          t."createdAt" as tx_created_at
        FROM tbl_company c
        JOIN tbl_user u ON u.user_id = c.user_id
        JOIN tbl_customer_transaction t ON t.company_id = c.company_id
        LEFT JOIN tbl_customer cust ON cust.customer_id = t.customer_id
        WHERE t.status = 'successful'
          AND t."createdAt" >= NOW() - INTERVAL '24 hours'
        AND (
          SELECT COUNT(*) FROM tbl_customer_transaction t2
          WHERE t2.company_id = c.company_id AND t2.status = 'successful'
        ) = 1
        ORDER BY t."createdAt" DESC`,
        { type: QueryTypes.SELECT }
      );

      if (firstPayments.length === 0) return;

      log(`First Payment Monitor: Found ${firstPayments.length} companies with first payment`, "info");

      for (const fp of firstPayments) {
        try {
          const dedupKey = `first-payment-admin-notified:${fp.company_id}`;
          const already = await getRedisItem(dedupKey);
          if (already && Object.keys(already).length > 0) continue;

          await setRedisItemWithTTL(dedupKey, { notified: true }, 365 * 86400); // 1 year dedup

          // Calculate days since registration
          const regDate = new Date(fp.registered_at);
          const txDate = new Date(fp.tx_created_at);
          const daysSinceReg = Math.floor((txDate.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24));

          // Resolve the real USD value: base_amount is in base_currency (often
          // crypto), so only USD-pegged currencies can be used as-is — anything
          // else is FX-converted. Previously base_amount was mislabelled as USD.
          const USD_PEGGED = new Set([
            "USD", "USDT", "USDC", "BUSD", "DAI",
            "USDT-TRC20", "USDT-ERC20", "USDC-ERC20",
            "USDT_TRC20", "USDT_ERC20", "USDC_ERC20",
            "USDT-POLYGON", "USDT_POLYGON",
          ]);
          let amountUsd: string | null = null;
          const baseCur = (fp.base_currency || "USD").toUpperCase();
          const baseAmt = Number(fp.base_amount) || 0;
          if (baseAmt > 0) {
            if (USD_PEGGED.has(baseCur)) {
              amountUsd = toFixedStr(baseAmt, 2);
            } else {
              try {
                const { convertToUSD } = await import("../currencyUtils");
                const converted = Number(await convertToUSD(baseCur, baseAmt));
                if (converted > 0) amountUsd = toFixedStr(converted, 2);
              } catch {
                amountUsd = null;
              }
            }
          }

          await sendFirstPaymentAdminEmail({
            user_id: fp.user_id,
            merchant_name: fp.merchant_name,
            merchant_email: fp.merchant_email,
            company_name: fp.company_name,
            company_id: fp.company_id,
            amount: fp.amount,
            currency: fp.currency,
            amount_usd: amountUsd,
            payment_method: fp.currency,
            customer_email: fp.customer_email,
            transaction_id: fp.tx_id,
            registered_at: regDate.toLocaleString("en-US", {
              dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
            }) + " UTC",
            days_since_registration: daysSinceReg,
          });

        } catch (fpErr) {
          log(`First Payment Monitor: Error for company ${fp.company_id}: ${fpErr}`, "error");
        }
      }

    } catch (e) {
      log(`First Payment Monitor Error: ${e}`, "error");
      captureError(e, 'cron', { extraContext: 'setupFirstPaymentMonitorCron' });
    }
  });

  log("First Payment Monitor Cron scheduled for every 15 minutes", "info");
};
