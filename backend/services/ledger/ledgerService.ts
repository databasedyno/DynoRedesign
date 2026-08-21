/**
 * Ledger Service — Double-Entry Postings, Balances, Reversals (Tier-1 Item #3)
 *
 * Public API:
 *   - postDoubleEntry(batch): atomically writes ≥2 balanced lines; idempotent
 *   - reverseBatch(batch_id, reason): posts an opposite-direction batch
 *   - getBalances(filter): DR/CR sums grouped by account+currency
 *   - getPaymentLedger(payment_id): timeline of all entries for a payment
 *
 * Invariants enforced at post time:
 *   1. lines.length ≥ 2
 *   2. For each currency, sum(DR) === sum(CR) (checked with DECIMAL string math)
 *   3. All account_codes reference active accounts
 *   4. Idempotency: same (payment_id, journal_event, dedup_key) → no-op, returns
 *      the existing batch_id
 *
 * Concurrency: relies on the unique index
 *   (payment_id, journal_event, dedup_key, account_code, direction)
 * to prevent duplicate postings. A race between two concurrent posters of the
 * same batch turns into a DB unique-violation, which we catch and treat as
 * "already posted" — idempotency without needing SERIALIZABLE.
 */

import { randomUUID } from "crypto";
import LedgerEntry, { Direction } from "../../models/ledger/ledgerEntryModel";
import LedgerAccount from "../../models/ledger/ledgerAccountModel";
import { cronLogger } from "../../utils/loggers";

// ─── Decimal helpers (avoid float loss; PG DECIMAL round-trip) ────────────────

function toDec(n: number | string): string {
  if (typeof n === "number") {
    if (!Number.isFinite(n)) throw new Error(`Ledger amount is not finite: ${n}`);
    return n.toFixed(12);
  }
  const trimmed = String(n).trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) throw new Error(`Ledger amount not decimal: ${n}`);
  return trimmed;
}

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
  const intPart = padded.slice(0, -scale);
  const fracPart = padded.slice(-scale);
  return `${neg ? "-" : ""}${intPart}.${fracPart}`;
}

