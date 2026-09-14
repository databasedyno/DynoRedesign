/**
 * Chain Strategy Factory
 * 
 * Centralized chain strategy resolution.
 * Maps currencies to their chain-specific strategy implementations.
 * 
 * Usage:
 *   import { getStrategy, resolveChainGroup } from './chains';
 *   const strategy = getStrategy('XRP');
 *   const fees = await strategy.estimateFee(from, to, amount);
 */

// Re-export types
export { ChainStrategy, ChainGroup, FeeEstimate, TransferResult, IncomingTx, BalanceResult } from './chainTypes';
export { CHAIN_GROUP_MAP, getChainGroup } from './chainTypes';

// Import chain strategies
import { evmStrategy, calculateEvmGasFee } from './evmChain';
import { utxoStrategy, calculateUtxoTxSizeKb } from './utxoChain';
import { tronStrategy, TRON_FEE_CONSTANTS } from './tronChain';
import { xrpStrategy, XRP_FEE_CONSTANTS, isTagBased, buildXrpRedisKey, filterByTag } from './xrpChain';
import { solStrategy, SOL_FEE_CONSTANTS, calculateSolPriorityFee } from './solChain';
import { polygonStrategy, POLYGON_GAS_CONSTANTS, calculatePolygonGasFee } from './polygonChain';
import { ChainStrategy, ChainGroup } from './chainTypes';

// Re-export chain-specific utilities
export { calculateEvmGasFee } from './evmChain';
export { calculateUtxoTxSizeKb } from './utxoChain';
export { TRON_FEE_CONSTANTS } from './tronChain';
export { XRP_FEE_CONSTANTS, isTagBased, buildXrpRedisKey, filterByTag } from './xrpChain';
export { SOL_FEE_CONSTANTS, calculateSolPriorityFee } from './solChain';
export { POLYGON_GAS_CONSTANTS, calculatePolygonGasFee } from './polygonChain';

// Strategy registry — maps chain group to strategy instance
const strategyRegistry: Record<ChainGroup, ChainStrategy> = {
  evm: evmStrategy,
  utxo: utxoStrategy,
  tron: tronStrategy,
  xrp: xrpStrategy,
  solana: solStrategy,
  polygon: polygonStrategy,
};

// Currency to chain group mapping
const currencyToGroup: Record<string, ChainGroup> = {
  'ETH': 'evm',
  'USDT-ERC20': 'evm',
  'USDC-ERC20': 'evm',
  'RLUSD-ERC20': 'evm',
  'BSC': 'evm',
  'BTC': 'utxo',
  'LTC': 'utxo',
  'DOGE': 'utxo',
  'BCH': 'utxo',
  'TRX': 'tron',
  'USDT-TRC20': 'tron',
  'XRP': 'xrp',
  'RLUSD': 'xrp',
  'SOL': 'solana',
  'POLYGON': 'polygon',
  'USDT-POLYGON': 'polygon',
};

/**
 * Get the chain strategy for a given currency.
 * Returns null if no strategy is registered for this currency.
 */
export const getStrategy = (currency: string): ChainStrategy | null => {
  const group = currencyToGroup[currency];
  return group ? strategyRegistry[group] : null;
};

/**
 * Resolve the chain group for a currency.
 */
export const resolveChainGroup = (currency: string): ChainGroup | null => {
  return currencyToGroup[currency] || null;
};


