import { formatDateI18n } from "@/utils/formatDate";
import { SUCCESS_GREEN, WARNING_AMBER, ERROR_RED } from "@/constants/theme";
import { toFixedStr } from "@/utils/money";

export interface SettlementOption {
  currency?: string;
  chain?: string;
  wallet_type?: string;
  wallet_address?: string;
}

/** Shared card surface passed down from the page so every section matches. */
export type CardSx = {
  borderRadius: number;
  border: string;
  bgcolor: string;
  p: { xs: number; sm: number };
};

export const STABLECOIN_LABELS: Record<string, string> = {
  usdt_trc20: "USDT (TRC-20)",
  usdt_erc20: "USDT (ERC-20)",
  usdc_erc20: "USDC (ERC-20)",
  "USDT-TRC20": "USDT (TRC-20)",
  "USDT-ERC20": "USDT (ERC-20)",
  "USDC-ERC20": "USDC (ERC-20)",
  "USDT-POLYGON": "USDT (Polygon)",
};

export const maskAddr = (a?: string) =>
  !a ? "\u2014" : a.length <= 12 ? a : `${a.slice(0, 6)}\u2026${a.slice(-4)}`;

// API-originated payments have no real customer email — the backend mints a
// synthetic placeholder (legacy-api-…@dynopay.internal etc). Never surface those.
const isInternalEmail = (v?: string) => {
  if (!v) return false;
  const s = String(v).toLowerCase();
  return (
    s.endsWith("@dynopay.internal") ||
    s.endsWith("@dynopay.local") ||
    s.startsWith("legacy-api-") ||
    s.startsWith("pk-buyer-") ||
    s.startsWith("elements-buyer-") ||
    s.startsWith("recovered-")
  );
};

const SOURCE_LABEL: Record<string, string> = {
  api: "API payment",
  payment_link: "Payment link",
  tip: "Tip",
  product: "Store order",
  contribution: "Donation",
  direct: "Direct payment",
};

// A human-friendly payer label: prefer a real name/email, otherwise fall back to
// the payment source (never the synthetic internal email).
export const payerLabel = (tx: any): string => {
  const name = (tx?.customer_name || "").toString().trim();
  const email = (tx?.customer_email || tx?.customerEmail || "").toString().trim();
  if (email && !isInternalEmail(email)) return name || email;
  if (name && !isInternalEmail(name)) return name;
  const type = tx?.source?.type;
  if (type && SOURCE_LABEL[type]) return SOURCE_LABEL[type];
  return isInternalEmail(email) ? "API payment" : "";
};

// Amount + single ticker (e.g. "0.016338 ETH"). base_currency and crypto_currency
// are usually identical, so show the ticker exactly once.
export const amountLabel = (tx: any, fallbackSym: string): string => {
  const amount = tx?.base_amount ?? tx?.amount;
  if (amount == null) return "\u2014";
  const ticker =
    tx?.crypto_currency ||
    tx?.cryptocurrency ||
    tx?.wallet_type ||
    tx?.base_currency ||
    tx?.currency ||
    fallbackSym;
  return `${amount} ${ticker}`.trim();
};

// Fiat equivalent from the stored usd_value (same convention as /transactions:
// only shown when the backend has an actual stored value — never a live
// client-side conversion, and never for unvalued pending rows).
export const fiatLabel = (tx: any): string | null => {
  const v = Number(tx?.usd_value) || 0;
  if (v <= 0) return null;
  if (v >= 1)
    return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (v >= 0.01) return `$${toFixedStr(v, 4).replace(/0+$/, "").replace(/\.$/, ".00")}`;
  return `$${toFixedStr(v, 6).replace(/0+$/, "").replace(/\.$/, ".00")}`;
};

// Coin code a settlement row belongs to → deep-link into /transactions?wallet=CODE (plan 2.6).
export const coinOf = (tx: any): string | null => {
  const c = tx?.crypto_currency || tx?.crypto || tx?.base_currency;
  return c ? String(c).toUpperCase() : null;
};

/** Router target for a pending / settled row (plan 2.6 deep link). */
export const coinTransactionsHref = (tx: any) => ({
  pathname: "/transactions",
  query: coinOf(tx) ? { wallet: coinOf(tx) } : {},
});

export const formatDate = (v?: string) => {
  if (!v) return "";
  return formatDateI18n(v, { month: "short", day: "numeric", year: "numeric" });
};

export const statusMeta = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (["complete", "success", "settled", "confirmed", "paid"].some((k) => s.includes(k)))
    return { label: status || "Settled", color: SUCCESS_GREEN };
  if (["pending", "processing", "awaiting", "confirming"].some((k) => s.includes(k)))
    return { label: status || "Pending", color: WARNING_AMBER };
  if (["fail", "expire", "cancel", "error"].some((k) => s.includes(k)))
    return { label: status || "Failed", color: ERROR_RED };
  return { label: status || "\u2014", color: WARNING_AMBER };
};

// Matches the backend UNPAID_AFTER_MINUTES payment window — a fresh 'pending'
// row auto-expires (shown as 'unpaid') after this many minutes.
const PAYMENT_WINDOW_MIN = 60;
export const minutesLeftToConfirm = (v?: string) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return null;
  const left = PAYMENT_WINDOW_MIN - Math.floor((Date.now() - t) / 60000);
  return left > 0 ? left : null;
};

export const RANGE_PRESETS: { value: string; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
  { value: "custom", label: "Custom range\u2026" },
];

export const fmtUsd = (n: number) =>
  `$${(Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
