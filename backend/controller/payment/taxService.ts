/**
 * Checkout tax calculation.
 *
 * Extended in session 57 to support:
 *   - Merchant-country-based jurisdiction (fallback when we can't detect buyer's country)
 *   - Per-product tax_category ('digital' | 'physical' | 'service' | 'exempt')
 *   - EU B2B reverse-charge (buyer's cross-border VAT ID → 0% + reverse_charge flag)
 *   - Tax-inclusive pricing (price already includes VAT → back-out subtotal)
 *   - Physical goods → prefer shipping-address country over IP
 *
 * Dynopay is a PAYMENT PROCESSOR — we compute + collect, merchant remits.
 * Every value we return is persisted on the order/transaction row so the
 * merchant has an audit trail for their VAT return.
 */
import axios from "axios";
import { taxRateModel, vatValidationModel } from "../../models";
import { getErrorMessage } from "../../helper";
import { cronLogger } from "../../utils/loggers";
import {
  FALLBACK_TAX_RATES,
  TAX_TYPE_ACRONYMS as TAX_ACRONYMS,
  COUNTRY_NAMES,
  EU_COUNTRIES,
} from "../../utils/taxData";
import { TAX_DATA_API_URL, TAX_DATA_API_KEY } from "./paymentConfig";
import { add, div, pct, sub, toNumber } from "../../utils/money";
import { resolveReducedRate } from "../../utils/reducedRates";

// ── VAT ID validation regexes by country (structural only — cross-check with
//    VIES for real production; MVP does regex + prefix match).
// Reference: https://ec.europa.eu/taxation_customs/vies/#/vat-validation
const VAT_ID_REGEX: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/,
  BE: /^BE0?\d{9,10}$/,
  BG: /^BG\d{9,10}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DE: /^DE\d{9}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  ES: /^ES[0-9A-Z]\d{7}[0-9A-Z]$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[0-9A-Z]{2}\d{9}$/,
  GR: /^(GR|EL)\d{9}$/,
  HR: /^HR\d{11}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE\d{7}[A-Z]{1,2}$/,
  IT: /^IT\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SE: /^SE\d{12}$/,
  SI: /^SI\d{8}$/,
  SK: /^SK\d{10}$/,
  // Non-EU with own VAT systems (structural check only)
  GB: /^GB(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
};

/**
 * Structural validation of a VAT ID. Strips spaces/dots. Optionally requires
 * the ID's country prefix to differ from `merchantCountry` (cross-border
 * requirement for EU reverse-charge).
 *
 * Returns { valid, countryCode, normalized } — never throws.
 * NOTE: Structural only — for production-grade validation, wire this to
 * VIES (EU) via `POST https://ec.europa.eu/taxation_customs/vies/services/checkVatService`.
 */
export function validateVatId(
  rawId: string,
  merchantCountry?: string
): { valid: boolean; countryCode: string | null; normalized: string; crossBorder: boolean } {
  const normalized = String(rawId || "")
    .toUpperCase()
    .replace(/[\s.\-]/g, "");
  if (!normalized) return { valid: false, countryCode: null, normalized: "", crossBorder: false };
  const rawCC = normalized.slice(0, 2);
  // Greece uses "EL" as its VAT-number prefix but "GR" as its ISO/EU country
  // code — normalise so rate lookup + EU membership checks use "GR".
  const countryCode = rawCC === "EL" ? "GR" : rawCC;
  const regex = VAT_ID_REGEX[countryCode];
  const valid = regex ? regex.test(normalized) : false;
  const crossBorder = valid && !!merchantCountry && countryCode !== String(merchantCountry).toUpperCase();
  return { valid, countryCode: valid ? countryCode : null, normalized, crossBorder };
}

/**
 * Determine if a country pair triggers EU B2B reverse-charge:
 *   - Both merchant and customer are in the EU
 *   - Countries differ (cross-border)
 *   - Customer provided a valid VAT ID matching their country
 */
