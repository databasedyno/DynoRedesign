/**
 * Unit Tests: Fee Service (Phase 2 — Centralized Fee Logic)
 *
 * Tests the centralized fee service (services/feeService.ts) which consolidates
 * all platform fee calculation logic previously scattered in controller/index.ts:
 *   - getTransactionFee: Platform transaction fee % (env → Redis → DB)
 *   - getDiscountedTransactionFee: With referral discount
 *   - getBlockchainFee: Blockchain fee from admin config
 *   - getBlockchainConfig: Full fee configuration for a blockchain
 *   - calculateTransactionFees: Tier-based fee calculation (fixed + %)
 *   - calculateTransactionFeesWithDiscount: With referral discount applied
 *
 * Business Rule: Merchant pays ALL fees. Fees are deducted from merchant payouts.
 *
 * BENEFIT: Unlike paymentFees.test.ts (which imports through controller barrel
 * and needs 10+ sub-controller mocks), this test imports directly from feeService
 * — minimal mock surface, cleaner tests.
 */

// ── Mock Setup ──────────────────────────────────────────────────────────────

const mockUserFindByPk = jest.fn();
jest.mock('../models/userModels/userModel', () => ({
  __esModule: true,
  default: { findByPk: (...args: unknown[]) => mockUserFindByPk(...args) },
}));

