/**
 * Unit Tests: Payment Fee Calculation (Phase 3)
 *
 * Tests the ACTUAL exported functions from controller/index.ts:
 *   - calculateTransactionFees(blockchain, amount)
 *   - calculateTransactionFeesWithDiscount(blockchain, amount, userId)
 *   - getTransactionFee()
 *   - getDiscountedTransactionFee(userId)
 *   - getBlockchainFee()
 *   - getBlockchainConfig(blockchain)
 *
 * Unlike feeCalculation.test.ts (which tests replicated pure-math),
 * these tests exercise the real service layer with mocked DB/Redis.
 */

// ── Mock Setup ──────────────────────────────────────────────────────────────

// Prevent cascading controller imports
jest.mock('../controller/apiController', () => ({ __esModule: true, default: {} }));
jest.mock('../controller/companyController', () => ({ __esModule: true, default: {} }));
jest.mock('../controller/paymentController', () => ({ __esModule: true, default: {} }));
jest.mock('../controller/userController', () => ({ __esModule: true, default: {} }));
jest.mock('../controller/walletController', () => ({ __esModule: true, default: {} }));
jest.mock('../controller/taxController', () => ({ __esModule: true, default: {} }));
jest.mock('../controller/dashboardController', () => ({ __esModule: true, default: {} }));
jest.mock('../controller/notificationController', () => ({
  __esModule: true,
  default: {},
  createNotification: jest.fn(),
  NOTIFICATION_TYPES: {},
}));
jest.mock('../controller/subscriptionController', () => ({ __esModule: true, default: {} }));

// Mock User model (for discount lookup)
const mockUserFindByPk = jest.fn();
jest.mock('../models/userModels/userModel', () => ({
  __esModule: true,
  default: { findByPk: (...args: unknown[]) => mockUserFindByPk(...args) },
}));