export function shouldReverseCharge(
  merchantCountry: string | null | undefined,
  customerCountry: string | null | undefined,
  customerVatIdValid: boolean
): boolean {
  if (!customerVatIdValid) return false;
  const mc = String(merchantCountry || "").toUpperCase();
  const cc = String(customerCountry || "").toUpperCase();
  if (!mc || !cc) return false;
  if (mc === cc) return false;
  return EU_COUNTRIES.includes(mc) && EU_COUNTRIES.includes(cc);
}

// ── Live VIES / VAT-number verification (backlog #1) ─────────────────
// Verifies the number is REAL against the EU's OFFICIAL VIES REST API
// (authoritative, free, no key). Results are cached in tbl_vat_validation so
// repeat checkouts are instant and a transient VIES outage still honours a
// recent positive result. Reverse-charge is granted ONLY on a positive result;
// anything unverifiable falls through to "charge VAT" (the compliant default).
const VIES_CACHE_TTL_DAYS = Number(process.env.VIES_CACHE_TTL_DAYS || 90);
const VIES_REST_BASE =
  process.env.VIES_REST_BASE || "https://ec.europa.eu/taxation_customs/vies/rest-api";

export interface VatVerifyResult {
  valid: boolean;
  countryCode: string | null;
  crossBorder: boolean;
  normalized: string;
  source:
    | "format_invalid"
    | "cache"
    | "cache_stale"
    | "vies"
    | "unverified_non_vies"
    | "unverified_error";
  companyName: string | null;
  checkedAt: string | null;
}

export async function verifyVatId(
  rawId: string,
  merchantCountry?: string
): Promise<VatVerifyResult> {
  const fmt = validateVatId(rawId, merchantCountry);
  if (!fmt.valid || !fmt.countryCode) {
    return { valid: false, countryCode: null, crossBorder: false, normalized: fmt.normalized, source: "format_invalid", companyName: null, checkedAt: null };
  }

  // Cache-first (table may not exist yet in a brand-new env — tolerate that).
  let cached: { dataValues: { valid?: boolean; company_name?: string | null; checked_at?: string | Date } } | null = null;
  try {
    cached = (await vatValidationModel.findOne({ where: { vat_id: fmt.normalized } })) as typeof cached;
  } catch { /* ignore */ }
  const ttlMs = VIES_CACHE_TTL_DAYS * 86400000;
  if (cached?.dataValues?.checked_at) {
    const age = Date.now() - new Date(cached.dataValues.checked_at).getTime();
    if (age < ttlMs) {
      return { valid: !!cached.dataValues.valid, countryCode: fmt.countryCode, crossBorder: fmt.crossBorder, normalized: fmt.normalized, source: "cache", companyName: cached.dataValues.company_name ?? null, checkedAt: new Date(cached.dataValues.checked_at).toISOString() };
    }
  }

  // VIES is EU-only. A non-EU VAT number (e.g. GB post-Brexit) can never
  // trigger EU B2B reverse-charge, so we don't call VIES for it — return
  // unverified so the compliant default (charge VAT) applies.
  if (!EU_COUNTRIES.includes(fmt.countryCode)) {
    return { valid: false, countryCode: fmt.countryCode, crossBorder: fmt.crossBorder, normalized: fmt.normalized, source: "unverified_non_vies", companyName: null, checkedAt: null };
  }

  // Greece: EU code "GR" → VIES member-state code "EL". The number part is the
  // normalized ID minus its 2-char prefix.
  const viesCC = fmt.countryCode === "GR" ? "EL" : fmt.countryCode;
  const numberPart = fmt.normalized.slice(2);

  try {
    const resp = await axios.get(`${VIES_REST_BASE}/ms/${viesCC}/vat/${numberPart}`, {
      headers: { Accept: "application/json" },
      timeout: 8000,
    });
    const valid = resp.data?.isValid === true;
    const name = resp.data?.name && resp.data.name !== "---" ? String(resp.data.name) : null;
    const address = resp.data?.address && resp.data.address !== "---" ? String(resp.data.address) : null;
    const now = new Date();
    await vatValidationModel
      .upsert({
        vat_id: fmt.normalized,
        country_code: fmt.countryCode,
        valid,
        company_name: name,
        company_address: address,
        source: "vies",
        raw: resp.data || null,
        checked_at: now,
      })
      .catch(() => {});
    return { valid, countryCode: fmt.countryCode, crossBorder: fmt.crossBorder, normalized: fmt.normalized, source: "vies", companyName: name, checkedAt: now.toISOString() };
  } catch (e: unknown) {
    cronLogger.info(`[Tax] VIES verify failed for ${fmt.normalized}: ${getErrorMessage(e)}`);
    // Resilience: a recent-but-stale POSITIVE cache still counts as verified.
    if (cached?.dataValues?.valid) {
      return { valid: true, countryCode: fmt.countryCode, crossBorder: fmt.crossBorder, normalized: fmt.normalized, source: "cache_stale", companyName: cached.dataValues.company_name ?? null, checkedAt: cached.dataValues.checked_at ? new Date(cached.dataValues.checked_at).toISOString() : null };
    }
    return { valid: false, countryCode: fmt.countryCode, crossBorder: fmt.crossBorder, normalized: fmt.normalized, source: "unverified_error", companyName: null, checkedAt: null };
  }
}

