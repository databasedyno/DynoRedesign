/**
 * Volume-based fee tier configuration.
 *
 * Single source of truth for merchant fee tiers. Reads from environment variables
 * (VOLUME_TIER_<NAME>_{MIN,MAX,PERCENT}); falls back to sensible defaults so a mis-
 * configured .env can never zero-out platform fees or crash the fee calc.
 *
 * Tiers are ordered strictly by min-volume ascending. A merchant's tier is decided
 * by their all-time confirmed USD volume (matches dashboardController's calc).
 *
 * The "trial" state (first $500 fee-free) is handled separately by feeFreeService
 * and is NOT a volume tier. When a user's `fee_tier` column is 'trial' or missing,
 * `getPlatformFeePercent()` returns the STARTER rate (1.5%) so no user ever gets
 * an unintended free ride.
 */

export interface VolumeTier {
  name: "starter" | "growth" | "scale" | "enterprise";
  displayName: string;
  min: number;         // Min all-time USD volume (inclusive)
  max: number | null;  // Max all-time USD volume (exclusive); null = unlimited
  percent: number;     // Platform fee percentage (e.g. 1.5 for 1.5%)
  description: string;
}

const DEFAULT_TIERS: VolumeTier[] = [
  { name: "starter",    displayName: "Starter",    min: 0,       max: 10000,   percent: 1.5, description: "For new merchants getting started" },
  { name: "growth",     displayName: "Growth",     min: 10000,   max: 100000,  percent: 1.0, description: "For growing businesses" },
  { name: "scale",      displayName: "Scale",      min: 100000,  max: 500000,  percent: 0.7, description: "For high-volume operations" },
  { name: "enterprise", displayName: "Enterprise", min: 500000,  max: null,    percent: 0.5, description: "Best pricing, priority support" },
];

const ORDER: VolumeTier["name"][] = ["starter", "growth", "scale", "enterprise"];

/**
 * Returns the full ordered list of tiers, applying .env overrides where present.
 * Any field not overridden falls back to the DEFAULT_TIERS values above.
 */
export const getVolumeTiers = (): VolumeTier[] => {
  return ORDER.map((name) => {
    const def = DEFAULT_TIERS.find((t) => t.name === name)!;
    const upper = name.toUpperCase();
    const minStr = process.env[`VOLUME_TIER_${upper}_MIN`];
    const maxStr = process.env[`VOLUME_TIER_${upper}_MAX`];
    const percentStr = process.env[`VOLUME_TIER_${upper}_PERCENT`];

    const parseNum = (s: string | undefined, fallback: number) => {
      if (s === undefined) return fallback;
      const n = Number(s);
      return isFinite(n) ? n : fallback;
    };

    return {
      name: def.name,
      displayName: def.displayName,
      min: parseNum(minStr, def.min),
      max:
        maxStr === "" || maxStr === undefined
          ? def.max
          : maxStr === "null"
          ? null
          : parseNum(maxStr, def.max ?? Number.POSITIVE_INFINITY),
      percent: parseNum(percentStr, def.percent),
      description: def.description,
    };
  });
};

/**
 * Given an all-time USD volume, return the tier the merchant qualifies for.
 * Always returns a tier (falls back to the last / highest if volume exceeds every max).
 */
export const getTierForVolume = (usdVolume: number): VolumeTier => {
  const tiers = getVolumeTiers();
  const found = tiers.find(
    (t) => usdVolume >= t.min && (t.max === null || usdVolume < t.max),
  );
  return found ?? tiers[tiers.length - 1];
};

/**
 * Look up a tier by its name (case-insensitive). Handles legacy names:
 *   - 'standard' → 'starter' (same 1.5% rate — safe migration)
 *   - 'trial'    → 'starter' (post-trial fallback — trial itself handled by feeFreeService)
 *   - null / undefined / '' → 'starter' (safe default: charge full 1.5%)
 */
export const getTierByName = (name: string | null | undefined): VolumeTier => {
  const tiers = getVolumeTiers();
  const normalized = (name || "").toLowerCase().trim();
  if (!normalized || normalized === "trial" || normalized === "standard") {
    return tiers[0]; // starter
  }
  const found = tiers.find((t) => t.name === normalized);
  return found ?? tiers[0];
};

/**
 * The main entry point used by fee calculators: returns the % to apply for a
 * given user's `fee_tier` column value. Safe against nulls / typos / unknown values.
 */
export const getPlatformFeePercent = (userTier: string | null | undefined): number => {
  return getTierByName(userTier).percent;
};

export const VOLUME_TIER_NAMES = ORDER;
