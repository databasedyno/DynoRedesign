/**
 * SafeDeal wallet ledger — sits on Dynopay's per-brand customer wallet
 * (tbl_customer_wallet + tbl_customer_transaction). `amount` = Available,
 * `held_amount` = Held in escrow. Every movement writes a statement row:
 *   CREDIT  (+ total)   DEBIT (− total)   HOLD / UNHOLD (bucket move, total unchanged)
 * Rows carry `meta` { kind, bucket, escrow_id, ... } so statements are self-describing.
 * Idempotent per `transaction_reference` (settlements/funding can be retried safely).
 */
import crypto from "crypto";
import { QueryTypes, Transaction } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";
import { toFixedStr, toNumber } from "../../utils/money";
import { CustomerRow, CustomerWalletError } from "../customerWalletService";

export type EntryType = "CREDIT" | "DEBIT" | "HOLD" | "UNHOLD";

export interface StatementRow {
  id: string | null;
  at: string;
  type: EntryType | string;
  kind: string;
  amount: number;
  signed: number; // effect on TOTAL balance (available + held)
  bucket: "available" | "held" | "transfer";
  description: string;
  reference: string;
  source: string;
  escrow_id: number | null;
  deal_title: string | null;
  running_balance: number;
  meta: Record<string, unknown>;
}

export interface WalletBalances {
  available: number;
  held: number;
  total: number;
  currency: string;
}

const round2 = (n: number): number => toNumber(Number(n) || 0, 2);
const LEDGER_MODES = ["ESCROW", "WITHDRAWAL", "MERCHANT", "ADJUSTMENT", "TOPUP"];

interface WalletRow {
  wallet_id: number;
  amount: number | string;
  held_amount: number | string;
  wallet_type: string;
}

async function lockOrCreateWallet(customerId: number, t: Transaction): Promise<WalletRow> {
  const rows = await sequelize.query<WalletRow>(
    `SELECT wallet_id, amount, held_amount, wallet_type FROM tbl_customer_wallet
      WHERE customer_id = :customerId ORDER BY wallet_id ASC LIMIT 1 FOR UPDATE`,
    { replacements: { customerId }, type: QueryTypes.SELECT, transaction: t }
  );
  if (rows[0]) return rows[0];
  const created = await sequelize.query<WalletRow>(
    `INSERT INTO tbl_customer_wallet (id, customer_id, amount, held_amount, wallet_type, "createdAt", "updatedAt")
     VALUES (:id, :customerId, 0, 0, 'USD', NOW(), NOW()) RETURNING wallet_id, amount, held_amount, wallet_type`,
    { replacements: { id: crypto.randomUUID(), customerId }, type: QueryTypes.SELECT, transaction: t }
  );
  return created[0];
}

export async function getBalances(customerId: number): Promise<WalletBalances> {
  const rows = await sequelize.query<WalletRow>(
    `SELECT wallet_id, amount, held_amount, wallet_type FROM tbl_customer_wallet WHERE customer_id = :customerId ORDER BY wallet_id ASC LIMIT 1`,
    { replacements: { customerId }, type: QueryTypes.SELECT }
  );
  const w = rows[0];
  const available = round2(Number(w?.amount || 0));
  const held = round2(Number(w?.held_amount || 0));
  return { available, held, total: round2(available + held), currency: w?.wallet_type || "USD" };
}

export interface EntryInput {
  customer: CustomerRow;
  type: EntryType;
  amount: number;
  kind: string;
  description: string;
  reference: string; // idempotency key
  source?: "ESCROW" | "WITHDRAWAL" | "ADJUSTMENT" | "TOPUP";
  escrowId?: number | null;
  dealTitle?: string | null;
  meta?: Record<string, unknown>;
  allowNegative?: boolean;
}