// ── Result shape ─────────────────────────────────────────────────────
export interface TaxCalcResult {
  tax_enabled: boolean;
  tax_rate: number;
  tax_acronym: string;
  tax_amount: number;
  country_code: string;
  country_name: string;
  subtotal: number;
  total: number;
  currency: string;
  // Extended fields (session 57)
  reverse_charge?: boolean;
  tax_inclusive?: boolean;
  customer_vat_id_valid?: boolean;
  exempt_reason?: string;
  // VIES verification proof (backlog #1)
  vies_valid?: boolean;
  vies_checked_at?: string | null;
  vies_source?: string;
  // Reduced/zero rate (backlog #5)
  tax_treatment?: "standard" | "reduced" | "zero";
  reduced_category?: string | null;
}

export interface TaxCalcInput {
  countryCode: string;       // buyer jurisdiction (IP-detected OR shipping country)
  amount: number;            // pre-tax OR gross amount depending on `taxInclusive`
  currency: string;
  taxInclusive?: boolean;    // if true, `amount` already INCLUDES tax → back-out
  taxCategory?: "digital" | "physical" | "service" | "exempt";
  merchantCountry?: string;  // for EU B2B reverse-charge
  customerVatId?: string;    // for EU B2B reverse-charge
  // Reduced/zero rate (backlog #5). `taxTreatment` is the merchant's explicit
  // choice; `reducedCategory` picks the jurisdiction band when treatment=reduced.
  taxTreatment?: "standard" | "reduced" | "zero";
  reducedCategory?: string | null;
}

/**
 * Legacy single-arg wrapper — kept for existing callers in paymentController.ts
 * + cryptoCheckout.ts. New callers should use `calculateTax()`.
 */
export const calculateTaxForCheckout = async (
  countryCode: string,
  amount: number,
  currency: string
): Promise<TaxCalcResult | null> => {
  return calculateTax({ countryCode, amount, currency });
};

/**
 * Core tax calc. Handles all edge cases:
 *   - `taxCategory==='exempt'` → 0% with exempt_reason='product_exempt'
 *   - EU B2B reverse-charge → 0% with reverse_charge=true + valid VAT ID
 *   - `taxInclusive===true`  → back out tax from gross (subtotal = gross / (1+rate))
 *   - Otherwise standard: tax added on top of `amount`
 */
