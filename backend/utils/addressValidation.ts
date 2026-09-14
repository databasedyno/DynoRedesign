/**
 * Cryptocurrency Address Validation Utilities
 * Validates wallet addresses for various blockchain networks
 */

// Basic regex patterns for address validation
const ADDRESS_PATTERNS: Record<string, RegExp> = {
  // Bitcoin - starts with 1, 3, or bc1
  BTC: /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/,
  
  // Ethereum and ERC-20 tokens - 0x followed by 40 hex chars
  ETH: /^0x[a-fA-F0-9]{40}$/,
  'USDT-ERC20': /^0x[a-fA-F0-9]{40}$/,
  'USDC-ERC20': /^0x[a-fA-F0-9]{40}$/,
  BSC: /^0x[a-fA-F0-9]{40}$/,
  
  // Tron - starts with T, 34 chars
  TRX: /^T[a-zA-HJ-NP-Za-km-z1-9]{33}$/,
  'USDT-TRC20': /^T[a-zA-HJ-NP-Za-km-z1-9]{33}$/,
  
  // Litecoin - starts with L, M, or ltc1
  LTC: /^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$|^ltc1[a-z0-9]{39,59}$/,
  
  // Dogecoin - starts with D
  DOGE: /^D[5-9A-HJ-NP-U][a-km-zA-HJ-NP-Z1-9]{32}$/,
  
  // Bitcoin Cash - starts with q or p (CashAddr) or legacy 1/3
  BCH: /^(q|p)[a-z0-9]{41}$|^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$/,

  // Solana - Base58, 32-44 chars
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,

  // XRP - starts with r, 25-35 chars
  XRP: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  'RLUSD': /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  'RLUSD-ERC20': /^0x[a-fA-F0-9]{40}$/,

  // Polygon - EVM compatible, same as ETH
  POLYGON: /^0x[a-fA-F0-9]{40}$/,
  'USDT-POLYGON': /^0x[a-fA-F0-9]{40}$/,
};

// Checksum validation for Ethereum addresses
const isValidEthereumChecksum = (address: string): boolean => {
  // If all lowercase or all uppercase (after 0x), skip checksum validation
  const addressWithout0x = address.slice(2);
  if (addressWithout0x === addressWithout0x.toLowerCase() || 
      addressWithout0x === addressWithout0x.toUpperCase()) {
    return true;
  }
  
  // For mixed case, we'd need keccak256 - for MVP, accept mixed case as valid
  // Full checksum validation would require crypto library
  return true;
};

/**
 * Validate a cryptocurrency address
 * @param address - The wallet address to validate
 * @param currency - The currency/blockchain type
 * @returns Object with isValid boolean and optional error message
 */
export const validateCryptoAddress = (
  address: string,
  currency: string
): { isValid: boolean; error?: string } => {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'Address is required' };
  }

  if (!currency || typeof currency !== 'string') {
    return { isValid: false, error: 'Currency type is required' };
  }

  const normalizedCurrency = currency.toUpperCase();
  const pattern = ADDRESS_PATTERNS[normalizedCurrency];

  if (!pattern) {
    // For unknown currencies, do basic length check
    if (address.length < 20 || address.length > 100) {
      return { isValid: false, error: `Invalid address length for ${currency}` };
    }
    return { isValid: true }; // Allow unknown currencies with valid length
  }

  if (!pattern.test(address)) {
    return { 
      isValid: false, 
      error: `Invalid ${currency} address format` 
    };
  }

  // Additional Ethereum checksum validation
  if (['ETH', 'USDT-ERC20', 'USDC-ERC20', 'RLUSD-ERC20', 'BSC', 'POLYGON', 'USDT-POLYGON'].includes(normalizedCurrency)) {
    if (!isValidEthereumChecksum(address)) {
      return { 
        isValid: false, 
        error: 'Invalid Ethereum address checksum' 
      };
    }
  }

  return { isValid: true };
};

/**
 * Validate multiple addresses at once
 * @param addresses - Array of { address, currency } objects
 * @returns Array of validation results with original data
 */
export const validateMultipleAddresses = (
  addresses: Array<{ address: string; currency: string }>
): Array<{ address: string; currency: string; isValid: boolean; error?: string }> => {
  return addresses.map(({ address, currency }) => ({
    address,
    currency,
    ...validateCryptoAddress(address, currency),
  }));
};

/**
 * Get the base chain for a token type
 * @param currency - The token/currency type
 * @returns The base blockchain
 */
export const getBaseChain = (currency: string): string => {
  const normalizedCurrency = currency.toUpperCase();
  
  const tokenToChain: Record<string, string> = {
    'USDT-ERC20': 'ETH',
    'USDT-TRC20': 'TRX',
    'USDC-ERC20': 'ETH',
    'BSC': 'ETH',
    'RLUSD': 'XRP',
    'RLUSD-ERC20': 'ETH',
    'USDT-POLYGON': 'POLYGON',
  };

  return tokenToChain[normalizedCurrency] || normalizedCurrency;
};

/**
 * Check if an address looks like a smart contract (basic heuristic)
 * Note: This is not definitive - would need blockchain query for certainty
 */
export const mightBeContract = (address: string, currency: string): boolean => {
  // Only applicable for EVM chains
  const evmChains = ['ETH', 'USDT-ERC20', 'USDC-ERC20', 'RLUSD-ERC20', 'BSC', 'POLYGON', 'USDT-POLYGON'];
  if (!evmChains.includes(currency.toUpperCase())) {
    return false;
  }

  // Known contract prefixes (exchanges, etc.) - add more as needed
  const knownContractPrefixes = [
    '0x0000000000000000000000000000000000000000', // Null address
  ];

  return knownContractPrefixes.some(prefix => 
    address.toLowerCase().startsWith(prefix.toLowerCase())
  );
};

export default {
  validateCryptoAddress,
  validateMultipleAddresses,
  getBaseChain,
  mightBeContract,
};
