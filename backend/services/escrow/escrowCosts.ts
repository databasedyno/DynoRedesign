/**
 * Escrow cost-rate engine.
 *
 * The escrow price is more than the 5% platform fee: real settlement also costs
 *   1) an inbound on-chain NETWORK fee (sweeping the buyer's funded crypto to the
 *      platform's Binance custody wallet),
 *   2) a CONVERSION fee (Binance spot taker, ~0.1%, when the funded coin isn't
 *      already the target stablecoin), and
 *   3) an outbound WITHDRAWAL fee (Binance's flat per-network fee) when the
 *      stablecoin is paid out at cashout.
 *
 * These are folded into the quote and allocated to whoever pays the fee
 * (buyer / seller / split — same rule as the escrow fee).
 *
 * This module keeps a SYNC, always-available rate table (static defaults,
 * env-overridable) so the per-deal fee breakdown never blocks on the network.
 * `refreshEscrowCostRates()` best-effort updates that table from the EXISTING
 * Binance + blockchain-fee code (dynamic imports, TTL-guarded) so production
 * quotes track live network/withdrawal costs; in SAFE MODE / when the exchange
 * is unreachable it silently keeps the static estimates.
 */

const envNum = (key: string, fallback: number): number => {
  const v = process.env[key];
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export interface PayoutOption {
  key: string; // e.g. "USDT-TRON"
  coin: "USDT" | "USDC";
  chain: string; // internal chain (TRC20 | ERC20 | POLYGON)
  binanceNetwork: string; // Binance network name (TRX | ETH | MATIC)
  label: string;
}

/** Stablecoins offered for cashout — USDT + USDC across the networks we support. */
export const ESCROW_PAYOUT_OPTIONS: PayoutOption[] = [
  { key: "USDT-TRON", coin: "USDT", chain: "TRC20", binanceNetwork: "TRX", label: "USDT · Tron (TRC-20)" },
  { key: "USDT-ERC20", coin: "USDT", chain: "ERC20", binanceNetwork: "ETH", label: "USDT · Ethereum (ERC-20)" },
  { key: "USDT-POLYGON", coin: "USDT", chain: "POLYGON", binanceNetwork: "MATIC", label: "USDT · Polygon" },
  { key: "USDC-ERC20", coin: "USDC", chain: "ERC20", binanceNetwork: "ETH", label: "USDC · Ethereum (ERC-20)" },
  { key: "USDC-POLYGON", coin: "USDC", chain: "POLYGON", binanceNetwork: "MATIC", label: "USDC · Polygon" },
];

export const ESCROW_PAYOUT_KEYS = ESCROW_PAYOUT_OPTIONS.map((o) => o.key);
export const DEFAULT_PAYOUT_KEY = "USDT-TRON";

/** Normalise a coin string ("usdt", "USDT-TRC20", "USDT (TRON)") to a payout key. */
export function normalizePayoutKey(coin?: string | null): string {
  if (!coin) return DEFAULT_PAYOUT_KEY;
  const c = String(coin).toUpperCase().replace(/[^A-Z0-9]/g, "-");
  const direct = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === c || o.key.replace("-", "") === c.replace("-", ""));
  if (direct) return direct.key;
  if (c.includes("TRON") || c.includes("TRC")) return "USDT-TRON";
  if (c.startsWith("USDC")) return c.includes("POLY") ? "USDC-POLYGON" : "USDC-ERC20";
  if (c.startsWith("USDT")) return c.includes("POLY") ? "USDT-POLYGON" : c.includes("ERC") ? "USDT-ERC20" : "USDT-TRON";
  return DEFAULT_PAYOUT_KEY;
}

// ── static defaults (USD) — env-overridable, live-refreshable ────────────────
const DEFAULT_WITHDRAW_FEE_USD: Record<string, number> = {
  "USDT-TRON": envNum("ESCROW_WITHDRAW_FEE_USDT_TRON", 1),
  "USDT-ERC20": envNum("ESCROW_WITHDRAW_FEE_USDT_ERC20", 5),
  "USDT-POLYGON": envNum("ESCROW_WITHDRAW_FEE_USDT_POLYGON", 0.8),
  "USDC-ERC20": envNum("ESCROW_WITHDRAW_FEE_USDC_ERC20", 5),
  "USDC-POLYGON": envNum("ESCROW_WITHDRAW_FEE_USDC_POLYGON", 0.8),
};

