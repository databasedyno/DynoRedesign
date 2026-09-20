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
// NOTE: sweeping an ERC-20/TRC-20 TOKEN costs far more than a native transfer on the
// same chain (contract call energy/gas), so token keys carry their own realistic
// defaults — never reuse the native TRX/ETH transfer fee for a USDT/USDC sweep.
// These values also act as a SAFETY FLOOR: the live refresh only ever raises a fee
// above its default (a momentarily near-zero live gas quote must never let the platform
// under-collect the real sweep cost).
const DEFAULT_NETWORK_FEE_USD: Record<string, number> = {
  BTC: 2,
  ETH: 3,
  "USDT-ERC20": 3,
  "USDC-ERC20": 3,
  "USDT-TRON": 2,
  "USDT-TRC20": 2,
  TRX: 0.5,
  "USDT-POLYGON": 0.1,
  "USDC-POLYGON": 0.1,
  POLYGON: 0.05,
  SOL: 0.05,
  XRP: 0.05,
  LTC: 0.1,
  DOGE: 0.1,
  BCH: 0.1,
};
const DEFAULT_SWEEP_USD = envNum("ESCROW_SWEEP_FEE_USD_DEFAULT", 2);
const CONVERSION_FEE_PCT = envNum("ESCROW_CONVERSION_FEE_PCT", 0.1); // Binance spot taker ~0.1%
// SafeDeal's own margin on non-stablecoin funding (covers spread/slippage + profit). Configurable.
const EXCHANGE_FEE_PCT = envNum("ESCROW_EXCHANGE_FEE_PCT", 2);

/** USDT/USDC on any network — no exchange fee, already a dollar-stable asset. */
export function isStableFundingCoin(coin?: string | null): boolean {
  return !!coin && /usdt|usdc/i.test(String(coin));
}

interface CostRates {
  conversionPct: number;
  exchangePct: number;
  network: Record<string, number>;
  withdraw: Record<string, number>;
  updatedAt: number;
}

const RATES: CostRates = {
  conversionPct: CONVERSION_FEE_PCT,
  exchangePct: EXCHANGE_FEE_PCT,
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
  // Exact match first (e.g. "USDT-TRC20", "USDT-ERC20" carry token-specific sweep costs).
  if (RATES.network[c] != null) return RATES.network[c];
  const isUsdc = c.includes("USDC");
  if (c.includes("USDT") || isUsdc) {
    // A stablecoin sweep is a TOKEN transfer — cost depends on the chain, not the native coin.
    if (c.includes("TRON") || c.includes("TRC")) return RATES.network["USDT-TRON"] ?? RATES.network["USDT-TRC20"] ?? DEFAULT_SWEEP_USD;
    if (c.includes("POLY")) return RATES.network[isUsdc ? "USDC-POLYGON" : "USDT-POLYGON"] ?? RATES.network["USDT-POLYGON"] ?? DEFAULT_SWEEP_USD;
    if (c.includes("ERC")) return RATES.network[isUsdc ? "USDC-ERC20" : "USDT-ERC20"] ?? RATES.network["USDT-ERC20"] ?? DEFAULT_SWEEP_USD;
    return RATES.network["USDT-TRON"] ?? DEFAULT_SWEEP_USD; // bare USDT/USDC → default network
  }
  if (c === "TRX" || c.includes("TRON")) return RATES.network.TRX ?? DEFAULT_SWEEP_USD;
  if (c.includes("POLY")) return RATES.network.POLYGON ?? DEFAULT_SWEEP_USD;
  return RATES.network[c] ?? DEFAULT_SWEEP_USD;
}

/** Outbound Binance withdrawal fee estimate (USD) for a payout stablecoin key. */
export function withdrawFeeUsdFor(payoutKey?: string | null): number {
  const key = normalizePayoutKey(payoutKey);
  return RATES.withdraw[key] ?? DEFAULT_WITHDRAW_FEE_USD[key] ?? 1;
}

let refreshing = false;
const REFRESH_TTL_MS = 15 * 60 * 1000;

/** Live fee is trusted only when it MEETS OR EXCEEDS the realistic per-coin floor,
 * so a momentarily near-zero gas quote (e.g. an unreachable oracle) can never make us
 * under-collect the real sweep cost. When the live network is congested, the higher
 * live value shows through. */
function flooredNetworkFee(key: string, liveUsd: number): number {
  const floor = DEFAULT_NETWORK_FEE_USD[key] ?? DEFAULT_SWEEP_USD;
  return Math.max(Number(liveUsd) || 0, floor);
}

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
    // 1) inbound sweep gas per chain — reuse blockchainFeeService.
    //    Native transfers AND stablecoin token transfers are priced separately: a USDT/USDC
    //    sweep is a contract call (energy/gas) that costs far more than a bare coin transfer,
    //    so we query the TOKEN chain identifiers for the stablecoin sweep fees.
    try {
      const { getBlockchainNetworkFee } = await import("../blockchainFeeService");
      const fetchUsd = async (chain: string): Promise<number | null> => {
        try {
          const r: any = await getBlockchainNetworkFee(chain, "fast");
          const usd = Number(r?.feeInUSD);
          return Number.isFinite(usd) && usd > 0 ? usd : null;
        } catch {
          return null;
        }
      };
      // native-coin funding sweeps
      const nativeChains: [string, string][] = [
        ["BTC", "BTC"], ["ETH", "ETH"], ["TRX", "TRX"], ["POLYGON", "POLYGON"],
        ["SOL", "SOL"], ["LTC", "LTC"], ["DOGE", "DOGE"], ["BCH", "BCH"], ["XRP", "XRP"],
      ];
      // stablecoin (token) funding sweeps — real contract-call cost per network
      const tokenChains: [string, string[]][] = [
        ["USDT_TRC20", ["USDT-TRON", "USDT-TRC20"]],
        ["USDT_ERC20", ["USDT-ERC20"]],
        ["USDC_ERC20", ["USDC-ERC20"]],
        ["USDT_POLYGON", ["USDT-POLYGON"]],
      ];
      await Promise.all([
        ...nativeChains.map(async ([chain, key]) => {
          const usd = await fetchUsd(chain);
          if (usd != null) RATES.network[key] = flooredNetworkFee(key, usd);
        }),
        ...tokenChains.map(async ([chain, keys]) => {
          const usd = await fetchUsd(chain);
          if (usd != null) for (const k of keys) RATES.network[k] = flooredNetworkFee(k, usd);
        }),
      ]);
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

/**
 * Await a live rate refresh, but never block a money request for more than `maxMs`.
 * If the refresh is slow (or already running), we proceed with the current RATES —
 * which the refresh keeps updating in the background for the next request. This lets
 * quote/settlement paths use fees "determined at payment time" without hanging on a
 * slow exchange call.
 */
export async function awaitFreshRates(maxMs = 4000): Promise<void> {
  await Promise.race([
    refreshEscrowCostRates().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
  ]);
}
