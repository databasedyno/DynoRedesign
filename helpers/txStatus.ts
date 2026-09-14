import type { StatusTone } from "@/Components/UI/StatusDot";

/**
 * The 7 merchant-facing transaction statuses — ONE bucket map used by the
 * dashboard, tables, detail drawers, notifications and the status chip, so a
 * raw backend status always lands on the same label + colour everywhere.
 */
export const TX_STATUS_BUCKETS = [
  "settled",
  "confirmed",
  "processing",
  "underpaid",
  "pending",
  "awaiting_payment",
  "unpaid",
  "failed",
] as const;

export type TxStatusBucket = (typeof TX_STATUS_BUCKETS)[number];

const SETTLED = new Set([
  "settled",
  "success",
  "successful",
  "completed",
  "payout_complete",
  "converted",
  "recovered",
  "done",
  "paid",
]);
const FAILED = new Set(["failed", "expired", "refunded", "settlement_failed", "cancelled"]);

export const toTxStatusBucket = (raw: unknown): TxStatusBucket => {
  const s = String(raw ?? "").toLowerCase().trim();
  if (SETTLED.has(s)) return "settled";
  if (s === "confirmed") return "confirmed";
  if (s === "processing" || s === "confirming") return "processing";
  if (s === "underpaid" || s === "partial" || s === "partially_paid") return "underpaid";
  if (s === "unpaid") return "unpaid";
  if (s === "awaiting_payment" || s === "awaiting") return "awaiting_payment";
  if (FAILED.has(s)) return "failed";
  return "pending";
};

/** Bucket → StatusDot tone. Filled = money seen on-chain; hollow = nothing received yet. */
export const TX_STATUS_TONE: Record<TxStatusBucket, StatusTone> = {
  settled: "settled",
  confirmed: "info",
  processing: "pending",
  underpaid: "underpaid",
  pending: "pending",
  awaiting_payment: "awaiting",
  unpaid: "unpaid",
  failed: "failed",
};

export const txStatusTone = (raw: unknown): StatusTone =>
  TX_STATUS_TONE[toTxStatusBucket(raw)];
