/**
 * Unit Tests: Crypto Currency Classification
 * Tests isVolatileCrypto, isStablecoin, STABLECOIN_CURRENCIES, VOLATILE_CURRENCIES
 * 
 * Critical: These decide whether auto-convert triggers or not.
 * A misclassification means either:
 *   - Stablecoin gets sent to Binance for unnecessary conversion (merchant loses on spread)
 *   - Volatile crypto bypasses conversion (merchant exposed to price risk)
 */

import { 
  isStablecoin, 
  isVolatileCrypto, 
  STABLECOIN_CURRENCIES, 
  VOLATILE_CURRENCIES 
} from '../services/binanceService';

describe('Crypto Currency Classification', () => {
  
  // ─── isStablecoin ─────────────────────────────────────────────
  describe('isStablecoin', () => {
    const expectedStablecoins = [
      'USDT', 'USDC', 'RLUSD',
      'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20',
      'USDT-POLYGON', 'RLUSD-ERC20',
    ];

    it.each(expectedStablecoins)('correctly identifies %s as stablecoin', (coin) => {
      expect(isStablecoin(coin)).toBe(true);
    });

    const expectedNonStablecoins = [
      'BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'SOL', 'XRP', 'POLYGON',
    ];

    it.each(expectedNonStablecoins)('correctly identifies %s as NOT stablecoin', (coin) => {
      expect(isStablecoin(coin)).toBe(false);
    });

    it('is case-sensitive (lowercase "usdt" is not stablecoin)', () => {
      expect(isStablecoin('usdt')).toBe(false);
    });

    it('handles empty string', () => {
      expect(isStablecoin('')).toBe(false);
    });

    it('handles unknown currency', () => {
      expect(isStablecoin('SHIB')).toBe(false);
    });
  });

  // ─── isVolatileCrypto ─────────────────────────────────────────
  describe('isVolatileCrypto', () => {
    const expectedVolatile = [
      'BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'SOL', 'XRP', 'POLYGON',
    ];

    it.each(expectedVolatile)('correctly identifies %s as volatile', (coin) => {
      expect(isVolatileCrypto(coin)).toBe(true);
    });

    const expectedNonVolatile = [
      'USDT', 'USDC', 'RLUSD',
      'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20',
      'USDT-POLYGON', 'RLUSD-ERC20',
    ];

    it.each(expectedNonVolatile)('correctly identifies %s as NOT volatile', (coin) => {
      expect(isVolatileCrypto(coin)).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(isVolatileCrypto('btc')).toBe(false);
    });
  });

  // ─── Completeness / No Overlap ─────────────────────────────────
  describe('Classification completeness', () => {
    const ALL_SUPPORTED = [
      'BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'SOL', 'XRP', 'POLYGON',
      'USDT', 'USDC', 'RLUSD',
      'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20',
      'USDT-POLYGON', 'RLUSD-ERC20',
    ];

    it('no currency is both stablecoin AND volatile', () => {
      const overlap = STABLECOIN_CURRENCIES.filter(c => VOLATILE_CURRENCIES.includes(c));
      expect(overlap).toEqual([]);
    });

    it('every supported currency is either stablecoin or volatile', () => {
      const unclassified = ALL_SUPPORTED.filter(
        c => !isStablecoin(c) && !isVolatileCrypto(c)
      );
      expect(unclassified).toEqual([]);
    });

    it('volatile + stablecoin lists cover all 17 supported currencies', () => {
      const totalClassified = VOLATILE_CURRENCIES.length + STABLECOIN_CURRENCIES.length;
      expect(totalClassified).toBe(ALL_SUPPORTED.length);
    });
  });
});