/** Apply one ledger entry inside `t` (caller owns the transaction). Skips if the reference already exists. */
export async function applyEntry(input: EntryInput, t: Transaction): Promise<boolean> {
  const amount = round2(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const dup = await sequelize.query<{ transaction_id: number }>(
    `SELECT transaction_id FROM tbl_customer_transaction WHERE transaction_reference = :ref LIMIT 1`,
    { replacements: { ref: input.reference }, type: QueryTypes.SELECT, transaction: t }
  );
  if (dup[0]) return false;

  const wallet = await lockOrCreateWallet(input.customer.customer_id, t);
  let available = round2(Number(wallet.amount || 0));
  let held = round2(Number(wallet.held_amount || 0));
  let bucket: StatementRow["bucket"] = "available";
  switch (input.type) {
    case "CREDIT":
      bucket = (input.meta?.bucket as StatementRow["bucket"]) || "available";
      if (bucket === "held") held = round2(held + amount);
      else available = round2(available + amount);
      break;
    case "DEBIT":
      if (available < amount && !input.allowNegative) {
        throw new CustomerWalletError(400, `Insufficient available balance: ${toFixedStr(available, 2)} USD available, ${toFixedStr(amount, 2)} USD needed.`);
      }
      available = round2(available - amount);
      break;
    case "HOLD":
      if (available < amount) {
        throw new CustomerWalletError(400, `Insufficient available balance: ${toFixedStr(available, 2)} USD available, ${toFixedStr(amount, 2)} USD needed.`);
      }
      available = round2(available - amount);
      held = round2(held + amount);
      bucket = "transfer";
      break;
    case "UNHOLD":
      held = round2(Math.max(0, held - amount));
      available = round2(available + amount);
      bucket = "transfer";
      break;
  }
  await sequelize.query(
    `UPDATE tbl_customer_wallet SET amount = :available, held_amount = :held, "updatedAt" = NOW() WHERE wallet_id = :walletId`,
    { replacements: { available: toFixedStr(available, 2), held: toFixedStr(held, 2), walletId: wallet.wallet_id }, type: QueryTypes.UPDATE, transaction: t }
  );
  const meta = {
    ...(input.meta || {}),
    kind: input.kind,
    bucket,
    escrow_id: input.escrowId ?? null,
    deal_title: input.dealTitle ?? null,
    balance_after: { available, held },
  };
  await sequelize.query(
    `INSERT INTO tbl_customer_transaction
       (id, company_id, customer_id, payment_mode, base_amount, base_currency, paid_amount, paid_currency,
        transaction_type, transaction_details, transaction_reference, status, unique_tx_id, meta, "createdAt", "updatedAt")
     VALUES (:id, :companyId, :customerId, :mode, :amount, 'USD', :amount, 'USD',
             :type, :details, :reference, 'successful', :uniqueTx, :meta::jsonb, NOW(), NOW())`,
    {
      replacements: {
        id: crypto.randomUUID(),
        companyId: input.customer.company_id,
        customerId: input.customer.customer_id,
        mode: input.source || "ESCROW",
        amount: toFixedStr(amount, 2),
        type: input.type,
        details: input.description.slice(0, 500),
        reference: input.reference,
        uniqueTx: input.escrowId ? `escrow-${input.escrowId}` : null,
        meta: JSON.stringify(meta),
      },
      type: QueryTypes.INSERT,
      transaction: t,
    }
  );
  apiLogger.info(
    `[SafeDealWallet] ${input.type} ${toFixedStr(amount, 2)} USD (${input.kind}) customer ${input.customer.customer_id}: available ${available} held ${held}`
  );
  return true;
}

/** Run a set of entries atomically. */
export async function applyEntries(entries: EntryInput[]): Promise<number> {
  return sequelize.transaction(async (t) => {
    let applied = 0;
    for (const e of entries) if (await applyEntry(e, t)) applied += 1;
    return applied;
  });
}

const sign = (type: string): number => (type === "CREDIT" ? 1 : type === "DEBIT" ? -1 : 0);

export async function getStatement(
  customerIds: number[],
  opts: { from?: string | null; to?: string | null; limit?: number } = {}
): Promise<StatementRow[]> {
  if (!customerIds.length) return [];
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 2000);
  const where: string[] = [`customer_id IN (:ids)`, `payment_mode IN (:modes)`];
  const replacements: Record<string, unknown> = { ids: customerIds, modes: LEDGER_MODES, limit };
  if (opts.from) { where.push(`"createdAt" >= :from`); replacements.from = new Date(opts.from); }
  if (opts.to) { where.push(`"createdAt" <= :to`); replacements.to = new Date(opts.to); }
  // Oldest → newest so the running balance can be accumulated in one pass.
  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT id, transaction_type, paid_amount, transaction_details, transaction_reference, payment_mode, meta, "createdAt"
       FROM tbl_customer_transaction WHERE ${where.join(" AND ")}
      ORDER BY "createdAt" ASC, transaction_id ASC LIMIT :limit`,
    { replacements, type: QueryTypes.SELECT }
  );
  // Opening balance = sum of everything before the window (so the running column is absolute).
  let running = 0;
  if (opts.from) {
    const prior = await sequelize.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(CASE transaction_type WHEN 'CREDIT' THEN paid_amount WHEN 'DEBIT' THEN -paid_amount ELSE 0 END), 0) AS total
         FROM tbl_customer_transaction WHERE customer_id IN (:ids) AND payment_mode IN (:modes) AND "createdAt" < :from`,
      { replacements: { ids: customerIds, modes: LEDGER_MODES, from: new Date(opts.from) }, type: QueryTypes.SELECT }
    );
    running = round2(Number(prior[0]?.total || 0));
  }
  const out: StatementRow[] = rows.map((r) => {
    const type = String(r.transaction_type).toUpperCase();
    const amount = round2(Number(r.paid_amount || 0));
    const meta = (r.meta as Record<string, unknown>) || {};
    // Legacy admin adjustments (payment_mode MERCHANT) carry no meta — label them.
    const kind = String(meta.kind || (String(r.payment_mode) === "MERCHANT" ? (type === "CREDIT" ? "adjustment_credit" : "adjustment_debit") : type.toLowerCase()));
    running = round2(running + sign(type) * amount);
    return {
      id: (r.id as string) || null,
      at: new Date(r.createdAt as string).toISOString(),
      type,
      kind,
      amount,
      signed: sign(type) * amount,
      bucket: (meta.bucket as StatementRow["bucket"]) || (type === "HOLD" || type === "UNHOLD" ? "transfer" : "available"),
      description: (r.transaction_details as string) || "",
      reference: String(r.transaction_reference || ""),
      source: String(r.payment_mode || "").toUpperCase(),
      escrow_id: meta.escrow_id != null ? Number(meta.escrow_id) : null,
      deal_title: (meta.deal_title as string) || null,
      running_balance: running,
      meta,
    };
  });
  return out.reverse(); // newest first for display
}

