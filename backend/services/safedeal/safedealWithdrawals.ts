/**
 * SafeDeal saved payout addresses + withdrawals (stablecoin only).
 * Money leaves the customer's Available balance at request time; a rejected
 * withdrawal is credited back. Live sending goes through Binance (same rail as
 * escrow payouts); safe mode simulates the send.
 */
import crypto from "crypto";
import { QueryTypes } from "sequelize";
import { raw as envRaw } from "../../utils/config";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";
import { toFixedStr } from "../../utils/money";
import { CustomerRow, CustomerWalletError } from "../customerWalletService";
import { ESCROW_PAYOUT_OPTIONS, normalizePayoutKey, withdrawFeeUsdFor } from "../escrow/escrowCosts";
import { isLiveSettlementEnabled } from "../../controller/escrow/escrowShared";
import { applyEntries, getBalances } from "./safedealWallet";
import { sendSafeDealWithdrawalEmail, sendSafeDealWithdrawalRejectedEmail } from "../email/safedealEmails";

export const MIN_WITHDRAWAL_USD = Number(envRaw("SAFEDEAL_MIN_WITHDRAWAL_USD")) || 10;
export const APPROVAL_THRESHOLD_USD = Number(envRaw("SAFEDEAL_WITHDRAWAL_APPROVAL_USD")) || 1000;

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export interface PayoutAddressRow {
  address_id: number;
  company_id: number;
  customer_id: number;
  payout_key: string;
  coin: string;
  network: string;
  address: string;
  label: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface WithdrawalRow {
  withdrawal_id: number;
  company_id: number;
  customer_id: number;
  address_id: number | null;
  payout_key: string;
  address: string;
  amount_usd: string | number;
  fee_usd: string | number;
  net_usd: string | number;
  status: string;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  tx_hash: string | null;
  simulated: boolean;
  sent_at: string | null;
  ledger_reference?: string | null;
  source: string;
  created_at: string;
  customer_email?: string | null;
}

const ADDRESS_PATTERNS: Record<string, RegExp> = {
  TRC20: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  ERC20: /^0x[a-fA-F0-9]{40}$/,
  POLYGON: /^0x[a-fA-F0-9]{40}$/,
};

export function validatePayoutAddress(payoutKeyIn: string, addressIn: string): { payout_key: string; coin: string; network: string; address: string } {
  const payout_key = normalizePayoutKey(payoutKeyIn);
  const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === payout_key);
  if (!opt) throw new CustomerWalletError(400, "Unsupported payout network. Choose USDT (TRC20, ERC20, Polygon) or USDC (ERC20, Polygon).");
  const address = String(addressIn || "").trim();
  const re = ADDRESS_PATTERNS[opt.chain];
  if (!address || (re && !re.test(address))) throw new CustomerWalletError(400, `That doesn't look like a valid ${opt.label} address.`);
  return { payout_key, coin: opt.coin, network: opt.chain, address };
}

export async function listAddresses(customerId: number): Promise<PayoutAddressRow[]> {
  return sequelize.query<PayoutAddressRow>(
    `SELECT * FROM tbl_customer_payout_address WHERE customer_id = :customerId AND removed_at IS NULL ORDER BY created_at DESC`,
    { replacements: { customerId }, type: QueryTypes.SELECT }
  );
}

export async function addAddress(customer: CustomerRow, input: { payout_key: string; address: string; label?: string | null }): Promise<PayoutAddressRow> {
  const v = validatePayoutAddress(input.payout_key, input.address);
  const existing = await listAddresses(customer.customer_id);
  if (existing.length >= 10) throw new CustomerWalletError(400, "You can save up to 10 payout addresses.");
  if (existing.some((a) => a.address === v.address && a.payout_key === v.payout_key)) throw new CustomerWalletError(409, "This address is already saved.");
  const rows = await sequelize.query<PayoutAddressRow>(
    `INSERT INTO tbl_customer_payout_address (company_id, customer_id, payout_key, coin, network, address, label)
     VALUES (:companyId, :customerId, :payoutKey, :coin, :network, :address, :label) RETURNING *`,
    {
      replacements: { companyId: customer.company_id, customerId: customer.customer_id, payoutKey: v.payout_key, coin: v.coin, network: v.network, address: v.address, label: (input.label || "").trim().slice(0, 80) || null },
      type: QueryTypes.SELECT,
    }
  );
  return rows[0];
}

