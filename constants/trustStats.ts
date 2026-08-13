/**
 * Single source of truth for marketing/trust statistics.
 * Referenced by the landing NumbersTrustBand, auth TrustStrip and About page
 * so every surface tells the same story (UI/UX audit P1 fix, 2026-06).
 */
export const TRUST_STATS = {
  /** Total volume settled since launch — display string. */
  volume: "$42M+",
  /** Numeric part of the volume stat (for count-up animations). */
  volumeNum: 42,
  merchants: "1,000+",
  /** Supported chains — display string. */
  chains: "15+",
  chainsNum: 15,
  settlement: "<1min",
} as const;