// Inbound sweep gas (buyer's funded coin -> Binance), keyed by funding coin/chain.
const DEFAULT_NETWORK_FEE_USD: Record<string, number> = {
  BTC: 2,
  ETH: 3,
  "USDT-ERC20": 4,
  "USDC-ERC20": 4,
  "USDT-TRON": 1.5,
  TRX: 1.5,
  "USDT-POLYGON": 0.1,
  POLYGON: 0.1,
  SOL: 0.05,
  XRP: 0.05,
  LTC: 0.1,
  DOGE: 0.1,
  BCH: 0.1,
};
const DEFAULT_SWEEP_USD = envNum("ESCROW_SWEEP_FEE_USD_DEFAULT", 2);
const CONVERSION_FEE_PCT = envNum("ESCROW_CONVERSION_FEE_PCT", 0.1); // Binance spot taker ~0.1%

interface CostRates {
  conversionPct: number;
  network: Record<string, number>;
  withdraw: Record<string, number>;
  updatedAt: number;
}

const RATES: CostRates = {
  conversionPct: CONVERSION_FEE_PCT,
  network: { ...DEFAULT_NETWORK_FEE_USD },
  withdraw: { ...DEFAULT_WITHDRAW_FEE_USD },
  updatedAt: 0,
};

/** Synchronous accessor used by the (sync) fee-breakdown math. */
export function getEscrowCostRates(): CostRates {
  return RATES;
}

/** Inbound sweep gas estimate (USD) for a funding coin (falls back to default). */
export function sweepFeeUsdFor(coin?: string | null): number {
  if (!coin) return DEFAULT_SWEEP_USD;
  const c = String(coin).toUpperCase();
  if (RATES.network[c] != null) return RATES.network[c];
  if (c.includes("TRON") || c.includes("TRC") || c === "TRX") return RATES.network.TRX ?? DEFAULT_SWEEP_USD;
  if (c.includes("POLY")) return RATES.network.POLYGON ?? DEFAULT_SWEEP_USD;
  if (c.includes("ERC")) return RATES.network["USDT-ERC20"] ?? DEFAULT_SWEEP_USD;
  return RATES.network[c] ?? DEFAULT_SWEEP_USD;
}

/** Outbound Binance withdrawal fee estimate (USD) for a payout stablecoin key. */
export function withdrawFeeUsdFor(payoutKey?: string | null): number {
  const key = normalizePayoutKey(payoutKey);
  return RATES.withdraw[key] ?? DEFAULT_WITHDRAW_FEE_USD[key] ?? 1;
}

let refreshing = false;
const REFRESH_TTL_MS = 15 * 60 * 1000;

/**
 * Best-effort refresh of the live rate table from the EXISTING Binance +
 * blockchain-fee services. Never throws; keeps static estimates on any failure
 * (e.g. SAFE MODE where the exchange is unreachable). TTL-guarded.
 */
export async function refreshEscrowCostRates(force = false): Promise<void> {
  if (refreshing) return;
  if (!force && Date.now() - RATES.updatedAt < REFRESH_TTL_MS) return;
  refreshing = true;
  try {
    // 1) inbound sweep gas per chain — reuse blockchainFeeService
    try {
      const { getBlockchainNetworkFee } = await import("../blockchainFeeService");
      const chains = ["BTC", "ETH", "TRX", "POLYGON", "SOL", "LTC", "DOGE", "BCH"] as const;
      await Promise.all(
        chains.map(async (chain) => {
          try {
            const r: any = await getBlockchainNetworkFee(chain, "fast");
            const usd = Number(r?.feeInUSD);
            if (Number.isFinite(usd) && usd > 0) {
              RATES.network[chain] = usd;
              if (chain === "TRX") RATES.network["USDT-TRON"] = usd;
              if (chain === "POLYGON") RATES.network["USDT-POLYGON"] = usd;
              if (chain === "ETH") {
                RATES.network["USDT-ERC20"] = usd;
                RATES.network["USDC-ERC20"] = usd;
              }
            }
          } catch {
            /* keep static for this chain */
          }
        })
      );
    } catch {
      /* blockchainFeeService unavailable — keep static */
    }

    // 2) Binance withdrawal fees — reuse binanceService (needs API access)
    try {
      const binance: any = await import("../binanceService");
      if (typeof binance.getWithdrawFeesUsd === "function") {
        const fees = await binance.getWithdrawFeesUsd(ESCROW_PAYOUT_OPTIONS);
        if (fees && typeof fees === "object") {
          for (const key of ESCROW_PAYOUT_KEYS) {
            const v = Number(fees[key]);
            if (Number.isFinite(v) && v >= 0) RATES.withdraw[key] = v;
          }
        }
      }
    } catch {
      /* binance unreachable / no keys — keep static */
    }

    RATES.updatedAt = Date.now();
  } finally {
    refreshing = false;
  }
}
