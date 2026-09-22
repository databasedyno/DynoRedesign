/**
 * Native EVM full-balance sweep must reserve gasLimit × maxFeePerGas (what the node checks),
 * not the market estimate — regression for the prod "insufficient funds for intrinsic
 * transaction cost" loop on dust ETH pool addresses (2026-09-22).
 */
import { ethers } from "ethers";

jest.mock("../utils/loggers", () => ({
  cronLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../utils/tatumAuth", () => ({ TATUM_V3_URL: "https://api.tatum.io/v3", getTatumApiKey: () => "" }));

const state = {
  balance: 225432750558000n, // 0.00022543 ETH (real prod dust address)
  baseFee: ethers.parseUnits("0.2", "gwei"),
  priority: ethers.parseUnits("0.05", "gwei"),
};

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  class FakeProvider {
    async getBalance() {
      return state.balance;
    }
    async getBlock() {
      return { baseFeePerGas: state.baseFee };
    }
    async getFeeData() {
      return { maxPriorityFeePerGas: state.priority, maxFeePerGas: null, gasPrice: null };
    }
    async getTransactionCount() {
      return 5;
    }
  }
  return { ...actual, ethers: { ...actual.ethers, JsonRpcProvider: FakeProvider, Network: actual.ethers.Network } };
});

import { quoteNativeSweep, isDirectEvmNative } from "../services/merchantPool/directEvmTransfer";

describe("quoteNativeSweep", () => {
  it("reserves gasLimit × (2×baseFee + priority) so value + gas never exceeds the balance", async () => {
    const q = await quoteNativeSweep({ fromAddress: "0x77f0342dde2f9cd1762a431eb202a3d642853822", walletType: "ETH" });
    expect(q).not.toBeNull();
    // maxFee = 2 × 0.2 + 0.05 = 0.45 gwei ; gas = 21000 × 0.45 gwei = 0.00000945 ETH
    expect(q!.maxFeeGwei).toBeCloseTo(0.45, 9);
    expect(q!.gasCost).toBeCloseTo(0.00000945, 10);
    const gasWei = 21000n * ethers.parseUnits("0.45", "gwei");
    const valueWei = ethers.parseEther(q!.maxSendable.toFixed(8));
    expect(valueWei + gasWei <= state.balance).toBe(true);
    // and it is not needlessly conservative: within 1e-8 ETH (8 dp floor) of the exact max
    expect(state.balance - (valueWei + gasWei) < 10_000_000_000n).toBe(true);
  });

  it("reports dust (maxSendable 0) when the balance cannot cover gas at maxFee", async () => {
    const prev = state.balance;
    state.balance = 5_000_000_000_000n; // 0.000005 ETH < 0.00000945 gas
    const q = await quoteNativeSweep({ fromAddress: "0xdc5507e71f00ccbcb1d3fbc4b9a13f409d14de5d", walletType: "ETH" });
    state.balance = prev;
    expect(q!.maxSendable).toBe(0);
    expect(q!.balance).toBeCloseTo(0.000005, 10);
  });

  it("only applies to native coins (tokens pay gas from a separately funded balance)", async () => {
    expect(isDirectEvmNative("ETH")).toBe(true);
    expect(isDirectEvmNative("POLYGON")).toBe(true);
    expect(isDirectEvmNative("USDT-ERC20")).toBe(false);
    expect(await quoteNativeSweep({ fromAddress: "0x0", walletType: "USDT-ERC20" })).toBeNull();
  });
});
