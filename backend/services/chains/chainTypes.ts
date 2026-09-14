/**
 * Chain Strategy Types
 * 
 * Core type definitions for the chain strategy pattern.
 * All chain-specific handlers implement these interfaces.
 */

export interface FeeEstimate {
  fast: number;
  medium: number;
  slow: number;
  unit: string;
  source: 'dynamic' | 'cached' | 'fallback';
}

export interface TransferResult {
  txId: string;
  success: boolean;
  gasCost?: number;
  error?: string;
}

export interface IncomingTx {
  txId: string;
  amount: number;
  timestamp: number;
  destinationTag?: number | null;  // XRP/RLUSD only
  from?: string;
}

export interface BalanceResult {
  balance: string;
  incoming?: IncomingTx[];  // For tag-based chains, filtered by tag
}

/**
 * ChainStrategy interface
 * 
 * Each chain (EVM, UTXO, XRP, TRON, SOL, Polygon) implements this interface.
 * Functions return normalized results; the caller doesn't need to know chain specifics.
 */
export interface ChainStrategy {
  /** Chain identifier(s) this strategy handles */
  currencies: string[];

  /** Estimate transaction fees */
  estimateFee(
    fromAddress: string,
    toAddress: string,
    amount: number,
    contractAddress?: string
  ): Promise<FeeEstimate>;

  /** Get incoming transactions (with optional destination tag filter) */
  getIncomingTransactions(
    address: string,
    currency: string,
    limit?: number,
    destinationTag?: number | null
  ): Promise<IncomingTx[]>;
}

/**
 * ChainGroup classification
 */
export type ChainGroup = 'evm' | 'utxo' | 'tron' | 'xrp' | 'solana' | 'polygon';

export const CHAIN_GROUP_MAP: Record<string, ChainGroup> = {
  'ETH': 'evm',
  'USDT-ERC20': 'evm',
  'USDC-ERC20': 'evm',
  'RLUSD-ERC20': 'evm',
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

export const getChainGroup = (currency: string): ChainGroup | null => {
  return CHAIN_GROUP_MAP[currency] || null;
};
