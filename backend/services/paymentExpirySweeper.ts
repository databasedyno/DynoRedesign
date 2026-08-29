/**
 * payment.expired sweeper (Tier-1 audit item #2).
 *
 * Payment-link expiry is COMPUTED (expires_at vs now), never written to the
 * status column, so there is no state transition to hang a webhook off. This
 * sweeper closes that gap: every run it looks at links that crossed expires_at
 * inside the lookback window, skips anything paid, and emits payment.expired
 * once per link (Redis dedup, 30-day TTL).
 *
 * Scope: hosted payment links. Direct-API crypto invoices live only in Redis
 * with a TTL, so they disappear rather than transition — documented limitation.
 *
 * Only companies subscribed to payment.expired are scanned (SQL-level jsonb
 * containment filter), so the sweep stays cheap and cannot surprise anyone.
 */

import { raw as envRaw } from "../utils/config";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { cronLogger } from "../utils/loggers";
import { PaymentState, parseState, persistTransition } from "./paymentStateMachine";
import { emitPaymentExpired } from "./webhookEvents";

export interface ExpirySweepResult {
  scanned: number;
  emitted: number;
  skipped_paid: number;
  skipped_not_emitted: number;
  errors: number;
}

const DEFAULT_LOOKBACK_MINUTES = Number(envRaw("PAYMENT_EXPIRED_LOOKBACK_MINUTES") || 180);

interface ExpiredLinkRow {
  link_id: number;
  transaction_id: string | null;
  company_id: number;
  status: string | null;
  expires_at: string;
  base_amount: number | null;
  base_currency: string | null;
  paid_amount: number | null;
  webhook_url: string | null;
  callback_url: string | null;
  webhook_secret: string | null;
  link_type: string | null;
}

export async function sweepExpiredPaymentLinks(
  opts: { lookbackMinutes?: number; limit?: number } = {}
): Promise<ExpirySweepResult> {
  const lookbackMinutes = opts.lookbackMinutes ?? DEFAULT_LOOKBACK_MINUTES;
  const limit = opts.limit ?? 200;
  const result: ExpirySweepResult = {
    scanned: 0,
    emitted: 0,
    skipped_paid: 0,
    skipped_not_emitted: 0,
    errors: 0,
  };

  const rows = (await sequelize.query(
    `SELECT l.link_id, l.transaction_id, l.company_id, l.status, l.expires_at,
            l.base_amount, l.base_currency, l.paid_amount, l.webhook_url, l.callback_url,
            l.link_type, c.webhook_secret
       FROM tbl_payment_link l
       JOIN tbl_company c ON c.company_id = l.company_id
      WHERE l.expires_at IS NOT NULL
        AND l.expires_at < NOW()
        AND l.expires_at > NOW() - (:lookbackMinutes * INTERVAL '1 minute')
        AND c.webhook_events @> '["payment.expired"]'::jsonb
      ORDER BY l.expires_at DESC
      LIMIT :limit`,
    { replacements: { lookbackMinutes, limit }, type: QueryTypes.SELECT }
  )) as ExpiredLinkRow[];

  for (const row of rows) {
    result.scanned++;

    const isPaid =
      parseState(row.status) === PaymentState.PAYOUT_COMPLETE || Number(row.paid_amount || 0) > 0;
    if (isPaid) {
      result.skipped_paid++;
      continue;
    }

    try {
      const emit = await emitPaymentExpired(
        {
          company_id: row.company_id,
          link_id: row.link_id,
          webhook_url: row.webhook_url,
          callback_url: row.callback_url,
          webhook_secret: row.webhook_secret,
        },
        {
          payment_id: row.transaction_id || `link-${row.link_id}`,
          link_id: row.link_id,
          base_amount: row.base_amount,
          base_currency: row.base_currency,
          link_type: row.link_type,
          expires_at: row.expires_at,
        }
      );
      if (emit.emitted) {
        result.emitted++;
        // AUDIT: journal the computed expiry as a real state transition
        await persistTransition({
          paymentId: row.transaction_id || `link-${row.link_id}`,
          from: PaymentState.PENDING,
          to: PaymentState.EXPIRED,
          event: "payment_expired",
          actor: "expiry_sweeper",
          currency: row.base_currency || null,
          amount: Number(row.base_amount) || null,
          companyId: row.company_id,
          metadata: { link_id: row.link_id, expires_at: row.expires_at },
        });
      } else {
        result.skipped_not_emitted++;
      }
    } catch (err) {
      result.errors++;
      cronLogger.error(`[ExpirySweeper] link ${row.link_id} failed: ${(err as Error).message}`);
    }
  }

  if (result.scanned > 0) {
    cronLogger.info(
      `[ExpirySweeper] scanned=${result.scanned} emitted=${result.emitted} ` +
        `paid=${result.skipped_paid} no_emit=${result.skipped_not_emitted} errors=${result.errors} ` +
        `lookback=${lookbackMinutes}m`
    );
  }
  return result;
}

export default { sweepExpiredPaymentLinks };
