import { toNumber } from "../../utils/money";
/**
 * Refund chain metadata + PURE helper functions.
 *
 * Everything here is dependency-free and synchronous (no DB / no network) so it
 * can be unit-tested in isolation — the money-critical math (amount cap, deposit
 * total, gas coverage) and the refund state machine live here.
 */

export type RefundStatus =
  | "created"
  | "awaiting_deposit"
  | "deposit_detected"
  | "forwarding"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled";

/** Round to 8 decimal places (crypto precision), avoiding FP drift. */
export const round8 = (n: number): number =>
  toNumber((Number(n) + Number.EPSILON), 8);

/**
 * Chain metadata for every asset the checkout/sweep rails support.
 * `native`  → the refund asset is the chain's gas currency (gas deducts in-asset).
 * `token`   → the refund asset is a token; gas is paid in `gasSymbol` (native),
 *             fronted by the fee wallet on forwarding.
 * `walletType` is the value passed to merchantPool.reserveAddress.
 */
export interface ChainMeta {
  walletType: string; // reservation / wallet_type identifier
  asset: string; // human asset symbol
  gasSymbol: string; // native gas currency symbol
  kind: "native" | "token";
}

export const CHAIN_META: Record<string, ChainMeta> = {
  // ── UTXO (native) ──
  BTC: { walletType: "BTC", asset: "BTC", gasSymbol: "BTC", kind: "native" },
  LTC: { walletType: "LTC", asset: "LTC", gasSymbol: "LTC", kind: "native" },
  DOGE: { walletType: "DOGE", asset: "DOGE", gasSymbol: "DOGE", kind: "native" },
  BCH: { walletType: "BCH", asset: "BCH", gasSymbol: "BCH", kind: "native" },
  // ── EVM (native + tokens) ──
  ETH: { walletType: "ETH", asset: "ETH", gasSymbol: "ETH", kind: "native" },
  "USDT-ERC20": { walletType: "USDT-ERC20", asset: "USDT", gasSymbol: "ETH", kind: "token" },
  "USDC-ERC20": { walletType: "USDC-ERC20", asset: "USDC", gasSymbol: "ETH", kind: "token" },
  "RLUSD-ERC20": { walletType: "RLUSD-ERC20", asset: "RLUSD", gasSymbol: "ETH", kind: "token" },
  POLYGON: { walletType: "POLYGON", asset: "POL", gasSymbol: "POL", kind: "native" },
  "USDT-POLYGON": { walletType: "USDT-POLYGON", asset: "USDT", gasSymbol: "POL", kind: "token" },
  // ── TRON (native + token) ──
  TRX: { walletType: "TRX", asset: "TRX", gasSymbol: "TRX", kind: "native" },
  "USDT-TRC20": { walletType: "USDT-TRC20", asset: "USDT", gasSymbol: "TRX", kind: "token" },
  // ── Account-based ──
  SOL: { walletType: "SOL", asset: "SOL", gasSymbol: "SOL", kind: "native" },
  XRP: { walletType: "XRP", asset: "XRP", gasSymbol: "XRP", kind: "native" },
  RLUSD: { walletType: "RLUSD", asset: "RLUSD", gasSymbol: "XRP", kind: "token" },
};

/**
 * Normalize a raw chain/asset string (from a link/order/transaction) to a
 * canonical CHAIN_META key. Accepts things like "usdt_trc20", "USDT (TRON)",
 * "usdterc20", "btc", etc.
 */
export const normalizeChain = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  // Direct hit
  if (CHAIN_META[s]) return s;
  // Common alias normalisation: underscores -> hyphen
  const hyph = s.replace(/_/g, "-");
  if (CHAIN_META[hyph]) return hyph;
  // Collapsed forms e.g. USDTTRC20 -> USDT-TRC20
  const collapsed = hyph.replace(/-/g, "");
  const match = Object.keys(CHAIN_META).find(
    (k) => k.replace(/-/g, "") === collapsed
  );
  return match || null;
};

export const getChainMeta = (raw: string | null | undefined): ChainMeta | null => {
  const key = normalizeChain(raw);
  return key ? CHAIN_META[key] : null;
};

/**
 * Per-chain address FORMAT validators, keyed by the chain's native gas symbol
 * (which groups every asset on that chain — e.g. all ERC-20 tokens share ETH's
 * 0x… format, all TRC-20 tokens share Tron's T… format). These check format
 * only (prefix / length / charset); they CANNOT prove ownership or catch a
 * valid-but-mistyped address. The refund chain is locked to the original
 * payment, so the address must match that chain's format.
 */
