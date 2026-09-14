/**
 * XRP Chain Strategy (XRP, RLUSD)
 * 
 * Handles fee estimation, transaction processing, and tag-based addressing.
 * XRP/RLUSD use a shared master address with destination tags for routing.
 * 
 * Key differences from other chains:
 * - Shared master address (tag-based routing)
 * - Redis keys include destination tag: crypto-{masterAddr}-tag-{destTag}
 * - Fee is in XRP drops (~12 drops = 0.000012 XRP)
 * - RLUSD is a trust-line token on XRP Ledger
 */

import { FeeEstimate, ChainStrategy, IncomingTx } from './chainTypes';

const XRP_CURRENCIES = ['XRP', 'RLUSD'];

/**
 * XRP fee constants.
 * XRP transaction fees are very low — ~12 drops (0.000012 XRP).
 * RLUSD uses the same XRP fee (it's a trust-line token).
 */
export const XRP_FEE_CONSTANTS = {
  BASE_FEE_DROPS: 12,
  BASE_FEE_XRP: 0.000012,
  FAST_FEE_XRP: 0.00005,
};

/**
 * Check if a currency uses tag-based addressing.
 */
export const isTagBased = (currency: string): boolean => {
  return XRP_CURRENCIES.includes(currency);
};

/**
 * Build Redis key for XRP/RLUSD payments.
 * Tag-based chains use: crypto-{masterAddress}-tag-{destinationTag}
 */
export const buildXrpRedisKey = (address: string, destinationTag?: number | null): string => {
  if (destinationTag !== undefined && destinationTag !== null) {
    return `crypto-${address}-tag-${destinationTag}`;
  }
  return `crypto-${address}`;
};

/**
 * Filter transactions by destination tag.
 * For XRP/RLUSD, only transactions matching the specific tag belong to this payment.
 */
export const filterByTag = (transactions: IncomingTx[], tag: number): IncomingTx[] => {
  return transactions.filter(tx => tx.destinationTag === tag);
};

export const xrpStrategy: ChainStrategy = {
  currencies: XRP_CURRENCIES,

  async estimateFee(): Promise<FeeEstimate> {
    // XRP fees are negligible and static
    return {
      fast: XRP_FEE_CONSTANTS.FAST_FEE_XRP,
      medium: XRP_FEE_CONSTANTS.BASE_FEE_XRP,
      slow: XRP_FEE_CONSTANTS.BASE_FEE_XRP,
      unit: 'XRP',
      source: 'dynamic',
    };
  },

  async getIncomingTransactions(
    address: string,
    currency: string,
    limit: number = 10,
    destinationTag?: number | null
  ): Promise<IncomingTx[]> {
    // Delegates to tatumApi.getIncomingTransactions with tag filter
    // This method is overridden by the actual implementation in tatumApi.ts
    return [];
  },
};

export default xrpStrategy;
