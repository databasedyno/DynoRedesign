/**
 * SafeDeal chain-hash sync
 *
 * A live cashout / deal payout is dispatched through the exchange (Binance withdraw API).
 * At dispatch time we only know the exchange's ORDER id, stored as tx_hash = "BINANCE-<id>"
 * — not something a user can look up. Minutes later the exchange broadcasts and the real
 * blockchain hash becomes available.
 *
 * Every few minutes this job:
 *   1. finds sent, non-simulated rows without a chain hash,
 *   2. asks the exchange's withdraw history for `sd-wd-<id>` → txId
 *      (TRON fallback: match the TRC-20 transfer on-chain by address / amount / time),
 *   3. stores chain_tx_hash + chain_confirmed_at, mirrors it onto the deal's payout_tx,
 *   4. emails the user "Cashout confirmed on-chain" with the hash + explorer link (once).
 *
 * Idempotent; safe to run concurrently with dispatch (rows are re-read each pass).
 */
import axios from "axios";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";
import { raw as envRaw } from "../../utils/config";
import { explorerTxUrl } from "../receiptLinkService";
import { tronGridHeaders } from "../tronEnergyService";
import { sendSafeDealCashoutConfirmedEmail } from "../email/safedealEmails";
import { cashoutEmailOptions, payoutKeyToCryptoCode, type WithdrawalRow } from "./safedealWithdrawals";
import { ESCROW_PAYOUT_OPTIONS } from "../escrow/escrowCosts";
import { isRealCustomerEmail } from "./safedealCheckout";
import { notifyCashoutConfirmed, notifyPendingCashouts } from "./safedealTelegram";

const MAX_ATTEMPTS = 300;              // ~25h at a 5-min cadence, then we stop asking (row keeps the exchange ref)
const LOOKBACK_DAYS = 14;
const TRON_FALLBACK_AFTER_ATTEMPTS = 3; // give the exchange ~15 min before matching on-chain ourselves
const TRONGRID_API = envRaw("TRONGRID_API_URL") || "https://api.trongrid.io";
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

type PendingRow = WithdrawalRow & { customer_email?: string | null; sent_at: string | Date | null };


/** What the exchange calls this payout: `sd-wd-<withdrawal_id>` (set at dispatch). */
const exchangeOrderId = (w: WithdrawalRow) => `sd-wd-${w.withdrawal_id}`;

async function lookupViaExchange(w: PendingRow): Promise<{ txId: string; completedAt: Date | null } | null> {
  const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === w.payout_key);
  if (!opt) return null;
  const binance = await import("../binanceService");
  const history = await binance.getWithdrawalHistory({
    coin: opt.coin,
    withdrawOrderId: exchangeOrderId(w),
    limit: 20,
  });
  const hit = history.find((h) => h.txId && String(h.txId).trim().length >= 20);
  if (!hit) return null;
  // Binance returns "0x…" style hashes for EVM, plain hex for TRON; occasionally suffixed with " Internal transfer …" for intra-exchange moves — strip anything after whitespace.
  const txId = String(hit.txId).trim().split(/\s+/)[0];
  return { txId, completedAt: hit.completeTime ? new Date(hit.completeTime) : null };
}

/**
 * TRON fallback: the recipient address received a USDT/USDC TRC-20 transfer of ~net amount
 * within a window after dispatch. Tolerates ±1% (USDT→USDC conversions) and rounding.
 */
