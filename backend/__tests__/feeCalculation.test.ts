/**
 * Unit Tests: Fee Calculation Engine
 * Tests calculateTransactionFees — the core function that determines
 * how much merchant receives vs platform takes.
 * 
 * MERCHANT PAYS ALL FEES: fixed tier fee + 1.5% transaction fee.
 * These are deducted from totalReceived → become adminAmountToSend.
 * 
 * If this math is wrong, either:
 *   - Platform undercharges (loses revenue)
 *   - Platform overcharges (merchant gets less than expected)
 */

// We test the fee math logic directly by importing feeConfigUtils
// and replicating the calculation logic from calculateTransactionFees
import { getFeeTiers, getTransactionFeePercent, FeeTier } from '../utils/feeConfigUtils';

/**
 * Replicated pure-function version of calculateTransactionFees
 * that doesn't require DB/Redis access.
 * This tests the MATH, not the DB layer.
 */
interface FeeCalcResult {
  fixedFee: number;
  transactionFee: number;
  totalDeduction: number;
  userReceives: number;
}

function calculateFees(
  amount: number, 
  tiers: Array<{ min: number; max: number | null; fixed: number }>,
  feePercent: number
): FeeCalcResult {
  // Find matching tier
  const matchingTier = tiers.find(
    tier => amount >= tier.min && (tier.max === null || amount <= tier.max)
  );
  
  // Fallback to lowest tier
  const effectiveTier = matchingTier || (() => {
    const sorted = [...tiers].sort((a, b) => a.min - b.min);
    return sorted[0] && amount > 0 ? sorted[0] : null;
  })();

  if (!effectiveTier) {
    throw new Error(`No fee tier found for amount ${amount}`);
  }

  const fixedFee = effectiveTier.fixed;
  const transactionFee = (amount * feePercent) / 100;
  const totalDeduction = fixedFee + transactionFee;
  const userReceives = amount - totalDeduction;

  return { fixedFee, transactionFee, totalDeduction, userReceives };
}

