/**
 * Regression: "First $500 fee-free" must NEVER resurrect for an established merchant.
 *
 * Production incident (hostbay@moxx.co, user_id 1, $27.7k lifetime volume):
 *   1. A $75 ETH payment failed to settle and was retried every 20 min.
 *   2. Each failure called reverseTransactionVolume(1, 75), which restored
 *      LEAST(500, remaining + 75) → fee_free_remaining_usd flipped 0 → 75.
 *   3. getFeeFreeStatus derived is_fee_free purely from `remaining > 0`, so the
 *      welcome popup / banner / GrowPanel CTA came back — and $75 of real
 *      platform fees would have been waived for a graduated merchant.
 *
 * Entitlement is now a function of LIFETIME volume, clamped on read AND on write.
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
  resolveFeeFreeRemaining,
  getFeeFreeStatus,
  calculateFeeFreeDiscount,
  reverseTransactionVolume,
} from '../services/feeFreeService';

const userRow = (cumulative: number, remaining: number, tier = 'growth') => {
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

describe('resolveFeeFreeRemaining', () => {
  it('gives a brand-new user the full $500', () => {
    expect(resolveFeeFreeRemaining(0, 500)).toBe(500);
  });

  it('keeps a mid-trial balance untouched', () => {
    expect(resolveFeeFreeRemaining(75, 425)).toBe(425);
  });

  it('returns 0 for a graduated merchant even when the counter drifted up', () => {
    expect(resolveFeeFreeRemaining(27738.93, 75)).toBe(0);
  });

  it('clamps a stored balance that exceeds the remaining entitlement', () => {
    expect(resolveFeeFreeRemaining(400, 500)).toBe(100);
  });

  it('never returns a negative balance', () => {
    expect(resolveFeeFreeRemaining(600, -25)).toBe(0);
  });
});

describe('getFeeFreeStatus', () => {
  it('reports NOT fee-free for the $27.7k merchant with a drifted $75 balance', async () => {
    mockFindByPk.mockResolvedValue(userRow(27738.93, 75));
    const status = await getFeeFreeStatus(1);
    expect(status?.is_fee_free).toBe(false);
    expect(status?.fee_free_remaining_usd).toBe(0);
    expect(status?.fee_free_used_usd).toBe(500);
    expect(status?.percentage_used).toBe(100);
  });

  it('still reports fee-free for a genuine new merchant', async () => {
    mockFindByPk.mockResolvedValue(userRow(0, 500, 'trial'));
    const status = await getFeeFreeStatus(1);
    expect(status?.is_fee_free).toBe(true);
    expect(status?.fee_free_remaining_usd).toBe(500);
    expect(status?.fee_free_used_usd).toBe(0);
  });
});

describe('calculateFeeFreeDiscount', () => {
  it('charges full platform fees to a graduated merchant with a drifted balance', async () => {
    mockFindByPk.mockResolvedValue(userRow(27738.93, 75));
    const d = await calculateFeeFreeDiscount(1, 75);
    expect(d.fee_free_amount).toBe(0);
    expect(d.fee_applicable_amount).toBe(75);
    expect(d.is_fully_free).toBe(false);
  });

  it('waives fees within the trial for a new merchant', async () => {
    mockFindByPk.mockResolvedValue(userRow(0, 500, 'trial'));
    const d = await calculateFeeFreeDiscount(1, 75);
    expect(d.fee_free_amount).toBe(75);
    expect(d.is_fully_free).toBe(true);
  });
});

describe('reverseTransactionVolume', () => {
  it('clamps the restored balance to the post-reversal entitlement (no LEAST($500, …) revival)', async () => {
    mockFindByPk.mockResolvedValue(userRow(27738.93, 0));
    await reverseTransactionVolume(1, 75);

    const sql = (mockUpdate.mock.calls[0][0] as any).fee_free_remaining_usd.__sql as string;
    // Entitlement clamp present …
    expect(sql).toContain('GREATEST(0, 500 - GREATEST(0, COALESCE("cumulative_volume_usd", 0) - 75))');
    // … and the old unconditional cap is gone.
    expect(sql).not.toMatch(/LEAST\(\s*500\s*,/);
  });

  it('does not re-flag a graduated merchant back to the trial tier', async () => {
    mockFindByPk.mockResolvedValue(userRow(27738.93, 0, 'standard'));
    await reverseTransactionVolume(1, 75);
    const tierWrites = mockUpdate.mock.calls.filter(
      (c) => (c[0] as any)?.fee_tier === 'trial',
    );
    expect(tierWrites).toHaveLength(0);
  });
});
