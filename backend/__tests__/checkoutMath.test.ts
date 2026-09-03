import { computeCheckoutSplit, computeFallbackSplit } from "../controller/payment/checkoutMath";
import { D } from "../utils/money";

const ties = (s: { cryptoAmount: number; merchantAmount: number; feesAmount: number }) =>
  D(s.merchantAmount).plus(s.feesAmount).eq(D(s.cryptoAmount));

describe("checkoutMath.computeCheckoutSplit", () => {
  it("customer pays fees: merchant gets full base + tax, customer pays base + fee + tax", () => {
    const s = computeCheckoutSplit({ totalCrypto: "0.01234567", baseAmount: 100, taxAmount: 20, feeFraction: "0.0165", feePayer: "customer" });
    expect(ties(s)).toBe(true);
    expect(D(s.baseAmount).plus(s.taxAmount).eq("0.01234567")).toBe(true); // base + tax == total
    expect(s.merchantAmount).toBe(0.01234567);
    expect(s.taxAmount).toBe(0.00205761);
    expect(s.baseAmount).toBe(0.01028806);
    expect(s.feesAmount).toBe(0.00016975); // 0.01028806 × 0.0165 → 8 dp
    expect(s.cryptoAmount).toBe(0.01251542);
  });

  it("company pays fees: customer pays base + tax, merchant rounded down, fee absorbs remainder", () => {
    const s = computeCheckoutSplit({ totalCrypto: "0.01234567", baseAmount: 100, taxAmount: 20, feeFraction: "0.0165", feePayer: "company" });
    expect(ties(s)).toBe(true);
    expect(s.cryptoAmount).toBe(0.01234567);
    expect(s.merchantAmount).toBe(0.01217591);
    expect(s.feesAmount).toBe(0.00016976);
    expect(D(s.merchantAmount).plus(s.feesAmount).lte(D(s.cryptoAmount))).toBe(true);
  });

  it("no tax: base share is the whole total", () => {
    const s = computeCheckoutSplit({ totalCrypto: 1, baseAmount: 50, taxAmount: 0, feeFraction: 0.015, feePayer: "company" });
    expect(s.taxAmount).toBe(0);
    expect(s.baseAmount).toBe(1);
    expect(s.merchantAmount).toBe(0.985);
    expect(s.feesAmount).toBe(0.015);
    expect(ties(s)).toBe(true);
  });

  it("never drifts across many random amounts", () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let k = 0; k < 500; k++) {
      const total = (rnd() * 5).toFixed(8);
      const base = Math.round(rnd() * 10000) / 100;
      const tax = rnd() < 0.5 ? 0 : Math.round(rnd() * 2000) / 100;
      for (const feePayer of ["customer", "company"] as const) {
        const s = computeCheckoutSplit({ totalCrypto: total, baseAmount: base, taxAmount: tax, feeFraction: 0.0165, feePayer });
        expect(ties(s)).toBe(true);
        expect(D(s.baseAmount).plus(s.taxAmount).eq(D(total))).toBe(true);
        expect(s.merchantAmount).toBeGreaterThanOrEqual(0);
        expect(s.feesAmount).toBeGreaterThanOrEqual(0);
        expect(String(s.cryptoAmount).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(8);
      }
    }
  });

  it("fallback flat percent ties exactly", () => {
    const f = computeFallbackSplit("0.00033163", "2.0");
    expect(D(f.merchantAmount).plus(f.feesAmount).eq("0.00033163")).toBe(true);
    expect(f.merchantAmount).toBe(0.00032499);
    expect(f.feesAmount).toBe(0.00000664);
  });
});