async function lookupViaTronGrid(w: PendingRow): Promise<{ txId: string; completedAt: Date | null } | null> {
  if (!/-TRON$/i.test(w.payout_key)) return null;
  const sentAt = w.sent_at ? new Date(w.sent_at).getTime() : null;
  if (!sentAt) return null;
  const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === w.payout_key);
  const contract = opt?.coin === "USDT" ? USDT_TRC20_CONTRACT : undefined; // USDC-TRON is not offered; keep generic otherwise
  const res = await axios.get(`${TRONGRID_API}/v1/accounts/${w.address}/transactions/trc20`, {
    params: { only_to: true, limit: 50, min_timestamp: sentAt - 5 * 60_000, max_timestamp: sentAt + 6 * 3600_000, ...(contract ? { contract_address: contract } : {}) },
    headers: tronGridHeaders(),
    timeout: 10_000,
  });
  const net = Number(w.net_usd);
  const rows: Array<{ transaction_id: string; value: string; block_timestamp: number; token_info?: { decimals?: number; symbol?: string } }> = res.data?.data || [];
  const match = rows.find((t) => {
    const dec = Number(t.token_info?.decimals ?? 6);
    const amt = Number(t.value) / 10 ** dec;
    return Math.abs(amt - net) <= Math.max(0.02, net * 0.01);
  });
  return match ? { txId: match.transaction_id, completedAt: new Date(match.block_timestamp) } : null;
}

async function markConfirmed(w: PendingRow, found: { txId: string; completedAt: Date | null }, via: string): Promise<void> {
  await sequelize.query(
    `UPDATE tbl_customer_withdrawal
        SET chain_tx_hash = :hash, chain_confirmed_at = COALESCE(:at, NOW()), chain_sync_attempts = chain_sync_attempts + 1, updated_at = NOW()
      WHERE withdrawal_id = :id AND chain_tx_hash IS NULL`,
    { replacements: { hash: found.txId, at: found.completedAt, id: w.withdrawal_id } }
  );
  // Mirror onto the deal so the deal page can link the real transaction instead of the exchange ref.
  if (w.source === "settlement" && w.escrow_id && w.tx_hash) {
    await sequelize.query(
      `UPDATE tbl_escrow_deal
          SET seller_payout_tx = CASE WHEN seller_payout_tx = :ref THEN :hash ELSE seller_payout_tx END,
              buyer_payout_tx  = CASE WHEN buyer_payout_tx  = :ref THEN :hash ELSE buyer_payout_tx  END
        WHERE escrow_id = :eid`,
      { replacements: { ref: w.tx_hash, hash: found.txId, eid: w.escrow_id } }
    );
  }
  apiLogger.info(`[SafeDealChainSync] ✅ ${w.source === "settlement" ? "deal payout" : "cashout"} #${w.withdrawal_id} confirmed on-chain via ${via}: ${found.txId}`);
  await emailConfirmation({ ...w, chain_tx_hash: found.txId, chain_confirmed_at: found.completedAt });
  await notifyCashoutConfirmed({ ...w, chain_tx_hash: found.txId, chain_confirmed_at: found.completedAt });
}

/** Send the "confirmed on-chain" email; stamps chain_hash_emailed_at only when the mail really left. */
async function emailConfirmation(w: PendingRow): Promise<void> {
  if (!w.chain_tx_hash || !isRealCustomerEmail(w.customer_email)) return;
  try {
    const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === w.payout_key);
    const opts = await cashoutEmailOptions(w);
    const info = (await sendSafeDealCashoutConfirmedEmail(
      w.customer_email as string,
      w,
      opt?.label || w.payout_key,
      { txHash: w.chain_tx_hash, explorerUrl: explorerTxUrl(payoutKeyToCryptoCode(w.payout_key), w.chain_tx_hash), confirmedAt: w.chain_confirmed_at ?? null },
      opts
    )) as { suppressed?: boolean } | undefined;
    // Preview pods suppress outbound email — leave the stamp empty so production sends it later.
    if (!info?.suppressed) {
      await sequelize.query(`UPDATE tbl_customer_withdrawal SET chain_hash_emailed_at = NOW() WHERE withdrawal_id = :id`, { replacements: { id: w.withdrawal_id } });
    }
  } catch (e) {
    apiLogger.warn(`[SafeDealChainSync] confirmation email failed for #${w.withdrawal_id}: ${(e as Error).message}`);
  }
}

