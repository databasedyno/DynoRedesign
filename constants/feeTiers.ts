/**
 * Public fee ladder — single source for the marketing /fees page and the
 * in-app Settings → Plan & fees view. Keep in sync with backend
 * `utils/feeConfigUtils.ts` (tier percentages + $1 fixed fee per payment).
 */
export interface PublicFeeTier {
  name: string;
  /** inclusive lower bound of monthly volume (USD) */
  min: number;
  /** exclusive upper bound of monthly volume (USD); null = no cap */
  max: number | null;
  /** platform fee percentage applied per payment */
  pct: number;
}

export const PUBLIC_FEE_TIERS: PublicFeeTier[] = [
  { name: "Starter", min: 0, max: 10000, pct: 1.5 },
  { name: "Growth", min: 10000, max: 100000, pct: 1.0 },
  { name: "Scale", min: 100000, max: 500000, pct: 0.7 },
  { name: "Enterprise", min: 500000, max: null, pct: 0.5 },
];

/** Fixed platform fee charged on every successful payment (USD). */
export const FIXED_FEE_USD = 1;

export const MONTHLY_FEE_USD = 0;
export const SETUP_FEE_USD = 0;
