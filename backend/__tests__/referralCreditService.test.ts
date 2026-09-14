/**
 * Referral revenue-share FEE CREDIT — balance math, idempotent consumption and
 * the crypto fee shift used at settlement.
 */
jest.mock("../utils/loggers", () => ({
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockUser = { findByPk: jest.fn() };
const mockReferral = { findAll: jest.fn() };
const mockReward = { findAll: jest.fn(), create: jest.fn() };
jest.mock("../models/userModels/userModel", () => ({ __esModule: true, default: mockUser }));
jest.mock("../models/referralModels/referralModel", () => ({ __esModule: true, default: mockReferral }));
jest.mock("../models/referralModels/referralRewardModel", () => ({ __esModule: true, default: mockReward }));

import sequelize from "../utils/dbInstance";
import {
  computeReferralFeeCreditShift,
  consumeReferralCreditForTransaction,
  getAvailableCreditForFees,
} from "../services/referralCreditService";

const referral = (over: Record<string, unknown>) => ({
  referral_id: 1,
  commission_accrued_usd: 0,
  commission_paid_usd: 0,
  commission_credited_usd: 0,
  update: jest.fn().mockResolvedValue(undefined),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (sequelize.transaction as jest.Mock).mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
    fn({ LOCK: { UPDATE: "UPDATE" } })
  );
  mockReward.findAll.mockResolvedValue([]);
  mockReward.create.mockResolvedValue({});
});

describe("getAvailableCreditForFees", () => {
  it("sums accrued − paid − credited across active/rewarded referrals in credit mode", async () => {
    mockUser.findByPk.mockResolvedValue({ referral_payout_mode: "credit" });
    mockReferral.findAll.mockResolvedValue([
      referral({ commission_accrued_usd: 40, commission_paid_usd: 10, commission_credited_usd: 5 }),
      referral({ referral_id: 2, commission_accrued_usd: 12.345 }),
    ]);
    await expect(getAvailableCreditForFees(1)).resolves.toBe(37.35);
  });

  it("returns 0 in cash mode — the balance is reserved for USDT cash-out", async () => {
    mockUser.findByPk.mockResolvedValue({ referral_payout_mode: "cash" });
    mockReferral.findAll.mockResolvedValue([referral({ commission_accrued_usd: 100 })]);
    await expect(getAvailableCreditForFees(1)).resolves.toBe(0);
    expect(mockReferral.findAll).not.toHaveBeenCalled();
  });

  it("never goes negative (over-credited history)", async () => {
    mockUser.findByPk.mockResolvedValue({ referral_payout_mode: null });
    mockReferral.findAll.mockResolvedValue([referral({ commission_accrued_usd: 5, commission_credited_usd: 9 })]);
    await expect(getAvailableCreditForFees(1)).resolves.toBe(0);
  });
});

describe("consumeReferralCreditForTransaction", () => {
  it("is idempotent per transaction ref — returns the prior total without writing", async () => {
    mockReward.findAll.mockResolvedValue([{ amount: 1.25 }, { amount: 0.5 }]);
    const consumed = await consumeReferralCreditForTransaction({ userId: 1, maxUsd: 9, transactionRef: "tx-1" });
    expect(consumed).toBe(1.75);
    expect(mockUser.findByPk).not.toHaveBeenCalled();
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it("does nothing in cash mode", async () => {
    mockUser.findByPk.mockResolvedValue({ referral_payout_mode: "cash" });
    const consumed = await consumeReferralCreditForTransaction({ userId: 1, maxUsd: 9, transactionRef: "tx-2" });
    expect(consumed).toBe(0);
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it("spends oldest referral first, caps at maxUsd and writes one audit row per referral touched", async () => {
    mockUser.findByPk.mockResolvedValue({ referral_payout_mode: "credit" });
    const r1 = referral({ referral_id: 11, commission_accrued_usd: 2, commission_credited_usd: 0.5 }); // $1.50 left
    const r2 = referral({ referral_id: 12, commission_accrued_usd: 10 }); // $10 left
    mockReferral.findAll.mockResolvedValue([r1, r2]);

    const consumed = await consumeReferralCreditForTransaction({ userId: 1, maxUsd: 4, transactionRef: "tx-3" });

    expect(consumed).toBe(4);
    expect(r1.update).toHaveBeenCalledWith({ commission_credited_usd: 2 }, expect.anything());
    expect(r2.update).toHaveBeenCalledWith({ commission_credited_usd: 2.5 }, expect.anything());
    expect(mockReward.create).toHaveBeenCalledTimes(2);
    expect(mockReward.create).toHaveBeenCalledWith(
      expect.objectContaining({ referral_id: 11, reward_type: "commission_credit", amount: 1.5, status: "credited", transaction_id: "tx-3" }),
      expect.anything()
    );
    expect(mockReward.create).toHaveBeenCalledWith(
      expect.objectContaining({ referral_id: 12, amount: 2.5 }),
      expect.anything()
    );
  });

  it("ignores zero / missing inputs", async () => {
    expect(await consumeReferralCreditForTransaction({ userId: 1, maxUsd: 0, transactionRef: "x" })).toBe(0);
    expect(await consumeReferralCreditForTransaction({ userId: 0, maxUsd: 5, transactionRef: "x" })).toBe(0);
    expect(await consumeReferralCreditForTransaction({ userId: 1, maxUsd: 5, transactionRef: "" })).toBe(0);
  });
});

describe("computeReferralFeeCreditShift", () => {
  const toUsd = jest.fn(async (amount: number) => amount * 100); // 1 unit == $100
  const base = { userId: 1, currency: "LTC", baseCryptoAmount: 1, adminAmountToSend: 0.02, userAmountToSend: 0.98, toUsd };

  it("leaves the split untouched when there is no credit", async () => {
    mockUser.findByPk.mockResolvedValue({ referral_payout_mode: "credit" });
    mockReferral.findAll.mockResolvedValue([]);
    await expect(computeReferralFeeCreditShift(base)).resolves.toEqual({ adminAmountToSend: 0.02, userAmountToSend: 0.98, appliedUsd: 0 });
  });

  it("shifts fee crypto to the merchant, capped at the platform fee ($2 here)", async () => {
    mockUser.findByPk.mockResolvedValue({ referral_payout_mode: "credit" });
    mockReferral.findAll.mockResolvedValue([referral({ commission_accrued_usd: 50 })]);
    const r = await computeReferralFeeCreditShift(base);
    expect(r.appliedUsd).toBe(2);
    expect(r.adminAmountToSend).toBeCloseTo(0, 8);
    expect(r.userAmountToSend).toBeCloseTo(1, 8);
  });

  it("applies only the available credit when it is smaller than the fee", async () => {
    mockUser.findByPk.mockResolvedValue({ referral_payout_mode: "credit" });
    mockReferral.findAll.mockResolvedValue([referral({ commission_accrued_usd: 0.5 })]);
    const r = await computeReferralFeeCreditShift(base);
    expect(r.appliedUsd).toBe(0.5);
    expect(r.adminAmountToSend).toBeCloseTo(0.015, 8);
    expect(r.userAmountToSend).toBeCloseTo(0.985, 8);
  });

  it("returns the original split (never throws) when the rate lookup fails", async () => {
    mockUser.findByPk.mockResolvedValue({ referral_payout_mode: "credit" });
    mockReferral.findAll.mockResolvedValue([referral({ commission_accrued_usd: 50 })]);
    const r = await computeReferralFeeCreditShift({ ...base, toUsd: jest.fn().mockRejectedValue(new Error("rate down")) });
    expect(r).toEqual({ adminAmountToSend: 0.02, userAmountToSend: 0.98, appliedUsd: 0 });
  });

  it("does not consult the balance without a user or when there is no fee to reduce", async () => {
    await computeReferralFeeCreditShift({ ...base, userId: null });
    await computeReferralFeeCreditShift({ ...base, adminAmountToSend: 0 });
    expect(mockUser.findByPk).not.toHaveBeenCalled();
  });
});
