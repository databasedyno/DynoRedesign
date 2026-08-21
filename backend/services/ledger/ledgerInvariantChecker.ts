/**
 * Ledger Invariant Checker (Tier-1 Item #3)
 *
 * Sweeps ledger entries in a rolling window and asserts:
 *   INVARIANT 1: For each currency, sum(DR) === sum(CR)           (global balance)
 *   INVARIANT 2: For each batch_id, sum(DR) === sum(CR) per cur   (per-batch balance)
 *
 * On drift:
 *   - Writes a `drift` row to tbl_ledger_invariant_checks
 *   - Emits a Slack alert (severity: high — could indicate a bug or DB tamper)
 *
 * Scheduled by `startLedgerInvariantChecker()` — runs every N minutes.
 * Only the WORKER_ROLE=primary node runs the cron.
 */

import LedgerEntry from "../../models/ledger/ledgerEntryModel";
import LedgerInvariantCheck from "../../models/ledger/ledgerInvariantModel";
import { cronLogger } from "../../utils/loggers";
import { sendAlertSafe } from "../slackAlertService";

const DEFAULT_WINDOW_HOURS = parseInt(process.env.LEDGER_INVARIANT_WINDOW_HOURS || "168", 10); // 7 days
const DEFAULT_INTERVAL_MIN = parseInt(process.env.LEDGER_INVARIANT_INTERVAL_MIN || "30", 10);

