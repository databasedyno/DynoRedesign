/**
 * Unit Tests: Ledger Decimal Math (Tier-1 Item #3)
 *
 * The decimal helpers underpin every balance/invariant check. Float loss would
 * silently break "DR sum === CR sum" and let unbalanced batches through.
 * These tests exercise edge cases jsFloats would fail on.
 */

// Mock DB modules so ledgerService.ts can be imported without a real Sequelize
jest.mock("../models/ledger/ledgerEntryModel", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findAll: jest.fn(), bulkCreate: jest.fn() },
}));
jest.mock("../models/ledger/ledgerAccountModel", () => ({
  __esModule: true,
  default: { findAll: jest.fn().mockResolvedValue([]) },
}));

import { _internals } from "../services/ledger/ledgerService";

describe("Ledger decimal math", () => {
  describe("toDec", () => {
    it("formats numbers to 12-decimal string", () => {
      expect(_internals.toDec(1.5)).toBe("1.500000000000");
      expect(_internals.toDec(0)).toBe("0.000000000000");
    });

    it("passes through valid decimal strings unchanged", () => {
      expect(_internals.toDec("1.23")).toBe("1.23");
      expect(_internals.toDec("100")).toBe("100");
      expect(_internals.toDec("-0.5")).toBe("-0.5");
    });

    it("rejects non-decimal input", () => {
      expect(() => _internals.toDec("abc")).toThrow(/decimal/);
      expect(() => _internals.toDec("1e-5")).toThrow(/decimal/);
    });

    it("rejects Infinity / NaN", () => {
      expect(() => _internals.toDec(Number.POSITIVE_INFINITY)).toThrow(/finite/);
      expect(() => _internals.toDec(Number.NaN)).toThrow(/finite/);
    });
  });

  describe("addDec", () => {
    it("adds two positive decimals with different scales", () => {
      expect(_internals.addDec("1.5", "2.25")).toBe("3.75");
      expect(_internals.addDec("1", "0.001")).toBe("1.001");
    });

    it("subtracts via negative signs", () => {
      expect(_internals.addDec("10", "-3")).toBe("7");
      expect(_internals.addDec("1.5", "-1.5")).toBe("0.0");
    });

    it("handles very large amounts (no float rounding)", () => {
      // 0.1 + 0.2 === 0.30000000000000004 in float, MUST be exact here
      expect(_internals.addDec("0.1", "0.2")).toBe("0.3");
      expect(_internals.addDec("0.0000000001", "0.0000000002")).toBe("0.0000000003");
    });

    it("handles crypto-scale amounts (12 decimals, 20-digit ints)", () => {
      expect(_internals.addDec("12345678901234567890.123456789012", "0.000000000001"))
        .toBe("12345678901234567890.123456789013");
    });

    it("returns integer result when both inputs are integer strings", () => {
      expect(_internals.addDec("100", "200")).toBe("300");
    });
  });

  describe("isZero", () => {
    it("recognizes zero variants", () => {
      expect(_internals.isZero("0")).toBe(true);
      expect(_internals.isZero("0.0")).toBe(true);
      expect(_internals.isZero("0.0000000")).toBe(true);
      expect(_internals.isZero("-0.0")).toBe(true);
    });

    it("rejects non-zero", () => {
      expect(_internals.isZero("0.0000001")).toBe(false);
      expect(_internals.isZero("-0.001")).toBe(false);
      expect(_internals.isZero("100")).toBe(false);
    });
  });
});

describe("Ledger balance property", () => {
  // Simulates the balance-check that postDoubleEntry runs BEFORE INSERT
  function balanceCheck(lines: Array<{ direction: "DR" | "CR"; amount: string; currency: string }>): Record<string, string> {
    const byCur: Record<string, string> = {};
    for (const l of lines) {
      const signed = l.direction === "DR" ? l.amount : "-" + l.amount;
      byCur[l.currency] = _internals.addDec(byCur[l.currency] ?? "0", signed);
    }
    return byCur;
  }

  it("balances a simple 2-line batch (DR = CR)", () => {
    const b = balanceCheck([
      { direction: "DR", amount: "10", currency: "USDT" },
      { direction: "CR", amount: "10", currency: "USDT" },
    ]);
    expect(_internals.isZero(b.USDT)).toBe(true);
  });

  it("balances a 4-line settlement (merchant + fee legs)", () => {
    const b = balanceCheck([
      { direction: "DR", amount: "98.5", currency: "USDT" },  // merchant payable
      { direction: "CR", amount: "98.5", currency: "USDT" },  // buyer escrow reduced
      { direction: "DR", amount: "1.5",  currency: "USDT" },  // fee revenue reduced (as liability release)
      { direction: "CR", amount: "1.5",  currency: "USDT" },  // buyer escrow reduced
    ]);
    expect(_internals.isZero(b.USDT)).toBe(true);
  });

  it("detects a 1-satoshi drift as unbalanced", () => {
    const b = balanceCheck([
      { direction: "DR", amount: "1.00000001", currency: "BTC" },
      { direction: "CR", amount: "1.00000000", currency: "BTC" },
    ]);
    expect(_internals.isZero(b.BTC)).toBe(false);
    expect(b.BTC).toBe("0.00000001");
  });

  it("balances multi-currency independently (conversion event)", () => {
    // BTC leg
    const b = balanceCheck([
      { direction: "DR", amount: "0.01", currency: "BTC" },
      { direction: "CR", amount: "0.01", currency: "BTC" },
      { direction: "DR", amount: "500", currency: "USDT" },
      { direction: "CR", amount: "500", currency: "USDT" },
    ]);
    expect(_internals.isZero(b.BTC)).toBe(true);
    expect(_internals.isZero(b.USDT)).toBe(true);
  });

  it("flags drift in one currency while another balances", () => {
    const b = balanceCheck([
      { direction: "DR", amount: "0.01", currency: "BTC" },
      { direction: "CR", amount: "0.01", currency: "BTC" },
      { direction: "DR", amount: "500", currency: "USDT" },
      { direction: "CR", amount: "499", currency: "USDT" },
    ]);
    expect(_internals.isZero(b.BTC)).toBe(true);
    expect(_internals.isZero(b.USDT)).toBe(false);
    expect(b.USDT).toBe("1");
  });
});
