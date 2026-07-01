/**
 * Pending Payment Notification Service
 * Handles notifications for unconfirmed/pending crypto payments
 */

import { QueryTypes } from "sequelize";
import { cronLogger } from "../utils/loggers";
import sequelize from "../utils/dbInstance";
import { normalizeLang } from "../utils/emailI18n";
import { createNotification, NOTIFICATION_TYPES } from "../controller/notificationController";
import { 
  sendPaymentPendingEmail, 
  sendPaymentConfirmingEmail,
  sendPaymentPartialEmail,
  sendPaymentPartialExpiredEmail
} from "../helper";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";
import { getCompanyBaseCurrency, convertToUSD, convertToFiat } from "../utils/currencyUtils";

/**
 * Convert a received crypto amount into the merchant's fiat display currency
 * (company base currency, defaulting to USD) so payment emails show the amount
 * the merchant actually understands. Returns the fiat amount as the primary
 * amount/currency and the crypto as a secondary line. Falls back to showing the
 * crypto amount as primary if conversion is unavailable.
 */
const computeFiatForEmail = async (
  companyId: number | undefined,
  cryptoCurrency: string,
  cryptoAmount: number,
): Promise<{ fiatAmount: string; fiatCurrency: string; cryptoAmount?: string; cryptoCurrency?: string }> => {
  const fallback = { fiatAmount: cryptoAmount.toString(), fiatCurrency: cryptoCurrency };
  try {
    if (!cryptoAmount || cryptoAmount <= 0) return fallback;
    const baseCurrency = await getCompanyBaseCurrency(companyId);
    const usd = await convertToUSD(cryptoCurrency, cryptoAmount);
    if (!usd || usd <= 0 || Number.isNaN(usd)) return fallback;
    const fiat = baseCurrency === "USD" ? usd : (await convertToFiat("USD", baseCurrency, usd)).amount;
    if (!fiat || fiat <= 0 || Number.isNaN(fiat)) return fallback;
    return {
      fiatAmount: fiat.toFixed(2),
      fiatCurrency: baseCurrency,
      cryptoAmount: Number(cryptoAmount).toString(),
      cryptoCurrency,
    };
  } catch {
    return fallback;
  }
};

// Confirmation requirements by blockchain
export const CONFIRMATION_REQUIREMENTS: Record<string, number> = {
  BTC: 1,      // 1 confirmation for BTC (can be increased for larger amounts)
  ETH: 12,     // 12 confirmations for ETH
  LTC: 6,      // 6 confirmations for LTC
  DOGE: 6,     // 6 confirmations for DOGE
  BCH: 6,      // 6 confirmations for BCH
  TRX: 19,     // 19 confirmations for TRON
  "USDT-TRC20": 19,
  "USDT-ERC20": 12,
};

// Estimated confirmation times (in minutes)
export const ESTIMATED_CONFIRMATION_TIMES: Record<string, string> = {
  BTC: "10-60 minutes",
  ETH: "1-5 minutes",
  LTC: "2-30 minutes",
  DOGE: "1-10 minutes",
  BCH: "10-60 minutes",
  TRX: "1-3 minutes",
  "USDT-TRC20": "1-3 minutes",
  "USDT-ERC20": "1-5 minutes",
};

// PendingPaymentData interface removed - not used

/**
 * Send pending payment notification when transaction is first detected
 */
