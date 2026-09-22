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
 * Lowest gas price (gwei) an EVM payout is ever quoted/broadcast at. Post-Dencun mainnet
 * often trades at 0.1–0.3 gwei; the broadcast path (directEvmTransfer) signs EIP-1559
 * transactions at decimal gwei, so this is a real floor — not an integer rounding artefact.
 */
export const EVM_MIN_GWEI = 0.05;
const roundGwei = (g: number): number => Math.round(g * 10000) / 10000;

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
  const minGas = options.minGas ?? EVM_MIN_GWEI;
  const maxGas = options.maxGas ?? 50;
  const bufferMultiplier = options.bufferMultiplier ?? 1.15;
  const priorityTip = options.priorityTip ?? EVM_MIN_GWEI;

  // Decimal gwei end-to-end: the estimate is what the merchant is charged AND the maxFeePerGas
  // cap the ethers.js broadcast signs with. Actual cost on-chain = baseFee + priority tip
  // (EIP-1559 refunds the rest), so a ×1.15 buffer + a tip-sized allowance is enough headroom.
  const raw = Number(rawGasPrice) || 0;
  const gasPrice = roundGwei(Math.max(minGas, Math.min(maxGas, raw)));
  const bufferedGasPrice = roundGwei(gasPrice * bufferMultiplier + priorityTip);

  // For native transfers (ETH, POL): an EOA→EOA transfer burns exactly 21000 gas. The SDK's
  // fee estimate is requested as TRANSFER_NFT (there is no "native" type) and comes back with
  // a padded 100000 limit — broadcasting that padded limit forces the sender to hold
  // value + 100000×price up front AND made merchants pay for 100000 gas that was refunded
  // on-chain (~5× over-charge). Use 21000 unless the estimate looks like a genuine
  // contract-recipient figure (between 21000 and the padded default).
  // For token transfers (ERC20): gasLimit comes from SDK estimate and stays as-is.
  const NATIVE_GAS = 21000;
  const PADDED_DEFAULT = 100000;
  const effectiveGasLimit = isToken
    ? gasLimit
    : (gasLimit > NATIVE_GAS && gasLimit < PADDED_DEFAULT ? gasLimit : NATIVE_GAS);
  // What the transfer will actually burn = what we deduct from the merchant.
  const burnGasLimit = effectiveGasLimit;

  const result: { fast: string; medium?: string; slow?: string; gasPrice: number; gasLimit: number } = {
    fast: toFixedStr(Number((bufferedGasPrice * burnGasLimit) / 1e9), 8),
    gasPrice: bufferedGasPrice,
    gasLimit: effectiveGasLimit,
  };

  if (!isToken) {
    // Speed tiers: vary gas price buffer (not gas limit) for native transfers
    const mediumGasPrice = roundGwei(Math.max(minGas, gasPrice + priorityTip * 0.5));
    const slowGasPrice = roundGwei(Math.max(minGas, gasPrice * 0.9));
    result.medium = toFixedStr(Number((mediumGasPrice * burnGasLimit) / 1e9), 8);
    result.slow = toFixedStr(Number((slowGasPrice * burnGasLimit) / 1e9), 8);
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
