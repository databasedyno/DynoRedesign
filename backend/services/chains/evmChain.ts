/**
 * EVM Chain Strategy (ETH, USDT-ERC20, USDC-ERC20, RLUSD-ERC20)
 * 
 * Handles fee estimation and transaction processing for EVM-based chains.
 * Extracted from tatumApi.ts feeEstimation if/else chain.
 */

import { raw as envRaw } from "../../utils/config";
import { FeeEstimate, ChainStrategy, IncomingTx } from './chainTypes';
import { toFixedStr } from "../../utils/money";

const EVM_CURRENCIES = ['ETH', 'USDT-ERC20', 'USDC-ERC20', 'RLUSD-ERC20', 'BSC'];

const getContractAddress = (currency: string): string | undefined => {
  if (currency === 'USDC-ERC20') return envRaw("USDC_CONTRACT");
  if (currency === 'RLUSD-ERC20') return envRaw("RLUSD_ERC20_CONTRACT");
  if (currency === 'USDT-ERC20') return envRaw("ETH_CONTRACT");
  return undefined;
};

/**
 * Calculate EVM gas fee from raw parameters.
 * Consolidates the gasPrice capping + buffer logic that was duplicated.
 */
export const calculateEvmGasFee = (
  rawGasPrice: number,
  gasLimit: number,
  isToken: boolean,
  options: { minGas?: number; maxGas?: number; bufferMultiplier?: number; priorityTip?: number } = {}
): { fast: string; medium?: string; slow?: string; gasPrice: number; gasLimit: number } => {
  const minGas = options.minGas ?? 1;
  const maxGas = options.maxGas ?? 50;
  const bufferMultiplier = options.bufferMultiplier ?? 1.15;
  const priorityTip = options.priorityTip ?? 0.5;

  const gasPrice = Math.max(minGas, Math.min(maxGas, Math.ceil(rawGasPrice)));
  const bufferedGasPrice = Math.ceil(gasPrice * bufferMultiplier + priorityTip);

  // For native transfers (ETH, POL): gasLimit is always fixed (21000 for simple transfer).
  // Speed tiers vary gasPrice buffer, NOT gasLimit — reducing gasLimit below 21000 causes
  // "intrinsic gas too low" on-chain failures.
  // For token transfers (ERC20): gasLimit comes from SDK estimate and stays as-is.
  const effectiveGasLimit = isToken ? gasLimit : Math.max(gasLimit, 21000);

  const result: { fast: string; medium?: string; slow?: string; gasPrice: number; gasLimit: number } = {
    fast: toFixedStr(Number((bufferedGasPrice * effectiveGasLimit) / 1e9), 8),
    gasPrice: bufferedGasPrice,
    gasLimit: effectiveGasLimit,
  };

  if (!isToken) {
    // Speed tiers: vary gas price buffer (not gas limit) for native transfers
    const mediumGasPrice = Math.ceil(gasPrice * 1.0 + priorityTip * 0.5); // Base price + half tip
    const slowGasPrice = Math.ceil(gasPrice * 0.9); // 10% below market, no tip
    result.medium = toFixedStr(Number((mediumGasPrice * effectiveGasLimit) / 1e9), 8);
    result.slow = toFixedStr(Number((slowGasPrice * effectiveGasLimit) / 1e9), 8);
  }

  return result;
};

export const evmStrategy: ChainStrategy = {
  currencies: EVM_CURRENCIES,

  async estimateFee(
    fromAddress: string,
    toAddress: string,
    amount: number,
    contractAddress?: string
  ): Promise<FeeEstimate> {
    // Stub — actual implementation delegates to tatumApi.ts
    // This is the target interface for gradual migration
    return { fast: 0.001, medium: 0.0005, slow: 0.0003, unit: 'ETH', source: 'fallback' };
  },

  async getIncomingTransactions(
    address: string,
    currency: string,
    limit: number = 10
  ): Promise<IncomingTx[]> {
    // Stub — delegates to tatumApi.getIncomingTransactions
    return [];
  },
};

export default evmStrategy;
