import { redis } from "./redisInstance";
import config from "./config";
import { cronLogger } from "./loggers";
import { sendTreasuryLowAlertEmail } from "../services/email/adminOpsEmails";

const THROTTLE_SECONDS = 3 * 60 * 60; // one admin alert per asset per 3h

/**
 * Fired when a payout/withdrawal cannot proceed because the Binance treasury for
 * that asset is too low. The payout is NOT failed — it waits for a top-up. This
 * only notifies the admin (throttled per asset) so ops can refill Binance.
 */
export const alertTreasuryLow = async (params: {
  asset: string;
  have: number;
  need: number;
  context: string;
}): Promise<void> => {
  const asset = (params.asset || "").toUpperCase();
  const { have, need, context } = params;
  try {
    const key = `treasury-alert:${asset}`;
    const already = await redis.get(key);
    if (already) {
      cronLogger.warn(`[TreasuryAlert] Low ${asset} (have ${have}, need ${need}, ${context}) — admin already alerted, throttled.`);
      return;
    }
    await redis.set(key, String(Date.now()), { EX: THROTTLE_SECONDS });
    const admin = config.adminEmail;
    if (admin) {
      await sendTreasuryLowAlertEmail(admin, asset, have, need, context);
    }
    cronLogger.warn(`[TreasuryAlert] Low ${asset} treasury — have ${have}, need ${need} (${context}). Admin alerted.`);
  } catch (e) {
    cronLogger.error(`[TreasuryAlert] failed: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export default { alertTreasuryLow };