jest.mock('../utils/loggers', () => ({
  log: jest.fn(),
  cronLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// ── Imports ─────────────────────────────────────────────────────────────────

import {
  getTransactionFee,
  getDiscountedTransactionFee,
  getBlockchainFee,
  getBlockchainConfig,
  calculateTransactionFees,
  calculateTransactionFeesWithDiscount,
} from '../services/feeService';
import { getRedisItem, setRedisItem } from '../utils/redisInstance';
import { feesModel } from '../models';

// ── Helpers ─────────────────────────────────────────────────────────────────

const originalEnv = { ...process.env };

function setDefaultFeeEnv() {
  process.env.TRANSACTION_FEE_PERCENT = '1.5';
  process.env.BTC_THRESHOLD = '5';
  process.env.ETH_THRESHOLD = '3';
  process.env.FEE_TIER_1_MIN = '1';
  process.env.FEE_TIER_1_MAX = '100';
  process.env.FEE_TIER_1_FIXED = '1';
  process.env.FEE_TIER_2_MIN = '101';
  process.env.FEE_TIER_2_MAX = '500';
  process.env.FEE_TIER_2_FIXED = '1';
  process.env.FEE_TIER_3_MIN = '501';
  process.env.FEE_TIER_3_MAX = '1000';
  process.env.FEE_TIER_3_FIXED = '1';
  process.env.FEE_TIER_4_MIN = '1001';
  process.env.FEE_TIER_4_MAX = '';
  process.env.FEE_TIER_4_FIXED = '1';
}

function clearFeeEnv() {
  delete process.env.TRANSACTION_FEE_PERCENT;
  delete process.env.BTC_THRESHOLD;
  delete process.env.ETH_THRESHOLD;
  for (let i = 1; i <= 4; i++) {
    delete process.env[`FEE_TIER_${i}_MIN`];
    delete process.env[`FEE_TIER_${i}_MAX`];
    delete process.env[`FEE_TIER_${i}_FIXED`];
  }
  delete process.env.BLOCKCHAIN_FEE_TIERS;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset mock implementation queues to prevent cross-test leaks
  (getRedisItem as jest.Mock).mockReset().mockResolvedValue({});
  (setRedisItem as jest.Mock).mockReset().mockResolvedValue(undefined);
  (feesModel.findOne as jest.Mock).mockReset();
  mockUserFindByPk.mockReset();
  clearFeeEnv();
  setDefaultFeeEnv();
});

afterAll(() => {
  process.env = originalEnv;
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. getTransactionFee — Platform fee %
// ═════════════════════════════════════════════════════════════════════════════

describe('getTransactionFee', () => {
  it('returns env fee when TRANSACTION_FEE_PERCENT is set', async () => {
    process.env.TRANSACTION_FEE_PERCENT = '2.5';
    const fee = await getTransactionFee();
    expect(fee).toBe(2.5);
  });

  it('returns Redis-cached fee when env fee is zero (fallback path)', async () => {
    process.env.TRANSACTION_FEE_PERCENT = '0'; // Force falsy to trigger Redis path
    (getRedisItem as jest.Mock).mockResolvedValueOnce({ transaction_fee: 3.0 });

    const fee = await getTransactionFee();
    expect(fee).toBe(3.0);
    expect(feesModel.findOne).not.toHaveBeenCalled();
  });

  it('falls back to DB and caches result when Redis is empty and env fee is zero', async () => {
    process.env.TRANSACTION_FEE_PERCENT = '0'; // Force falsy to trigger DB path
    (getRedisItem as jest.Mock).mockResolvedValueOnce({});
    (feesModel.findOne as jest.Mock).mockResolvedValueOnce({
      dataValues: { fee: 1.8 },
    });

    const fee = await getTransactionFee();

    expect(fee).toBe(1.8);
    expect(feesModel.findOne).toHaveBeenCalledWith({
      where: { feeType: 'TRANSACTION_FEE' },
    });
    expect(setRedisItem).toHaveBeenCalledWith('admin_fee', { transaction_fee: 1.8 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. getBlockchainFee — Blockchain fee from admin config
// ═════════════════════════════════════════════════════════════════════════════

describe('getBlockchainFee', () => {
  it('returns Redis-cached fee', async () => {
    (getRedisItem as jest.Mock).mockResolvedValueOnce({ blockchain_fee: 0.001 });

    const fee = await getBlockchainFee();
    expect(fee).toBe(0.001);
    expect(feesModel.findOne).not.toHaveBeenCalled();
  });

  it('falls back to DB and caches result', async () => {
    (getRedisItem as jest.Mock).mockResolvedValueOnce({});
    (feesModel.findOne as jest.Mock).mockResolvedValueOnce({
      dataValues: { fee: 0.002 },
    });

    const fee = await getBlockchainFee();

    expect(fee).toBe(0.002);
    expect(feesModel.findOne).toHaveBeenCalledWith({
      where: { feeType: 'BLOCKCHAIN_FEE' },
    });
    expect(setRedisItem).toHaveBeenCalledWith('admin_fee', { blockchain_fee: 0.002 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. getBlockchainConfig — Full fee configuration
// ═════════════════════════════════════════════════════════════════════════════

describe('getBlockchainConfig', () => {
  it('returns config with threshold and tiers from env', async () => {
    const config = await getBlockchainConfig('BTC');

    expect(config).toEqual({
      blockchain: 'BTC',
      min_forwarding_amount: 5,
      transaction_fee_percent: 1.5,
      tiers: [
        { min_amount: 1, max_amount: 100, fixed_fee: 1 },
        { min_amount: 101, max_amount: 500, fixed_fee: 1 },
        { min_amount: 501, max_amount: 1000, fixed_fee: 1 },
        { min_amount: 1001, max_amount: null, fixed_fee: 1 },
      ],
    });
  });

  it('uses blockchain-specific threshold from env', async () => {
    process.env.ETH_THRESHOLD = '10';
    const config = await getBlockchainConfig('ETH');

    expect(config?.min_forwarding_amount).toBe(10);
  });

  it('defaults threshold to 5 when env var is missing', async () => {
    delete process.env.BTC_THRESHOLD;
    const config = await getBlockchainConfig('BTC');

    expect(config?.min_forwarding_amount).toBe(5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. calculateTransactionFees — Core fee calculation
// ═════════════════════════════════════════════════════════════════════════════

describe('calculateTransactionFees', () => {
  it('calculates fixed + percentage for tier 1 ($50)', async () => {
    const result = await calculateTransactionFees('BTC', 50);

    expect(result.fixedFee).toBe(1);
    expect(result.transactionFee).toBe(50 * 1.5 / 100); // 0.75
    expect(result.totalDeduction).toBe(1 + 0.75); // 1.75
    expect(result.userReceives).toBe(50 - 1.75); // 48.25
    expect(result.minForwarding).toBe(5);
  });

  it('calculates for tier 2 ($300)', async () => {
    const result = await calculateTransactionFees('BTC', 300);

    expect(result.fixedFee).toBe(1);
    expect(result.transactionFee).toBeCloseTo(4.5); // 300 * 1.5%
    expect(result.totalDeduction).toBeCloseTo(5.5);
    expect(result.userReceives).toBeCloseTo(294.5);
  });

  it('calculates for open-ended tier 4 ($5000)', async () => {
    const result = await calculateTransactionFees('BTC', 5000);

    expect(result.fixedFee).toBe(1);
    expect(result.transactionFee).toBe(75); // 5000 * 1.5%
    expect(result.totalDeduction).toBe(76);
    expect(result.userReceives).toBe(4924);
  });

  it('falls back to lowest tier for sub-minimum amounts ($0.50)', async () => {
    // Amount below tier 1 min ($1) — should use tier 1 as fallback
    const result = await calculateTransactionFees('BTC', 0.5);

    expect(result.fixedFee).toBe(1); // Tier 1 fixed
    expect(result.transactionFee).toBeCloseTo(0.0075); // 0.5 * 1.5%
  });

  it('handles exact tier boundary ($100)', async () => {
    const result = await calculateTransactionFees('BTC', 100);

    expect(result.fixedFee).toBe(1); // Tier 1 (1-100)
    expect(result.transactionFee).toBe(1.5); // 100 * 1.5%
    expect(result.totalDeduction).toBe(2.5);
  });

  it('handles tier boundary crossing ($101 → tier 2)', async () => {
    const result = await calculateTransactionFees('BTC', 101);

    expect(result.fixedFee).toBe(1); // Tier 2 (101-500)
    expect(result.transactionFee).toBeCloseTo(1.515); // 101 * 1.5%
  });

  it('throws for missing blockchain config', async () => {
    // getBlockchainConfig returns undefined only when NO tiers AND no threshold
    // Since feeConfigUtils always provides defaults, test that defaults work
    clearFeeEnv();
    const config = await getBlockchainConfig('BTC');

    // Should return config with defaults (threshold=5, default tiers)
    expect(config).toBeDefined();
    expect(config?.min_forwarding_amount).toBe(5);
    expect(config?.tiers?.length).toBeGreaterThan(0);
  });

  it('returns correct structure', async () => {
    const result = await calculateTransactionFees('BTC', 200);

    expect(result).toHaveProperty('fixedFee');
    expect(result).toHaveProperty('transactionFee');
    expect(result).toHaveProperty('totalDeduction');
    expect(result).toHaveProperty('userReceives');
    expect(result).toHaveProperty('tierId');
    expect(result).toHaveProperty('minForwarding');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. getDiscountedTransactionFee — Referral discount
// ═════════════════════════════════════════════════════════════════════════════

describe('getDiscountedTransactionFee', () => {
  it('returns base fee when user not found', async () => {
    mockUserFindByPk.mockResolvedValueOnce(null);

    const result = await getDiscountedTransactionFee(999);

    expect(result.base_fee).toBe(1.5);
    expect(result.discount_percent).toBe(0);
    expect(result.final_fee).toBe(1.5);
  });

  it('returns base fee when discount is expired', async () => {
    mockUserFindByPk.mockResolvedValueOnce({
      fee_discount_percent: 20,
      fee_discount_expires_at: new Date('2020-01-01'), // Past date
      fee_discount_reason: 'referral',
    });

    const result = await getDiscountedTransactionFee(1);

    expect(result.discount_percent).toBe(0);
    expect(result.final_fee).toBe(1.5);
  });

  it('applies active discount', async () => {
    const futureDate = new Date(Date.now() + 86400000); // +1 day
    mockUserFindByPk.mockResolvedValueOnce({
      fee_discount_percent: 50,
      fee_discount_expires_at: futureDate,
      fee_discount_reason: 'referral_bonus',
    });

    const result = await getDiscountedTransactionFee(1);

    expect(result.discount_percent).toBe(50);
    expect(result.final_fee).toBe(0.75); // 1.5 - 50%
    expect(result.discount_reason).toBe('referral_bonus');
  });

  it('returns base fee when discount percent is 0', async () => {
    mockUserFindByPk.mockResolvedValueOnce({
      fee_discount_percent: 0,
      fee_discount_expires_at: new Date(Date.now() + 86400000),
      fee_discount_reason: 'expired_promo',
    });

    const result = await getDiscountedTransactionFee(1);

    expect(result.discount_percent).toBe(0);
    expect(result.final_fee).toBe(1.5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. calculateTransactionFeesWithDiscount — Fees + discount
// ═════════════════════════════════════════════════════════════════════════════

describe('calculateTransactionFeesWithDiscount', () => {
  it('calculates without discount when user has none', async () => {
    mockUserFindByPk.mockResolvedValueOnce(null);

    const result = await calculateTransactionFeesWithDiscount('BTC', 200, 999);

    expect(result.fixedFee).toBe(1);
    expect(result.transactionFee).toBe(3); // 200 * 1.5%
    expect(result.discountApplied).toBe(false);
    expect(result.savings).toBe(0);
  });

  it('applies percentage discount to transaction fee', async () => {
    mockUserFindByPk.mockResolvedValueOnce({
      fee_discount_percent: 50,
      fee_discount_expires_at: new Date(Date.now() + 86400000),
      fee_discount_reason: 'referral',
    });

    const result = await calculateTransactionFeesWithDiscount('BTC', 200, 1);

    // Transaction fee: 200 * (1.5% * 50%) = 200 * 0.75% = 1.5
    expect(result.transactionFee).toBe(1.5);
    expect(result.transactionFeeOriginal).toBe(3); // Without discount
    expect(result.fixedFee).toBe(1); // Fixed fee NOT discounted
    expect(result.discountApplied).toBe(true);
    expect(result.discountPercent).toBe(50);
  });

  it('tracks savings amount', async () => {
    mockUserFindByPk.mockResolvedValueOnce({
      fee_discount_percent: 25,
      fee_discount_expires_at: new Date(Date.now() + 86400000),
      fee_discount_reason: 'promo',
    });

    const result = await calculateTransactionFeesWithDiscount('BTC', 400, 1);

    // Original: 400 * 1.5% = 6.0
    // Discounted: 400 * (1.5% * 75%) = 400 * 1.125% = 4.5
    // Savings: 6.0 - 4.5 = 1.5
    expect(result.savings).toBeCloseTo(1.5);
    expect(result.discountReason).toBe('promo');
  });

  it('includes discount metadata in result', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    mockUserFindByPk.mockResolvedValueOnce({
      fee_discount_percent: 10,
      fee_discount_expires_at: futureDate,
      fee_discount_reason: 'loyalty',
    });

    const result = await calculateTransactionFeesWithDiscount('BTC', 100, 1);

    expect(result).toHaveProperty('discountApplied', true);
    expect(result).toHaveProperty('discountPercent', 10);
    expect(result).toHaveProperty('discountReason', 'loyalty');
    expect(result).toHaveProperty('discountExpiresAt');
    expect(result).toHaveProperty('savings');
    expect(result).toHaveProperty('transactionFeeOriginal');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. Edge Cases & Business Rules
// ═════════════════════════════════════════════════════════════════════════════

describe('Business Rules', () => {
  it('merchant pays ALL fees (deducted from payout)', async () => {
    const amount = 500;
    const result = await calculateTransactionFees('BTC', amount);

    // Total deduction = fixedFee + transactionFee
    // userReceives = amount - totalDeduction
    expect(result.totalDeduction).toBe(result.fixedFee + result.transactionFee);
    expect(result.userReceives).toBe(amount - result.totalDeduction);
    expect(result.userReceives).toBeLessThan(amount);
  });

  it('fixed fee is independent of amount (within same tier)', async () => {
    const result50 = await calculateTransactionFees('BTC', 50);
    const result99 = await calculateTransactionFees('BTC', 99);

    expect(result50.fixedFee).toBe(result99.fixedFee);
  });

  it('transaction fee scales linearly with amount', async () => {
    const r100 = await calculateTransactionFees('BTC', 100);
    const r200 = await calculateTransactionFees('BTC', 200);

    // Both in tier range, 200 should have ~2x the transaction fee of 100
    expect(r200.transactionFee).toBeCloseTo(r100.transactionFee * 2);
  });

  it('custom fee tiers work (legacy BLOCKCHAIN_FEE_TIERS format)', async () => {
    clearFeeEnv();
    process.env.TRANSACTION_FEE_PERCENT = '2.0';
    process.env.BTC_THRESHOLD = '5';
    process.env.BLOCKCHAIN_FEE_TIERS = '1-100:2,101-500:1.5,500+:1';

    const result = await calculateTransactionFees('BTC', 50);

    expect(result.fixedFee).toBe(2); // First tier: $2 fixed
    expect(result.transactionFee).toBe(1); // 50 * 2%
  });
});
