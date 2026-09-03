import { D, add, sub, mul, div, sum, pct, roundTo, toNumber, toFixedStr, toAmountStr, toBaseUnits, fromBaseUnits, splitFee, convert, eq, fiat, crypto } from "../utils/money";

describe("utils/money", () => {
  it("coerces inputs safely", () => {
    expect(D("1,234.50").toString()).toBe("1234.5");
    expect(D(null).toString()).toBe("0");
    expect(D(undefined).toString()).toBe("0");
    expect(D("").toString()).toBe("0");
    expect(D("abc").toString()).toBe("0");
    expect(D(NaN).toString()).toBe("0");
    expect(D(Infinity).toString()).toBe("0");
    expect(D("1e-8").toString()).toBe("0.00000001");
  });

  it("is exact where floats drift", () => {
    expect(add(0.1, 0.2).toString()).toBe("0.3");
    expect(sub(1.0, 0.9).toString()).toBe("0.1");
    expect(mul(0.07, 100).toString()).toBe("7");
    expect(sum([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]).toString()).toBe("1");
    expect(pct(1319.47, 1.5).toString()).toBe("19.79205");
    expect(toNumber(1.005, 2)).toBe(1.01); // float toFixed(2) gives "1.00"
  });

  it("rounds with explicit modes and never emits exponents", () => {
    expect(toFixedStr("0.000000005", 8)).toBe("0.00000001");
    expect(toFixedStr("0.000000005", 8, "down")).toBe("0.00000000");
    expect(toFixedStr(1e-7, 8)).toBe("0.00000010");
    expect(toAmountStr("0.10000000")).toBe("0.1");
    expect(toAmountStr(0.123456789)).toBe("0.12345678"); // down
    expect(roundTo("2.675", 2).toString()).toBe("2.68");
    expect(fiat("19.999")).toBe(20);
    expect(crypto("0.123456789")).toBe(0.12345679);
  });

  it("division by zero yields 0", () => {
    expect(div(10, 0).toString()).toBe("0");
    expect(div(10, "").toString()).toBe("0");
  });

  it("base units are exact bigint", () => {
    expect(toBaseUnits("0.1")).toBe(10000000n);
    expect(toBaseUnits(0.00000001)).toBe(1n);
    expect(toBaseUnits("1.23456789", 8)).toBe(123456789n);
    expect(toBaseUnits("12.5", 6)).toBe(12500000n);
    expect(fromBaseUnits(123456789n).toString()).toBe("1.23456789");
    // classic float failure: 0.29 * 100 = 28.999999999999996
    expect(toBaseUnits("0.29", 2)).toBe(29n);
  });

  it("splitFee: net rounded down, fee absorbs remainder, parts sum to gross", () => {
    const s = splitFee("0.12345678", 1.5, 0, 8);
    expect(s.net.plus(s.fee).toString()).toBe("0.12345678");
    expect(s.net.toString()).toBe("0.12160492"); // 0.12345678 - 0.0018518517 = 0.1216049283 -> down
    expect(s.fee.gte(s.nominalFee)).toBe(true);
    expect(s.fee.minus(s.nominalFee).abs().lt("0.00000001")).toBe(true);

    const f = splitFee(100, 1, 0.5, 2);
    expect(f.net.toString()).toBe("98.5");
    expect(f.fee.toString()).toBe("1.5");

    const tiny = splitFee(0.5, 0, 1, 2); // fixed fee larger than amount
    expect(tiny.net.toString()).toBe("0");
    expect(tiny.fee.toString()).toBe("0.5");
  });

  it("convert applies a rate and rounds", () => {
    expect(convert(100, "0.0000125", 8, "down").toString()).toBe("0.00125");
    expect(convert("19.99", 1.0842, 2).toString()).toBe("21.67");
    expect(eq(convert(0.1, 3, 8), 0.3)).toBe(true);
  });
});