const ADDRESS_VALIDATORS: Record<string, (a: string) => boolean> = {
  BTC: (a) => /^(bc1[a-z0-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(a),
  LTC: (a) => /^(ltc1[a-z0-9]{11,87}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(a),
  DOGE: (a) => /^D[1-9A-HJ-NP-Za-km-z]{25,39}$/.test(a),
  BCH: (a) => /^((bitcoincash:)?[qp][a-z0-9]{38,}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/i.test(a),
  ETH: (a) => /^0x[0-9a-fA-F]{40}$/.test(a),
  POL: (a) => /^0x[0-9a-fA-F]{40}$/.test(a),
  TRX: (a) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a),
  SOL: (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a),
  XRP: (a) => /^r[1-9A-HJ-NP-Za-km-z]{23,34}$/.test(a),
};

export interface AddressValidation {
  ok: boolean;
  error?: string;
}

/**
 * Validate that `address` is a well-formed address on the chain of `meta`.
 * The refund chain is LOCKED to the original payment — an ETH 0x… address is
 * rejected for a BTC refund, etc.
 */
export const validateChainAddress = (
  meta: ChainMeta,
  address: string | null | undefined
): AddressValidation => {
  const addr = String(address || "").trim();
  if (!addr) return { ok: false, error: "A customer refund address is required." };
  const validator = ADDRESS_VALIDATORS[meta.gasSymbol];
  if (!validator) {
    // Unknown family — permissive length fallback.
    return addr.length >= 12 && addr.length <= 255
      ? { ok: true }
      : { ok: false, error: "Refund address looks invalid." };
  }
  if (!validator(addr)) {
    return {
      ok: false,
      error: `That does not look like a valid ${meta.asset} address on the ${meta.walletType} network. The refund is locked to the original chain, so it must go to a ${meta.walletType} address.`,
    };
  }
  return { ok: true };
};

const EXPLORER_TX: Record<string, (t: string) => string> = {
  BTC: (t) => `https://mempool.space/tx/${t}`,
  LTC: (t) => `https://blockchair.com/litecoin/transaction/${t}`,
  DOGE: (t) => `https://blockchair.com/dogecoin/transaction/${t}`,
  BCH: (t) => `https://blockchair.com/bitcoin-cash/transaction/${t}`,
  ETH: (t) => `https://etherscan.io/tx/${t}`,
  POL: (t) => `https://polygonscan.com/tx/${t}`,
  TRX: (t) => `https://tronscan.org/#/transaction/${t}`,
  SOL: (t) => `https://solscan.io/tx/${t}`,
  XRP: (t) => `https://xrpscan.com/tx/${t}`,
};

/** Block-explorer URL for a tx on the chain of `meta` (null if txid/chain unknown). */
export const explorerTxUrl = (
  meta: ChainMeta,
  txid: string | null | undefined
): string | null => {
  const t = String(txid || "").trim();
  if (!t) return null;
  const fn = EXPLORER_TX[meta.gasSymbol];
  return fn ? fn(t) : null;
};

export interface AmountValidation {
  ok: boolean;
  amount: number;
  error?: string;
}

/**
 * Validate a requested refund amount against the original paid amount.
 * Single-refund policy: amount must be > 0 and <= original (custom/partial ok).
 */
export const validateRefundAmount = (
  requested: number | string,
  originalPaid: number | string
): AmountValidation => {
  const amt = round8(Number(requested));
  const cap = round8(Number(originalPaid));
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, amount: 0, error: "Refund amount must be greater than 0." };
  }
  if (!Number.isFinite(cap) || cap <= 0) {
    return { ok: false, amount: 0, error: "Original payment amount is unknown or zero." };
  }
  if (amt > cap) {
    return {
      ok: false,
      amount: 0,
      error: `Refund amount (${amt}) cannot exceed the amount paid (${cap}).`,
    };
  }
  return { ok: true, amount: amt };
};

export interface DepositPlan {
  depositAsset: string;
  depositAmount: number; // total the merchant must send in depositAsset
  gasCoverage: "in_asset" | "fee_wallet";
}

/**
 * Compute what the merchant deposits.
 *  - native asset: deposit = refund + gas (same asset), merchant covers gas in-asset.
 *  - token asset:  deposit = refund (token); gas fronted by the fee wallet (native),
 *                  tracked separately as gas_buffer for accounting.
 */
export const computeDepositPlan = (
  meta: ChainMeta,
  refundAmount: number,
  gasBufferNative: number
): DepositPlan => {
  if (meta.kind === "native") {
    return {
      depositAsset: meta.asset,
      depositAmount: round8(refundAmount + Math.max(0, gasBufferNative)),
      gasCoverage: "in_asset",
    };
  }
  return {
    depositAsset: meta.asset,
    depositAmount: round8(refundAmount),
    gasCoverage: "fee_wallet",
  };
};

/**
 * Conservative static gas buffers (native units) used as a FALLBACK when a live
 * fee estimate is unavailable (e.g. the preview has Binance/live probes off).
 * Generous by design — the merchant covers gas and the customer is made whole.
 */
export const STATIC_GAS_BUFFER_NATIVE: Record<string, number> = {
  BTC: 0.00005,
  LTC: 0.001,
  DOGE: 2,
  BCH: 0.00005,
  ETH: 0.0008,
  POL: 0.05,
  TRX: 30,
  SOL: 0.00005,
  XRP: 0.0002,
};

/** Allowed forward transitions for the refund state machine. */
const TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  created: ["awaiting_deposit", "cancelled", "failed"],
  awaiting_deposit: ["deposit_detected", "expired", "cancelled", "failed"],
  deposit_detected: ["forwarding", "failed"],
  forwarding: ["completed", "failed"],
  completed: [],
  failed: [],
  expired: [],
  cancelled: [],
};

export const canTransition = (from: RefundStatus, to: RefundStatus): boolean =>
  (TRANSITIONS[from] || []).includes(to);

/** Payment statuses that are eligible to start a refund. */
export const isRefundableOrderStatus = (status: string | null | undefined): boolean =>
  status === "paid" || status === "refund_requested";