export async function removeAddress(customerId: number, addressId: number): Promise<PayoutAddressRow> {
  const rows = await sequelize.query<PayoutAddressRow>(
    `UPDATE tbl_customer_payout_address SET removed_at = NOW() WHERE address_id = :id AND customer_id = :customerId AND removed_at IS NULL RETURNING *`,
    { replacements: { id: addressId, customerId }, type: QueryTypes.SELECT }
  );
  if (!rows[0]) throw new CustomerWalletError(404, "Saved address not found.");
  await sequelize.query(
    `UPDATE tbl_safedeal_profile SET auto_withdraw = false, auto_withdraw_address_id = NULL, updated_at = NOW()
      WHERE customer_id = :customerId AND auto_withdraw_address_id = :id`,
    { replacements: { id: addressId, customerId }, type: QueryTypes.UPDATE }
  );
  return rows[0];
}

export function quoteWithdrawal(payoutKey: string, amountUsd: number): { amount: number; fee: number; net: number; payout_key: string; min: number; approval_threshold: number } {
  const payout_key = normalizePayoutKey(payoutKey);
  const amount = round2(amountUsd);
  const fee = round2(withdrawFeeUsdFor(payout_key));
  return { amount, fee, net: round2(amount - fee), payout_key, min: MIN_WITHDRAWAL_USD, approval_threshold: APPROVAL_THRESHOLD_USD };
}

async function loadAddress(customerId: number, addressId: number): Promise<PayoutAddressRow> {
  const rows = await sequelize.query<PayoutAddressRow>(
    `SELECT * FROM tbl_customer_payout_address WHERE address_id = :id AND customer_id = :customerId AND removed_at IS NULL LIMIT 1`,
    { replacements: { id: addressId, customerId }, type: QueryTypes.SELECT }
  );
  if (!rows[0]) throw new CustomerWalletError(404, "Saved address not found.");
  return rows[0];
}

async function getWithdrawal(id: number): Promise<WithdrawalRow | null> {
  const rows = await sequelize.query<WithdrawalRow>(`SELECT * FROM tbl_customer_withdrawal WHERE withdrawal_id = :id LIMIT 1`, {
    replacements: { id },
    type: QueryTypes.SELECT,
  });
  return rows[0] || null;
}

/** Execute the send for a queued withdrawal (simulated in safe mode). */
async function dispatchWithdrawal(w: WithdrawalRow): Promise<WithdrawalRow> {
  const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === w.payout_key);
  let txHash = `SIMULATED-WITHDRAWAL-${crypto.randomBytes(10).toString("hex")}`;
  let simulated = true;
  if (isLiveSettlementEnabled() && opt) {
    const { submitWithdrawal } = await import("../binanceService");
    const r = await submitWithdrawal({ coin: opt.coin, address: w.address, amount: Number(w.net_usd), network: opt.chain, withdrawOrderId: `sd-wd-${w.withdrawal_id}` });
    txHash = `BINANCE-${r.id}`;
    simulated = false;
  }
  const rows = await sequelize.query<WithdrawalRow>(
    `UPDATE tbl_customer_withdrawal SET status = 'sent', tx_hash = :tx, simulated = :sim, sent_at = NOW(), updated_at = NOW()
      WHERE withdrawal_id = :id RETURNING *`,
    { replacements: { tx: txHash, sim: simulated, id: w.withdrawal_id }, type: QueryTypes.SELECT }
  );
  await sequelize.query(`UPDATE tbl_customer_payout_address SET last_used_at = NOW() WHERE address_id = :id`, {
    replacements: { id: w.address_id },
    type: QueryTypes.UPDATE,
  });
  apiLogger.info(`[SafeDeal] withdrawal ${w.withdrawal_id} sent (${simulated ? "SIMULATED" : "LIVE"}) ${w.net_usd} USD → ${w.address}`);
  return rows[0];
}

