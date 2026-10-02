import {
  redis,
} from "../../utils/redisInstance";
import { walletLogger } from "../../utils/loggers";

// HTML escape utility to prevent XSS in email templates
export { escapeHtml } from "../../utils/escapeHtml";

/**
 * Builds parameterized WHERE conditions for transaction queries.
 * Used by getWalletTransactions and exportTransactions.
 */
export function buildTransactionFilters(
  userId: string | number,
  filters: { date_from?: string; date_to?: string; status?: string; currency?: string; search?: string; company_id?: string }
): { whereConditions: string; replacements: Record<string, unknown> } {
  const replacements: Record<string, unknown> = { user_id: userId };
  let whereConditions = `ut.user_id=:user_id`;
  if (filters.date_from) {
    whereConditions += ` AND ut."createdAt" >= :date_from`;
    replacements.date_from = filters.date_from;
  }
  if (filters.date_to) {
    whereConditions += ` AND ut."createdAt" <= :date_to`;
    replacements.date_to = filters.date_to;
  }
  if (filters.status) {
    whereConditions += ` AND ut.status = :status`;
    replacements.status = filters.status;
  }
  if (filters.currency) {
    whereConditions += ` AND ut.base_currency = :currency`;
    replacements.currency = filters.currency;
  }
  if (filters.search) {
    whereConditions += ` AND (ut.id ILIKE :search OR ut.transaction_reference ILIKE :search)`;
    replacements.search = `%${filters.search}%`;
  }
  if (filters.company_id) {
    whereConditions += ` AND (ut.company_id = :company_id OR cm.company_id = :company_id)`;
    replacements.company_id = parseInt(filters.company_id as string, 10);
  }
  return { whereConditions, replacements };
}

/**
 * Invalidate all wallet caches for a user
 * Called after any wallet modification (add, update, delete)
 */
export const invalidateWalletCache = async (userId: number): Promise<void> => {
  try {
    // Delete all wallet cache keys for this user using pattern matching
    const walletPattern = `wallet:${userId}:*`;
    const walletKeys = await redis.keys(walletPattern);
    if (walletKeys.length > 0) {
      await redis.del(walletKeys);
      walletLogger.info(`[WalletCache] Invalidated ${walletKeys.length} wallet cache keys for user ${userId}`);
    }
    
    // Also invalidate dashboard cache if it exists
    const dashboardPattern = `dashboard:${userId}:*`;
    const dashboardKeys = await redis.keys(dashboardPattern);
    if (dashboardKeys.length > 0) {
      await redis.del(dashboardKeys);
      walletLogger.info(`[WalletCache] Invalidated ${dashboardKeys.length} dashboard cache keys for user ${userId}`);
    }
    
    if (walletKeys.length === 0 && dashboardKeys.length === 0) {
      walletLogger.info(`[WalletCache] No cache keys found for user ${userId}`);
    }
  } catch (error) {
    walletLogger.error(`[WalletCache] Error invalidating cache for user ${userId}:`, error);
    // Don't throw - cache invalidation failure shouldn't break the main operation
  }
};

