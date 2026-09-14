/**
 * Single source of truth for marketing/trust statistics.
 * Referenced by the landing NumbersTrustBand, auth TrustStrip and About page
 * so every surface tells the same story.
 *
 * 2026-08 honesty pass: removed the unverified "$42M+ settled" volume and
 * "1,000+ merchants" / "<1min" claims. Only defensible, product-true signals
 * remain (flat fee floor, supported networks, no chargebacks, always-on).
 */
export const TRUST_STATS = {
  /** Lowest fee (at volume) — display string. */
  fee: "0.5%",
  feeNum: 0.5,
  /** Supported networks — display string. */
  chains: "15+",
  chainsNum: 15,
  /** Crypto settles final — no chargebacks. */
  chargebacks: "0",
  /** Always-on settlement — no banking hours. */
  settlement: "24/7",
} as const;
