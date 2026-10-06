/**
 * Settlement claim release (prod 2026-10-06, payment 3105cb92 — 19-minute delay):
 * acquireLock("settlement-claim-<id>") stores the claim at `lock:settlement-claim-<id>`,
 * but markSettlementFailed used deleteRedisItem("settlement-claim-<id>") — a key that
 * never existed — so every retry for the 10-min TTL was rejected as "another worker won
 * the race". The claim must be released through releaseLock (same namespace).
 */
jest.mock("../utils/loggers", () => ({
  cronLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  webhookLogs: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  log: jest.fn(),
}));
jest.mock("../utils/config", () => ({ raw: (k: string) => process.env[k], str: (k: string) => process.env[k] || "", num: (_k: string, d: number) => d, bool: () => false }));
jest.mock("../services/tronEnergyService", () => ({ tronGridHeaders: () => ({}) }));
jest.mock("../services/errorMonitoringService", () => ({ captureError: jest.fn() }));
jest.mock("../services/webhookQueue", () => ({ getQueueHealth: jest.fn() }));
jest.mock("../services/merchantPool/merchantPoolConfig", () => ({ TOKEN_CONTRACTS: {}, RLUSD_CONFIG: { issuer: "r" } }));
const journal = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), destroy: jest.fn() };
jest.mock("../models/paymentJournalModel", () => ({ __esModule: true, default: journal }));
jest.mock("../apis/tatumApi", () => ({ __esModule: true, default: { getTatumSDK: async () => ({ blockchain: {} }) } }));

import { markSettlementFailed, markSettlementCompleted, checkSettlementIdempotency, releaseSettlementClaim } from "../services/paymentReliability";
import { acquireLock, releaseLock, deleteRedisItem, getRedisItem, setRedisItem } from "../utils/redisInstance";

const PAYMENT = "3105cb92-ad20-4b5b-a1a5-22e20347103e";
const CLAIM = `settlement-claim-${PAYMENT}`;

beforeEach(() => {
  jest.clearAllMocks();
  (getRedisItem as jest.Mock).mockResolvedValue(null);
  (acquireLock as jest.Mock).mockResolvedValue(true);
});

describe("settlement claim lifecycle", () => {
  it("claim is taken through acquireLock under the settlement-claim-<id> name", async () => {
    await checkSettlementIdempotency(PAYMENT, "0xpool", "ETH", "0xdeposit", "0xmerchant");
    expect(acquireLock).toHaveBeenCalledWith(CLAIM, 600, 1, 0, false, true);
  });

  it("markSettlementFailed releases the claim via releaseLock (same namespace as acquireLock) — not deleteRedisItem", async () => {
    await markSettlementFailed(PAYMENT, "insufficient funds for intrinsic transaction cost");
    expect(releaseLock).toHaveBeenCalledWith(CLAIM, true);
    expect(deleteRedisItem).not.toHaveBeenCalledWith(CLAIM);
    // the lock marker itself goes to 'failed' with a short cooldown so the next retry is allowed through
    expect(setRedisItem).toHaveBeenCalledWith(`settlement-lock-${PAYMENT}`, expect.objectContaining({ status: "failed" }));
  });

  it("markSettlementCompleted also drops the claim (no dangling 10-min lock after success)", async () => {
    await markSettlementCompleted(PAYMENT, "0xpayout", "0xpool", "ETH", 0.00184136, 0, 399);
    expect(releaseLock).toHaveBeenCalledWith(CLAIM, true);
    expect(setRedisItem).toHaveBeenCalledWith(`settlement-lock-${PAYMENT}`, expect.objectContaining({ status: "completed", settlementTxId: "0xpayout" }));
  });

  it("fail → retry: once the claim is released a retry acquires it instead of being blocked as a duplicate", async () => {
    // Simulate the real lock semantics for this payment only
    let held = false;
    (acquireLock as jest.Mock).mockImplementation(async () => { if (held) return false; held = true; return true; });
    (releaseLock as jest.Mock).mockImplementation(async () => { held = false; });

    expect((await checkSettlementIdempotency(PAYMENT, "0xpool", "ETH", "0xdeposit", "0xmerchant")).alreadySettled).toBe(false);
    // Another worker arriving while the first still holds the claim is (correctly) blocked …
    expect((await checkSettlementIdempotency(PAYMENT, "0xpool", "ETH", "0xdeposit", "0xmerchant")).alreadySettled).toBe(true);
    // … but after the holder fails, the very next retry gets through (previously blocked for 10 min).
    await markSettlementFailed(PAYMENT, "boom");
    (getRedisItem as jest.Mock).mockResolvedValue({ status: "failed", failedAt: Date.now() });
    expect((await checkSettlementIdempotency(PAYMENT, "0xpool", "ETH", "0xdeposit", "0xmerchant")).alreadySettled).toBe(false);
  });

  it("releaseSettlementClaim never throws (release failures are logged, not fatal)", async () => {
    (releaseLock as jest.Mock).mockRejectedValueOnce(new Error("redis down"));
    await expect(releaseSettlementClaim(PAYMENT)).resolves.toBeUndefined();
  });
});
