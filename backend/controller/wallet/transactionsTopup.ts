import express from "express";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { IUserType } from "../../utils/types";
import { errorResponseHelper, successResponseHelper } from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { validateCompanyOwnership } from "../../utils/validateCompanyOwnership";
import { getRedisItem, setRedisItemWithTTL } from "../../utils/redisInstance";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { normalizeLang } from "../../utils/emailI18n";
import { raw as envRaw } from "../../utils/config";
import { sendBuyerUnderpaidNudgeEmail } from "../../services/email/paymentEmails";
import { walletLogger } from "../../utils/loggers";

const RESEND_COOLDOWN_SECONDS = 10 * 60;

interface TopupRow {
  id: string;
  user_id: number;
  company_id: number | null;
  status: string;
  crypto_amount: number | null;
  received_amount: number | null;
  remaining_amount: number | null;
  currency: string | null;
  email: string | null;
  customer_name: string | null;
  company_name: string | null;
  payment_link: string | null;
}

const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, local.length - 2)))}@${domain}`;
};

/**
 * POST /api/wallet/transactions/:id/request-topup — re-send the buyer's
 * "you're almost there — send X more" email for an UNDERPAID payment.
 * Manual resend bypasses the automatic per-address dedupe but is throttled
 * to one send per 10 minutes per payment.
 */
export const requestTopup = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return errorResponseHelper(res, 400, "Transaction id is required.");

    const rows = (await sequelize.query(
      `SELECT ut.id, ut.user_id, COALESCE(ut.company_id, c.company_id) AS company_id, ut.status,
              ut.crypto_amount, ut.received_amount, ut.remaining_amount,
              COALESCE(NULLIF(uw.wallet_type, ''), NULLIF(ut.crypto_currency, ''), ut.base_currency) AS currency,
              c.email, c.customer_name, cm.company_name, pl.payment_link
       FROM tbl_user_transaction ut
       LEFT JOIN tbl_customer c ON c.customer_id = ut.customer_id
       LEFT JOIN tbl_company cm ON cm.company_id = COALESCE(ut.company_id, c.company_id)
       LEFT JOIN tbl_user_wallet uw ON uw.wallet_id = ut.wallet_id
       LEFT JOIN LATERAL (
         SELECT payment_link FROM tbl_payment_link
         WHERE transaction_reference = ut.transaction_reference AND ut.transaction_reference <> ''
         ORDER BY link_id DESC LIMIT 1
       ) pl ON TRUE
       WHERE ut.id::text = :id OR ut.transaction_id::text = :id
       ORDER BY (ut.id::text = :id) DESC
       LIMIT 1`,
      { replacements: { id }, type: QueryTypes.SELECT },
    )) as TopupRow[];
    const tx = rows[0];
    if (!tx) return errorResponseHelper(res, 404, "Transaction not found.");

    if (Number(tx.user_id) !== Number(userData.user_id)) {
      if (!tx.company_id) return errorResponseHelper(res, 404, "Transaction not found.");
      const company = await validateCompanyOwnership(res, String(tx.company_id), userData.user_id);
      if (!company) return;
    }

    if (String(tx.status).toLowerCase() !== "underpaid") {
      return errorResponseHelper(res, 409, "Only underpaid payments can be nudged for a top-up.");
    }
    const buyerEmail = String(tx.email || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) {
      return errorResponseHelper(res, 400, "No buyer e-mail is on file for this payment.");
    }

    const throttleKey = `topup-resend-${tx.id}`;
    const recent = await getRedisItem(throttleKey);
    if (recent && recent.sentAt) {
      return errorResponseHelper(res, 429, "A reminder was sent recently — try again in a few minutes.");
    }

    const expected = Number(tx.crypto_amount) || 0;
    const received = Number(tx.received_amount) || 0;
    const remaining = tx.remaining_amount != null ? Number(tx.remaining_amount) : Math.max(0, expected - received);
    const currency = String(tx.currency || "").toUpperCase();
    const checkoutBase = (envRaw("CHECKOUT_URL") || "https://checkout.dynopay.com").replace(/\/$/, "");
    const checkoutUrl = tx.payment_link || checkoutBase;

    let lang = "en";
    const refMatch = tx.payment_link?.match(/[?&]d=([A-Za-z0-9]+)/);
    if (refMatch) {
      const session = await getRedisItem(`customer-${refMatch[1]}`).catch(() => null);
      if (session?.language) lang = normalizeLang(session.language);
    }

    await sendBuyerUnderpaidNudgeEmail(
      buyerEmail,
      tx.customer_name || "",
      tx.company_name || "the merchant",
      formatCryptoAmount(received, currency),
      formatCryptoAmount(expected, currency),
      formatCryptoAmount(remaining, currency),
      currency,
      checkoutUrl,
      30,
      lang,
    );
    await setRedisItemWithTTL(throttleKey, { sentAt: new Date().toISOString(), by: userData.user_id }, RESEND_COOLDOWN_SECONDS);
    walletLogger.info(`[requestTopup] reminder re-sent for tx ${tx.id} → ${maskEmail(buyerEmail)} by user ${userData.user_id}`);

    return successResponseHelper(res, 200, "Top-up reminder sent.", {
      sent: true,
      email: maskEmail(buyerEmail),
      remaining: formatCryptoAmount(remaining, currency),
      currency,
    });
  } catch (e) {
    handleControllerError(res, e, walletLogger, { user_id: userData?.user_id });
  }
};
