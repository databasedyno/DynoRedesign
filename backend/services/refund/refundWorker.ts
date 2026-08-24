/**
 * Phase C — Refund forwarding worker (PRODUCTION-only).
 *
 * Drives the refund state machine for REAL (non-dry-run) refunds:
 *   awaiting_deposit → deposit_detected → forwarding → completed
 * plus awaiting_deposit → expired on timeout, and → failed on error.
 *
 * SAFETY (never runs in the safe-mode preview):
 *   runRefundForwardingCycle() HARD-REFUSES (no-ops) unless
 *   ENABLE_CRYPTO_REFUNDS is on AND REFUND_DRY_RUN is off AND
 *   ENABLE_BACKGROUND_JOBS is on. It only ever touches is_dry_run=false rows.
 *
 * The two chain-specific operations below (detectDeposit / forwardToCustomer)
 * are the PRODUCTION INTEGRATION POINTS a staging engineer wires to the
 * existing sweep/KMS rails. Until wired they SAFELY no-op (leave the refund in
 * place + log) so enabling the flag can never move or lose funds.
 */
import { Op } from "sequelize";
import { config } from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import refundModel from "../../models/userModels/refundModel";
import { isRefundDryRun, isRefundsEnabled, transitionRefund } from "./refundService";
import { RefundStatus } from "./refundChains";

export interface RefundCycleStats {
  scanned: number;
  advanced: number;
  completed: number;
  failed: number;
  expired: number;
}

/**
 * PRODUCTION INTEGRATION POINT — detect a confirmed merchant deposit of
 * `merchant_deposit_total` at `dyno_deposit_address` on `chain`.
 * TODO(staging): query the chain / Tatum for the confirmed balance and return
 * { confirmed: true, txid } once the deposit lands with enough confirmations.
 */
const detectDeposit = async (
  refund: any
): Promise<{ confirmed: boolean; txid?: string }> => {
  apiLogger.warn(
    `[refundWorker] detectDeposit not wired — ${refund.dataValues.refund_id} stays awaiting_deposit`
  );
  return { confirmed: false };
};

/**
 * PRODUCTION INTEGRATION POINT — forward the refund to the customer.
 * TODO(staging): reuse the sweep/KMS rails to send `refund_amount` of `asset`
 * from `dyno_deposit_address` to `customer_refund_address` (the fee wallet
 * fronts gas for token chains). MUST be idempotent — if `forward_txid` already
 * exists, only re-check its confirmation, never re-send.
 */
const forwardToCustomer = async (
  refund: any
): Promise<{ sent: boolean; txid?: string }> => {
  apiLogger.warn(
    `[refundWorker] forwardToCustomer not wired — ${refund.dataValues.refund_id} stays forwarding`
  );
  return { sent: false };
};

const isExpired = (refund: any): boolean => {
  const exp = refund.dataValues.expires_at;
  return !!exp && new Date(exp).getTime() < Date.now();
};

/**
 * One forwarding cycle. Called by the leader cron. Returns per-cycle stats.
 * Hard-gated so it is a no-op anywhere the safety rails are on.
 */
export const runRefundForwardingCycle = async (): Promise<RefundCycleStats> => {
  const stats: RefundCycleStats = {
    scanned: 0,
    advanced: 0,
    completed: 0,
    failed: 0,
    expired: 0,
  };

  if (!isRefundsEnabled() || isRefundDryRun() || !config.bool("ENABLE_BACKGROUND_JOBS")) {
    return stats; // safe-mode preview / disabled → no-op
  }

  const rows: any[] = await refundModel.findAll({
    where: {
      is_dry_run: false,
      status: { [Op.in]: ["awaiting_deposit", "deposit_detected", "forwarding"] },
    },
    order: [["createdAt", "ASC"]],
    limit: 100,
  });
  stats.scanned = rows.length;

  for (const refund of rows) {
    const status = refund.dataValues.status as RefundStatus;
    try {
      if (status === "awaiting_deposit") {
        if (isExpired(refund)) {
          await transitionRefund(refund, "expired");
          stats.expired++;
          continue;
        }
        const dep = await detectDeposit(refund);
        if (dep.confirmed) {
          await transitionRefund(refund, "deposit_detected", {
            merchant_deposit_txid: dep.txid || null,
          });
          stats.advanced++;
        }
      } else if (status === "deposit_detected") {
        await transitionRefund(refund, "forwarding");
        const fwd = await forwardToCustomer(refund);
        if (fwd.sent) {
          await transitionRefund(refund, "completed", { forward_txid: fwd.txid || null });
          stats.completed++;
        } else {
          stats.advanced++;
        }
      } else if (status === "forwarding") {
        const fwd = await forwardToCustomer(refund);
        if (fwd.sent) {
          await transitionRefund(refund, "completed", { forward_txid: fwd.txid || null });
          stats.completed++;
        }
      }
    } catch (e: any) {
      apiLogger.error(
        `[refundWorker] ${refund.dataValues.refund_id} failed: ${e?.message || e}`
      );
      try {
        await transitionRefund(refund, "failed", {
          error: String(e?.message || e).slice(0, 1000),
        });
      } catch {
        /* transition guard — ignore */
      }
      stats.failed++;
    }
  }

  if (stats.advanced || stats.completed || stats.failed || stats.expired) {
    apiLogger.info(`[refundWorker] cycle ${JSON.stringify(stats)}`);
  }
  return stats;
};
