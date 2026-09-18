/**
 * Shared escrow UI helpers — status tone/label mapping, money formatting,
 * coin lists and small role/derivation utilities. Kept framework-light so both
 * the merchant, public-invite and admin surfaces reuse the exact same rules.
 */
import {
  BRAND_ACCENT,
  BRAND_ACCENT_LIGHT,
  SUCCESS_GREEN,
  SUCCESS_GREEN_LIGHT,
  ERROR_RED,
  ERROR_RED_LIGHT,
  WARNING_AMBER,
  WARNING_AMBER_LIGHT,
} from "@/constants/theme";
import type { EscrowDeal } from "@/api/escrow";

export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "error" | "purple";

const PURPLE = "#7C3AED";
const PURPLE_LIGHT = "#A78BFA";
const INFO_BLUE = "#2563EB";
const INFO_BLUE_LIGHT = "#60A5FA";

export const STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  invited: "brand",
  declined: "neutral",
  awaiting_payment: "warning",
  funded: "info",
  delivered: "brand",
  disputed: "error",
  completed: "success",
  refunded: "info",
  split: "purple",
  cancelled: "neutral",
  expired: "neutral",
};

export function toneColors(tone: Tone, isDark: boolean): { fg: string; bg: string; border: string } {
  const pick = (light: string, dark: string) => (isDark ? dark : light);
  switch (tone) {
    case "brand":
      return { fg: pick(BRAND_ACCENT, BRAND_ACCENT_LIGHT), bg: pick("#EEF2FF", "rgba(129,140,248,0.14)"), border: pick("#C7D2FE", "rgba(129,140,248,0.35)") };
    case "info":
      return { fg: pick(INFO_BLUE, INFO_BLUE_LIGHT), bg: pick("#EFF6FF", "rgba(96,165,250,0.14)"), border: pick("#BFDBFE", "rgba(96,165,250,0.35)") };
    case "success":
      return { fg: pick(SUCCESS_GREEN, SUCCESS_GREEN_LIGHT), bg: pick("#ECFDF3", "rgba(63,217,138,0.14)"), border: pick("#A6F4C5", "rgba(63,217,138,0.35)") };
    case "warning":
      return { fg: pick(WARNING_AMBER, WARNING_AMBER_LIGHT), bg: pick("#FFFAEB", "rgba(251,191,36,0.14)"), border: pick("#FEDF89", "rgba(251,191,36,0.35)") };
    case "error":
      return { fg: pick(ERROR_RED, ERROR_RED_LIGHT), bg: pick("#FEF3F2", "rgba(255,107,107,0.14)"), border: pick("#FECDCA", "rgba(255,107,107,0.35)") };
    case "purple":
      return { fg: pick(PURPLE, PURPLE_LIGHT), bg: pick("#F5F3FF", "rgba(167,139,250,0.14)"), border: pick("#DDD6FE", "rgba(167,139,250,0.35)") };
    case "neutral":
    default:
      return { fg: pick("#475467", "#98A2B3"), bg: pick("#F2F4F7", "rgba(152,162,179,0.12)"), border: pick("#E4E7EC", "rgba(152,162,179,0.3)") };
  }
}

export const STATUS_LABEL_FRIENDLY: Record<string, string> = {
  draft: "Draft",
  invited: "Invited",
  declined: "Declined",
  awaiting_payment: "Awaiting payment",
  funded: "Funded",
  delivered: "Delivered",
  disputed: "Disputed",
  completed: "Completed",
  refunded: "Refunded",
  split: "Split resolved",
  cancelled: "Cancelled",
  expired: "Expired",
};

/**
 * The human label. The backend's `status_label` already carries the payout
 * phase suffix (e.g. "Completed — payout pending"); keep that when present,
 * otherwise use a friendly base label instead of the raw snake_case status.
 */
export function statusLabel(deal: Pick<EscrowDeal, "status" | "status_label">): string {
  if (deal.status_label && deal.status_label.includes("—")) return deal.status_label;
  return STATUS_LABEL_FRIENDLY[deal.status] || titleize(deal.status_label || deal.status);
}

export function statusTone(status: string): Tone {
  return STATUS_TONE[status] || "neutral";
}

export function titleize(s?: string): string {
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a fiat amount for the deal's display currency. */
export function money(amount?: number | null, currency = "USD"): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "USD").toUpperCase() }).format(Number(amount));
  } catch {
    return `${Number(amount).toFixed(2)} ${(currency || "USD").toUpperCase()}`;
  }
}

/** Stablecoin amount (no fiat symbol) with the coin suffix. */
export function stable(amount?: number | null, coin?: string | null): string {
  if (amount == null) return "—";
  return `${Number(amount).toFixed(2)} ${coin || "USDT-TRON"}`;
}

export const FUNDING_COINS = ["BTC", "ETH", "USDT-TRON", "USDT-ERC20", "USDC", "LTC", "SOL", "XRP"] as const;
export const PAYOUT_STABLECOINS = ["USDT-TRON", "USDC"] as const;

export function shortDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

export function relativeDays(iso?: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.round(ms / 86400000);
  if (Number.isNaN(days)) return "";
  if (days === 0) return "today";
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
}

/** Payout-leg state → tone + label. */
export function legTone(state?: string | null): Tone {
  switch (state) {
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "retrying":
      return "error";
    default:
      return "neutral";
  }
}
