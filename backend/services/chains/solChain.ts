/**
 * Solana Chain Strategy (SOL)
 * 
 * Handles fee estimation and transaction processing for Solana.
 * SOL has very low base fees (5000 lamports = 0.000005 SOL) with optional priority fees.
 */

import { FeeEstimate, ChainStrategy, IncomingTx } from './chainTypes';

const SOL_CURRENCIES = ['SOL'];

/**
 * SOL fee constants.
 */
export const SOL_FEE_CONSTANTS = {
  BASE_FEE_LAMPORTS: 5000,
  BASE_FEE_SOL: 0.000005,
  STANDARD_COMPUTE_UNITS: 200000,
  MIN_FAST_FEE_SOL: 0.00001, // 10k lamports floor
};

/**
 * Calculate SOL priority fee from micro-lamports per compute unit.
 */
export const calculateSolPriorityFee = (microLamportsPerCU: number): number => {
  return (microLamportsPerCU * SOL_FEE_CONSTANTS.STANDARD_COMPUTE_UNITS) / 1e15;
};

export const solStrategy: ChainStrategy = {
  currencies: SOL_CURRENCIES,

  async estimateFee(): Promise<FeeEstimate> {
    return {
      fast: SOL_FEE_CONSTANTS.MIN_FAST_FEE_SOL,
      medium: SOL_FEE_CONSTANTS.BASE_FEE_SOL,
      slow: SOL_FEE_CONSTANTS.BASE_FEE_SOL,
      unit: 'SOL',
      source: 'fallback',
    };
  },

  async getIncomingTransactions(
    address: string,
    currency: string,
    limit: number = 10
  ): Promise<IncomingTx[]> {
    return [];
  },
};

export default solStrategy;
