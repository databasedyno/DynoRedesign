/**
 * Polygon Chain Strategy (POLYGON/POL, USDT-POLYGON)
 * 
 * Handles fee estimation and transaction processing for Polygon.
 * Polygon gas prices are volatile (30-800+ Gwei), requiring both SDK and RPC checks.
 */

import { FeeEstimate, ChainStrategy, IncomingTx } from './chainTypes';
import { toFixedStr } from "../../utils/money";

const POLYGON_CURRENCIES = ['POLYGON', 'USDT-POLYGON'];

/**
 * Polygon gas price bounds.
 * Gas can spike to 800+ Gwei on Polygon, so we need generous bounds.
 */
export const POLYGON_GAS_CONSTANTS = {
  MIN_GAS_GWEI: 25,
  MAX_GAS_GWEI: 1500,
  NATIVE_GAS_LIMIT: 21000,
  TOKEN_GAS_LIMIT: 65000,
  BUFFER_MULTIPLIER: 1.15,
  PRIORITY_TIP_GWEI: 0.5,
  USDT_CONTRACT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
};

/**
 * Calculate Polygon gas fee with buffering.
 */
export const calculatePolygonGasFee = (
  rawGasPrice: number,
  isToken: boolean,
  gasLimit?: number
): { fast: string; gasPrice: number; gasLimit: number } => {
  const effectiveGasLimit = gasLimit ?? (isToken ? POLYGON_GAS_CONSTANTS.TOKEN_GAS_LIMIT : POLYGON_GAS_CONSTANTS.NATIVE_GAS_LIMIT);
  const gasPrice = Math.max(
    POLYGON_GAS_CONSTANTS.MIN_GAS_GWEI,
    Math.min(POLYGON_GAS_CONSTANTS.MAX_GAS_GWEI, rawGasPrice)
  );
  const bufferedPrice = Math.ceil(gasPrice * POLYGON_GAS_CONSTANTS.BUFFER_MULTIPLIER + POLYGON_GAS_CONSTANTS.PRIORITY_TIP_GWEI);

  return {
    fast: toFixedStr(Number((bufferedPrice * effectiveGasLimit) / 1e9), 8),
    gasPrice: bufferedPrice,
    gasLimit: effectiveGasLimit,
  };
};

export const polygonStrategy: ChainStrategy = {
  currencies: POLYGON_CURRENCIES,

  async estimateFee(
    fromAddress: string,
    toAddress: string,
    amount: number,
    contractAddress?: string
  ): Promise<FeeEstimate> {
    return { fast: 0.005, medium: 0.003, slow: 0.001, unit: 'POL', source: 'fallback' };
  },

  async getIncomingTransactions(
    address: string,
    currency: string,
    limit: number = 10
  ): Promise<IncomingTx[]> {
    return [];
  },
};

export default polygonStrategy;
