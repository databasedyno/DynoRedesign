/**
 * Ledger Backfill Service (Tier-1 Item #3)
 *
 * One-shot script to seed the double-entry ledger from existing paymentJournal
 * events. Idempotent — safe to run multiple times (relies on postDoubleEntry's
 * (payment_id, journal_event, dedup_key) dedup index).
 *
 * Supported source events:
 *   - "settlement_sent"   → recordSettlementCompleted() from journal metadata
 *
 * Skips events with insufficient metadata (logs a warning).
 *
 * Called via CLI: `yarn ts-node scripts/backfillLedger.ts` (or admin endpoint).
 */

import PaymentJournal from "../../models/paymentJournalModel";
import { recordSettlementCompleted } from "./ledgerPaymentMapper";
import { cronLogger } from "../../utils/loggers";

export interface BackfillOptions {
  limit?: number;
  since?: Date;
  dryRun?: boolean;
}

export interface BackfillResult {
  scanned: number;
  posted: number;
  skipped_dedup: number;
  skipped_no_metadata: number;
  errors: number;
  error_samples: string[];
}

export async function backfillLedgerFromJournal(opts: BackfillOptions = {}): Promise<BackfillResult> {
  const result: BackfillResult = {
    scanned: 0,
    posted: 0,
    skipped_dedup: 0,
    skipped_no_metadata: 0,
    errors: 0,
    error_samples: [],
  };

  const { Op } = require("sequelize");
  const where: Record<string, unknown> = { event: "settlement_sent" };
  if (opts.since) where.created_at = { [Op.gte]: opts.since };

  const rows = await PaymentJournal.findAll({
    where: where as never,
    order: [["created_at", "ASC"]],
    limit: opts.limit ?? 5000,
  });

  result.scanned = rows.length;

  for (const row of rows) {
    const meta = row.metadata as Record<string, unknown> | null;
    const merchantAmt = meta && typeof meta.merchant_amount !== "undefined" ? meta.merchant_amount : null;
    const adminAmt = meta && typeof meta.admin_amount !== "undefined" ? meta.admin_amount : null;
    if (merchantAmt === null && adminAmt === null) {
      result.skipped_no_metadata++;
      continue;
    }

    if (opts.dryRun) {
      result.posted++;
      continue;
    }

    try {
      const post = await recordSettlementCompleted({
        paymentId: row.payment_id,
        companyId: row.company_id,
        currency: row.currency,
        address: row.address,
        settlementTxId: row.settlement_tx_id || `journal-${row.id}`,
        merchantAmount: Number(merchantAmt || 0),
        adminAmount: Number(adminAmt || 0),
        metadata: { backfilled_from: "paymentJournal", journal_id: row.id, journal_created_at: row.created_at },
      });
      if (post.posted) result.posted++;
      else result.skipped_dedup++;
    } catch (err) {
      result.errors++;
      if (result.error_samples.length < 5) {
        result.error_samples.push(`journal_id=${row.id}: ${(err as Error).message}`);
      }
    }
  }

  cronLogger.info(
    `[LedgerBackfill] scanned=${result.scanned} posted=${result.posted} ` +
    `dedup=${result.skipped_dedup} no_meta=${result.skipped_no_metadata} errors=${result.errors} ` +
    `dryRun=${!!opts.dryRun}`
  );
  return result;
}

export default { backfillLedgerFromJournal };
