/**
 * Unit Tests: Merchant Pool Configuration
 * Tests isTagBasedChain, getCryptoRedisKey, TAG_BASED_CHAINS, ADMIN_WALLETS, TOKEN_CONTRACTS
 * 
 * Critical: getCryptoRedisKey is how we look up payment data in Redis.
 * Wrong key = payment never settles (customer paid, merchant never gets it).
 */

import { 
  isTagBasedChain, 
  getCryptoRedisKey, 
  TAG_BASED_CHAINS,
  NATIVE_CURRENCIES,
  TOKEN_CHAINS,
  UTXO_CHAINS,
  TOKEN_CONTRACTS,
  RLUSD_CONFIG,
} from '../services/merchantPool/merchantPoolConfig';

describe('Merchant Pool Config', () => {

  // ─── isTagBasedChain ──────────────────────────────────────────
  describe('isTagBasedChain', () => {
    it('XRP is tag-based', () => {
      expect(isTagBasedChain('XRP')).toBe(true);
    });

    it('RLUSD is tag-based', () => {
      expect(isTagBasedChain('RLUSD')).toBe(true);
    });

    it('BTC is NOT tag-based', () => {
      expect(isTagBasedChain('BTC')).toBe(false);
    });

    it('ETH is NOT tag-based', () => {
      expect(isTagBasedChain('ETH')).toBe(false);
    });

    it('USDT-TRC20 is NOT tag-based', () => {
      expect(isTagBasedChain('USDT-TRC20')).toBe(false);
    });

    it('empty string is NOT tag-based', () => {
      expect(isTagBasedChain('')).toBe(false);
    });
  });

  // ─── getCryptoRedisKey ────────────────────────────────────────
  describe('getCryptoRedisKey', () => {
    it('returns crypto-{address} for non-tag-based chains', () => {
      expect(getCryptoRedisKey('0xABC123')).toBe('crypto-0xABC123');
    });

    it('returns crypto-{address} when tag is undefined', () => {
      expect(getCryptoRedisKey('rMaster123', undefined)).toBe('crypto-rMaster123');
    });

    it('returns crypto-{address} when tag is null', () => {
      expect(getCryptoRedisKey('rMaster123', null)).toBe('crypto-rMaster123');
    });

    it('returns crypto-{address}-tag-{tag} when tag is provided', () => {
      expect(getCryptoRedisKey('rMaster123', 12345)).toBe('crypto-rMaster123-tag-12345');
    });

    it('handles tag value of 0 (valid destination tag)', () => {
      // Tag 0 is a valid XRP destination tag!
      expect(getCryptoRedisKey('rMaster123', 0)).toBe('crypto-rMaster123-tag-0');
    });

    it('handles very large tag values (XRP max = 4294967295)', () => {
      expect(getCryptoRedisKey('rMaster123', 4294967295)).toBe('crypto-rMaster123-tag-4294967295');
    });
  });

  // ─── Chain Category Lists ─────────────────────────────────────
  describe('Chain categories', () => {
    it('TAG_BASED_CHAINS contains exactly XRP and RLUSD', () => {
      expect(TAG_BASED_CHAINS).toEqual(['XRP', 'RLUSD']);
    });

    it('ACCOUNT_CHAINS (NATIVE_CURRENCIES) includes non-UTXO non-token native chains', () => {
      expect(NATIVE_CURRENCIES).toContain('ETH');
      expect(NATIVE_CURRENCIES).toContain('TRX');
      expect(NATIVE_CURRENCIES).toContain('XRP');
      expect(NATIVE_CURRENCIES).toContain('SOL');
      expect(NATIVE_CURRENCIES).toContain('POLYGON');
      // UTXO chains should NOT be in NATIVE_CURRENCIES
      expect(NATIVE_CURRENCIES).not.toContain('BTC');
      expect(NATIVE_CURRENCIES).not.toContain('LTC');
    });

    it('TOKEN_CHAINS includes token variants', () => {
      expect(TOKEN_CHAINS).toContain('USDT-TRC20');
      expect(TOKEN_CHAINS).toContain('USDT-ERC20');
      expect(TOKEN_CHAINS).toContain('USDC-ERC20');
      expect(TOKEN_CHAINS).toContain('USDT-POLYGON');
      // Native chains should NOT be tokens
      expect(TOKEN_CHAINS).not.toContain('BTC');
      expect(TOKEN_CHAINS).not.toContain('ETH');
    });

    it('UTXO chains include BTC, LTC, DOGE, BCH', () => {
      expect(UTXO_CHAINS).toContain('BTC');
      expect(UTXO_CHAINS).toContain('LTC');
      expect(UTXO_CHAINS).toContain('DOGE');
      expect(UTXO_CHAINS).toContain('BCH');
    });

    it('no chain appears in both NATIVE_CURRENCIES and UTXO', () => {
      const overlap = NATIVE_CURRENCIES.filter(c => UTXO_CHAINS.includes(c));
      expect(overlap).toEqual([]);
    });
  });

  // ─── Token Contracts ──────────────────────────────────────────
  describe('TOKEN_CONTRACTS', () => {
    it('USDT-TRC20 has valid TRX contract address', () => {
      expect(TOKEN_CONTRACTS['USDT-TRC20']).toBeDefined();
      expect(TOKEN_CONTRACTS['USDT-TRC20']).toMatch(/^T[a-zA-Z0-9]+/);
    });

    it('USDT-ERC20 has valid ETH contract address', () => {
      expect(TOKEN_CONTRACTS['USDT-ERC20']).toBeDefined();
      expect(TOKEN_CONTRACTS['USDT-ERC20']).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('USDC-ERC20 has valid ETH contract address', () => {
      expect(TOKEN_CONTRACTS['USDC-ERC20']).toBeDefined();
      expect(TOKEN_CONTRACTS['USDC-ERC20']).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('USDT-POLYGON has valid Polygon contract address', () => {
      expect(TOKEN_CONTRACTS['USDT-POLYGON']).toBeDefined();
      expect(TOKEN_CONTRACTS['USDT-POLYGON']).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('RLUSD-ERC20 has valid ETH contract address', () => {
      expect(TOKEN_CONTRACTS['RLUSD-ERC20']).toBeDefined();
      expect(TOKEN_CONTRACTS['RLUSD-ERC20']).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  // ─── RLUSD Config ─────────────────────────────────────────────
  describe('RLUSD_CONFIG', () => {
    it('has valid XRP Ledger issuer address', () => {
      expect(RLUSD_CONFIG.issuer).toBeDefined();
      expect(RLUSD_CONFIG.issuer).toMatch(/^r[a-zA-Z0-9]+/);
    });

    it('has valid currency hex (40 chars)', () => {
      expect(RLUSD_CONFIG.currencyHex).toBeDefined();
      expect(RLUSD_CONFIG.currencyHex).toHaveLength(40);
    });
  });
});