export async function requestWithdrawal(
  customer: CustomerRow,
  input: { address_id: number; amount: number; source?: "manual" | "auto" }
): Promise<WithdrawalRow> {
  const addr = await loadAddress(customer.customer_id, Number(input.address_id));
  const q = quoteWithdrawal(addr.payout_key, Number(input.amount));
  if (!Number.isFinite(q.amount) || q.amount < MIN_WITHDRAWAL_USD) throw new CustomerWalletError(400, `Minimum withdrawal is $${MIN_WITHDRAWAL_USD}.`);
  if (q.net <= 0) throw new CustomerWalletError(400, `Amount must exceed the ${toFixedStr(q.fee, 2)} USD network fee.`);
  const bal = await getBalances(customer.customer_id);
  if (bal.available < q.amount) throw new CustomerWalletError(400, `Insufficient available balance (${toFixedStr(bal.available, 2)} USD).`);
  const requiresApproval = q.amount > APPROVAL_THRESHOLD_USD;
  const ledgerRef = `withdrawal:${crypto.randomUUID()}`;
  const rows = await sequelize.query<WithdrawalRow>(
    `INSERT INTO tbl_customer_withdrawal
       (company_id, customer_id, address_id, payout_key, address, amount_usd, fee_usd, net_usd, status, requires_approval, ledger_reference, source)
     VALUES (:companyId, :customerId, :addressId, :payoutKey, :address, :amount, :fee, :net, :status, :requiresApproval, :ledgerRef, :source)
     RETURNING *`,
    {
      replacements: {
        companyId: customer.company_id,
        customerId: customer.customer_id,
        addressId: addr.address_id,
        payoutKey: addr.payout_key,
        address: addr.address,
        amount: toFixedStr(q.amount, 2),
        fee: toFixedStr(q.fee, 2),
        net: toFixedStr(q.net, 2),
        status: requiresApproval ? "pending_approval" : "queued",
        requiresApproval,
        ledgerRef,
        source: input.source || "manual",
      },
      type: QueryTypes.SELECT,
    }
  );
  let w = rows[0];
  const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === w.payout_key);
  await applyEntries([
    {
      customer,
      type: "DEBIT",
      amount: q.amount,
      kind: "withdrawal",
      description: `Withdrawal to ${opt?.label || w.payout_key} ${w.address.slice(0, 6)}…${w.address.slice(-4)} (fee ${toFixedStr(q.fee, 2)} USD, you receive ${toFixedStr(q.net, 2)} ${opt?.coin || "USDT"})${requiresApproval ? " — awaiting approval" : ""}`,
      reference: ledgerRef,
      source: "WITHDRAWAL",
      meta: { withdrawal_id: w.withdrawal_id, payout_key: w.payout_key, fee: q.fee, net: q.net },
    },
  ]);
  if (!requiresApproval) w = await dispatchWithdrawal(w);
  if (customer.email) void sendSafeDealWithdrawalEmail(customer.email, w, opt?.label || w.payout_key);
  return w;
}

export async function listWithdrawals(customerId: number, limit = 50): Promise<WithdrawalRow[]> {
  return sequelize.query<WithdrawalRow>(
    `SELECT * FROM tbl_customer_withdrawal WHERE customer_id = :customerId ORDER BY created_at DESC LIMIT :limit`,
    { replacements: { customerId, limit }, type: QueryTypes.SELECT }
  );
}

export async function adminListWithdrawals(filter: { status?: string | null; companyId?: number | null }, limit = 200): Promise<WithdrawalRow[]> {
  const where: string[] = ["1=1"];
  const replacements: Record<string, unknown> = { limit };
  if (filter.status) { where.push("w.status = :status"); replacements.status = filter.status; }
  if (filter.companyId) { where.push("w.company_id = :companyId"); replacements.companyId = filter.companyId; }
  return sequelize.query<WithdrawalRow>(
    `SELECT w.*, c.email AS customer_email FROM tbl_customer_withdrawal w
       LEFT JOIN tbl_customer c ON c.customer_id = w.customer_id
      WHERE ${where.join(" AND ")} ORDER BY w.created_at DESC LIMIT :limit`,
    { replacements, type: QueryTypes.SELECT }
  );
}