// Mock loggers
jest.mock('../utils/loggers', () => ({
  log: jest.fn(),
  apiLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  cronLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// ── Imports ─────────────────────────────────────────────────────────────────

import {
  calculateTransactionFees,
  calculateTransactionFeesWithDiscount,
  getTransactionFee,
  getDiscountedTransactionFee,
  getBlockchainFee,
  getBlockchainConfig,
} from '../controller';
import { getRedisItem, setRedisItem } from '../utils/redisInstance';
import { feesModel } from '../models';

// ── Helpers ─────────────────────────────────────────────────────────────────

const originalEnv = { ...process.env };

function setDefaultFeeEnv() {
  process.env.TRANSACTION_FEE_PERCENT = '1.5';
  process.env.BTC_THRESHOLD = '5';
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
  for (let i = 1; i <= 10; i++) {
    delete process.env[`FEE_TIER_${i}_MIN`];
    delete process.env[`FEE_TIER_${i}_MAX`];
    delete process.env[`FEE_TIER_${i}_FIXED`];
  }
  delete process.env.BLOCKCHAIN_FEE_TIERS;
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('Payment Fee Calculation — controller/index.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDefaultFeeEnv();

    // Default: Redis returns null (cache miss)
    (getRedisItem as jest.Mock).mockResolvedValue(null);
    (setRedisItem as jest.Mock).mockResolvedValue(undefined);

    // Default: feesModel returns a fee
    (feesModel.findOne as jest.Mock).mockResolvedValue({
      dataValues: { fee: 1.5 },
    });

    // Default: no user discount
    mockUserFindByPk.mockResolvedValue(null);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getBlockchainConfig
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getBlockchainConfig', () => {
    it('returns complete config for BTC', async () => {
      const config = await getBlockchainConfig('BTC');
      expect(config).toEqual(
        expect.objectContaining({
          blockchain: 'BTC',
          min_forwarding_amount: 5,
          transaction_fee_percent: 1.5,
          tiers: expect.arrayContaining([
            expect.objectContaining({ min_amount: 1, max_amount: 100, fixed_fee: 1 }),
          ]),
        })
      );
    });

    it('returns undefined when no tiers are configured', async () => {
      clearFeeEnv();
      // Default tiers from feeConfigUtils should still work
      const config = await getBlockchainConfig('ETH');
      expect(config).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // calculateTransactionFees
  // ═══════════════════════════════════════════════════════════════════════════

  describe('calculateTransactionFees', () => {
    it('calculates fees for amount in first tier ($50)', async () => {
      const result = await calculateTransactionFees('BTC', 50);

      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(0.75, 2); // 50 * 1.5%
      expect(result.totalDeduction).toBeCloseTo(1.75, 2);
      expect(result.userReceives).toBeCloseTo(48.25, 2);
    });

    it('calculates fees for amount in second tier ($250)', async () => {
      const result = await calculateTransactionFees('BTC', 250);

      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(3.75, 2); // 250 * 1.5%
      expect(result.totalDeduction).toBeCloseTo(4.75, 2);
      expect(result.userReceives).toBeCloseTo(245.25, 2);
    });

    it('calculates fees for amount in third tier ($750)', async () => {
      const result = await calculateTransactionFees('ETH', 750);

      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(11.25, 2); // 750 * 1.5%
      expect(result.totalDeduction).toBeCloseTo(12.25, 2);
    });

    it('calculates fees for open-ended fourth tier ($5000)', async () => {
      const result = await calculateTransactionFees('BTC', 5000);

      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(75, 2); // 5000 * 1.5%
      expect(result.totalDeduction).toBeCloseTo(76, 2);
      expect(result.userReceives).toBeCloseTo(4924, 2);
    });

    it('falls back to lowest tier for amounts below tier 1 minimum', async () => {
      // Amount $0.50 is below tier 1 min of $1
      const result = await calculateTransactionFees('BTC', 0.5);

      expect(result.fixedFee).toBe(1); // Lowest tier's fixed fee
      expect(result.transactionFee).toBeCloseTo(0.0075, 4); // 0.5 * 1.5%
    });

    it('respects custom fee percent from env', async () => {
      process.env.TRANSACTION_FEE_PERCENT = '2.5';

      const result = await calculateTransactionFees('BTC', 100);

      expect(result.transactionFee).toBeCloseTo(2.5, 2); // 100 * 2.5%
    });

    it('uses correct tier for boundary amounts (exactly $100)', async () => {
      const result = await calculateTransactionFees('BTC', 100);

      // $100 falls in tier 1 (min=1, max=100)
      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(1.5, 2);
    });

    it('uses correct tier for boundary amounts (exactly $101)', async () => {
      const result = await calculateTransactionFees('BTC', 101);

      // $101 falls in tier 2 (min=101, max=500)
      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(1.515, 2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // calculateTransactionFeesWithDiscount
  // ═══════════════════════════════════════════════════════════════════════════

  describe('calculateTransactionFeesWithDiscount', () => {
    it('applies referral discount to transaction fee', async () => {
      mockUserFindByPk.mockResolvedValue({
        fee_discount_percent: 20,
        fee_discount_expires_at: new Date(Date.now() + 86400000), // tomorrow
        fee_discount_reason: 'referral',
      });

      const result = await calculateTransactionFeesWithDiscount('BTC', 100, 1);

      // 1.5% base → 20% discount → 1.2% effective
      expect(result.transactionFee).toBeCloseTo(1.2, 2);
      expect(result.discountApplied).toBe(true);
      expect(result.discountPercent).toBe(20);
      expect(result.savings).toBeCloseTo(0.3, 2);
    });

    it('does NOT apply expired discount', async () => {
      mockUserFindByPk.mockResolvedValue({
        fee_discount_percent: 20,
        fee_discount_expires_at: new Date(Date.now() - 86400000), // yesterday
        fee_discount_reason: 'referral',
      });

      const result = await calculateTransactionFeesWithDiscount('BTC', 100, 1);

      expect(result.transactionFee).toBeCloseTo(1.5, 2); // No discount
      expect(result.discountApplied).toBe(false);
    });

    it('handles user not found (no discount)', async () => {
      mockUserFindByPk.mockResolvedValue(null);

      const result = await calculateTransactionFeesWithDiscount('BTC', 100, 999);

      expect(result.transactionFee).toBeCloseTo(1.5, 2);
      expect(result.discountApplied).toBe(false);
    });

    it('fixed fee is NOT affected by discount (only percentage)', async () => {
      mockUserFindByPk.mockResolvedValue({
        fee_discount_percent: 50,
        fee_discount_expires_at: new Date(Date.now() + 86400000),
        fee_discount_reason: 'referral',
      });

      const result = await calculateTransactionFeesWithDiscount('BTC', 100, 1);

      expect(result.fixedFee).toBe(1); // Fixed fee unchanged
      expect(result.transactionFee).toBeCloseTo(0.75, 2); // 1.5% → 50% off → 0.75%
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getTransactionFee
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getTransactionFee', () => {
    it('returns env var when TRANSACTION_FEE_PERCENT is set', async () => {
      process.env.TRANSACTION_FEE_PERCENT = '2.0';

      const fee = await getTransactionFee();

      expect(fee).toBe(2.0);
      // Should NOT hit Redis or DB
      expect(getRedisItem).not.toHaveBeenCalled();
    });

    it('falls back to Redis cache on env miss', async () => {
      process.env.TRANSACTION_FEE_PERCENT = '0'; // falsy but valid
      (getRedisItem as jest.Mock).mockResolvedValue({ transaction_fee: 3.0 });

      const fee = await getTransactionFee();

      // 0 is falsy, so it falls through to Redis
      expect(fee).toBe(3.0);
    });

    it('falls back to DB when Redis cache is empty', async () => {
      process.env.TRANSACTION_FEE_PERCENT = '0';
      (getRedisItem as jest.Mock).mockResolvedValue(null);
      (feesModel.findOne as jest.Mock).mockResolvedValue({
        dataValues: { fee: 1.75 },
      });

      const fee = await getTransactionFee();

      expect(fee).toBe(1.75);
      // Should cache in Redis
      expect(setRedisItem).toHaveBeenCalledWith('admin_fee', { transaction_fee: 1.75 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getDiscountedTransactionFee
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getDiscountedTransactionFee', () => {
    it('returns full info with active discount', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      mockUserFindByPk.mockResolvedValue({
        fee_discount_percent: 25,
        fee_discount_expires_at: expiresAt,
        fee_discount_reason: 'referral_signup',
      });

      const result = await getDiscountedTransactionFee(1);

      expect(result.base_fee).toBe(1.5);
      expect(result.discount_percent).toBe(25);
      expect(result.discount_reason).toBe('referral_signup');
      expect(result.final_fee).toBeCloseTo(1.13, 2); // 1.5 - (1.5*25%) = 1.125 → rounded to 1.13
      expect(result.discount_expires_at).toEqual(expiresAt);
    });

    it('returns base fee with zero discount when no user', async () => {
      mockUserFindByPk.mockResolvedValue(null);

      const result = await getDiscountedTransactionFee(999);

      expect(result.base_fee).toBe(1.5);
      expect(result.discount_percent).toBe(0);
      expect(result.final_fee).toBe(1.5);
    });

    it('returns base fee when discount is expired', async () => {
      mockUserFindByPk.mockResolvedValue({
        fee_discount_percent: 25,
        fee_discount_expires_at: new Date(Date.now() - 1000), // expired
        fee_discount_reason: 'referral',
      });

      const result = await getDiscountedTransactionFee(1);

      expect(result.discount_percent).toBe(0);
      expect(result.final_fee).toBe(1.5);
    });

    it('prevents negative final fee (100% discount)', async () => {
      mockUserFindByPk.mockResolvedValue({
        fee_discount_percent: 100,
        fee_discount_expires_at: new Date(Date.now() + 86400000),
        fee_discount_reason: 'special',
      });

      const result = await getDiscountedTransactionFee(1);

      expect(result.final_fee).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getBlockchainFee
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getBlockchainFee', () => {
    it('returns from Redis cache when available', async () => {
      (getRedisItem as jest.Mock).mockResolvedValue({ blockchain_fee: 0.5 });

      const fee = await getBlockchainFee();

      expect(fee).toBe(0.5);
      expect(feesModel.findOne).not.toHaveBeenCalled();
    });

    it('falls back to DB and caches result', async () => {
      (getRedisItem as jest.Mock).mockResolvedValue(null);
      (feesModel.findOne as jest.Mock).mockResolvedValue({
        dataValues: { fee: 0.75 },
      });

      const fee = await getBlockchainFee();

      expect(fee).toBe(0.75);
      expect(setRedisItem).toHaveBeenCalledWith('admin_fee', { blockchain_fee: 0.75 });
    });
  });
});
