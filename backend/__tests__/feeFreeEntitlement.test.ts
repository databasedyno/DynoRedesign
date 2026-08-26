/**
 * First-Payment-Free entitlement (replaces the old "first $500 of lifetime
 * volume" trial — decided 2026-08).
 *
 * Guarantees under test:
 *   - A genuine new merchant (zero settled volume, 'trial') gets ONE fully
 *     platform-fee-free payment of ANY size (no cap).
 *   - Anyone who has already transacted (cumulative > 0) OR graduated
 *     (fee_tier ≠ 'trial') is treated as having used it — clean cut-over, no
 *     revival for established merchants (regression: hostbay, $27.7k lifetime).
 *   - The first settled payment graduates the account trial → standard.
 *   - A failed/reversed settlement restores the freebie ONLY when it drops the
 *     account back to $0 settled volume.
 */

const mockFindByPk = jest.fn();
const mockUpdate = jest.fn();
const mockCommit = jest.fn();
const mockRollback = jest.fn();

jest.mock('../models', () => ({
  __esModule: true,
  userModel: {
    findByPk: (...args: unknown[]) => mockFindByPk(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

jest.mock('../utils/dbInstance', () => ({
  __esModule: true,
  default: {
    transaction: () => Promise.resolve({ commit: mockCommit, rollback: mockRollback }),
    literal: (sql: string) => ({ __sql: sql }),
  },
}));

jest.mock('../utils/loggers', () => ({
  log: jest.fn(),
  cronLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import {
  isFirstPaymentFreeAvailable,
  resolveFeeFreeRemaining,
  getFeeFreeStatus,
  calculateFeeFreeDiscount,
  recordTransactionVolume,
  reverseTransactionVolume,
} from '../services/feeFreeService';

const userRow = (cumulative: number, tier = 'trial', remaining = 0) => {
  const plain = {
    user_id: 1,
    cumulative_volume_usd: String(cumulative),
    fee_free_remaining_usd: String(remaining),
    fee_tier: tier,
  };
  return { ...plain, get: () => plain };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue([1]);
});

describe('isFirstPaymentFreeAvailable', () => {
  it('is available for a brand-new merchant (no volume, trial)', () => {
    expect(isFirstPaymentFreeAvailable(0, 'trial')).toBe(true);
  });
  it('is NOT available once the merchant has any settled volume', () => {
    expect(isFirstPaymentFreeAvailable(75, 'trial')).toBe(false);
  });
  it('is NOT available for a graduated merchant (standard) even at $0 volume', () => {
    expect(isFirstPaymentFreeAvailable(0, 'standard')).toBe(false);
  });
  it('is NOT available for an established $27.7k merchant', () => {
    expect(isFirstPaymentFreeAvailable(27738.93, 'standard')).toBe(false);
  });
});

describe('resolveFeeFreeRemaining (legacy compat for profile.ts)', () => {
  it('reports the sentinel while unused (zero volume)', () => {
    expect(resolveFeeFreeRemaining(0)).toBe(500);
  });
  it('reports 0 once the merchant has transacted', () => {
    expect(resolveFeeFreeRemaining(75)).toBe(0);
  });
});

describe('getFeeFreeStatus', () => {
  it('reports first-payment-free AVAILABLE for a genuine new merchant', async () => {
    mockFindByPk.mockResolvedValue(userRow(0, 'trial'));
    const status = await getFeeFreeStatus(1);
    expect(status?.is_fee_free).toBe(true);
    expect(status?.first_payment_free).toBe(true);
    expect(status?.fee_free_remaining_usd).toBe(500);
    expect(status?.percentage_used).toBe(0);
  });

  it('reports USED for a merchant who already transacted (Q3a clean cut-over)', async () => {
    mockFindByPk.mockResolvedValue(userRow(75, 'trial'));
    const status = await getFeeFreeStatus(1);
    expect(status?.is_fee_free).toBe(false);
    expect(status?.first_payment_free).toBe(false);
    expect(status?.fee_free_remaining_usd).toBe(0);
    expect(status?.percentage_used).toBe(100);
  });

  it('reports USED for the established $27.7k merchant (no revival)', async () => {
    mockFindByPk.mockResolvedValue(userRow(27738.93, 'standard'));
    const status = await getFeeFreeStatus(1);
    expect(status?.is_fee_free).toBe(false);
    expect(status?.first_payment_free).toBe(false);
  });
});

describe('calculateFeeFreeDiscount', () => {
  it('waives the FULL first payment for a new merchant (small amount)', async () => {
    mockFindByPk.mockResolvedValue(userRow(0, 'trial'));
    const d = await calculateFeeFreeDiscount(1, 75);
    expect(d.fee_free_amount).toBe(75);
    expect(d.fee_applicable_amount).toBe(0);
    expect(d.is_fully_free).toBe(true);
  });

  it('waives the FULL first payment with NO cap (large amount, Q2a)', async () => {
    mockFindByPk.mockResolvedValue(userRow(0, 'trial'));
    const d = await calculateFeeFreeDiscount(1, 10000);
    expect(d.fee_free_amount).toBe(10000);
    expect(d.is_fully_free).toBe(true);
  });

  it('charges full platform fees once the freebie is used', async () => {
    mockFindByPk.mockResolvedValue(userRow(75, 'trial'));
    const d = await calculateFeeFreeDiscount(1, 75);
    expect(d.fee_free_amount).toBe(0);
    expect(d.fee_applicable_amount).toBe(75);
    expect(d.is_fully_free).toBe(false);
  });

  it('charges full platform fees to the established $27.7k merchant', async () => {
    mockFindByPk.mockResolvedValue(userRow(27738.93, 'standard'));
    const d = await calculateFeeFreeDiscount(1, 75);
    expect(d.fee_free_amount).toBe(0);
    expect(d.is_fully_free).toBe(false);
  });
});

describe('recordTransactionVolume', () => {
  it('adds volume, zeroes the legacy counter and graduates trial → standard on the first payment', async () => {
    mockFindByPk.mockResolvedValue(userRow(75, 'standard'));
    await recordTransactionVolume(1, 75);

    const writes = mockUpdate.mock.calls[0][0] as any;
    expect(writes.cumulative_volume_usd.__sql).toContain('COALESCE("cumulative_volume_usd", 0) + 75');
    expect(writes.fee_free_remaining_usd).toBe(0);
    // Graduate to standard on the account's first payment (idempotent afterwards).
    expect(writes.fee_tier.__sql).toContain(`CASE WHEN "fee_tier" = 'trial' THEN 'standard'`);
  });
});

describe('reverseTransactionVolume', () => {
  it('restores first-payment-free when the reversal drops the account back to $0 volume', async () => {
    // After the decrement the account is back to 0 volume on 'standard'.
    mockFindByPk.mockResolvedValueOnce(userRow(0, 'standard'));
    mockFindByPk.mockResolvedValue(userRow(0, 'trial'));
    await reverseTransactionVolume(1, 75);

    const tierRestores = mockUpdate.mock.calls.filter(
      (c) => (c[0] as any)?.fee_tier === 'trial',
    );
    expect(tierRestores).toHaveLength(1);
  });

  it('does NOT restore for an established merchant with remaining volume', async () => {
    // After the decrement the merchant still has $27.6k of settled volume.
    mockFindByPk.mockResolvedValue(userRow(27663.93, 'standard'));
    await reverseTransactionVolume(1, 75);

    const tierRestores = mockUpdate.mock.calls.filter(
      (c) => (c[0] as any)?.fee_tier === 'trial',
    );
    expect(tierRestores).toHaveLength(0);
  });
});
