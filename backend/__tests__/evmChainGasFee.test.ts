/**
 * calculateEvmGasFee — regression tests for the 2026-09 fee audit + fractional-gwei broadcast.
 *
 * Background: Ethereum mainnet often trades below 1 gwei since Dencun. Payouts are now signed
 * locally with ethers.js (EIP-1559, decimal gwei), so the quote must track the market instead
 * of rounding up to integer gwei, and native transfers are charged for the 21000 gas actually
 * burned rather than the SDK's padded 100000 limit.
 */
import { calculateEvmGasFee, EVM_MIN_GWEI } from "../services/chains/evmChain";

describe("calculateEvmGasFee", () => {
  const eth = { minGas: EVM_MIN_GWEI, maxGas: 50 };

  it("exports a fractional floor (0.05 gwei) — no 1 gwei integer floor", () => {
    expect(EVM_MIN_GWEI).toBe(0.05);
  });

  it("low-gas regime: quotes decimal gwei at market (×1.15 + 0.05 tip), not 1 gwei", () => {
    const r = calculateEvmGasFee(0.12, 100000, false, eth);
    expect(r.gasPrice).toBeCloseTo(0.12 * 1.15 + 0.05, 4); // 0.188
    expect(r.gasPrice).toBeLessThan(0.2);
  });

  it("native transfer: deducts and broadcasts exactly 21000 gas, ignoring the padded SDK default", () => {
    const r = calculateEvmGasFee(0.12, 100000, false, eth);
    expect(r.gasLimit).toBe(21000);
    // 0.188 gwei × 21000 = 0.000003948 ETH (was 0.000021 at the 1 gwei floor)
    expect(Number(r.fast)).toBeCloseTo((0.188 * 21000) / 1e9, 8); // fee strings carry 8 decimals
    expect(Number(r.medium)).toBeLessThanOrEqual(Number(r.fast));
    expect(Number(r.slow)).toBeLessThanOrEqual(Number(r.medium));
  });

  it("native transfer: keeps a genuine contract-recipient estimate between 21000 and 100000", () => {
    const r = calculateEvmGasFee(0.12, 35000, false, eth);
    expect(r.gasLimit).toBe(35000);
    expect(Number(r.fast)).toBeCloseTo((0.188 * 35000) / 1e9, 8);
  });

  it("floors at EVM_MIN_GWEI when the oracle reports (near) zero", () => {
    const r = calculateEvmGasFee(0, 21000, false, eth);
    expect(r.gasPrice).toBeCloseTo(0.05 * 1.15 + 0.05, 4);
    expect(Number(r.slow)).toBeGreaterThanOrEqual((0.05 * 21000) / 1e9);
  });

  it("busy regime (≥ 1 gwei): applies the ×1.15 buffer + tip without integer rounding", () => {
    const r = calculateEvmGasFee(12, 21000, false, eth);
    expect(r.gasPrice).toBeCloseTo(12 * 1.15 + 0.05, 4); // 13.85 (was ceil → 15)
    expect(Number(r.fast)).toBeCloseTo((13.85 * 21000) / 1e9, 8);
  });

  it("caps at maxGas", () => {
    const r = calculateEvmGasFee(500, 21000, false, eth);
    expect(r.gasPrice).toBeCloseTo(50 * 1.15 + 0.05, 4);
  });

  it("token transfer: uses the SDK gas limit as-is and prices at decimal gwei", () => {
    const r = calculateEvmGasFee(0.12, 48000, true, eth);
    expect(r.gasLimit).toBe(48000);
    expect(r.gasPrice).toBeCloseTo(0.188, 4);
    expect(Number(r.fast)).toBeCloseTo((0.188 * 48000) / 1e9, 8);
    expect(r.medium).toBeUndefined();
  });

  it("polygon: honours its own 25 gwei floor and buffers a genuine market price", () => {
    const r = calculateEvmGasFee(315, 21000, false, { minGas: 25, maxGas: 1000 });
    expect(r.gasPrice).toBeCloseTo(315 * 1.15 + 0.05, 4);
    expect(r.gasLimit).toBe(21000);
    const floored = calculateEvmGasFee(3, 21000, false, { minGas: 25, maxGas: 1000 });
    expect(floored.gasPrice).toBeCloseTo(25 * 1.15 + 0.05, 4);
  });
});
