/**
 * Economic-nexus / VAT-GST registration thresholds (backlog #4).
 * ⚠️ NOT TAX ADVICE — indicative headline thresholds to warn merchants BEFORE
 * they must register. Confirm specifics with a tax adviser.
 */
export interface NexusThreshold {
  key: string;
  label: string;
  scope: "eu_oss" | "country";
  country?: string;      // for scope="country"
  currency: string;      // threshold + reporting currency
  amount: number;        // registration threshold in `currency`
  note: string;
}

export const NEXUS_THRESHOLDS: NexusThreshold[] = [
  {
    key: "eu_oss",
    label: "EU pan-EU B2C (OSS)",
    scope: "eu_oss",
    currency: "EUR",
    amount: 10000,
    note: "Cross-border B2C sales to other EU member states. Above €10,000/yr you must charge each buyer's destination VAT and register for the One-Stop-Shop (OSS).",
  },
  {
    key: "uk",
    label: "United Kingdom VAT",
    scope: "country",
    country: "GB",
    currency: "GBP",
    amount: 90000,
    note: "UK-established threshold is £90,000. Non-UK sellers of digital services to UK consumers generally must register from the first sale.",
  },
  {
    key: "au",
    label: "Australia GST",
    scope: "country",
    country: "AU",
    currency: "AUD",
    amount: 75000,
    note: "Register for GST once annual turnover reaches A$75,000.",
  },
  {
    key: "nz",
    label: "New Zealand GST",
    scope: "country",
    country: "NZ",
    currency: "NZD",
    amount: 60000,
    note: "Remote-services GST registration threshold is NZ$60,000.",
  },
  {
    key: "sg",
    label: "Singapore GST",
    scope: "country",
    country: "SG",
    currency: "SGD",
    amount: 1000000,
    note: "Overseas-vendor GST registration threshold is S$1,000,000.",
  },
];

/** ≥ this fraction of a threshold surfaces an "approaching" warning. */
export const NEXUS_APPROACHING_RATIO = 0.8;
