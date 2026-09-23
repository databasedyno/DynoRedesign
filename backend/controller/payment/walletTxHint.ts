/**
 * POST /api/pay/walletTxSubmitted — the hosted checkout's "Pay with wallet" just
 * broadcast a transaction from the buyer's connected wallet. We only record the
 * hash as a hint (Redis, 48h) so support can trace a stuck payment; detection and
 * confirmation still come from the chain listeners / Tatum webhooks.
 */
import express from "express";
import successResponseHelper from "../../helper/successResponseHelper";
import errorResponseHelper from "../../helper/errorResponseHelper";
import { getRedisItem, setRedisItemWithTTL } from "../../utils/redisInstance";
import { apiLogger } from "../../utils/loggers";

export const walletTxSubmitted = async (req: express.Request, res: express.Response) => {
  try {
    const { data, payment_id, tx_hash, address, coin, wallet_name, from_address } = req.body || {};
    const hash = String(tx_hash || "").trim();
    const addr = String(address || "").trim();
    if (!/^[A-Za-z0-9]{20,128}$/.test(hash)) return errorResponseHelper(res, 400, "Invalid transaction hash.");
    if (!addr || addr.length > 128) return errorResponseHelper(res, 400, "Payment address is required.");
    const ref = typeof data === "string" && data ? data : "";
    // Bind the hint to the live checkout session when we have it (customer-<ref>).
    const session = ref ? ((await getRedisItem(`customer-${ref}`)) as Record<string, unknown> | null) : null;
    const rec = {
      ref, payment_id: String(payment_id || "").slice(0, 80), tx_hash: hash, address: addr,
      coin: String(coin || "").slice(0, 24), from_address: String(from_address || "").slice(0, 128),
      wallet_name: String(wallet_name || "").slice(0, 60), session_found: !!session, at: new Date().toISOString(),
    };
    await setRedisItemWithTTL(`pay:wallettx:${addr}`, rec, 48 * 3600);
    apiLogger.info(`[pay.walletTxSubmitted] ${rec.coin} → ${addr.slice(0, 10)}… tx ${hash.slice(0, 12)}… via ${rec.wallet_name || "wallet"}`);
    return successResponseHelper(res, 200, "Transaction noted — waiting for network confirmations.", { tx_hash: hash });
  } catch (e) {
    apiLogger.error(`[pay.walletTxSubmitted] ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not record the transaction.");
  }
};

export default walletTxSubmitted;
