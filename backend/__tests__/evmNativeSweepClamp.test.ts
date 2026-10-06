/**
 * directEvmSweep native branch — wei-exact clamp (prod 2026-10-06, payment 3105cb92):
 * the quoted fee was 8-dp truncated, so value + 21000 × 1.221 gwei exceeded the pool
 * balance by exactly 1 gwei and the node rejected the payout (INSUFFICIENT_FUNDS).
 * The broadcast layer must absorb a rounding-sized shortfall and report the amount it
 * really signed; a large shortfall is a real bug and must still surface.
 */
import { ethers } from "ethers";

jest.mock("../utils/loggers", () => ({
  cronLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../utils/tatumAuth", () => ({ TATUM_V3_URL: "https://api.tatum.io/v3", getTatumApiKey: () => "" }));

const state = {
  balance: 1_854_360_000_000_000n, // 0.00185436 ETH — the real prod deposit
  baseFee: ethers.parseUnits("0.6", "gwei"),
  priority: ethers.parseUnits("0.05", "gwei"),
  sent: [] as ethers.TransactionRequest[],
};

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  class FakeProvider {
    async getBalance() { return state.balance; }
    async getBlock() { return { baseFeePerGas: state.baseFee }; }
    async getFeeData() { return { maxPriorityFeePerGas: state.priority, maxFeePerGas: null, gasPrice: null }; }
    async getTransactionCount() { return 3; }
    async getTransaction(hash: string) { return { hash }; }
  }
  class FakeWallet {
    constructor(_key: string, _provider: unknown) {}
    async sendTransaction(tx: ethers.TransactionRequest) {
      state.sent.push(tx);
      return { hash: "0x" + "ab".repeat(32) };
    }
  }
  return { ...actual, ethers: { ...actual.ethers, JsonRpcProvider: FakeProvider, Wallet: FakeWallet, Network: actual.ethers.Network } };
});

import { directEvmSweep } from "../services/merchantPool/directEvmTransfer";

const POOL = "0x28d8fcbe473184926ffdd1645286d197f379fa67";
const MERCHANT = "0x584a9917cf0d4a50b3575c8d6c1b8f2afae014da";
const KEY = "0x" + "11".repeat(32);
const CAP_GWEI = 1.221;
const gasWei = 21000n * ethers.parseUnits(String(CAP_GWEI), "gwei");

beforeEach(() => { state.sent = []; });

describe("directEvmSweep — native full-balance clamp", () => {
  it("prod case: 1 gwei short → clamps value to balance − gasLimit × maxFeePerGas and reports amountSent", async () => {
    // Settlement deducted the truncated quote 0.00002564 → asked to send 0.00182872
    const r = await directEvmSweep({ fromAddress: POOL, toAddress: MERCHANT, privateKey: KEY, walletType: "ETH", amount: 0.00182872, gasPriceGwei: CAP_GWEI });
    expect(state.sent).toHaveLength(1);
    const tx = state.sent[0];
    const value = BigInt(tx.value as bigint);
    expect(value + gasWei).toBe(state.balance);                       // fits exactly
    expect(value).toBe(state.balance - gasWei);                        // 1828719000000000 wei
    expect(ethers.parseEther("0.00182872") - value).toBe(1_000_000_000n); // clamped by exactly 1 gwei
    expect(r.amountSent).toBe(ethers.formatEther(value));
    expect(r.gasLimit).toBe(21000);
    expect(Number(r.gasPriceGwei)).toBeCloseTo(CAP_GWEI, 9);
  });

  it("amount that already fits is signed untouched", async () => {
    const r = await directEvmSweep({ fromAddress: POOL, toAddress: MERCHANT, privateKey: KEY, walletType: "ETH", amount: 0.001, gasPriceGwei: CAP_GWEI });
    expect(BigInt(state.sent[0].value as bigint)).toBe(ethers.parseEther("0.001"));
    expect(r.amountSent).toBe("0.001");
  });

  it("a shortfall larger than a rounding step (> 0.000001 ETH) is a real bug → throws, nothing broadcast", async () => {
    await expect(
      directEvmSweep({ fromAddress: POOL, toAddress: MERCHANT, privateKey: KEY, walletType: "ETH", amount: 0.0019, gasPriceGwei: CAP_GWEI })
    ).rejects.toThrow(/insufficient funds/i);
    expect(state.sent).toHaveLength(0);
  });

  it("balance that cannot even cover gas → throws, nothing broadcast", async () => {
    const prev = state.balance;
    state.balance = 10_000_000_000_000n; // 0.00001 ETH < 0.000025641 gas
    try {
      await expect(
        directEvmSweep({ fromAddress: POOL, toAddress: MERCHANT, privateKey: KEY, walletType: "ETH", amount: 0.000009, gasPriceGwei: CAP_GWEI })
      ).rejects.toThrow(/insufficient funds/i);
    } finally {
      state.balance = prev;
    }
    expect(state.sent).toHaveLength(0);
  });
});
