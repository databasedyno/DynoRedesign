/**
 * geoDefaults — helpers for pre-filling country + currency on the
 * Create-Company form (and any other form that needs a sensible default).
 *
 * Flow:
 *   1. call fetchGeoDefaults() — hits /api/geo-detect (which already exists
 *      and is called on landing / for legal reasons).
 *   2. it returns { country, currency } where country is a 2-letter ISO
 *      code (e.g. 'NG') and currency is a 3-letter code (e.g. 'NGN').
 *   3. The caller uses country-state-city to hydrate the country object,
 *      and can drop the currency straight into a currency-code field.
 *
 * The country → currency mapping below covers the ~65 highest-volume
 * countries. For anything else, we fall back to USD (safe default).
 */

import axiosBaseApi from "@/axiosConfig";

export interface GeoDefaults {
  /** ISO 3166-1 alpha-2 country code, e.g. "NG", "US", "IN". Empty if lookup failed. */
  country: string;
  /** ISO 4217 currency code, e.g. "NGN", "USD", "INR". Falls back to "USD". */
  currency: string;
}

/** Country → default currency mapping. Add rows as needed. */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD", CA: "CAD", MX: "MXN", BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
  GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", IT: "EUR", ES: "EUR", PT: "EUR", NL: "EUR",
  BE: "EUR", LU: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", CY: "EUR", MT: "EUR", SK: "EUR",
  SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", HR: "EUR",
  SE: "SEK", NO: "NOK", DK: "DKK", IS: "ISK", CH: "CHF", PL: "PLN", CZ: "CZK", HU: "HUF",
  RO: "RON", BG: "BGN", RS: "RSD", UA: "UAH", RU: "RUB", TR: "TRY",
  IN: "INR", PK: "PKR", BD: "BDT", LK: "LKR", NP: "NPR",
  CN: "CNY", HK: "HKD", TW: "TWD", JP: "JPY", KR: "KRW", MO: "MOP", MN: "MNT",
  SG: "SGD", MY: "MYR", TH: "THB", VN: "VND", ID: "IDR", PH: "PHP", KH: "KHR", LA: "LAK",
  AU: "AUD", NZ: "NZD",
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", JO: "JOD", LB: "LBP",
  IL: "ILS", EG: "EGP",
  ZA: "ZAR", NG: "NGN", KE: "KES", GH: "GHS", UG: "UGX", TZ: "TZS", RW: "RWF", ZM: "ZMW",
  ZW: "ZWL", MA: "MAD", TN: "TND", DZ: "DZD", SN: "XOF", CI: "XOF", ML: "XOF", BF: "XOF",
  CM: "XAF", GA: "XAF", CG: "XAF", TD: "XAF",
};

/**
 * Look up a currency code for a given country. Returns "USD" if unknown.
 */
export function currencyForCountry(countryCode: string | undefined | null): string {
  const key = (countryCode || "").toUpperCase();
  return COUNTRY_TO_CURRENCY[key] || "USD";
}

/**
 * Fetch geo defaults from the backend. Never throws — falls back to
 * `{ country: "", currency: "USD" }` on any error, so the caller can
 * safely `await fetchGeoDefaults()` without a try/catch.
 */
export async function fetchGeoDefaults(): Promise<GeoDefaults> {
  try {
    // /api/geo-detect returns something like:
    //   { success: true, data: { country_code: "NG", country_name: "Nigeria", ... } }
    const response = await axiosBaseApi.get("/geo-detect");
    const data = response?.data?.data || response?.data || {};
    const country =
      String(
        data.country_code ??
          data.countryCode ??
          data.country ??
          "",
      ).toUpperCase() || "";
    return {
      country,
      currency: currencyForCountry(country),
    };
  } catch {
    return { country: "", currency: "USD" };
  }
}
