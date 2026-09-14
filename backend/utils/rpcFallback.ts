/**
 * SDK-to-RPC Fallback Utility
 * 
 * Provides a unified pattern for calling Tatum SDK with automatic RPC fallback.
 * Instead of ad-hoc try/catch blocks scattered across tatumApi.ts,
 * all SDK calls can use this wrapper for consistent error handling and fallback.
 * 
 * Usage:
 *   const result = await withSdkFallback(
 *     () => tatumSdk.blockchain.eth.ethGetBalance(address),
 *     () => callRpcFallback('eth_getBalance', [address, 'latest']),
 *     { operation: 'getBalance', chain: 'ETH', address }
 *   );
 */

import { cronLogger } from './loggers';

interface FallbackContext {
  operation: string;
  chain: string;
  address?: string;
  txId?: string;
}

interface FallbackOptions {
  /** Max time to wait for SDK call (ms) */
  sdkTimeout?: number;
  /** Max time to wait for RPC fallback (ms) */
  rpcTimeout?: number;
  /** Whether to log the fallback event */
  logFallback?: boolean;
  /** Custom error filter - return true to skip RPC fallback for this error */
  skipFallbackOn?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: FallbackOptions = {
  sdkTimeout: 15000,
  rpcTimeout: 10000,
  logFallback: true,
};

// Track fallback frequency for diagnostics
const fallbackMetrics: Record<string, { count: number; lastAt: Date }> = {};

/**
 * Execute an SDK call with automatic RPC fallback.
 * 
 * 1. Tries the SDK call first
 * 2. If SDK fails, logs the error and tries the RPC fallback
 * 3. If both fail, throws the RPC error (or SDK error if no fallback provided)
 */
export async function withSdkFallback<T>(
  sdkCall: () => Promise<T>,
  rpcFallback: (() => Promise<T>) | null,
  context: FallbackContext,
  options: FallbackOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const metricKey = `${context.chain}:${context.operation}`;

  try {
    // Attempt SDK call with timeout
    const result = await Promise.race([
      sdkCall(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`SDK timeout after ${opts.sdkTimeout}ms`)), opts.sdkTimeout)
      ),
    ]);
    return result;
  } catch (sdkError: unknown) {
    const sdkErr = sdkError as { message?: string; response?: { status?: number } };
    const sdkMsg = sdkErr?.message || 'Unknown SDK error';

    // Check if we should skip fallback for this error type
    if (opts.skipFallbackOn && sdkError instanceof Error && opts.skipFallbackOn(sdkError)) {
      throw sdkError;
    }

    if (!rpcFallback) {
      throw sdkError;
    }

    // Log the fallback
    if (opts.logFallback) {
      const metric = fallbackMetrics[metricKey] || { count: 0, lastAt: new Date() };
      metric.count++;
      metric.lastAt = new Date();
      fallbackMetrics[metricKey] = metric;

      cronLogger.warn(
        `[RpcFallback] ${context.chain}.${context.operation} SDK failed (${sdkMsg}), ` +
        `using RPC fallback (occurrence #${metric.count})` +
        (context.address ? ` [addr: ${context.address.substring(0, 10)}...]` : '') +
        (context.txId ? ` [tx: ${context.txId.substring(0, 10)}...]` : '')
      );
    }

    try {
      // Attempt RPC fallback with timeout
      const result = await Promise.race([
        rpcFallback(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`RPC timeout after ${opts.rpcTimeout}ms`)), opts.rpcTimeout)
        ),
      ]);
      return result;
    } catch (rpcError: unknown) {
      const rpcErr = rpcError as { message?: string };
      cronLogger.error(
        `[RpcFallback] ${context.chain}.${context.operation} BOTH SDK and RPC failed. ` +
        `SDK: ${sdkMsg}, RPC: ${rpcErr?.message || 'Unknown RPC error'}`
      );
      cronLogger?.error?.(`[RpcFallback] Double failure: ${metricKey}`, rpcError);
      throw rpcError;
    }
  }
}

