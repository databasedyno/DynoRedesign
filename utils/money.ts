/**
 * Exact decimal rounding for the browser — no float math, no dependency.
 *
 * Amounts arrive from the API as numbers or strings. `Number.prototype.toFixed`
 * rounds the binary double (1.005.toFixed(2) === "1.00"), which is how display
 * totals end up a cent/satoshi off the backend's exact figures. These helpers
 * work on the decimal *string* form with BigInt, so "1.005" → "1.01" and
 * 0.1 + 0.2 style artifacts never reach the screen.
 */

export type RoundMode = "half-up" | "down" | "up";
export type MoneyLike = number | string | null | undefined;

/** Plain decimal string ("-123.456") for any input; garbage → "0". */
export const toPlainDecimal = (v: MoneyLike): string => {
  if (v === null || v === undefined || v === "") return "0";
  let s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "0") : String(v).trim().replace(/,/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return "0";
  const neg = s.startsWith("-");
  s = s.replace(/^[-+]/, "");
  // expand exponent notation exactly (e.g. "1e-7", "2.5e+3")
  const em = s.match(/^(\d*)\.?(\d*)e([-+]?\d+)$/i);
  if (em) {
    const digits = (em[1] + em[2]).replace(/^0+(?=\d)/, "");
    const pointPos = em[1].length + parseInt(em[3], 10);
    if (pointPos <= 0) s = "0." + "0".repeat(-pointPos) + digits;
    else if (pointPos >= digits.length) s = digits + "0".repeat(pointPos - digits.length);
    else s = digits.slice(0, pointPos) + "." + digits.slice(pointPos);
  }
  if (s.startsWith(".")) s = "0" + s;
  s = s.replace(/\.$/, "");
  if (/^0*\.?0*$/.test(s)) return "0";
  return (neg ? "-" : "") + s.replace(/^0+(?=\d)/, "");
};

/** Round to `dp` decimals as a fixed-point string (exactly `dp` fraction digits). */
export const toFixedStr = (v: MoneyLike, dp: number = 2, mode: RoundMode = "half-up"): string => {
  const plain = toPlainDecimal(v);
  const neg = plain.startsWith("-");
  const [intPart, fracPart = ""] = plain.replace("-", "").split(".");
  const scaled = BigInt(intPart + fracPart.slice(0, dp).padEnd(dp, "0"));
  const rest = fracPart.slice(dp);
  let result = scaled;
  if (rest && /[1-9]/.test(rest)) {
    if (mode === "up") result += BigInt(1);
    else if (mode === "half-up" && rest[0] >= "5") result += BigInt(1);
  }
  let digits = result.toString().padStart(dp + 1, "0");
  const out = dp > 0 ? `${digits.slice(0, -dp)}.${digits.slice(-dp)}` : digits;
  return neg && result !== BigInt(0) ? `-${out}` : out;
};

/** Rounded JS number (safe for values that fit a double once rounded). */
export const toNumber = (v: MoneyLike, dp: number = 2, mode: RoundMode = "half-up"): number =>
  Number(toFixedStr(v, dp, mode));

/** "0.00100000" → "0.001", "25.000" → "25" */
export const trimZeros = (fixed: string): string => fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

/**
 * Exact locale formatting: round on the decimal string first, then hand the
 * already-rounded value to Intl (which therefore never has to round a double).
 * Modern engines accept the string form directly; older ones get the number.
 */
export const formatExact = (v: MoneyLike, dp: number, options: Intl.NumberFormatOptions = {}, locale: string = "en-US"): string => {
  const fixed = toFixedStr(v, dp);
  const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: dp, maximumFractionDigits: dp, ...options });
  try {
    return nf.format(fixed as unknown as number);
  } catch {
    return nf.format(Number(fixed));
  }
};
