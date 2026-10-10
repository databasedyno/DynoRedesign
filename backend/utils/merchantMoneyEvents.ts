import { redis } from "./redisInstance";
import { apiLogger } from "./loggers";
import { sendToUser } from "../services/sseService";

// Every per-user Redis cache that holds fiat totals (dashboard, overview, payouts,
// brands, chart, fee tiers, recent tx, wallets, invoice period summary).
const moneyCachePatterns = (userId: number) => [
  `dashboard:${userId}:*`,
  `dashboard:*:${userId}:*`,
  `chart:${userId}:*`,
  `feeTiers:${userId}:*`,
  `recentTx:${userId}:*`,
  `wallet:${userId}:*`,
  `invoices:period:${userId}:*`,
];

export const invalidateMerchantMoneyCaches = async (userId: number): Promise<void> => {
  if (!userId) return;
  try {
    const keyLists = await Promise.all(moneyCachePatterns(userId).map((p) => redis.keys(p)));
    const keys = [...new Set(keyLists.flat())];
    if (keys.length) await redis.del(keys);
  } catch (err) {
    apiLogger.warn(`[MoneyEvents] cache invalidation failed for user ${userId}: ${(err as Error).message}`);
  }
};

/** Payment/currency change: drop stale fiat caches, then tell the merchant's open tabs to refresh. */
export const notifyMerchantMoneyChange = async (
  userId: number,
  data: { reason: "payment" | "currency"; type?: string; transaction_id?: string | number | null; company_id?: number | null },
): Promise<void> => {
  if (!userId) return;
  await invalidateMerchantMoneyCaches(userId);
  try {
    sendToUser(userId, "money_update", { ...data, at: Date.now() });
  } catch {
    /* SSE is best-effort */
  }
};