export const sendPendingPaymentNotification = async (
  address: string,
  txId: string,
  amount: number,
  currency: string,
  customerData: { name?: string; email?: string; phone?: string; metadata?: Record<string, unknown>; adm_id?: number; company_id?: number; amount?: number }
): Promise<boolean> => {
  try {
    // Check if we already sent a pending notification for this transaction
    const pendingKey = `pending-notif-${txId}`;
    const existingNotification = await getRedisItem(pendingKey);
    
    if (existingNotification && existingNotification.sent) {
      cronLogger.info(`Pending notification already sent for tx: ${txId}`);
      return false;
    }
    
    // RACE CONDITION FIX: Set flag immediately before doing any work
    // to prevent duplicate notifications from concurrent webhook calls
    await setRedisItem(pendingKey, {
      sent: true,
      sentAt: new Date().toISOString(),
      txId,
      address,
      status: 'sending', // Will be updated to 'completed' after success
    });

    // Get user and company details
    // FIX: Filter by company_id to avoid picking wrong company when user owns multiple
    const companyFilter = customerData.company_id
      ? `AND c.company_id = :companyId`
      : '';
    const userResult = await sequelize.query(
      `SELECT u.user_id, u.name, u.email, u.language, c.company_name, c.company_id
       FROM tbl_user u
       JOIN tbl_company c ON c.user_id = u.user_id
       WHERE u.user_id = :userId ${companyFilter}
       LIMIT 1`,
      {
        replacements: { userId: customerData.adm_id, companyId: customerData.company_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (!userResult || userResult.length === 0) {
      cronLogger.info("User not found for pending notification");
      return false;
    }

    const user = userResult[0] as { user_id: number; name: string; email: string; language: string; company_name: string; company_id: number };
    const confirmationsRequired = CONFIRMATION_REQUIREMENTS[currency] || 1;

    // Create in-app notification
    await createNotification(
      user.user_id,
      NOTIFICATION_TYPES.PAYMENT_PENDING,
      "Payment Pending Confirmation",
      `A payment of ${amount} ${currency} has been detected and is awaiting blockchain confirmation. Transaction ID: ${txId.substring(0, 16)}...`,
      {
        tx_id: txId,
        amount: amount,
        currency: currency,
        address: address,
        confirmations_required: confirmationsRequired,
        estimated_time: ESTIMATED_CONFIRMATION_TIMES[currency] || "1-10 minutes",
        status: "pending",
      },
      customerData.company_id
    );

    // Send email notification — show the amount in the merchant's fiat currency
    // (primary) with the crypto amount as a secondary line (Issue #6).
    const pendingFiat = await computeFiatForEmail(
      customerData.company_id ?? user.company_id,
      currency,
      Number(amount),
    );
    await sendPaymentPendingEmail(
      user.email,
      user.name,
      user.company_name,
      pendingFiat.fiatAmount,
      pendingFiat.fiatCurrency,
      txId,
      confirmationsRequired,
      normalizeLang(user.language),
      pendingFiat.cryptoAmount,
      pendingFiat.cryptoCurrency
    );

    // Mark notification as completed in Redis (expires in 24 hours)
    await setRedisItem(pendingKey, {
      sent: true,
      sentAt: new Date().toISOString(),
      txId,
      address,
      userId: user.user_id,
      status: 'completed',
    });

    cronLogger.info(`Pending payment notification sent for tx: ${txId}`);
    return true;

  } catch (error) {
    cronLogger.error("Error sending pending payment notification:", error);
    return false;
  }
};

/**
 * Send confirmation progress notification
 * Called when we receive updates about confirmation count
 */
export const sendConfirmationProgressNotification = async (
  txId: string,
  currentConfirmations: number,
  currency: string,
  customerData: { name?: string; email?: string; phone?: string; metadata?: Record<string, unknown>; adm_id?: number; company_id?: number; amount?: number }
): Promise<boolean> => {
  try {
    const requiredConfirmations = CONFIRMATION_REQUIREMENTS[currency] || 1;
    
    // Only send progress updates at certain milestones (25%, 50%, 75%, 100%)
    const progressPercent = (currentConfirmations / requiredConfirmations) * 100;
    const milestones = [25, 50, 75, 100];
    const nearestMilestone = milestones.find(m => progressPercent >= m && progressPercent < m + 25);
    
    if (!nearestMilestone) return false;

    // Check if we already sent this milestone notification
    const milestoneKey = `confirm-milestone-${txId}-${nearestMilestone}`;
    const existingMilestone = await getRedisItem(milestoneKey);
    
    if (existingMilestone && existingMilestone.sent) {
      return false;
    }

    // Get user details — filter by company_id to avoid wrong company for multi-company users
    const confirmCompanyFilter = customerData.company_id
      ? `AND c.company_id = :companyId`
      : '';
    const userResult = await sequelize.query(
      `SELECT u.user_id, u.name, u.email, u.language, c.company_name
       FROM tbl_user u
       JOIN tbl_company c ON c.user_id = u.user_id
       WHERE u.user_id = :userId ${confirmCompanyFilter}
       LIMIT 1`,
      {
        replacements: { userId: customerData.adm_id, companyId: customerData.company_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (!userResult || userResult.length === 0) {
      return false;
    }

    const user = userResult[0] as { user_id: number; name: string; email: string; language: string; company_name: string; company_id: number };

    // Create in-app notification for progress
    await createNotification(
      user.user_id,
      NOTIFICATION_TYPES.PAYMENT_CONFIRMING,
      `Payment Confirming (${currentConfirmations}/${requiredConfirmations})`,
      `Your payment is being confirmed on the ${currency} network. ${currentConfirmations} of ${requiredConfirmations} confirmations received.`,
      {
        tx_id: txId,
        currency: currency,
        current_confirmations: currentConfirmations,
        required_confirmations: requiredConfirmations,
        progress_percent: progressPercent,
        status: currentConfirmations >= requiredConfirmations ? "confirmed" : "confirming",
      },
      customerData.company_id
    );

    // Send email for significant milestones (50% and 100%)
    if (nearestMilestone >= 50) {
      const confirmingFiat = await computeFiatForEmail(
        customerData.company_id ?? user.company_id,
        currency,
        Number(customerData.amount || 0),
      );
      await sendPaymentConfirmingEmail(
        user.email,
        user.name,
        user.company_name,
        confirmingFiat.fiatAmount,
        confirmingFiat.fiatCurrency,
        txId,
        currentConfirmations,
        requiredConfirmations,
        normalizeLang(user.language),
        confirmingFiat.cryptoAmount,
        confirmingFiat.cryptoCurrency
      );
    }

    // Mark milestone as sent
    await setRedisItem(milestoneKey, {
      sent: true,
      sentAt: new Date().toISOString(),
      milestone: nearestMilestone,
    });

    return true;

  } catch (error) {
    cronLogger.error("Error sending confirmation progress notification:", error);
    return false;
  }
};

/**
 * Get confirmation count for a transaction
 * Uses Tatum API to check current confirmations
 */
export const getTransactionConfirmations = async (
  _txId: string,
  currency: string
): Promise<number> => {
  try {
    // This would typically call Tatum API to get confirmation count
    // For now, we'll implement a placeholder that can be enhanced
    const tatumKey = process.env.TATUM_KEY;
    
    if (!tatumKey) {
      cronLogger.info("Tatum key not configured");
      return 0;
    }

    // Map currency to Tatum chain
    const chainMap: Record<string, string> = {
      BTC: "bitcoin",
      ETH: "ethereum",
      LTC: "litecoin",
      DOGE: "dogecoin",
      BCH: "bitcoin-cash",
      TRX: "tron",
      "USDT-TRC20": "tron",
      "USDT-ERC20": "ethereum",
    };

    const chain = chainMap[currency];
    if (!chain) {
      cronLogger.info(`Unknown chain for currency: ${currency}`);
      return 0;
    }

    // Placeholder - in production, call Tatum API:
    // const response = await axios.get(
    //   `https://api.tatum.io/v3/${chain}/transaction/${txId}`,
    //   { headers: { "x-api-key": tatumKey } }
    // );
    // return response.data.confirmations || 0;

    return 0;

  } catch (error) {
    cronLogger.error("Error getting transaction confirmations:", error);
    return 0;
  }
};

/**
 * Send partial payment notification
 * Called when a payment is detected but amount is less than expected
 */
export const sendPartialPaymentNotification = async (
  address: string,
  txId: string,
  receivedAmount: number,
  expectedAmount: number,
  currency: string,
  customerData: { name?: string; email?: string; phone?: string; metadata?: Record<string, unknown>; adm_id?: number; company_id?: number; amount?: number },
  gracePeriodMinutes: number = 30
): Promise<boolean> => {
  try {
    // Check if we already sent a partial notification for this address
    const partialKey = `partial-notif-${address}`;
    const existingNotification = await getRedisItem(partialKey);
    
    if (existingNotification && existingNotification.sent) {
      cronLogger.info(`Partial notification already sent for address: ${address}`);
      return false;
    }

    // Get user and company details — filter by company_id for multi-company users
    const partialCompanyFilter = customerData.company_id
      ? `AND c.company_id = :companyId`
      : '';
    const userResult = await sequelize.query(
      `SELECT u.user_id, u.name, u.email, u.language, c.company_name, c.company_id
       FROM tbl_user u
       JOIN tbl_company c ON c.user_id = u.user_id
       WHERE u.user_id = :userId ${partialCompanyFilter}
       LIMIT 1`,
      {
        replacements: { userId: customerData.adm_id, companyId: customerData.company_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (!userResult || userResult.length === 0) {
      cronLogger.info("User not found for partial payment notification");
      return false;
    }

    const user = userResult[0] as { user_id: number; name: string; email: string; language: string; company_name: string; company_id: number };
    const remainingAmount = (expectedAmount - receivedAmount).toFixed(8);

    // Create in-app notification
    await createNotification(
      user.user_id,
      NOTIFICATION_TYPES.PAYMENT_PARTIAL,
      "Partial Payment Received",
      `A partial payment of ${receivedAmount} ${currency} has been received. Expected: ${expectedAmount} ${currency}. Please send the remaining ${remainingAmount} ${currency} within ${gracePeriodMinutes} minutes to complete this payment.`,
      {
        tx_id: txId,
        received_amount: receivedAmount,
        expected_amount: expectedAmount,
        remaining_amount: remainingAmount,
        currency: currency,
        address: address,
        grace_period_minutes: gracePeriodMinutes,
        expires_at: new Date(Date.now() + gracePeriodMinutes * 60 * 1000).toISOString(),
        status: "partial",
      },
      customerData.company_id
    );

    // Send email notification
    await sendPaymentPartialEmail(
      user.email,
      user.name,
      user.company_name,
      receivedAmount.toString(),
      expectedAmount.toString(),
      remainingAmount,
      currency,
      txId,
      address,
      gracePeriodMinutes,
      normalizeLang(user.language)
    );

    // Mark notification as sent in Redis (expires in 2 hours)
    await setRedisItem(partialKey, {
      sent: true,
      sentAt: new Date().toISOString(),
      txId,
      address,
      userId: user.user_id,
      receivedAmount,
      expectedAmount,
    });

    cronLogger.info(`Partial payment notification sent for address: ${address}`);
    return true;

  } catch (error) {
    cronLogger.error("Error sending partial payment notification:", error);
    return false;
  }
};

/**
 * Send partial payment expired notification
 * Called when the grace period expires for a partial payment
 */
export const sendPartialPaymentExpiredNotification = async (
  address: string,
  txId: string,
  receivedAmount: number,
  expectedAmount: number,
  currency: string,
  userId: number,
  companyId: number,
  status: "completed_partial" | "incomplete_expired"
): Promise<boolean> => {
  try {
    // Get user and company details — filter by companyId for multi-company users
    const expiredCompanyFilter = companyId
      ? `AND c.company_id = :companyId`
      : '';
    const userResult = await sequelize.query(
      `SELECT u.user_id, u.name, u.email, u.language, c.company_name
       FROM tbl_user u
       JOIN tbl_company c ON c.user_id = u.user_id
       WHERE u.user_id = :userId ${expiredCompanyFilter}
       LIMIT 1`,
      {
        replacements: { userId, companyId },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (!userResult || userResult.length === 0) {
      cronLogger.info("User not found for partial expired notification");
      return false;
    }

    const user = userResult[0] as { user_id: number; name: string; email: string; language: string; company_name: string; company_id: number };
    const isCompleted = status === "completed_partial";

    // Create in-app notification
    await createNotification(
      user.user_id,
      NOTIFICATION_TYPES.PAYMENT_PARTIAL_EXPIRED,
      isCompleted ? "Partial Payment Processed" : "Partial Payment Expired",
      isCompleted
        ? `Your partial payment of ${receivedAmount} ${currency} has been processed. The funds have been forwarded with adjusted fees.`
        : `The grace period for your partial payment has expired. Received ${receivedAmount} of ${expectedAmount} ${currency}. The partial amount has been processed.`,
      {
        tx_id: txId,
        received_amount: receivedAmount,
        expected_amount: expectedAmount,
        currency: currency,
        address: address,
        status: status,
        processed_at: new Date().toISOString(),
      },
      companyId
    );

    // Send email notification
    await sendPaymentPartialExpiredEmail(
      user.email,
      user.name,
      user.company_name,
      receivedAmount.toString(),
      expectedAmount.toString(),
      currency,
      txId,
      status,
      normalizeLang(user.language)
    );

    cronLogger.info(`Partial payment expired notification sent for address: ${address}, status: ${status}`);
    return true;

  } catch (error) {
    cronLogger.error("Error sending partial payment expired notification:", error);
    return false;
  }
};

export default {
  sendPendingPaymentNotification,
  sendConfirmationProgressNotification,
  sendPartialPaymentNotification,
  sendPartialPaymentExpiredNotification,
  getTransactionConfirmations,
  CONFIRMATION_REQUIREMENTS,
  ESTIMATED_CONFIRMATION_TIMES,
};
