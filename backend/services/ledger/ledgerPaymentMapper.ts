/**
 * Ledger Payment Mapper (Tier-1 Item #3)
 *
 * Translates payment lifecycle events into balanced double-entry postings.
 *
 * Standard postings:
 *
 *   1. payment_detected  (buyer sends to temp/pool address; DB confirms)
 *        DR buyer_escrow / CR merchant_payable      (net-of-fee)
 *        DR buyer_escrow / CR fee_revenue           (fee portion)
 *      (total buyer_escrow DR == receivedAmount + userAmount)
 *
 *   2. settlement_sent   (funds leave pool → merchant wallet & admin fee wallet)
 *        DR merchant_payable / CR buyer_escrow      (merchant payout leg)
 *        DR fee_revenue      / CR buyer_escrow      (admin fee leg)   [reduces liab]
 *      Optional gas leg (if platform-borne):
 *        DR gas_expense / CR buyer_escrow           (gas amount)
 *
 *   3. sweep_completed   (admin fees swept to fee wallet — no P&L change,
 *                        just accounting movement between accounts)
 *        DR fee_revenue / CR merchant_payable       (usually no-op if already flat)
 *      OR — if we treat "sweep" as an internal cash-management op (no ledger change),
 *      we may skip. Enabled/disabled by JOURNAL_EVENT_MAP.
 *
 * Amount inputs are in NATIVE crypto units (e.g. USDT tokens, BTC), so `currency`
 * on the ledger LINE is the crypto ticker.
 */

import { postDoubleEntry, PostResult } from "./ledgerService";
import { cronLogger } from "../../utils/loggers";

export interface SettlementMapInput {
  paymentId: string;
  companyId: number | null;
  currency: string;
  address: string;              // Pool/temp address
  settlementTxId: string;       // Outgoing TX
  merchantAmount: number | string;
  adminAmount: number | string;
  gasAmount?: number | string;  // If platform paid gas separately
  metadata?: Record<string, unknown>;
}

/**
 * Record a completed settlement in the ledger.
 * Idempotent per (paymentId, "settlement_sent").
 */
export async function recordSettlementCompleted(input: SettlementMapInput): Promise<PostResult> {
  const lines: Parameters<typeof postDoubleEntry>[0]["lines"] = [];
  const merchantAmt = String(input.merchantAmount ?? "0");
  const adminAmt = String(input.adminAmount ?? "0");
  const gasAmt = String(input.gasAmount ?? "0");

  // Merchant payout leg
  if (Number(merchantAmt) > 0) {
    lines.push({ account_code: "merchant_payable", direction: "DR", amount: merchantAmt, currency: input.currency });
    lines.push({ account_code: "buyer_escrow",     direction: "CR", amount: merchantAmt, currency: input.currency });
  }
  // Fee leg
  if (Number(adminAmt) > 0) {
    lines.push({ account_code: "fee_revenue",      direction: "DR", amount: adminAmt,    currency: input.currency });
    lines.push({ account_code: "buyer_escrow",     direction: "CR", amount: adminAmt,    currency: input.currency });
  }
  // Gas leg (optional — only when platform bears gas cost)
  if (Number(gasAmt) > 0) {
    lines.push({ account_code: "gas_expense",      direction: "DR", amount: gasAmt,      currency: input.currency });
    lines.push({ account_code: "buyer_escrow",     direction: "CR", amount: gasAmt,      currency: input.currency });
  }

  if (lines.length === 0) {
    cronLogger.warn(`[LedgerMap] settlement_sent for ${input.paymentId} has zero-amounts — skipping ledger post`);
    return { batch_id: "", posted: false, entries_created: 0 };
  }

  return postDoubleEntry({
    payment_id: input.paymentId,
    company_id: input.companyId,
    journal_event: "settlement_sent",
    dedup_key: input.settlementTxId || `no-tx-${input.paymentId}`,
    tx_id: input.settlementTxId,
    metadata: { address: input.address, ...(input.metadata || {}) },
    lines,
  });
}

export interface DetectionMapInput {
  paymentId: string;
  companyId: number | null;
  currency: string;
  address: string;
  txId: string;                        // Incoming buyer TX
  merchantAmount: number | string;     // Net to merchant
  adminAmount: number | string;        // Platform fee
  metadata?: Record<string, unknown>;
}

/**
 * Record a detected/confirmed incoming payment in the ledger.
 * Idempotent per (paymentId, "payment_detected", txId).
 */
export async function recordPaymentDetected(input: DetectionMapInput): Promise<PostResult> {
  const merchantAmt = String(input.merchantAmount ?? "0");
  const adminAmt = String(input.adminAmount ?? "0");

  const lines: Parameters<typeof postDoubleEntry>[0]["lines"] = [];
  if (Number(merchantAmt) > 0) {
    lines.push({ account_code: "buyer_escrow",     direction: "DR", amount: merchantAmt, currency: input.currency });
    lines.push({ account_code: "merchant_payable", direction: "CR", amount: merchantAmt, currency: input.currency });
  }
  if (Number(adminAmt) > 0) {
    lines.push({ account_code: "buyer_escrow",     direction: "DR", amount: adminAmt,    currency: input.currency });
    lines.push({ account_code: "fee_revenue",      direction: "CR", amount: adminAmt,    currency: input.currency });
  }

  if (lines.length === 0) {
    return { batch_id: "", posted: false, entries_created: 0 };
  }

  return postDoubleEntry({
    payment_id: input.paymentId,
    company_id: input.companyId,
    journal_event: "payment_detected",
    dedup_key: input.txId || `detected-${input.paymentId}`,
    tx_id: input.txId,
    metadata: { address: input.address, ...(input.metadata || {}) },
    lines,
  });
}

export default {
  recordSettlementCompleted,
  recordPaymentDetected,
};
