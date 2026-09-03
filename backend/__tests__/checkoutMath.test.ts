import { computeCheckoutSplit, computeFallbackSplit, computeInclusiveSplit } from "../controller/payment/checkoutMath";
import { D } from "../utils/money";

const ties = (s: { cryptoAmount: number; merchantAmount: number; feesAmount: number }) =>
  D(s.merchantAmount).plus(s.feesAmount).eq(D(s.cryptoAmount));

describe("checkoutMath.computeInclusiveSplit (hosted checkout addPayment)", () => {
  it("company pays: fee = base share × fee/base, merchant is the exact complement (live $5 BTC case)", () => {
    const s = computeInclusiveSplit({ cryptoAmount: 0.00006155, baseAmount: 5, taxAmount: 0, feeFiat: 1.05, feePayer: "company" });
    expect(ties(s)).toBe(true);
    expect(s.feesAmount).toBe(0.00001293); // 0.000012925500000000002 rounded up, no float residue
    expect(s.merchantAmount).toBe(0.00004862);
    expect(s.taxAmount).toBe(0);
  });

  it("customer pays: merchant receives the base+tax share, fee absorbs the residue", () => {
    const s = computeInclusiveSplit({ cryptoAmount: "0.00007449", baseAmount: 5, taxAmount: 0, feeFiat: 1.05, feePayer: "customer" });
    expect(ties(s)).toBe(true);
    // 0.00007449 × 5/6.05 = 0.0000615619… → merchant rounded down
    expect(s.merchantAmount).toBe(0.00006156);
    expect(s.feesAmount).toBe(0.00001293);
  });

  it("customer pays with network buffer: buffer rides with the merchant, Dynopay gets exactly the tier share (live $6.90 quote)", () => {
    // quote: $5 base + $1.05 tier + $0.85 network = $6.90 → 0.00008469 BTC
    const s = computeInclusiveSplit({ cryptoAmount: "0.00008469", baseAmount: 5, taxAmount: 0, feeFiat: 1.05, networkFeeFiat: 0.85, feePayer: "customer" });
    expect(ties(s)).toBe(true);
    // merchant share = 5.85/6.90 → 0.0000718 (rounded down); fee = 1.05/6.90 ≈ 0.00001289
    expect(s.merchantAmount).toBe(0.0000718);
    expect(s.feesAmount).toBe(0.00001289);
    // Dynopay fee in fiat ≈ $1.05 (not the old $1.20 skew)
    expect(D(s.feesAmount).div(s.cryptoAmount).times(6.9).toDecimalPlaces(2).toNumber()).toBe(1.05);
  });

  it("network buffer is ignored for company-pays", () => {
    const a = computeInclusiveSplit({ cryptoAmount: 0.00006155, baseAmount: 5, taxAmount: 0, feeFiat: 1.05, feePayer: "company" });
    const b = computeInclusiveSplit({ cryptoAmount: 0.00006155, baseAmount: 5, taxAmount: 0, feeFiat: 1.05, networkFeeFiat: 0.85, feePayer: "company" });
    expect(b).toEqual(a);
  });

  it("company pays with tax: tax passes through untouched, fee only on the base share", () => {
    const s = computeInclusiveSplit({ cryptoAmount: "0.12000000", baseAmount: 100, taxAmount: 20, feeFiat: 2.65, feePayer: "company" });
    expect(ties(s)).toBe(true);
    expect(s.taxAmount).toBe(0.02); // 0.12 × 20/120
    // fee = 0.10 × 0.0265 = 0.00265 → merchant = 0.12 − 0.00265
    expect(s.feesAmount).toBe(0.00265);
    expect(s.merchantAmount).toBe(0.11735);
  });

  it("zero fee (fee-free promo) gives the merchant everything", () => {
    const s = computeInclusiveSplit({ cryptoAmount: "0.5", baseAmount: 50, taxAmount: 0, feeFiat: 0, feePayer: "company" });
    expect(s.feesAmount).toBe(0);
    expect(s.merchantAmount).toBe(0.5);
  });

  it("property: merchant + fee === crypto for random inputs, both payers", () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 500; i++) {
      const crypto = Math.round(rnd() * 1e8) / 1e8;
      const base = Math.round(rnd() * 10000) / 100 + 0.01;
      const tax = rnd() < 0.5 ? 0 : Math.round(rnd() * 2000) / 100;
      const fee = Math.round(rnd() * base * 5) / 100;
      for (const feePayer of ["customer", "company"] as const) {
        const s = computeInclusiveSplit({ cryptoAmount: crypto, baseAmount: base, taxAmount: tax, feeFiat: fee, feePayer });
        expect(ties(s)).toBe(true);
        expect(s.merchantAmount).toBeGreaterThanOrEqual(0);
        expect(s.feesAmount).toBeGreaterThanOrEqual(0);
        expect(String(s.merchantAmount).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(8);
        expect(String(s.feesAmount).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(8);
      }
    }
  });
});

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
