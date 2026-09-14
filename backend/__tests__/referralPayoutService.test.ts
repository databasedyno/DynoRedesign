/**
 * Referral revenue-share CASH-OUT — opt-in / OTP gating / payout request rules.
 * No funds move in any of these paths (the Binance leg runs on the leader cron).
 */
jest.mock("../utils/loggers", () => ({
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../utils/config", () => ({ raw: jest.fn(() => undefined) }));

const mockUser = { findByPk: jest.fn(), update: jest.fn().mockResolvedValue([1]) };
const mockPayout = { findOne: jest.fn(), create: jest.fn() };
const mockRedisStore: Record<string, string> = {};
const mockValidateTron = jest.fn((a: string) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a));
const mockSummary = jest.fn();
const mockEmails = {
  sendWithdrawalOTPEmail: jest.fn().mockResolvedValue(undefined),
  sendReferralPayoutRequestedEmail: jest.fn().mockResolvedValue(undefined),
  sendReferralAutoPayEnabledEmail: jest.fn().mockResolvedValue(undefined),
};

jest.mock("../models/userModels/userModel", () => ({ __esModule: true, default: mockUser }));
jest.mock("../models/referralModels/referralPayoutModel", () => ({ __esModule: true, default: mockPayout }));
jest.mock("../integrations/tatum/TatumClient", () => ({ tatumClient: { validateTronAddress: (a: string) => mockValidateTron(a) } }));
jest.mock("../services/emailService", () => mockEmails);
jest.mock("../services/referralService", () => ({ getReferrerCommissionSummary: (id: number) => mockSummary(id) }));

import sequelize from "../utils/dbInstance";
import { redis } from "../utils/redisInstance";
import { MIN_PAYOUT_USDT, getPayoutOverview, optInPayout, requestPayout, setAutoPayout } from "../services/referralPayoutService";

const SAVED = "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR";
const NEW_ADDR = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

const user = (over: Record<string, unknown> = {}) => ({
  user_id: 1,
  email: "owner@example.com",
  name: "Owner",
  referral_payout_mode: "credit",
  referral_payout_trc20_address: null,
  referral_payout_address_verified_at: null,
  referral_payout_auto: false,
  referral_payout_auto_min_usd: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockRedisStore)) delete mockRedisStore[k];
  (redis.get as jest.Mock).mockImplementation(async (k: string) => mockRedisStore[k] ?? null);
  (redis.set as jest.Mock).mockImplementation(async (k: string, v: string) => { mockRedisStore[k] = v; return "OK"; });
  (redis.del as jest.Mock).mockImplementation(async (k: string) => { delete mockRedisStore[k]; return 1; });
  // Saved (company-level) TRON wallets for the account
  (sequelize.query as jest.Mock).mockResolvedValue([
    { wallet_id: 3, wallet_name: null, wallet_type: "TRX", wallet_address: SAVED, company_id: 1, company_name: "The Dev Store" },
  ]);
  mockPayout.findOne.mockResolvedValue(null);
  mockSummary.mockResolvedValue({ unpaid_balance_usd: 0, total_credited_usd: 0 });
});

describe("getPayoutOverview", () => {
  it("credit mode exposes the balance as fee credit and cannot withdraw", async () => {
    mockUser.findByPk.mockResolvedValue(user({ referral_payout_trc20_address: SAVED, referral_payout_address_verified_at: new Date() }));
    mockSummary.mockResolvedValue({ unpaid_balance_usd: 40, total_credited_usd: 12 });
    const o = await getPayoutOverview(1);
    expect(o.mode).toBe("credit");
    expect(o.available_credit_usd).toBe(40);
    expect(o.credited_balance_usd).toBe(12);
    expect(o.can_withdraw).toBe(false);
    expect(o.wallets).toHaveLength(1);
    expect(o.trc20_address_masked).toBe("TTve8v6Y…4mAkxR");
  });

  it("cash mode: withdraw only with a verified address, ≥ minimum and no payout in flight", async () => {
    mockUser.findByPk.mockResolvedValue(user({ referral_payout_mode: "cash", referral_payout_trc20_address: SAVED, referral_payout_address_verified_at: new Date() }));
    mockSummary.mockResolvedValue({ unpaid_balance_usd: MIN_PAYOUT_USDT, total_credited_usd: 0 });
    let o = await getPayoutOverview(1);
    expect(o.available_credit_usd).toBe(0);
    expect(o.can_withdraw).toBe(true);

    mockPayout.findOne.mockResolvedValue({ payout_id: 9, amount_usd: "25", status: "pending", requested_at: new Date() });
    o = await getPayoutOverview(1);
    expect(o.can_withdraw).toBe(false);
    expect(o.pending_payout?.payout_id).toBe(9);

    mockPayout.findOne.mockResolvedValue(null);
    mockSummary.mockResolvedValue({ unpaid_balance_usd: MIN_PAYOUT_USDT - 0.01, total_credited_usd: 0 });
    o = await getPayoutOverview(1);
    expect(o.can_withdraw).toBe(false);
  });
});

