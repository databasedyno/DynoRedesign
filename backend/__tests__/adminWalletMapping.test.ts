/**
 * Unit Tests: Admin Wallet Address Mapping
 * Tests getAdminWalletAddress
 * 
 * Critical: If this returns the wrong wallet address, funds go to wrong place.
 * If it returns null, the settlement fails silently and crypto sits in temp address.
 */

import { getAdminWalletAddress } from '../utils/adminUtils';

describe('getAdminWalletAddress', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ─── Currency → Env Key Mapping ───────────────────────────────
  describe('currency to env key mapping', () => {
    const mappings: [string, string][] = [
      ['BTC', 'BTC'],
      ['LTC', 'LTC'],
      ['DOGE', 'DOGE'],
      ['ETH', 'ETH'],
      ['TRX', 'TRX'],
      ['BCH', 'BCH'],
      ['SOL', 'SOL'],
      ['XRP', 'XRP'],
      ['POLYGON', 'POLYGON'],
      ['USDT-TRC20', 'USDT_TRC20'],
      ['USDT-ERC20', 'USDT_ERC20'],
      ['USDC-ERC20', 'USDC_ERC20'],
      ['RLUSD', 'RLUSD_ADMIN_WALLET'],
      ['RLUSD-ERC20', 'RLUSD_ERC20'],
      ['USDT-POLYGON', 'USDT_POLYGON'],
    ];

    it.each(mappings)('maps %s → env key %s', (currency, envKey) => {
      const testWallet = `test-wallet-${currency}`;
      process.env[envKey] = testWallet;
      expect(getAdminWalletAddress(currency)).toBe(testWallet);
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────
  describe('edge cases', () => {
    it('returns null for unsupported currency', () => {
      expect(getAdminWalletAddress('SHIB')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getAdminWalletAddress('')).toBeNull();
    });

    it('returns null when env var is not set', () => {
      delete process.env.BTC;
      expect(getAdminWalletAddress('BTC')).toBeNull();
    });

    it('returns null when env var is empty string', () => {
      process.env.BTC = '';
      // '' || null → null
      expect(getAdminWalletAddress('BTC')).toBeNull();
    });

    it('is case-sensitive (lowercase "btc" returns null)', () => {
      process.env.BTC = 'some-wallet';
      expect(getAdminWalletAddress('btc')).toBeNull();
    });
  });

  // ─── All 15 Supported Currencies Have Mappings ────────────────
  describe('completeness', () => {
    const allCurrencies = [
      'BTC', 'LTC', 'DOGE', 'ETH', 'TRX', 'BCH', 'SOL', 'XRP', 'POLYGON',
      'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'RLUSD', 'RLUSD-ERC20', 'USDT-POLYGON',
    ];

    it.each(allCurrencies)('%s has a mapping (returns non-null when env is set)', (currency) => {
      // Set ALL possible env vars
      process.env.BTC = 'w1'; process.env.LTC = 'w2'; process.env.DOGE = 'w3';
      process.env.ETH = 'w4'; process.env.TRX = 'w5'; process.env.BCH = 'w6';
      process.env.SOL = 'w7'; process.env.XRP = 'w8'; process.env.POLYGON = 'w9';
      process.env.USDT_TRC20 = 'w10'; process.env.USDT_ERC20 = 'w11';
      process.env.USDC_ERC20 = 'w12'; process.env.RLUSD_ADMIN_WALLET = 'w13';
      process.env.RLUSD_ERC20 = 'w14'; process.env.USDT_POLYGON = 'w15';

      const result = getAdminWalletAddress(currency);
      expect(result).not.toBeNull();
    });
  });
});
