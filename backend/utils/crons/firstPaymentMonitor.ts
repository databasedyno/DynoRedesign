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
import { resolveTransactionSource } from "../transactionSource";

export const setupFirstPaymentMonitorCron = () => {
  // Run every 15 minutes at minute 5, 20, 35, 50
  cron.schedule("5,20,35,50 * * * *", async () => {
    try {
      const { getRedisItem, setRedisItemWithTTL } = await import("../redisInstance");
      const { sendFirstPaymentAdminEmail, sendFirstPaymentMerchantEmail } = await import("../../services/emailService");

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
        company_country: string | null;
        merchant_country_code: string | null;
        company_website: string | null;
        source_link_id: number | null;
        source_link_type: string | null;
        source_link_title: string | null;
        source_parent_link_id: number | null;
        source_parent_title: string | null;
        source_parent_is_tip_jar: boolean | null;
        source_order_id: number | null;
        source_order_ref: string | null;
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
          t."createdAt" as tx_created_at,
          c.country as company_country,
          c.merchant_country_code,
          c.website as company_website,
          pl.link_id           as source_link_id,
          pl.link_type         as source_link_type,
          pl.title             as source_link_title,
          pl.parent_link_id    as source_parent_link_id,
          parent_pl.title      as source_parent_title,
          parent_pl.is_tip_jar as source_parent_is_tip_jar,
          po.order_id          as source_order_id,
          po.public_ref        as source_order_ref
        FROM tbl_company c
        JOIN tbl_user u ON u.user_id = c.user_id
        JOIN tbl_customer_transaction t ON t.company_id = c.company_id
        LEFT JOIN tbl_customer cust ON cust.customer_id = t.customer_id
        LEFT JOIN (
          SELECT DISTINCT ON (transaction_reference)
            transaction_reference, link_id, link_type, title, parent_link_id, is_tip_jar
          FROM tbl_payment_link
          WHERE transaction_reference IS NOT NULL AND transaction_reference <> ''
          ORDER BY transaction_reference, link_id DESC
        ) pl ON pl.transaction_reference = t.transaction_reference
          AND t.transaction_reference IS NOT NULL AND t.transaction_reference <> ''
        LEFT JOIN tbl_payment_link parent_pl ON parent_pl.link_id = pl.parent_link_id
        LEFT JOIN tbl_product_order po ON po.payment_link_id = pl.link_id
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

          // Classify WHERE the payment came from (API / payment link / store /
          // donation / tip / direct) — identical taxonomy to the /transactions page.
          const src = resolveTransactionSource({
            source_company_id: fp.company_id,
            source_order_id: fp.source_order_id,
            source_order_ref: fp.source_order_ref,
            source_link_id: fp.source_link_id,
            source_link_type: fp.source_link_type,
            source_link_title: fp.source_link_title,
            source_parent_link_id: fp.source_parent_link_id,
            source_parent_title: fp.source_parent_title,
            source_parent_is_tip_jar: fp.source_parent_is_tip_jar,
            customer_email: fp.customer_email,
          });

          // Platform-activity snapshot so the admin sees what the new merchant
          // has actually built/used, not just the single payment.
          const [activity] = await sequelize.query<{
            api_requests: string | number;
            payment_links: string | number;
            invoices: string | number;
            webhook_deliveries: string | number;
          }>(
            `SELECT
              (SELECT COALESCE(SUM(request_count), 0) FROM tbl_api WHERE company_id = :cid) as api_requests,
              (SELECT COUNT(*) FROM tbl_payment_link WHERE company_id = :cid) as payment_links,
              (SELECT COUNT(*) FROM tbl_invoice WHERE company_id = :cid) as invoices,
              (SELECT COUNT(*) FROM tbl_webhook_delivery_log WHERE company_id = :cid AND status = 'success') as webhook_deliveries`,
            { replacements: { cid: fp.company_id }, type: QueryTypes.SELECT }
          );

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
            country: fp.company_country || fp.merchant_country_code || null,
            website: fp.company_website || null,
            payment_type: src.type,
            activity: {
              apiRequests: Number(activity?.api_requests) || 0,
              paymentLinks: Number(activity?.payment_links) || 0,
              invoices: Number(activity?.invoices) || 0,
              webhookDeliveries: Number(activity?.webhook_deliveries) || 0,
            },
          });

          // Merchant-facing "your first payment landed" celebration (same dedup guard).
          if (fp.merchant_email) {
            try {
              await sendFirstPaymentMerchantEmail(
                fp.merchant_email,
                fp.merchant_name || "there",
                fp.company_name || "your business",
                `${fp.amount} ${fp.currency}`,
                amountUsd,
              );
            } catch (mErr) {
              log(`First Payment Monitor: merchant celebration email failed for company ${fp.company_id}: ${mErr}`, "error");
            }
          }

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
