/**
 * UTXO Chain Strategy (BTC, LTC, DOGE, BCH)
 * 
 * Handles fee estimation and transaction processing for UTXO-based chains.
 * Extracted from tatumApi.ts feeEstimation if/else chain.
 */

import { FeeEstimate, ChainStrategy, IncomingTx } from './chainTypes';

const UTXO_CURRENCIES = ['BTC', 'LTC', 'DOGE', 'BCH'];

/**
 * Calculate UTXO transaction size in KB.
 * Formula: (inputs × 148) + (outputs × 34) + 10 overhead
 * 
 * @param inputs - Number of input UTXOs (min 2 for safety)
 * @param outputs - Number of outputs (default 2: merchant + admin fee)
 */
export const calculateUtxoTxSizeKb = (inputs: number = 1, outputs: number = 2): number => {
  const safeInputs = Math.max(inputs, 2);
  return (safeInputs * 148 + outputs * 34 + 10) / 1000;
};

export const utxoStrategy: ChainStrategy = {
  currencies: UTXO_CURRENCIES,

  async estimateFee(
    fromAddress: string,
    toAddress: string,
    amount: number
  ): Promise<FeeEstimate> {
    // Stub — actual implementation delegates to tatumApi.ts
    return { fast: 0.0001, medium: 0.00005, slow: 0.00003, unit: 'BTC', source: 'fallback' };
  },

  async getIncomingTransactions(
    address: string,
    currency: string,
    limit: number = 10
  ): Promise<IncomingTx[]> {
    return [];
  },
};

export default utxoStrategy;