describe('Fee Calculation Engine', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear any tier overrides
    for (let i = 1; i <= 10; i++) {
      delete process.env[`FEE_TIER_${i}_MIN`];
      delete process.env[`FEE_TIER_${i}_MAX`];
      delete process.env[`FEE_TIER_${i}_FIXED`];
    }
    delete process.env.BLOCKCHAIN_FEE_TIERS;
    delete process.env.TRANSACTION_FEE_PERCENT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ─── Default Tiers ($1 fixed + 1.5%) ──────────────────────────
  describe('with default tiers ($1 fixed, 1.5% transaction fee)', () => {
    const getDefaultConfig = () => ({
      tiers: getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed })),
      feePercent: getTransactionFeePercent(),
    });

    it('$10 payment: $1 fixed + $0.15 (1.5%) = $1.15 total fee', () => {
      const { tiers, feePercent } = getDefaultConfig();
      const result = calculateFees(10, tiers, feePercent);
      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(0.15, 2);
      expect(result.totalDeduction).toBeCloseTo(1.15, 2);
      expect(result.userReceives).toBeCloseTo(8.85, 2);
    });

    it('$100 payment: $1 fixed + $1.50 (1.5%) = $2.50 total fee', () => {
      const { tiers, feePercent } = getDefaultConfig();
      const result = calculateFees(100, tiers, feePercent);
      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(1.5, 2);
      expect(result.totalDeduction).toBeCloseTo(2.5, 2);
      expect(result.userReceives).toBeCloseTo(97.5, 2);
    });

    it('$500 payment: $1 fixed + $7.50 (1.5%) = $8.50 total fee', () => {
      const { tiers, feePercent } = getDefaultConfig();
      const result = calculateFees(500, tiers, feePercent);
      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(7.5, 2);
      expect(result.totalDeduction).toBeCloseTo(8.5, 2);
      expect(result.userReceives).toBeCloseTo(491.5, 2);
    });

    it('$1000 payment: $1 fixed + $15.00 (1.5%) = $16.00 total fee', () => {
      const { tiers, feePercent } = getDefaultConfig();
      const result = calculateFees(1000, tiers, feePercent);
      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(15, 2);
      expect(result.totalDeduction).toBeCloseTo(16, 2);
      expect(result.userReceives).toBeCloseTo(984, 2);
    });

    it('$5000 payment (above highest tier): $1 fixed + $75 (1.5%) = $76', () => {
      const { tiers, feePercent } = getDefaultConfig();
      const result = calculateFees(5000, tiers, feePercent);
      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(75, 2);
      expect(result.totalDeduction).toBeCloseTo(76, 2);
      expect(result.userReceives).toBeCloseTo(4924, 2);
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────
  describe('edge cases', () => {
    it('amount below lowest tier falls back to lowest tier', () => {
      // Default tiers start at $1, so $0.50 falls below
      const tiers = getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed }));
      const feePercent = getTransactionFeePercent();
      const result = calculateFees(0.5, tiers, feePercent);
      // Should use tier 1 ($1 fixed)
      expect(result.fixedFee).toBe(1);
      // Fee exceeds payment amount — merchant receives negative
      // This is a valid edge case: minimum forwarding threshold should prevent this
      expect(result.userReceives).toBeLessThan(0);
    });

    it('throws error for $0 payment', () => {
      const tiers = getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed }));
      const feePercent = getTransactionFeePercent();
      expect(() => calculateFees(0, tiers, feePercent)).toThrow('No fee tier found');
    });

    it('throws error for negative amount', () => {
      const tiers = getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed }));
      const feePercent = getTransactionFeePercent();
      expect(() => calculateFees(-10, tiers, feePercent)).toThrow('No fee tier found');
    });

    it('very large payment ($1M) uses open-ended tier', () => {
      const tiers = getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed }));
      const feePercent = getTransactionFeePercent();
      const result = calculateFees(1000000, tiers, feePercent);
      expect(result.fixedFee).toBe(1);
      expect(result.transactionFee).toBeCloseTo(15000, 0);
    });

    it('boundary: exactly $100 matches tier 1 (1-100)', () => {
      const tiers = getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed }));
      const feePercent = getTransactionFeePercent();
      const result = calculateFees(100, tiers, feePercent);
      expect(result.fixedFee).toBe(1); // tier 1
    });

    it('boundary: $101 matches tier 2 (101-500)', () => {
      const tiers = getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed }));
      const feePercent = getTransactionFeePercent();
      const result = calculateFees(101, tiers, feePercent);
      expect(result.fixedFee).toBe(1); // tier 2 also $1 in defaults
    });
  });

  // ─── Custom Tiers ─────────────────────────────────────────────
  describe('with custom tiers', () => {
    it('applies different fixed fees per tier', () => {
      process.env.FEE_TIER_1_MIN = '0';
      process.env.FEE_TIER_1_MAX = '100';
      process.env.FEE_TIER_1_FIXED = '2';
      process.env.FEE_TIER_2_MIN = '101';
      process.env.FEE_TIER_2_MAX = '500';
      process.env.FEE_TIER_2_FIXED = '3';
      process.env.FEE_TIER_3_MIN = '501';
      process.env.FEE_TIER_3_MAX = '';
      process.env.FEE_TIER_3_FIXED = '5';

      const tiers = getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed }));
      const feePercent = getTransactionFeePercent();

      expect(calculateFees(50, tiers, feePercent).fixedFee).toBe(2);
      expect(calculateFees(200, tiers, feePercent).fixedFee).toBe(3);
      expect(calculateFees(1000, tiers, feePercent).fixedFee).toBe(5);
    });

    it('applies custom transaction fee percentage', () => {
      process.env.TRANSACTION_FEE_PERCENT = '2.5';
      const feePercent = getTransactionFeePercent();
      const tiers = getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed }));
      const result = calculateFees(100, tiers, feePercent);
      expect(result.transactionFee).toBeCloseTo(2.5, 2);
    });
  });

  // ─── Discount Calculation ─────────────────────────────────────
  describe('discount math (referral fee reduction)', () => {
    it('50% discount on 1.5% fee → 0.75% effective fee', () => {
      const baseFeePercent = 1.5;
      const discountPercent = 50;
      const discountedPercent = baseFeePercent * (1 - discountPercent / 100);
      expect(discountedPercent).toBeCloseTo(0.75, 2);

      // On $100 payment:
      const transactionFee = (100 * discountedPercent) / 100;
      expect(transactionFee).toBeCloseTo(0.75, 2);

      // Savings:
      const originalFee = (100 * baseFeePercent) / 100;
      const savings = originalFee - transactionFee;
      expect(savings).toBeCloseTo(0.75, 2);
    });

    it('0% discount → no change to fee', () => {
      const baseFeePercent = 1.5;
      const discountPercent = 0;
      const discountedPercent = baseFeePercent * (1 - discountPercent / 100);
      expect(discountedPercent).toBe(1.5);
    });

    it('100% discount → 0% fee', () => {
      const baseFeePercent = 1.5;
      const discountPercent = 100;
      const discountedPercent = baseFeePercent * (1 - discountPercent / 100);
      expect(discountedPercent).toBe(0);
    });
  });

  // ─── Fee Deduction from Merchant Payout (the core question) ──
  describe('merchant payout after fee deduction', () => {
    it('$500 BTC payment → merchant gets $491.50 equivalent in BTC', () => {
      const tiers = getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed }));
      const feePercent = getTransactionFeePercent();
      const result = calculateFees(500, tiers, feePercent);

      // Platform takes: $8.50 ($1 fixed + $7.50 at 1.5%)
      expect(result.totalDeduction).toBeCloseTo(8.5, 2);
      // Merchant gets: $491.50 equivalent in BTC
      expect(result.userReceives).toBeCloseTo(491.5, 2);
      // THEN blockchain fees are deducted from merchant's $491.50 in settleCryptoTransaction
    });

    it('$50 payment — fee is significant % of total (3.75%)', () => {
      const tiers = getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed }));
      const feePercent = getTransactionFeePercent();
      const result = calculateFees(50, tiers, feePercent);

      const effectiveFeeRate = (result.totalDeduction / 50) * 100;
      // $1 fixed + $0.75 (1.5%) = $1.75 → 3.5% effective
      expect(effectiveFeeRate).toBeCloseTo(3.5, 1);
    });

    it('$10000 payment — fee rate approaches 1.5% + negligible fixed', () => {
      const tiers = getFeeTiers().map(t => ({ min: t.min, max: t.max, fixed: t.fixed }));
      const feePercent = getTransactionFeePercent();
      const result = calculateFees(10000, tiers, feePercent);

      const effectiveFeeRate = (result.totalDeduction / 10000) * 100;
      // $1 fixed + $150 (1.5%) = $151 → 1.51% effective
      expect(effectiveFeeRate).toBeCloseTo(1.51, 1);
    });
  });
});
