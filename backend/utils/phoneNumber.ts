import { parsePhoneNumberFromString, getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

export type NormalizedPhone = { digits: string; e164: string; country: CountryCode | null };

/**
 * Canonicalise a user-typed mobile number to E.164 digits (no "+"), the format
 * tbl_user.mobile stores. Tolerates "+", spaces, dashes, parentheses AND a
 * national trunk "0" typed after the country code (e.g. BD users entering
 * +880 01712… → 8801712…). Returns null when the number is not a valid mobile
 * (or fixed-line-or-mobile) number anywhere in the world.
 */
export const normalizeMobile = (raw: unknown): NormalizedPhone | null => {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;

  const accept = (pn: ReturnType<typeof parsePhoneNumberFromString>): NormalizedPhone | null => {
    if (!pn || !pn.isValid()) return null;
    const type = pn.getType();
    if (type && type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") return null;
    return { digits: pn.number.replace(/^\+/, ""), e164: pn.number, country: (pn.country as CountryCode) || null };
  };

  const direct = accept(parsePhoneNumberFromString(`+${digits}`));
  if (direct) return direct;

  // Trunk-zero repair: find the calling code prefix, re-parse the national part per region.
  for (const len of [1, 2, 3]) {
    const cc = digits.slice(0, len);
    const regions = getCountries().filter((c) => getCountryCallingCode(c) === cc);
    for (const region of regions) {
      const repaired = accept(parsePhoneNumberFromString(digits.slice(len), region));
      if (repaired) return repaired;
    }
  }
  return null;
};

export const INVALID_MOBILE_MESSAGE =
  "That doesn't look like a valid mobile number. Enter it with the country code, without the leading 0 (e.g. +880 1712 345678).";
