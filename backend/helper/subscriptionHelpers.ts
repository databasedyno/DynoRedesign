/**
 * Safe Tatum subscription deletion helper.
 * Wraps tatumApi.deleteSubscription with null-check and error handling.
 */
import tatumApi from "../apis/tatumApi";
import { cronLogger } from "../utils/loggers";

/**
 * Safely delete a Tatum subscription by ID.
 * No-ops if subscriptionId is falsy. Logs and swallows errors.
 */
export async function safeDeleteSubscription(
  subscriptionId: string | number | null | undefined,
  context?: string,
): Promise<void> {
  if (!subscriptionId) return;
  try {
    await tatumApi.deleteSubscription(subscriptionId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    cronLogger.info(`Failed to delete subscription ${subscriptionId}${context ? ` (${context})` : ''}: ${msg}`);
  }
}