export const calculateTax = async (
  input: TaxCalcInput
): Promise<TaxCalcResult | null> => {
  try {
    const {
      countryCode,
      amount,
      currency,
      taxInclusive = false,
      taxCategory = "digital",
      merchantCountry,
      customerVatId,
      taxTreatment = "standard",
      reducedCategory = null,
    } = input;

    const upperCountryCode = String(countryCode || "").toUpperCase();
    const countryName = COUNTRY_NAMES[upperCountryCode] || countryCode || "Unknown";
    const taxAcronym = TAX_ACRONYMS[upperCountryCode] || "Tax";

    // ── EXEMPT product category → early exit ────────────────────────
    if (taxCategory === "exempt") {
      return {
        tax_enabled: true,
        tax_rate: 0,
        tax_acronym: taxAcronym,
        tax_amount: 0,
        country_code: upperCountryCode,
        country_name: countryName,
        subtotal: toNumber(amount, 2),
        total: toNumber(amount, 2),
        currency,
        tax_inclusive: taxInclusive,
        reverse_charge: false,
        customer_vat_id_valid: false,
        exempt_reason: "product_exempt",
      };
    }

    // ── EU B2B reverse-charge check (backlog #1: live VIES) ─────────
    let vatIdValid = false;
    let reverseCharge = false;
    let viesValid: boolean | undefined;
    let viesCheckedAt: string | null | undefined;
    let viesSource: string | undefined;
    if (customerVatId && customerVatId.trim()) {
      const v = await verifyVatId(customerVatId, merchantCountry);
      vatIdValid = v.valid;
      viesValid = v.valid;
      viesSource = v.source;
      viesCheckedAt = v.checkedAt;
      // Reverse-charge only when the number is VERIFIED real + both parties in
      // the EU + cross-border. Unverifiable → no reverse charge → charge VAT.
      if (v.valid) {
        reverseCharge = shouldReverseCharge(merchantCountry, v.countryCode, true);
      }
    }
    if (reverseCharge) {
      return {
        tax_enabled: true,
        tax_rate: 0,
        tax_acronym: taxAcronym,
        tax_amount: 0,
        country_code: upperCountryCode,
        country_name: countryName,
        subtotal: toNumber(amount, 2),
        total: toNumber(amount, 2),
        currency,
        tax_inclusive: taxInclusive,
        reverse_charge: true,
        customer_vat_id_valid: true,
        exempt_reason: "eu_b2b_reverse_charge",
        vies_valid: viesValid,
        vies_checked_at: viesCheckedAt ?? null,
        vies_source: viesSource,
      };
    }

    // ── Resolve the applicable rate ─────────────────────────────────
    let taxRate = 0;
    let resolvedAcronym = taxAcronym;
    let resolvedCountryName = countryName;

    interface CachedTaxRate {
      dataValues: {
        standard_rate?: string | number;
        tax_acronym?: string;
        country_name?: string;
      };
    }

    const cachedRate = (await taxRateModel.findOne({
      where: { country_code: upperCountryCode },
    })) as CachedTaxRate | null;

    if (cachedRate) {
      taxRate = parseFloat(String(cachedRate.dataValues.standard_rate)) || 0;
      resolvedAcronym = String(cachedRate.dataValues.tax_acronym || resolvedAcronym);
      resolvedCountryName = String(cachedRate.dataValues.country_name || resolvedCountryName);
      cronLogger.info(`[Tax] Using cached rate for ${upperCountryCode}: ${taxRate}%`);
    } else if (TAX_DATA_API_KEY) {
      try {
        const response = await axios.get(`${TAX_DATA_API_URL}/tax_rates`, {
          headers: { apikey: TAX_DATA_API_KEY },
          params: { country: upperCountryCode },
          timeout: 5000,
        });
        // APILayer sometimes returns standard_rate as a nested object
        // ({ rate: 0.23, class, ... }) rather than a plain percentage. Coerce
        // to a number, expand a fractional value (0.23 → 23), and only trust a
        // positive result — otherwise fall back to the static table. NEVER
        // assign a non-numeric rate (that silently under-collected to 0%).
        const raw: unknown = response.data?.standard_rate;
        let apiRate = Number(raw);
        if (!Number.isFinite(apiRate) || apiRate <= 0) {
          const nested = raw && typeof raw === "object" ? Number((raw as { rate?: number }).rate) : NaN;
          apiRate = Number.isFinite(nested) && nested > 0 ? (nested <= 1 ? nested * 100 : nested) : NaN;
        }
        if (Number.isFinite(apiRate) && apiRate > 0) {
          taxRate = apiRate;
          cronLogger.info(`[Tax] Fetched rate from API for ${upperCountryCode}: ${taxRate}%`);
          await taxRateModel
            .create({
              country_code: upperCountryCode,
              country_name: resolvedCountryName,
              tax_acronym: resolvedAcronym,
              standard_rate: taxRate,
            })
            .catch(() => {});
        } else {
          taxRate = FALLBACK_TAX_RATES[upperCountryCode] || 0;
          cronLogger.info(`[Tax] API rate unusable for ${upperCountryCode}, using fallback: ${taxRate}%`);
        }
      } catch (apiError: unknown) {
        cronLogger.info(
          `[Tax] API error for ${upperCountryCode}, using fallback:`,
          getErrorMessage(apiError)
        );
        taxRate = FALLBACK_TAX_RATES[upperCountryCode] || 0;
      }
    } else {
      taxRate = FALLBACK_TAX_RATES[upperCountryCode] || 0;
      cronLogger.info(`[Tax] Using fallback rate for ${upperCountryCode}: ${taxRate}%`);
    }

    // ── Apply reduced / zero VAT treatment (backlog #5) ─────────────
    // Merchant's explicit per-product choice. `reduced` maps to the buyer
    // country's band for the product's category (falls back to the standard
    // rate → never under-collects). `zero` forces 0% (zero-rated, in-scope).
    let zeroRated = false;
    if (taxTreatment === "zero") {
      taxRate = 0;
      zeroRated = true;
    } else if (taxTreatment === "reduced") {
      const reduced = resolveReducedRate(upperCountryCode, reducedCategory, taxRate);
      cronLogger.info(`[Tax] Reduced treatment ${upperCountryCode}/${reducedCategory || "general"}: ${taxRate}% → ${reduced}%`);
      taxRate = reduced;
    }

    // ── Compute amount split (tax-inclusive vs tax-exclusive) ───────
    let subtotal: number;
    let taxAmount: number;
    let total: number;
    if (taxInclusive && taxRate > 0) {
      // Buyer sees the gross figure; back out the VAT portion so accounting
      // (fee % + volume tier) applies to the true subtotal.
      // amount = subtotal * (1 + rate/100)  →  subtotal = amount / (1 + rate/100)
      // Exact decimal back-out, rounded to cents; tax is the complement so
      // subtotal + tax always equals the gross figure the buyer sees.
      subtotal = toNumber(div(amount, add(1, div(taxRate, 100))), 2);
      taxAmount = sub(amount, subtotal).toNumber();
      total = amount;
    } else {
      subtotal = amount;
      taxAmount = toNumber(pct(amount, taxRate), 2);
      total = add(amount, taxAmount).toNumber();
    }

    return {
      tax_enabled: true,
      tax_rate: taxRate,
      tax_acronym: resolvedAcronym,
      tax_amount: toNumber(taxAmount, 2),
      country_code: upperCountryCode,
      country_name: resolvedCountryName,
      subtotal: toNumber(subtotal, 2),
      total: toNumber(total, 2),
      currency,
      tax_inclusive: taxInclusive,
      reverse_charge: false,
      customer_vat_id_valid: vatIdValid,
      vies_valid: viesValid,
      vies_checked_at: viesCheckedAt ?? null,
      vies_source: viesSource,
      tax_treatment: taxTreatment,
      reduced_category: taxTreatment === "reduced" ? reducedCategory : null,
      ...(zeroRated ? { exempt_reason: "zero_rated" } : {}),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cronLogger.error(`[Tax] Error calculating tax:`, errorMessage);
    return null;
  }
};
