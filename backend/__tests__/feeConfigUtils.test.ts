/**
 * Unit Tests: Fee Configuration Utilities
 * Tests getBlockchainThreshold, getTransactionFeePercent, getFeeTiers
 * 
 * These are the foundation of the fee engine — if tiers are wrong,
 * every merchant payout will be miscalculated.
 */

import { getBlockchainThreshold, getTransactionFeePercent, getFeeTiers, FeeTier } from '../utils/feeConfigUtils';

describe('feeConfigUtils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ─── getBlockchainThreshold ───────────────────────────────────
  describe('getBlockchainThreshold', () => {
    it('returns default threshold (5) when no env var set', () => {
      delete process.env.BTC_THRESHOLD;
      expect(getBlockchainThreshold('BTC')).toBe(5);
    });

    it('reads threshold from env for BTC', () => {
      process.env.BTC_THRESHOLD = '10';
      expect(getBlockchainThreshold('BTC')).toBe(10);
    });

    it('reads threshold from env for ETH', () => {
      process.env.ETH_THRESHOLD = '25';
      expect(getBlockchainThreshold('ETH')).toBe(25);
    });

    it('handles hyphenated chains like USDT-TRC20 → USDT_TRC20_THRESHOLD', () => {
      process.env.USDT_TRC20_THRESHOLD = '3';
      expect(getBlockchainThreshold('USDT-TRC20')).toBe(3);
    });

    it('handles USDT-ERC20 → USDT_ERC20_THRESHOLD', () => {
      process.env.USDT_ERC20_THRESHOLD = '15';
      expect(getBlockchainThreshold('USDT-ERC20')).toBe(15);
    });

    it('handles RLUSD-ERC20 → RLUSD_ERC20_THRESHOLD', () => {
      process.env.RLUSD_ERC20_THRESHOLD = '8';
      expect(getBlockchainThreshold('RLUSD-ERC20')).toBe(8);
    });

    it('returns default 5 for invalid/NaN env value', () => {
      process.env.BTC_THRESHOLD = 'abc';
      expect(getBlockchainThreshold('BTC')).toBe(5);
    });

    it('returns 0 when env is explicitly "0" (valid threshold)', () => {
      process.env.BTC_THRESHOLD = '0';
      expect(getBlockchainThreshold('BTC')).toBe(0);
    });
  });

  // ─── getTransactionFeePercent ─────────────────────────────────
  describe('getTransactionFeePercent', () => {
    it('returns default 1.5% when no env var', () => {
      delete process.env.TRANSACTION_FEE_PERCENT;
      expect(getTransactionFeePercent()).toBe(1.5);
    });

    it('reads custom fee percent from env', () => {
      process.env.TRANSACTION_FEE_PERCENT = '2.5';
      expect(getTransactionFeePercent()).toBe(2.5);
    });

    it('returns default for invalid env value', () => {
      process.env.TRANSACTION_FEE_PERCENT = 'xyz';
      expect(getTransactionFeePercent()).toBe(1.5);
    });

    it('handles zero fee (returns 0 when explicitly set)', () => {
      process.env.TRANSACTION_FEE_PERCENT = '0';
      expect(getTransactionFeePercent()).toBe(0);
    });
  });

  // ─── getFeeTiers ──────────────────────────────────────────────
  describe('getFeeTiers', () => {
    it('returns default tiers when no env vars configured', () => {
      delete process.env.FEE_TIER_1_MIN;
      delete process.env.BLOCKCHAIN_FEE_TIERS;
      const tiers = getFeeTiers();
      expect(tiers).toHaveLength(4);
      expect(tiers[0]).toEqual({ min: 1, max: 100, fixed: 1 });
      expect(tiers[1]).toEqual({ min: 101, max: 500, fixed: 1 });
      expect(tiers[2]).toEqual({ min: 501, max: 1000, fixed: 1 });
      expect(tiers[3]).toEqual({ min: 1001, max: null, fixed: 1 });
    });

    it('reads individual tier env vars (FEE_TIER_N_*)', () => {
      process.env.FEE_TIER_1_MIN = '0';
      process.env.FEE_TIER_1_MAX = '50';
      process.env.FEE_TIER_1_FIXED = '0.50';
      process.env.FEE_TIER_2_MIN = '51';
      process.env.FEE_TIER_2_MAX = '200';
      process.env.FEE_TIER_2_FIXED = '1.00';
      process.env.FEE_TIER_3_MIN = '201';
      process.env.FEE_TIER_3_MAX = '';
      process.env.FEE_TIER_3_FIXED = '2.00';

      const tiers = getFeeTiers();
      expect(tiers).toHaveLength(3);
      expect(tiers[0]).toEqual({ min: 0, max: 50, fixed: 0.5 });
      expect(tiers[1]).toEqual({ min: 51, max: 200, fixed: 1 });
      expect(tiers[2]).toEqual({ min: 201, max: null, fixed: 2 });
    });

    it('reads legacy tier format (BLOCKCHAIN_FEE_TIERS string)', () => {
      delete process.env.FEE_TIER_1_MIN;
      process.env.BLOCKCHAIN_FEE_TIERS = '0-100:1.5,101-500:2,501+:3';

      const tiers = getFeeTiers();
      expect(tiers).toHaveLength(3);
      expect(tiers[0]).toEqual({ min: 0, max: 100, fixed: 1.5 });
      expect(tiers[1]).toEqual({ min: 101, max: 500, fixed: 2 });
      expect(tiers[2]).toEqual({ min: 501, max: null, fixed: 3 });
    });

    it('individual tiers take precedence over legacy format', () => {
      process.env.FEE_TIER_1_MIN = '0';
      process.env.FEE_TIER_1_MAX = '100';
      process.env.FEE_TIER_1_FIXED = '0.75';
      process.env.BLOCKCHAIN_FEE_TIERS = '0-100:99'; // Should be ignored

      const tiers = getFeeTiers();
      expect(tiers[0].fixed).toBe(0.75);
    });

    it('handles MAX=0 as null (open-ended tier)', () => {
      process.env.FEE_TIER_1_MIN = '0';
      process.env.FEE_TIER_1_MAX = '0';
      process.env.FEE_TIER_1_FIXED = '1';

      const tiers = getFeeTiers();
      expect(tiers[0].max).toBeNull();
    });
  });
});