describe("optInPayout", () => {
  it("credit → turns cash-out off but keeps the saved wallet", async () => {
    mockUser.findByPk.mockResolvedValue(user({ referral_payout_mode: "cash", referral_payout_trc20_address: SAVED }));
    const r = await optInPayout({ userId: 1, mode: "credit" });
    expect(r.success).toBe(true);
    expect(mockUser.update).toHaveBeenCalledWith({ referral_payout_mode: "credit" }, { where: { user_id: 1 } });
  });

  it("rejects an invalid TRON address", async () => {
    mockUser.findByPk.mockResolvedValue(user());
    const r = await optInPayout({ userId: 1, mode: "cash", address: "0xnotTron" });
    expect(r).toMatchObject({ success: false, statusCode: 400 });
    expect(mockUser.update).not.toHaveBeenCalled();
  });

  it("a wallet already saved on one of the account's brands is accepted", async () => {
    mockUser.findByPk.mockResolvedValue(user());
    const r = await optInPayout({ userId: 1, mode: "cash", address: SAVED });
    expect(r).toMatchObject({ success: true, mode: "cash", trc20_address: SAVED });
    expect(mockUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ referral_payout_mode: "cash", referral_payout_trc20_address: SAVED }),
      { where: { user_id: 1 } }
    );
  });

  it("re-enabling the address already verified on file is accepted", async () => {
    (sequelize.query as jest.Mock).mockResolvedValue([]);
    mockUser.findByPk.mockResolvedValue(user({ referral_payout_trc20_address: NEW_ADDR, referral_payout_address_verified_at: new Date() }));
    const r = await optInPayout({ userId: 1, mode: "cash", address: NEW_ADDR });
    expect(r.success).toBe(true);
    expect(r.message).toMatch(/re-enabled/i);
  });

  it("a brand-new address is verified + saved (identity comes from the payout step-up session)", async () => {
    (sequelize.query as jest.Mock).mockResolvedValue([]);
    mockUser.findByPk.mockResolvedValue(user());

    const ok = await optInPayout({ userId: 1, mode: "cash", address: NEW_ADDR });
    expect(ok).toMatchObject({ success: true, mode: "cash", trc20_address: NEW_ADDR });
    expect(ok.message).toMatch(/verified/i);
    expect(mockUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ referral_payout_mode: "cash", referral_payout_trc20_address: NEW_ADDR }),
      { where: { user_id: 1 } }
    );
  });
});

describe("requestPayout", () => {
  const cashUser = () => user({ referral_payout_mode: "cash", referral_payout_trc20_address: SAVED, referral_payout_address_verified_at: new Date() });

  it("refuses in credit mode / without a verified address", async () => {
    mockUser.findByPk.mockResolvedValue(user());
    expect(await requestPayout({ userId: 1 })).toMatchObject({ success: false, statusCode: 400, message: /cash first/i });
    mockUser.findByPk.mockResolvedValue(user({ referral_payout_mode: "cash" }));
    expect(await requestPayout({ userId: 1 })).toMatchObject({ success: false, statusCode: 400, message: /verify a USDT/i });
  });

  it("enforces the minimum + one payout in flight", async () => {
    mockUser.findByPk.mockResolvedValue(cashUser());
    mockSummary.mockResolvedValue({ unpaid_balance_usd: 10, total_credited_usd: 0 });
    expect(await requestPayout({ userId: 1 })).toMatchObject({ success: false, message: /at least \$25\.00/ });
    expect(mockPayout.create).not.toHaveBeenCalled();

    mockSummary.mockResolvedValue({ unpaid_balance_usd: 30, total_credited_usd: 0 });
    mockPayout.findOne.mockResolvedValue({ payout_id: 5, status: "pending" });
    expect(await requestPayout({ userId: 1 })).toMatchObject({ success: false, statusCode: 409 });
  });

  it("creates ONE pending payout row for the full unpaid balance (no funds move here)", async () => {
    mockUser.findByPk.mockResolvedValue(cashUser());
    mockSummary.mockResolvedValue({ unpaid_balance_usd: 42.5, total_credited_usd: 0 });
    mockPayout.create.mockResolvedValue({ payout_id: 77, requested_at: new Date() });

    const r = await requestPayout({ userId: 1, idempotencyKey: "idem-1" });

    expect(r.success).toBe(true);
    expect(mockPayout.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, amount_usd: 42.5, trc20_address: SAVED, status: "pending", idempotency_key: "idem-1" })
    );
    expect(mockEmails.sendReferralPayoutRequestedEmail).toHaveBeenCalled();
  });
});

describe("setAutoPayout", () => {
  it("requires cash mode + verified address; enabling stores the threshold", async () => {
    mockUser.findByPk.mockResolvedValue(user());
    expect(await setAutoPayout({ userId: 1, enabled: true })).toMatchObject({ success: false, statusCode: 400 });

    mockUser.findByPk.mockResolvedValue(user({ referral_payout_mode: "cash", referral_payout_trc20_address: SAVED, referral_payout_address_verified_at: new Date() }));
    const on = await setAutoPayout({ userId: 1, enabled: true, autoMinUsd: 60 });
    expect(on).toMatchObject({ success: true, auto: true, auto_min_usd: 60 });

    const off = await setAutoPayout({ userId: 1, enabled: false });
    expect(off).toMatchObject({ success: true, auto: false });
    expect(mockUser.update).toHaveBeenLastCalledWith({ referral_payout_auto: false }, { where: { user_id: 1 } });
  });
});