function addDec(a: string, b: string): string {
  const [ai, af = ""] = a.replace(/^-/, "").split(".");
  const [bi, bf = ""] = b.replace(/^-/, "").split(".");
  const scale = Math.max(af.length, bf.length);
  const na = BigInt((ai + af.padEnd(scale, "0")) || "0") * (a.startsWith("-") ? -1n : 1n);
  const nb = BigInt((bi + bf.padEnd(scale, "0")) || "0") * (b.startsWith("-") ? -1n : 1n);
  const sum = na + nb;
  const s = sum < 0n ? "-" + (-sum).toString() : sum.toString();
  if (scale === 0) return s;
  const neg = s.startsWith("-");
  const raw = neg ? s.slice(1) : s;
  const padded = raw.padStart(scale + 1, "0");
  return `${neg ? "-" : ""}${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
}
function isZero(a: string): boolean { return /^-?0(\.0+)?$/.test(a); }

export interface InvariantResult {
  status: "ok" | "drift" | "error";
  window_start: Date;
  window_end: Date;
  rows_scanned: number;
  batches_scanned: number;
  drift_by_currency: Record<string, string>;
  unbalanced_batches: string[];
  error_message?: string;
  duration_ms: number;
}

export async function runInvariantCheck(windowHours: number = DEFAULT_WINDOW_HOURS): Promise<InvariantResult> {
  const started = Date.now();
  const window_end = new Date();
  const window_start = new Date(window_end.getTime() - windowHours * 60 * 60 * 1000);

  const result: InvariantResult = {
    status: "ok",
    window_start,
    window_end,
    rows_scanned: 0,
    batches_scanned: 0,
    drift_by_currency: {},
    unbalanced_batches: [],
    duration_ms: 0,
  };

  try {
    const { Op } = require("sequelize");
    const rows = await LedgerEntry.findAll({
      where: { created_at: { [Op.gte]: window_start, [Op.lte]: window_end } },
      attributes: ["batch_id", "currency", "direction", "amount"],
      raw: true,
    }) as unknown as Array<{ batch_id: string; currency: string; direction: "DR" | "CR"; amount: string }>;

    result.rows_scanned = rows.length;

    // Invariant 1: global sum per currency
    const globalByCur: Record<string, string> = {};
    // Invariant 2: per-batch sum per currency
    const batchByCur: Record<string, Record<string, string>> = {};
    const batchIds = new Set<string>();

    for (const r of rows) {
      const signed = r.direction === "DR" ? r.amount : "-" + r.amount;
      globalByCur[r.currency] = addDec(globalByCur[r.currency] ?? "0", signed);
      if (!batchByCur[r.batch_id]) batchByCur[r.batch_id] = {};
      batchByCur[r.batch_id][r.currency] = addDec(batchByCur[r.batch_id][r.currency] ?? "0", signed);
      batchIds.add(r.batch_id);
    }

    result.batches_scanned = batchIds.size;

    for (const [cur, delta] of Object.entries(globalByCur)) {
      if (!isZero(delta)) result.drift_by_currency[cur] = delta;
    }
    for (const [bid, curs] of Object.entries(batchByCur)) {
      for (const [_cur, delta] of Object.entries(curs)) {
        if (!isZero(delta)) {
          result.unbalanced_batches.push(bid);
          break;
        }
      }
    }

    if (Object.keys(result.drift_by_currency).length > 0 || result.unbalanced_batches.length > 0) {
      result.status = "drift";
    }
  } catch (err) {
    result.status = "error";
    result.error_message = (err as Error).message;
  }

  result.duration_ms = Date.now() - started;

  // Persist and alert
  try {
    await LedgerInvariantCheck.create({
      status: result.status,
      window_start: result.window_start,
      window_end: result.window_end,
      rows_scanned: result.rows_scanned,
      batches_scanned: result.batches_scanned,
      drift_by_currency: Object.keys(result.drift_by_currency).length > 0 ? result.drift_by_currency : null,
      error_message: result.error_message ?? null,
      duration_ms: result.duration_ms,
      metadata: result.unbalanced_batches.length > 0 ? { unbalanced_batches: result.unbalanced_batches.slice(0, 20) } : null,
    });
  } catch (persistErr) {
    cronLogger.error(`[LedgerInvariant] Failed to persist check: ${(persistErr as Error).message}`);
  }

  if (result.status === "drift") {
    const driftSummary = Object.entries(result.drift_by_currency)
      .map(([c, d]) => `${c}: ${d}`)
      .join(", ");
    cronLogger.error(`[LedgerInvariant] ❌ DRIFT DETECTED — ${driftSummary} | ${result.unbalanced_batches.length} unbalanced batches`);
    try {
      await sendAlertSafe({
        severity: "critical",
        title: "Ledger Invariant Drift",
        message: `Ledger drift over ${windowHours}h — ${driftSummary || `${result.unbalanced_batches.length} unbalanced batches`}`,
        fields: {
          rows_scanned: String(result.rows_scanned),
          batches_scanned: String(result.batches_scanned),
          drift: driftSummary || "(none globally, but per-batch drift)",
          unbalanced_batches: String(result.unbalanced_batches.length),
        },
      });
    } catch (alertErr) {
      cronLogger.error(`[LedgerInvariant] Alert failed: ${(alertErr as Error).message}`);
    }
  } else if (result.status === "error") {
    cronLogger.error(`[LedgerInvariant] Check errored: ${result.error_message}`);
  } else {
    cronLogger.info(`[LedgerInvariant] ✅ OK — ${result.rows_scanned} rows, ${result.batches_scanned} batches in ${result.duration_ms}ms`);
  }

  return result;
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startLedgerInvariantChecker(): void {
  if (intervalHandle) return; // already started
  const intervalMs = DEFAULT_INTERVAL_MIN * 60 * 1000;
  cronLogger.info(`[LedgerInvariant] Scheduler started — every ${DEFAULT_INTERVAL_MIN}min, window ${DEFAULT_WINDOW_HOURS}h`);
  // Run once at boot (delayed so DB / models are ready)
  setTimeout(() => { void runInvariantCheck().catch((e) => cronLogger.error(`[LedgerInvariant] initial run failed: ${e.message}`)); }, 60_000);
  intervalHandle = setInterval(() => {
    void runInvariantCheck().catch((e) => cronLogger.error(`[LedgerInvariant] scheduled run failed: ${e.message}`));
  }, intervalMs);
}

export function stopLedgerInvariantChecker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export default { runInvariantCheck, startLedgerInvariantChecker, stopLedgerInvariantChecker };