/** Catch-up: hashes that were stored but whose confirmation email never left (suppressed / transient failure). */
async function emailPendingConfirmations(limit = 20): Promise<number> {
  const rows = await sequelize.query<PendingRow>(
    `SELECT w.*, c.email AS customer_email
       FROM tbl_customer_withdrawal w
       LEFT JOIN tbl_customer c ON c.customer_id = w.customer_id
      WHERE w.chain_tx_hash IS NOT NULL
        AND w.chain_hash_emailed_at IS NULL
        AND w.simulated = false
        AND COALESCE(w.chain_confirmed_at, w.sent_at, w.created_at) > NOW() - INTERVAL '7 days'
      ORDER BY w.withdrawal_id ASC
      LIMIT :limit`,
    { replacements: { limit }, type: QueryTypes.SELECT }
  );
  for (const w of rows) await emailConfirmation(w);
  return rows.length;
}

export interface ChainSyncResult { scanned: number; confirmed: number; pending: number; errors: number }

/** One pass. Returns counts; never throws (each row is isolated). */
export async function syncCashoutChainHashes(limit = 50): Promise<ChainSyncResult> {
  const rows = await sequelize.query<PendingRow>(
    `SELECT w.*, c.email AS customer_email
       FROM tbl_customer_withdrawal w
       LEFT JOIN tbl_customer c ON c.customer_id = w.customer_id
      WHERE w.status = 'sent'
        AND w.simulated = false
        AND w.chain_tx_hash IS NULL
        AND w.tx_hash LIKE 'BINANCE-%'
        AND COALESCE(w.sent_at, w.created_at) > NOW() - INTERVAL '${LOOKBACK_DAYS} days'
        AND COALESCE(w.chain_sync_attempts, 0) < :max
      ORDER BY COALESCE(w.sent_at, w.created_at) ASC
      LIMIT :limit`,
    { replacements: { max: MAX_ATTEMPTS, limit }, type: QueryTypes.SELECT }
  );
  const result: ChainSyncResult = { scanned: rows.length, confirmed: 0, pending: 0, errors: 0 };
  for (const w of rows) {
    try {
      let found: { txId: string; completedAt: Date | null } | null = null;
      let via = "exchange";
      try {
        found = await lookupViaExchange(w);
      } catch (e) {
        apiLogger.warn(`[SafeDealChainSync] exchange lookup failed for #${w.withdrawal_id}: ${(e as Error).message}`);
      }
      if (!found && Number(w.chain_sync_attempts || 0) >= TRON_FALLBACK_AFTER_ATTEMPTS) {
        try {
          found = await lookupViaTronGrid(w);
          via = "trongrid";
        } catch (e) {
          apiLogger.warn(`[SafeDealChainSync] TronGrid lookup failed for #${w.withdrawal_id}: ${(e as Error).message}`);
        }
      }
      if (found) {
        await markConfirmed(w, found, via);
        result.confirmed++;
      } else {
        await sequelize.query(`UPDATE tbl_customer_withdrawal SET chain_sync_attempts = COALESCE(chain_sync_attempts, 0) + 1 WHERE withdrawal_id = :id`, { replacements: { id: w.withdrawal_id } });
        result.pending++;
      }
    } catch (e) {
      result.errors++;
      apiLogger.error(`[SafeDealChainSync] row #${w.withdrawal_id} failed: ${(e as Error).message}`);
    }
  }
  try {
    await emailPendingConfirmations();
  } catch (e) {
    apiLogger.warn(`[SafeDealChainSync] catch-up emails failed: ${(e as Error).message}`);
  }
  try {
    await notifyPendingCashouts();
  } catch (e) {
    apiLogger.warn(`[SafeDealChainSync] catch-up Telegram notices failed: ${(e as Error).message}`);
  }
  if (result.scanned) apiLogger.info(`[SafeDealChainSync] scanned ${result.scanned} · confirmed ${result.confirmed} · still pending ${result.pending} · errors ${result.errors}`);
  return result;
}
