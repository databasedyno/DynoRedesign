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

/** Minutes after which a still-confirming payment counts as "needs action" (mirrors the backend window). */
export const NEEDS_ACTION_AFTER_MS = 60 * 60 * 1000;

/** Saved "Needs action" filter: underpaid, or money seen on-chain but confirming for over an hour. */
export const isNeedsAction = (bucket: TxStatusBucket, createdAtTs: number, now = Date.now()): boolean => {
  if (bucket === "underpaid") return true;
  if (bucket !== "processing" && bucket !== "confirmed" && bucket !== "pending") return false;
  return createdAtTs > 0 && now - createdAtTs > NEEDS_ACTION_AFTER_MS;
};
