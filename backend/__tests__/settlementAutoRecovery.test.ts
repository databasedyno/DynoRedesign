/**
 * Settlement auto-recovery for EVM chains (2026-09-27, prod payment f8e1ca0e):
 * the payout tx was mined but the process died before bookkeeping → reconciliation
 * looped for hours. verifySettlementOnChain must find the mined payout and
 * checkSettlementIdempotency must short-circuit on retries instead of paying twice.
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
jest.mock("../services/merchantPool/merchantPoolConfig", () => ({
  TOKEN_CONTRACTS: { "USDT-ERC20": "0xdac17f958d2ee523a2206206994597c13d831ec7" },
  RLUSD_CONFIG: { issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De" },
}));
const journal = { findOne: jest.fn(), create: jest.fn().mockResolvedValue({}), destroy: jest.fn() };
jest.mock("../models/paymentJournalModel", () => ({ __esModule: true, default: journal }));
const sdk: any = { blockchain: { eth: {}, polygon: {}, bsc: {} } };
jest.mock("../apis/tatumApi", () => ({ __esModule: true, default: { getTatumSDK: async () => sdk } }));

import { verifySettlementOnChain, checkSettlementIdempotency } from "../services/paymentReliability";
import { getRedisItem, setRedisItem, acquireLock } from "../utils/redisInstance";

const POOL = "0xdbb830880280b349df072edace1b70f03f9e3d1c";
const MERCHANT = "0x9a7221b5e32d5f99e8da95585835442e29afb38f";
const DEPOSIT = "0xe8288573856701a498d9b3bcca7137eb2616ebcecdaeec375f17b41b6b25cec6";
const PAYOUT = "0xd797611b300002c15e0cbf279f8ca9e89b8d853bd51de6a05d1c1c9dd847f016";
const PAYMENT = "f8e1ca0e-19f1-46a9-b54f-5fdbd5b4ca08";
const wei = (eth: number) => BigInt(Math.round(eth * 1e18)).toString();

const depositTx = { hash: DEPOSIT, from: "0x28c6c06298d514db089934071355e5743bf21d60", to: POOL, value: wei(0.00793), blockNumber: 26069285, status: true };
const payoutTx = { hash: PAYOUT, from: POOL, to: MERCHANT, value: wei(0.00791971), blockNumber: 26069295, status: true };
const olderPayout = { hash: "0xef751a14017700000000000000000000000000000000000000000000000000aa", from: POOL, to: MERCHANT, value: wei(0.021367), blockNumber: 25951077, status: true };

beforeEach(() => {
  jest.clearAllMocks();
  journal.findOne.mockReset().mockResolvedValue(null);
  (getRedisItem as jest.Mock).mockResolvedValue(null);
  (acquireLock as jest.Mock).mockResolvedValue(true);
  const known: Record<string, any> = { [DEPOSIT]: depositTx, [PAYOUT]: payoutTx };
  sdk.blockchain.eth = {
    ethGetTransaction: jest.fn(async (h: string) => {
      if (known[h]) return known[h];
      throw Object.assign(new Error("not found"), { status: 404 });
    }),
    ethGetTransactionByAddress: jest.fn().mockResolvedValue([payoutTx, depositTx, olderPayout]),
  };
});

describe("verifySettlementOnChain — EVM", () => {
  it("pass 1: the hash journaled at broadcast time is mined and pays the merchant → settled", async () => {
    journal.findOne.mockResolvedValueOnce({ metadata: { settlementTxHash: PAYOUT } });
    const r = await verifySettlementOnChain(POOL, "ETH", MERCHANT, PAYMENT, DEPOSIT);
    expect(r).toEqual({ settled: true, outgoingTxId: PAYOUT, amount: 0.00791971 });
    expect(sdk.blockchain.eth.ethGetTransactionByAddress).not.toHaveBeenCalled();
  });
  it("pass 2: no journaled hash → scans outgoing txs mined at/after the deposit block, ignores the deposit and older payouts", async () => {
    const r = await verifySettlementOnChain(POOL, "ETH", MERCHANT, PAYMENT, DEPOSIT);
    expect(r).toEqual({ settled: true, outgoingTxId: PAYOUT, amount: 0.00791971 });
    expect(sdk.blockchain.eth.ethGetTransactionByAddress).toHaveBeenCalledWith(POOL, 50, 0, 26069285, undefined, "DESC");
  });
  it("payout to a different wallet than the merchant's is NOT a settlement", async () => {
    const r = await verifySettlementOnChain(POOL, "ETH", "0x000000000000000000000000000000000000dead", PAYMENT, DEPOSIT);
    expect(r.settled).toBe(false);
  });
  it("only the older payout exists after the deposit block → not settled (recycled pool address safety)", async () => {
    sdk.blockchain.eth.ethGetTransactionByAddress.mockResolvedValue([depositTx, olderPayout]);
    expect((await verifySettlementOnChain(POOL, "ETH", MERCHANT, PAYMENT, DEPOSIT)).settled).toBe(false);
  });
  it("reverted payout (status=false) is not a settlement", async () => {
    sdk.blockchain.eth.ethGetTransactionByAddress.mockResolvedValue([{ ...payoutTx, status: false }]);
    expect((await verifySettlementOnChain(POOL, "ETH", MERCHANT, PAYMENT, DEPOSIT)).settled).toBe(false);
  });
  it("no incoming txId and no journaled hash → cannot bound the scan → not settled", async () => {
    expect((await verifySettlementOnChain(POOL, "ETH", MERCHANT, PAYMENT, null)).settled).toBe(false);
    expect(sdk.blockchain.eth.ethGetTransactionByAddress).not.toHaveBeenCalled();
  });
  it("ERC-20: Transfer log from pool to merchant on the token contract counts", async () => {
    const TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const pad = (a: string) => "0x" + a.replace(/^0x/, "").padStart(64, "0");
    const tokenPayout = { hash: "0xtok", from: POOL, to: "0xdac17f958d2ee523a2206206994597c13d831ec7", value: "0", blockNumber: 26069300, status: true,
      logs: [{ address: "0xdac17f958d2ee523a2206206994597c13d831ec7", topics: [TOPIC, pad(POOL), pad(MERCHANT)], data: "0x" + (26_000_000).toString(16) }] };
    sdk.blockchain.eth.ethGetTransactionByAddress.mockResolvedValue([tokenPayout, depositTx]);
    const r = await verifySettlementOnChain(POOL, "USDT-ERC20", MERCHANT, PAYMENT, DEPOSIT);
    expect(r).toEqual({ settled: true, outgoingTxId: "0xtok", amount: 26 });
  });
});

describe("checkSettlementIdempotency — retry after a broadcast that never got bookkept", () => {
  it("prior settlement_started + payout mined on-chain → alreadySettled with the payout hash; Redis completed + journal auto_recovered; no claim taken", async () => {
    journal.findOne.mockImplementation(async (q: any) => {
      const ev = q?.where?.event;
      if (ev === "settlement_sent") return null;
      if (ev === "settlement_tx_broadcast") return { metadata: { settlementTxHash: PAYOUT } };
      return { id: 1 }; // the Op.in prior-attempt probe
    });
    const r = await checkSettlementIdempotency(PAYMENT, POOL, "ETH", DEPOSIT, MERCHANT);
    expect(r).toEqual({ alreadySettled: true, existingTxId: PAYOUT });
    expect(setRedisItem).toHaveBeenCalledWith(`settlement-lock-${PAYMENT}`, expect.objectContaining({ status: "completed", settlementTxId: PAYOUT, autoRecovered: true, recoveredFrom: "retry_after_broadcast" }));
    expect(journal.create).toHaveBeenCalledWith(expect.objectContaining({ event: "settlement_auto_recovered", settlement_tx_id: PAYOUT, payment_id: PAYMENT }));
    expect(acquireLock).not.toHaveBeenCalled();
  });
  it("first attempt (no prior settlement_* journal) → no chain lookup, proceeds to the atomic claim", async () => {
    const r = await checkSettlementIdempotency(PAYMENT, POOL, "ETH", DEPOSIT, MERCHANT);
    expect(r).toEqual({ alreadySettled: false, existingTxId: null });
    expect(sdk.blockchain.eth.ethGetTransaction).not.toHaveBeenCalled();
    expect(sdk.blockchain.eth.ethGetTransactionByAddress).not.toHaveBeenCalled();
    expect(acquireLock).toHaveBeenCalled();
  });
  it("prior attempt but funds still in pool (no payout on-chain) → retry allowed (claim taken)", async () => {
    journal.findOne.mockImplementation(async (q: any) => (q?.where?.event === "settlement_sent" || q?.where?.event === "settlement_tx_broadcast") ? null : { id: 1 });
    sdk.blockchain.eth.ethGetTransactionByAddress.mockResolvedValue([depositTx, olderPayout]);
    const r = await checkSettlementIdempotency(PAYMENT, POOL, "ETH", DEPOSIT, MERCHANT);
    expect(r).toEqual({ alreadySettled: false, existingTxId: null });
    expect(acquireLock).toHaveBeenCalled();
  });
  it("stale in_progress marker + payout mined → auto-recovered from the stale path too", async () => {
    (getRedisItem as jest.Mock).mockResolvedValue({ status: "in_progress", startedAt: Date.now() - 20 * 60_000 });
    journal.findOne.mockImplementation(async (q: any) => q?.where?.event === "settlement_tx_broadcast" ? { metadata: { settlementTxHash: PAYOUT } } : null);
    const r = await checkSettlementIdempotency(PAYMENT, POOL, "ETH", DEPOSIT, MERCHANT);
    expect(r).toEqual({ alreadySettled: true, existingTxId: PAYOUT });
    expect(setRedisItem).toHaveBeenCalledWith(`settlement-lock-${PAYMENT}`, expect.objectContaining({ recoveredFrom: "stale_in_progress" }));
  });
});
