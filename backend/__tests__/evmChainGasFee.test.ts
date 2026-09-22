/**
 * calculateEvmGasFee — regression tests for the 2026-09 fee audit.
 *
 * Background: Ethereum mainnet often trades below 1 gwei since Dencun. The settlement path
 * broadcasts INTEGER gwei, so the old math (ceil(raw) → ×1.15 + 0.5 → ceil) turned a
 * 0.12 gwei market into a 2 gwei broadcast, and native transfers were charged for the
 * SDK's padded 100000 gas limit although only 21000 is ever burned.
 */
import { calculateEvmGasFee } from "../services/chains/evmChain";

describe("calculateEvmGasFee", () => {
  const eth = { minGas: 1, maxGas: 50 };

  it("low-gas regime: floors at 1 gwei WITHOUT stacking the buffer/tip on top", () => {
    const r = calculateEvmGasFee(0.12, 100000, false, eth);
    expect(r.gasPrice).toBe(1);
  });

  it("native transfer: deducts and broadcasts exactly 21000 gas, ignoring the padded SDK default", () => {
    const r = calculateEvmGasFee(0.12, 100000, false, eth);
    expect(r.gasLimit).toBe(21000);
    // 1 gwei × 21000 = 0.000021 ETH (was 0.0002 ETH with the padded limit at 2 gwei)
    expect(Number(r.fast)).toBeCloseTo(0.000021, 8);
    expect(Number(r.medium)).toBeCloseTo(0.000021, 8);
    expect(Number(r.slow)).toBeCloseTo(0.000021, 8);
  });

  it("native transfer: keeps a genuine contract-recipient estimate between 21000 and 100000", () => {
    const r = calculateEvmGasFee(0.12, 35000, false, eth);
    expect(r.gasLimit).toBe(35000);
    expect(Number(r.fast)).toBeCloseTo(0.000035, 8);
  });

  it("busy regime (≥ 1 gwei): still applies the ×1.15 + 0.5 safety buffer", () => {
    const r = calculateEvmGasFee(12, 21000, false, eth);
    expect(r.gasPrice).toBe(15); // ceil(12 × 1.15 + 0.5)
    expect(Number(r.fast)).toBeCloseTo(0.000315, 8);
  });

  it("caps at maxGas", () => {
    const r = calculateEvmGasFee(500, 21000, false, eth);
    expect(r.gasPrice).toBe(Math.ceil(50 * 1.15 + 0.5));
  });

  it("token transfer: uses the SDK gas limit as-is and prices at the floored gwei", () => {
    const r = calculateEvmGasFee(0.12, 48000, true, eth);
    expect(r.gasLimit).toBe(48000);
    expect(r.gasPrice).toBe(1);
    expect(Number(r.fast)).toBeCloseTo(0.000048, 8);
    expect(r.medium).toBeUndefined();
  });

  it("polygon: honours its own 25 gwei floor and buffers a genuine market price", () => {
    const r = calculateEvmGasFee(315, 21000, false, { minGas: 25, maxGas: 1000 });
    expect(r.gasPrice).toBe(Math.ceil(315 * 1.15 + 0.5));
    expect(r.gasLimit).toBe(21000);
  });
});