/** Per-row network/exchange fee in USD, read from the row's stored meta (top-ups carry it). */
const rowFeeUsd = (meta: Record<string, unknown> | null | undefined): number => {
  const m = (meta || {}) as Record<string, unknown>;
  const total = Number(m.total_fee_usd);
  if (isFinite(total) && total > 0) return round2(total);
  const sum = Number(m.network_fee_usd || 0) + Number(m.conversion_fee_usd || 0) + Number(m.exchange_fee_usd || 0);
  return sum > 0 ? round2(sum) : 0;
};

export function statementToCsv(rows: StatementRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Date", "Deal", "Type", "Description", "Amount (USD)", "Fees (USD)", "Bucket", "Running balance (USD)", "Reference"];
  const lines = rows.map((r) => {
    const fee = rowFeeUsd(r.meta);
    return [
      r.at,
      r.escrow_id ? `#${r.escrow_id}${r.deal_title ? ` ${r.deal_title}` : ""}` : "",
      r.kind,
      r.description,
      r.signed !== 0 ? toFixedStr(r.signed, 2) : `${r.type === "HOLD" ? "-" : "+"}${toFixedStr(r.amount, 2)} (${r.type.toLowerCase()})`,
      fee > 0 ? toFixedStr(fee, 2) : "",
      r.bucket,
      toFixedStr(r.running_balance, 2),
      r.reference,
    ].map(esc).join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

/** Brand-level totals for the Dynopay owner: reconcilable against USDT custody. */
export async function brandWalletTotals(companyId: number): Promise<{
  customers: number;
  wallets: number;
  available_total: number;
  held_total: number;
  fees_earned: number;
  costs_retained: number;
  withdrawals_paid: number;
  withdrawals_pending: number;
  deals_total: number;
  deals_volume: number;
}> {
  const [w] = await sequelize.query<Record<string, string>>(
    `SELECT COUNT(DISTINCT c.customer_id) AS customers, COUNT(w.wallet_id) AS wallets,
            COALESCE(SUM(w.amount),0) AS available_total, COALESCE(SUM(w.held_amount),0) AS held_total
       FROM tbl_customer c LEFT JOIN tbl_customer_wallet w ON w.customer_id = c.customer_id
      WHERE c.company_id = :companyId`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );
  const [f] = await sequelize.query<Record<string, string>>(
    `SELECT COALESCE(SUM(CASE WHEN meta->>'kind' IN ('escrow_fee','exchange_fee') THEN paid_amount ELSE 0 END),0) AS fees_earned,
            COALESCE(SUM(CASE WHEN meta->>'kind' = 'escrow_costs' THEN paid_amount ELSE 0 END),0) AS costs_retained,
            COALESCE(SUM(CASE WHEN meta->>'kind' = 'withdrawal' THEN paid_amount ELSE 0 END),0) AS withdrawals_paid
       FROM tbl_customer_transaction WHERE company_id = :companyId AND payment_mode IN ('ESCROW','WITHDRAWAL')`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );
  const [p] = await sequelize.query<Record<string, string>>(
    `SELECT COALESCE(SUM(amount_usd),0) AS pending FROM tbl_customer_withdrawal
      WHERE company_id = :companyId AND status IN ('pending_approval','queued')`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );
  const [d] = await sequelize.query<Record<string, string>>(
    `SELECT COUNT(*) AS deals_total, COALESCE(SUM(amount),0) AS deals_volume FROM tbl_escrow_deal WHERE company_id = :companyId AND source = 'safedeal'`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );
  return {
    customers: Number(w?.customers || 0),
    wallets: Number(w?.wallets || 0),
    available_total: round2(Number(w?.available_total || 0)),
    held_total: round2(Number(w?.held_total || 0)),
    fees_earned: round2(Number(f?.fees_earned || 0)),
    costs_retained: round2(Number(f?.costs_retained || 0)),
    withdrawals_paid: round2(Number(f?.withdrawals_paid || 0)),
    withdrawals_pending: round2(Number(p?.pending || 0)),
    deals_total: Number(d?.deals_total || 0),
    deals_volume: round2(Number(d?.deals_volume || 0)),
  };
}
