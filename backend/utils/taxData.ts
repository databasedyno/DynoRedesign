/**
 * Centralized tax data constants
 * Single source of truth for tax rates, acronyms, and country names
 * Used by: taxController, paymentController, invoiceController
 */

// Fallback VAT/Tax rates for countries (standard rates)
export const FALLBACK_TAX_RATES: Record<string, number> = {
  // European Union
  AT: 20, BE: 21, BG: 20, CY: 19, CZ: 21, DE: 19, DK: 25, EE: 22, ES: 21,
  FI: 24, FR: 20, GR: 24, HR: 25, HU: 27, IE: 23, IT: 22, LT: 21, LU: 17,
  LV: 21, MT: 18, NL: 21, PL: 23, PT: 23, RO: 19, SE: 25, SI: 22, SK: 20,
  // Non-EU European
  GB: 20, CH: 8.1, NO: 25, IS: 24, LI: 8.1,
  // Rest of World
  US: 0, CA: 5, AU: 10, NZ: 15, JP: 10, SG: 9, IN: 18,
};

// Tax type acronyms by country (the type of tax applied, e.g., VAT, GST, IVA)
export const TAX_TYPE_ACRONYMS: Record<string, string> = {
  // European Union (local names)
  AT: "VAT", BE: "VAT", BG: "VAT", CY: "VAT", CZ: "VAT", DE: "VAT", DK: "VAT",
  EE: "VAT", ES: "IVA", FI: "VAT", FR: "TVA", GR: "VAT", HR: "VAT", HU: "VAT",
  IE: "VAT", IT: "IVA", LT: "VAT", LU: "VAT", LV: "VAT", MT: "VAT", NL: "VAT",
  PL: "VAT", PT: "IVA", RO: "VAT", SE: "VAT", SI: "VAT", SK: "VAT",
  // Non-EU European
  GB: "VAT", CH: "VAT", NO: "VAT", IS: "VAT", LI: "VAT",
  // Rest of World
  US: "Tax", CA: "GST", AU: "GST", NZ: "GST", JP: "Tax", SG: "GST", IN: "GST",
};

// Tax ID acronyms by country (the business registration / tax identification number type)
export const TAX_ID_ACRONYMS: Record<string, string> = {
  // European Union (All use VAT number for tax ID)
  AT: "VAT", BE: "VAT", BG: "VAT", CY: "VAT", CZ: "VAT", DE: "VAT", DK: "VAT",
  EE: "VAT", ES: "VAT", FI: "VAT", FR: "VAT", GR: "VAT", HR: "VAT", HU: "VAT",
  IE: "VAT", IT: "VAT", LT: "VAT", LU: "VAT", LV: "VAT", MT: "VAT", NL: "VAT",
  PL: "VAT", PT: "VAT", RO: "VAT", SE: "VAT", SI: "VAT", SK: "VAT",
  // Rest of World
  AD: "NRT", AE: "TRN", AF: "TIN", AG: "TIN", AL: "TIN", AM: "TIN", AO: "TIN",
  AR: "CUIT", AU: "ABN", AW: "TIN", AZ: "TIN", BA: "TIN", BB: "TIN", BD: "BIN",
  BF: "IFU", BH: "VAT", BJ: "IFU", BO: "TIN", BR: "CNPJ/CPF", BS: "TIN",
  BY: "TIN", CA: "BN", CH: "VAT", CL: "RUT", CN: "TIN", CO: "NIT", CR: "TIN",
  DO: "RCN", DZ: "TIN", EC: "RUC", EG: "TIN", GB: "VAT", GE: "VAT", GH: "TIN",
  GT: "VAT", HK: "BR", ID: "NPWP", IL: "VAT", IN: "GST", IS: "VAT", JP: "CN",
  KE: "PIN", KR: "BRN", KZ: "BIN", LI: "VAT", MA: "TIN", MC: "NIF", MD: "VAT",
  ME: "TIN", MK: "TIN", MU: "VAT", MX: "RFC", MY: "TIN", NG: "TIN", NO: "VAT",
  NZ: "GST", OM: "VAT", PA: "RUC", PE: "RUC", PH: "TIN", PK: "STRN", PY: "TIN",
  RS: "TIN", RU: "INN", SA: "VAT", SG: "UEN", TH: "VAT", TR: "TIN", TW: "VAT",
  UA: "VAT", US: "EIN", UY: "RUT", VE: "RIF", VN: "TIN", ZA: "VAT",
};

// Country names mapping
export const COUNTRY_NAMES: Record<string, string> = {
  AT: "Austria", BE: "Belgium", BG: "Bulgaria", CY: "Cyprus", CZ: "Czech Republic",
  DE: "Germany", DK: "Denmark", EE: "Estonia", ES: "Spain", FI: "Finland",
  FR: "France", GR: "Greece", HR: "Croatia", HU: "Hungary", IE: "Ireland",
  IT: "Italy", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MT: "Malta",
  NL: "Netherlands", PL: "Poland", PT: "Portugal", RO: "Romania", SE: "Sweden",
  SI: "Slovenia", SK: "Slovakia", GB: "United Kingdom", US: "United States",
  CA: "Canada", AU: "Australia", NZ: "New Zealand", IN: "India", JP: "Japan",
  CN: "China", BR: "Brazil", MX: "Mexico", AR: "Argentina", CH: "Switzerland",
  NO: "Norway", SG: "Singapore", HK: "Hong Kong", KR: "South Korea", ZA: "South Africa",
  AE: "United Arab Emirates", SA: "Saudi Arabia", IL: "Israel", TR: "Turkey",
  RU: "Russia", UA: "Ukraine", TH: "Thailand", MY: "Malaysia", ID: "Indonesia",
  PH: "Philippines", VN: "Vietnam", NG: "Nigeria", EG: "Egypt", KE: "Kenya",
  GH: "Ghana", MA: "Morocco", PK: "Pakistan", BD: "Bangladesh", CL: "Chile",
  CO: "Colombia", PE: "Peru", VE: "Venezuela", EC: "Ecuador",
};

// EU country codes list
export const EU_COUNTRIES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR",
  "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL",
  "PT", "RO", "SE", "SI", "SK",
];