function isZero(a: string): boolean {
  return /^-?0(\.0+)?$/.test(a);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LedgerLineInput {
  account_code: string;
  direction: Direction;
  amount: number | string;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface PostBatchInput {
  payment_id: string | null;
  company_id?: number | null;
  journal_event: string;                 // e.g. "settlement_sent", "sweep_completed"
  dedup_key: string;                     // Idempotency token unique per business event
  tx_id?: string | null;
  reversal_of?: string | null;
  metadata?: Record<string, unknown>;
  lines: LedgerLineInput[];
}

export interface PostResult {
  batch_id: string;
  posted: boolean;                       // false = already existed (idempotent)
  entries_created: number;
}

const KNOWN_ACCOUNTS = new Set<string>();

async function loadKnownAccounts(force = false): Promise<void> {
  if (!force && KNOWN_ACCOUNTS.size > 0) return;
  const rows = await LedgerAccount.findAll({ attributes: ["code", "is_active"] });
  KNOWN_ACCOUNTS.clear();
  for (const r of rows) if (r.is_active) KNOWN_ACCOUNTS.add(r.code);
}

// ─── postDoubleEntry ──────────────────────────────────────────────────────────

export async function postDoubleEntry(input: PostBatchInput): Promise<PostResult> {
  if (!input.lines || input.lines.length < 2) {
    throw new Error(`Ledger batch requires ≥2 lines (got ${input.lines?.length || 0})`);
  }
  if (!input.journal_event) throw new Error("journal_event required");
  if (!input.dedup_key) throw new Error("dedup_key required (idempotency)");

  // Validate accounts exist & active
  await loadKnownAccounts();
  for (const l of input.lines) {
    if (!KNOWN_ACCOUNTS.has(l.account_code)) {
      // Re-load in case a new account was just seeded
      await loadKnownAccounts(true);
      if (!KNOWN_ACCOUNTS.has(l.account_code)) {
        throw new Error(`Unknown or inactive ledger account: ${l.account_code}`);
      }
    }
    if (l.direction !== "DR" && l.direction !== "CR") {
      throw new Error(`Line direction must be DR or CR, got ${l.direction}`);
    }
  }

  // Balance check per currency: DR - CR === 0
  const byCurrency: Record<string, string> = {};
  for (const l of input.lines) {
    const amt = toDec(l.amount);
    if (amt.startsWith("-")) throw new Error(`Ledger amount must be positive (got ${l.amount}); use direction`);
    if (isZero(amt)) throw new Error(`Ledger amount must be non-zero`);
    const signed = l.direction === "DR" ? amt : "-" + amt;
    byCurrency[l.currency] = addDec(byCurrency[l.currency] ?? "0", signed);
  }
  for (const [cur, delta] of Object.entries(byCurrency)) {
    if (!isZero(delta)) {
      throw new Error(`Unbalanced ledger batch: currency ${cur} DR-CR = ${delta}`);
    }
  }

  // Idempotency short-circuit: if any row with (payment_id, journal_event, dedup_key)
  // exists, return the existing batch_id. The unique index also enforces this at DB level.
  if (input.payment_id) {
    const existing = await LedgerEntry.findOne({
      where: {
        payment_id: input.payment_id,
        journal_event: input.journal_event,
        dedup_key: input.dedup_key,
      },
      attributes: ["batch_id"],
    });
    if (existing) {
      return { batch_id: existing.batch_id, posted: false, entries_created: 0 };
    }
  }

  const batchId = randomUUID();
  const now = new Date();

  const rows = input.lines.map((l, idx) => ({
    batch_id: batchId,
    line_index: idx,
    account_code: l.account_code,
    direction: l.direction,
    amount: toDec(l.amount),
    currency: l.currency,
    payment_id: input.payment_id,
    company_id: input.company_id ?? null,
    journal_event: input.journal_event,
    tx_id: input.tx_id ?? null,
    dedup_key: input.dedup_key,
    reversal_of: input.reversal_of ?? null,
    metadata: { ...(input.metadata || {}), ...(l.metadata || {}) },
    created_at: now,
  }));

  try {
    // Single-statement atomic multi-row INSERT — either all rows commit or none.
    // The unique index (payment_id, journal_event, dedup_key, account_code, direction)
    // provides idempotency at the DB level.
    await LedgerEntry.bulkCreate(rows as never);
  } catch (err: unknown) {
    const msg = (err as Error).message || "";
    // Race with a concurrent poster of the exact same batch — treat as success (idempotent)
    if (/tbl_ledger_entries_dedup_uniq|unique constraint|duplicate key/i.test(msg) && input.payment_id) {
      const existing = await LedgerEntry.findOne({
        where: {
          payment_id: input.payment_id,
          journal_event: input.journal_event,
          dedup_key: input.dedup_key,
        },
        attributes: ["batch_id"],
      });
      if (existing) return { batch_id: existing.batch_id, posted: false, entries_created: 0 };
    }
    throw err;
  }

  return { batch_id: batchId, posted: true, entries_created: input.lines.length };
}

// ─── reverseBatch ─────────────────────────────────────────────────────────────

export async function reverseBatch(batchId: string, reason: string): Promise<PostResult> {
  const original = await LedgerEntry.findAll({ where: { batch_id: batchId } });
  if (original.length === 0) throw new Error(`Batch not found: ${batchId}`);
  if (original.some((e) => e.reversal_of === batchId)) {
    throw new Error(`Batch already reversed: ${batchId}`);
  }
  const anchor = original[0];
  return postDoubleEntry({
    payment_id: anchor.payment_id,
    company_id: anchor.company_id,
    journal_event: `${anchor.journal_event}_reversal`,
    dedup_key: `reversal_${batchId}`,
    tx_id: anchor.tx_id,
    reversal_of: batchId,
    metadata: { reversal_reason: reason },
    lines: original.map((e) => ({
      account_code: e.account_code,
      direction: e.direction === "DR" ? "CR" : "DR",
      amount: e.amount,
      currency: e.currency,
    })),
  });
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export interface BalanceFilter {
  account_code?: string;
  currency?: string;
  company_id?: number;
  payment_id?: string;
  from?: Date;
  to?: Date;
}

export interface BalanceRow {
  account_code: string;
  currency: string;
  dr: string;
  cr: string;
  net: string;                          // DR - CR
}

export async function getBalances(filter: BalanceFilter = {}): Promise<BalanceRow[]> {
  const where: Record<string, unknown> = {};
  if (filter.account_code) where.account_code = filter.account_code;
  if (filter.currency) where.currency = filter.currency;
  if (filter.company_id) where.company_id = filter.company_id;
  if (filter.payment_id) where.payment_id = filter.payment_id;
  if (filter.from || filter.to) {
    const { Op } = require("sequelize");
    where.created_at = {};
    if (filter.from) (where.created_at as Record<symbol, Date>)[Op.gte] = filter.from;
    if (filter.to) (where.created_at as Record<symbol, Date>)[Op.lte] = filter.to;
  }

  const rows = await LedgerEntry.findAll({
    where: where as never,
    attributes: ["account_code", "currency", "direction", "amount"],
    raw: true,
  }) as unknown as Array<{ account_code: string; currency: string; direction: Direction; amount: string }>;

  const map: Record<string, BalanceRow> = {};
  for (const r of rows) {
    const key = `${r.account_code}::${r.currency}`;
    if (!map[key]) map[key] = { account_code: r.account_code, currency: r.currency, dr: "0", cr: "0", net: "0" };
    if (r.direction === "DR") map[key].dr = addDec(map[key].dr, r.amount);
    else map[key].cr = addDec(map[key].cr, r.amount);
  }
  for (const b of Object.values(map)) {
    b.net = addDec(b.dr, "-" + b.cr);
  }
  return Object.values(map).sort((a, b) => a.account_code.localeCompare(b.account_code));
}

export async function getPaymentLedger(paymentId: string): Promise<LedgerEntry[]> {
  return LedgerEntry.findAll({
    where: { payment_id: paymentId },
    order: [["created_at", "ASC"], ["id", "ASC"]],
  });
}

// Exported for tests
export const _internals = { toDec, addDec, isZero, loadKnownAccounts };

export default {
  postDoubleEntry,
  reverseBatch,
  getBalances,
  getPaymentLedger,
};