async function customerById(id: number): Promise<CustomerRow | null> {
  const rows = await sequelize.query<CustomerRow>(`SELECT customer_id, company_id, customer_name, email FROM tbl_customer WHERE customer_id = :id LIMIT 1`, {
    replacements: { id },
    type: QueryTypes.SELECT,
  });
  return rows[0] || null;
}

export async function approveWithdrawal(id: number, adminLabel: string): Promise<WithdrawalRow> {
  const w = await getWithdrawal(id);
  if (!w) throw new CustomerWalletError(404, "Withdrawal not found.");
  if (w.status !== "pending_approval") throw new CustomerWalletError(409, `Withdrawal is '${w.status}', not awaiting approval.`);
  await sequelize.query(
    `UPDATE tbl_customer_withdrawal SET status = 'queued', approved_by = :by, approved_at = NOW(), updated_at = NOW() WHERE withdrawal_id = :id`,
    { replacements: { by: adminLabel, id }, type: QueryTypes.UPDATE }
  );
  const sent = await dispatchWithdrawal({ ...w, status: "queued" });
  const customer = await customerById(w.customer_id);
  const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === w.payout_key);
  if (customer?.email) void sendSafeDealWithdrawalEmail(customer.email, sent, opt?.label || w.payout_key);
  return sent;
}

export async function rejectWithdrawal(id: number, adminLabel: string, reason: string): Promise<WithdrawalRow> {
  const w = await getWithdrawal(id);
  if (!w) throw new CustomerWalletError(404, "Withdrawal not found.");
  if (!["pending_approval", "queued"].includes(w.status)) throw new CustomerWalletError(409, `Withdrawal is '${w.status}' and can no longer be rejected.`);
  const rows = await sequelize.query<WithdrawalRow>(
    `UPDATE tbl_customer_withdrawal SET status = 'rejected', approved_by = :by, approved_at = NOW(), rejected_reason = :reason, updated_at = NOW()
      WHERE withdrawal_id = :id RETURNING *`,
    { replacements: { by: adminLabel, reason: String(reason || "").slice(0, 500) || null, id }, type: QueryTypes.SELECT }
  );
  const customer = await customerById(w.customer_id);
  if (customer) {
    await applyEntries([
      {
        customer,
        type: "CREDIT",
        amount: Number(w.amount_usd),
        kind: "withdrawal_reversed",
        description: `Withdrawal #${w.withdrawal_id} rejected — funds returned${reason ? `: ${String(reason).slice(0, 120)}` : ""}`,
        reference: `${w.ledger_reference || `withdrawal:${w.withdrawal_id}`}:reversal`,
        source: "WITHDRAWAL",
        meta: { withdrawal_id: w.withdrawal_id },
      },
    ]);
    const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === w.payout_key);
    if (customer.email) void sendSafeDealWithdrawalRejectedEmail(customer.email, rows[0], opt?.label || w.payout_key);
  }
  return rows[0];
}

/** After a wallet credit: if the user opted in, sweep the available balance to their saved address. */
export async function maybeAutoWithdraw(customerId: number): Promise<WithdrawalRow | null> {
  const prof = await sequelize.query<{ auto_withdraw: boolean; auto_withdraw_address_id: number | null }>(
    `SELECT auto_withdraw, auto_withdraw_address_id FROM tbl_safedeal_profile WHERE customer_id = :id LIMIT 1`,
    { replacements: { id: customerId }, type: QueryTypes.SELECT }
  );
  const p = prof[0];
  if (!p?.auto_withdraw || !p.auto_withdraw_address_id) return null;
  const bal = await getBalances(customerId);
  if (bal.available < MIN_WITHDRAWAL_USD) return null;
  const customer = await customerById(customerId);
  if (!customer) return null;
  try {
    return await requestWithdrawal(customer, { address_id: p.auto_withdraw_address_id, amount: bal.available, source: "auto" });
  } catch (err) {
    apiLogger.error(`[SafeDeal] auto-withdraw failed for customer ${customerId}: ${(err as Error).message}`);
    return null;
  }
}
