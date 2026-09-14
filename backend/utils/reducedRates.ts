/**
 * Reduced / zero VAT rate resolution (backlog #5).
 *
 * A product carries an explicit VAT *treatment* (standard | reduced | zero) and,
 * when reduced, a canonical *reduced category* (e-books, foodstuffs, …). At
 * checkout we resolve the correct band for the BUYER's destination country:
 *   band for (country, category)  →  else the country's primary reduced rate
 *   →  else the standard rate (so we NEVER under-collect on an unmapped country).
 *
 * ⚠️ NOT TAX ADVICE. These are indicative EU/UK reduced & super-reduced rates
 * (≈2024/2025). Rates and category eligibility change — merchants must confirm
 * with their tax adviser. Where a category is standard-rated in a country we
 * simply omit it (→ standard-rate fallback).
 */

export interface ReducedCategory {
  key: string;
  label: string;
}

/** Canonical, jurisdiction-agnostic reduced-rate categories a merchant can pick. */
export const REDUCED_RATE_CATEGORIES: ReducedCategory[] = [
  { key: "ebooks", label: "E-books & digital publications" },
  { key: "books", label: "Printed books, news & periodicals" },
  { key: "foodstuffs", label: "Foodstuffs & groceries" },
  { key: "medical", label: "Pharmaceuticals & medical" },
  { key: "children", label: "Children's goods (clothing, nappies)" },
  { key: "passenger_transport", label: "Passenger transport" },
  { key: "accommodation", label: "Hotel & accommodation" },
  { key: "general", label: "Other reduced-rate goods / services" },
];

export const REDUCED_CATEGORY_KEYS = new Set(REDUCED_RATE_CATEGORIES.map((c) => c.key));

interface CountryBands {
  /** The country's primary (most common) reduced rate — used for "general". */
  primaryReduced?: number;
  /** Category-specific rates (incl. 0 for zero-rated). Missing → primary/standard. */
  bands: Record<string, number>;
}

/**
 * Per-country reduced-rate bands. `bands` values are PERCENTAGES (0 = zero-rated).
 * A category absent from a country falls back to `primaryReduced`, then standard.
 */
export const VAT_REDUCED_BANDS: Record<string, CountryBands> = {
  AT: { primaryReduced: 10, bands: { ebooks: 10, books: 10, foodstuffs: 10, medical: 10, passenger_transport: 10, accommodation: 13 } },
  BE: { primaryReduced: 6, bands: { ebooks: 6, books: 6, foodstuffs: 6, medical: 6, passenger_transport: 6, accommodation: 6 } },
  BG: { primaryReduced: 9, bands: { ebooks: 9, books: 9, accommodation: 9 } },
  CY: { primaryReduced: 5, bands: { ebooks: 5, books: 5, foodstuffs: 5, medical: 5, passenger_transport: 9, accommodation: 9 } },
  CZ: { primaryReduced: 12, bands: { ebooks: 12, books: 12, foodstuffs: 12, medical: 12, accommodation: 12 } },
  DE: { primaryReduced: 7, bands: { ebooks: 7, books: 7, foodstuffs: 7, passenger_transport: 7, accommodation: 7 } },
  DK: { bands: {} }, // Denmark has no general reduced rate (newspapers 0 is niche).
  EE: { primaryReduced: 9, bands: { ebooks: 9, books: 9, medical: 9, accommodation: 13 } },
  ES: { primaryReduced: 10, bands: { ebooks: 4, books: 4, foodstuffs: 4, medical: 4, passenger_transport: 10, accommodation: 10 } },
  FI: { primaryReduced: 10, bands: { ebooks: 10, books: 10, foodstuffs: 14, medical: 10, passenger_transport: 10, accommodation: 10 } },
  FR: { primaryReduced: 5.5, bands: { ebooks: 5.5, books: 5.5, foodstuffs: 5.5, medical: 2.1, passenger_transport: 10, accommodation: 10 } },
  GR: { primaryReduced: 13, bands: { ebooks: 6, books: 6, foodstuffs: 13, medical: 6, accommodation: 13 } },
  HR: { primaryReduced: 13, bands: { ebooks: 5, books: 5, foodstuffs: 13, medical: 5 } },
  HU: { primaryReduced: 5, bands: { ebooks: 5, books: 5, foodstuffs: 18, medical: 5, accommodation: 5 } },
  IE: { primaryReduced: 13.5, bands: { ebooks: 0, books: 0, foodstuffs: 0, medical: 0, children: 0, accommodation: 13.5 } },
  IT: { primaryReduced: 10, bands: { ebooks: 4, books: 4, foodstuffs: 4, medical: 10, accommodation: 10 } },
  LT: { primaryReduced: 9, bands: { ebooks: 9, books: 9, medical: 5, accommodation: 9 } },
  LU: { primaryReduced: 8, bands: { ebooks: 3, books: 3, foodstuffs: 3, medical: 3, passenger_transport: 8, accommodation: 3 } },
  LV: { primaryReduced: 12, bands: { ebooks: 5, books: 5, foodstuffs: 12, medical: 12 } },
  MT: { primaryReduced: 5, bands: { ebooks: 5, books: 5, foodstuffs: 0, medical: 0, accommodation: 7 } },
  NL: { primaryReduced: 9, bands: { ebooks: 9, books: 9, foodstuffs: 9, medical: 9, passenger_transport: 9, accommodation: 9 } },
  PL: { primaryReduced: 8, bands: { ebooks: 5, books: 5, foodstuffs: 5, medical: 8, accommodation: 8 } },
  PT: { primaryReduced: 6, bands: { ebooks: 6, books: 6, foodstuffs: 6, medical: 6, accommodation: 6 } },
  RO: { primaryReduced: 9, bands: { ebooks: 5, books: 5, foodstuffs: 9, medical: 9, accommodation: 5 } },
  SE: { primaryReduced: 12, bands: { ebooks: 6, books: 6, foodstuffs: 12, passenger_transport: 6, accommodation: 12 } },
  SI: { primaryReduced: 9.5, bands: { ebooks: 5, books: 5, foodstuffs: 9.5, medical: 9.5, accommodation: 9.5 } },
  SK: { primaryReduced: 10, bands: { ebooks: 10, books: 10, foodstuffs: 19, medical: 10, accommodation: 5 } },
  // Non-EU with reduced/zero regimes (applied if a merchant sells there).
  GB: { primaryReduced: 5, bands: { ebooks: 0, books: 0, foodstuffs: 0, children: 0, medical: 5, passenger_transport: 0 } },
};

/**
 * Resolve the applicable reduced rate for a destination country + category.
 * Falls back to the country's primary reduced rate, then the standard rate.
 * Returns a percentage number (0 = zero-rated).
 */
export function resolveReducedRate(
  countryCode: string,
  category: string | null | undefined,
  standardRate: number
): number {
  const cc = String(countryCode || "").toUpperCase();
  const entry = VAT_REDUCED_BANDS[cc];
  if (!entry) return standardRate;
  const cat = category ? String(category) : "";
  if (cat && cat !== "general" && entry.bands[cat] != null) return entry.bands[cat];
  if (entry.primaryReduced != null) return entry.primaryReduced;
  return standardRate;
}
