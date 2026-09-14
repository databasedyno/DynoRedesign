/**
 * TRON Chain Strategy (TRX, USDT-TRC20)
 * 
 * Handles fee estimation and transaction processing for TRON-based chains.
 * Extracted from tatumApi.ts feeEstimation if/else chain.
 */

import { FeeEstimate, ChainStrategy, IncomingTx } from './chainTypes';

const TRON_CURRENCIES = ['TRX', 'USDT-TRC20'];

/**
 * TRON fee constants.
 * Post Proposal #104 (Aug 2025): Energy reduced from 420 → 100 SUN/unit
 */
export const TRON_FEE_CONSTANTS = {
  ENERGY_PRICE_SUN: 100,
  TRC20_ENERGY_ESTIMATE: 65000,
  BANDWIDTH_FALLBACK_TRX: 0.3,
  NATIVE_FALLBACK_TRX: 1,
  TRC20_FALLBACK_TRX: 14,
};

export const tronStrategy: ChainStrategy = {
  currencies: TRON_CURRENCIES,

  async estimateFee(
    fromAddress: string,
    toAddress: string,
    amount: number
  ): Promise<FeeEstimate> {
    return { fast: 14, medium: 7, slow: 1, unit: 'TRX', source: 'fallback' };
  },

  async getIncomingTransactions(
    address: string,
    currency: string,
    limit: number = 10
  ): Promise<IncomingTx[]> {
    return [];
  },
};

export default tronStrategy;
