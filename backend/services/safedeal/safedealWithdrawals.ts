/**
 * SafeDeal saved payout addresses + withdrawals (stablecoin only).
 * Money leaves the customer's Available balance at request time; a rejected
 * withdrawal is credited back. Live sending goes through Binance (same rail as
 * escrow payouts); safe mode simulates the send.
 */
import crypto from "crypto";
import { QueryTypes } from "sequelize";
import { raw as envRaw, num } from "../../utils/config";
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
// New-address cooling-off: hours before a freshly saved payout address can receive a withdrawal.
export const ADDRESS_COOLING_HOURS = num("SAFEDEAL_ADDRESS_COOLING_HOURS", 24);

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
  /** created_at + cooling-off window; withdrawals to this address are blocked before then. */
  usable_at?: string;
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
  escrow_id?: number | null;
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
    `SELECT *, created_at + (:hours || ' hours')::interval AS usable_at
       FROM tbl_customer_payout_address WHERE customer_id = :customerId AND removed_at IS NULL ORDER BY created_at DESC`,
    { replacements: { customerId, hours: String(ADDRESS_COOLING_HOURS) }, type: QueryTypes.SELECT }
  );
}

/** New payout addresses can't receive withdrawals until the cooling-off window has passed. */
export function assertAddressUsable(addr: PayoutAddressRow, now = Date.now()): void {
  const usableAt = new Date(addr.created_at).getTime() + ADDRESS_COOLING_HOURS * 3600000;
  const left = usableAt - now;
  if (left <= 0) return;
  const totalMin = Math.ceil(left / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  throw new CustomerWalletError(
    400,
    `This address was added recently. For your safety, new addresses can be used ${ADDRESS_COOLING_HOURS} hours after they're saved — usable in ${h ? `${h}h ` : ""}${m}m.`
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
    // Binance deducts its network fee FROM the submitted amount. Manual: submit the gross (user receives net).
    // Settlement payout: the fee was reserved in the deal quote, so submit net + fee (recipient receives the full net).
    const submitAmount = w.source === "settlement" ? round2(Number(w.net_usd) + withdrawFeeUsdFor(w.payout_key)) : Number(w.amount_usd);
    const r = await submitWithdrawal({ coin: opt.coin, address: w.address, amount: submitAmount, network: opt.chain, withdrawOrderId: `sd-wd-${w.withdrawal_id}` });
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
  input: { address_id: number; amount: number; source?: "manual" | "auto" | "settlement"; escrow_id?: number | null; fee_covered?: boolean; skip_cooling?: boolean; deal_title?: string | null }
): Promise<WithdrawalRow> {
  const addr = await loadAddress(customer.customer_id, Number(input.address_id));
  if (!input.skip_cooling) assertAddressUsable(addr);
  const q = quoteWithdrawal(addr.payout_key, Number(input.amount));
  // Escrow payouts: the withdrawal fee was already collected in the deal quote (cost reserve) — never charge it twice.
  if (input.fee_covered) { q.fee = 0; q.net = q.amount; }
  const isSettlement = input.source === "settlement";
  if (!Number.isFinite(q.amount) || (!isSettlement && q.amount < MIN_WITHDRAWAL_USD)) throw new CustomerWalletError(400, `Minimum withdrawal is $${MIN_WITHDRAWAL_USD}.`);
  if (q.net <= 0) throw new CustomerWalletError(400, `Amount must exceed the ${toFixedStr(q.fee, 2)} USD network fee.`);
  const bal = await getBalances(customer.customer_id);
  if (bal.available < q.amount) throw new CustomerWalletError(400, `Insufficient available balance (${toFixedStr(bal.available, 2)} USD).`);
  const requiresApproval = q.amount > APPROVAL_THRESHOLD_USD;
  const ledgerRef = `withdrawal:${crypto.randomUUID()}`;
  const rows = await sequelize.query<WithdrawalRow>(
    `INSERT INTO tbl_customer_withdrawal
       (company_id, customer_id, address_id, payout_key, address, amount_usd, fee_usd, net_usd, status, requires_approval, ledger_reference, source, escrow_id)
     VALUES (:companyId, :customerId, :addressId, :payoutKey, :address, :amount, :fee, :net, :status, :requiresApproval, :ledgerRef, :source, :escrowId)
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
        escrowId: input.escrow_id ?? null,
      },
      type: QueryTypes.SELECT,
    }
  );
  let w = rows[0];
  const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === w.payout_key);
  const short = `${w.address.slice(0, 6)}…${w.address.slice(-4)}`;
  await applyEntries([
    {
      customer,
      type: "DEBIT",
      amount: q.amount,
      kind: isSettlement ? "payout" : "withdrawal",
      description: isSettlement
        ? `Deal payout${input.deal_title ? ` — ${input.deal_title}` : ""} sent to ${opt?.label || w.payout_key} ${short} (network fee covered by the deal)${requiresApproval ? " — awaiting approval" : ""}`
        : `Withdrawal to ${opt?.label || w.payout_key} ${short} (fee ${toFixedStr(q.fee, 2)} USD, you receive ${toFixedStr(q.net, 2)} ${opt?.coin || "USDT"})${requiresApproval ? " — awaiting approval" : ""}`,
      reference: ledgerRef,
      source: "WITHDRAWAL",
      escrowId: input.escrow_id ?? undefined,
      dealTitle: input.deal_title ?? undefined,
      meta: { withdrawal_id: w.withdrawal_id, payout_key: w.payout_key, fee: q.fee, net: q.net, source: input.source || "manual", escrow_id: input.escrow_id ?? null },
    },
  ]);
  await clampDepositReserve(customer.customer_id); // funds left the wallet — release any now-unbacked deposit protection
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

/** Settlement payouts sent from custody for one deal (both legs). */
export async function listDealPayouts(escrowId: number): Promise<WithdrawalRow[]> {
  return sequelize.query<WithdrawalRow>(
    `SELECT * FROM tbl_customer_withdrawal WHERE escrow_id = :escrowId AND source = 'settlement' ORDER BY created_at ASC`,
    { replacements: { escrowId }, type: QueryTypes.SELECT }
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

// ── Settlement payouts (deal closed → Binance withdrawal to the party's address) ──

export interface PayoutPref { address_id: number; set_at: string; before_funding: boolean }

/**
 * Destination precedence: the address chosen inside the deal → the auto-withdraw address
 * (only when auto-withdraw is ON). Otherwise null: the money stays in the SafeDeal balance
 * (custodied as USDT) until the user withdraws manually.
 */
export async function resolvePayoutDestination(customerId: number, pref?: PayoutPref | null): Promise<{ addr: PayoutAddressRow; skipCooling: boolean } | null> {
  const addrs = await listAddresses(customerId);
  if (!addrs.length) return null;
  if (pref?.address_id) {
    const a = addrs.find((x) => x.address_id === Number(pref.address_id));
    if (a) return { addr: a, skipCooling: !!pref.before_funding };
  }
  const prof = await sequelize.query<{ auto_withdraw: boolean; auto_withdraw_address_id: number | null }>(
    `SELECT auto_withdraw, auto_withdraw_address_id FROM tbl_safedeal_profile WHERE customer_id = :id LIMIT 1`,
    { replacements: { id: customerId }, type: QueryTypes.SELECT }
  );
  const p = prof[0];
  if (!p?.auto_withdraw) return null;
  const def = p.auto_withdraw_address_id ? addrs.find((x) => x.address_id === p.auto_withdraw_address_id) : null;
  return def ? { addr: def, skipCooling: false } : null;
}

export type SettlementPayoutResult =
  | { mode: "sent"; withdrawal: WithdrawalRow }
  | { mode: "kept" }
  | { mode: "parked"; reason: "cooling" | "error"; usable_at?: string | null; detail?: string };

/**
 * Pay a settled leg straight out of custody when the party asked for it (deal-level
 * address or auto-withdraw ON). Otherwise the amount simply stays in their SafeDeal
 * balance ("kept"). When the chosen address is still in its cooling-off, the amount is
 * parked and released automatically by releaseParkedPayouts().
 */
export async function settlementPayout(customerId: number, amount: number, deal: { escrow_id: number; title: string }, pref?: PayoutPref | null): Promise<SettlementPayoutResult> {
  const customer = await customerById(customerId);
  if (!customer) return { mode: "parked", reason: "error", detail: "customer not found" };
  const dest = await resolvePayoutDestination(customerId, pref);
  if (!dest) return { mode: "kept" };
  try {
    const w = await requestWithdrawal(customer, { address_id: dest.addr.address_id, amount, source: "settlement", escrow_id: deal.escrow_id, fee_covered: true, skip_cooling: dest.skipCooling, deal_title: deal.title });
    return { mode: "sent", withdrawal: w };
  } catch (err) {
    const msg = (err as Error).message || "";
    await parkPayout(customerId, amount);
    if (/added recently/i.test(msg)) return { mode: "parked", reason: "cooling", usable_at: dest.addr.usable_at || null };
    apiLogger.error(`[SafeDeal] settlement payout failed for customer ${customerId}: ${msg}`);
    return { mode: "parked", reason: "error", detail: msg };
  }
}

async function parkPayout(customerId: number, amount: number): Promise<void> {
  await sequelize.query(
    `UPDATE tbl_safedeal_profile SET parked_payout_usd = parked_payout_usd + :amt, updated_at = NOW() WHERE customer_id = :id`,
    { replacements: { amt: toFixedStr(amount, 2), id: customerId }, type: QueryTypes.UPDATE }
  );
}

export async function clearParked(customerId: number): Promise<void> {
  await sequelize.query(`UPDATE tbl_safedeal_profile SET parked_payout_usd = 0, updated_at = NOW() WHERE customer_id = :id`, { replacements: { id: customerId }, type: QueryTypes.UPDATE });
}

/**
 * Deposit reserve — wallet top-ups are "spending money for deals" and must NEVER be pulled out by
 * auto-withdraw. We track the un-spent deposit total per customer; the auto-withdraw sweep skips it,
 * so only deal *earnings* are ever auto-sent. The reserve grows on deposit (addDepositReserve) and is
 * clamped down to the live available balance whenever funds leave the wallet (withdrawal or deal
 * funding) via clampDepositReserve — so a manual withdrawal or funding a deal from balance correctly
 * releases the protection, while incoming earnings stay sweepable.
 */
export async function addDepositReserve(customerId: number, amount: number): Promise<void> {
  if (!(Number(amount) > 0)) return;
  await sequelize.query(
    `UPDATE tbl_safedeal_profile SET deposit_reserved_usd = COALESCE(deposit_reserved_usd, 0) + :amt, updated_at = NOW() WHERE customer_id = :id`,
    { replacements: { amt: toFixedStr(Number(amount), 2), id: customerId }, type: QueryTypes.UPDATE }
  );
}

export async function clampDepositReserve(customerId: number): Promise<void> {
  await sequelize.query(
    `UPDATE tbl_safedeal_profile p
        SET deposit_reserved_usd = LEAST(
              COALESCE(p.deposit_reserved_usd, 0),
              GREATEST(0, COALESCE((SELECT amount FROM tbl_customer_wallet w WHERE w.customer_id = p.customer_id ORDER BY wallet_id ASC LIMIT 1), 0))),
            updated_at = NOW()
      WHERE p.customer_id = :id`,
    { replacements: { id: customerId }, type: QueryTypes.UPDATE }
  );
}

export async function getDepositReserve(customerId: number): Promise<number> {
  const rows = await sequelize.query<{ deposit_reserved_usd: string | number }>(
    `SELECT deposit_reserved_usd FROM tbl_safedeal_profile WHERE customer_id = :id LIMIT 1`,
    { replacements: { id: customerId }, type: QueryTypes.SELECT }
  );
  const stored = round2(Number(rows[0]?.deposit_reserved_usd || 0));
  if (stored <= 0) return 0;
  const bal = await getBalances(customerId);
  return round2(Math.min(stored, bal.available));
}

/**
 * Switch-on sweep: when auto-withdraw is turned ON, push the CURRENT available balance
 * out to the auto-withdraw address too (not only future settlements / parked funds).
 * Behaves like a normal withdrawal — the network fee applies and amounts over the
 * approval threshold are queued for review. If the address is still in its cooling-off,
 * the whole available balance is parked so releaseParkedPayouts() sends it once usable.
 */
export async function sweepBalanceToAutoWithdraw(customerId: number): Promise<{ mode: "sent" | "parked" | "skipped"; amount: number; withdrawal?: WithdrawalRow }> {
  const dest = await resolvePayoutDestination(customerId, null); // returns the auto-withdraw address only when auto-withdraw is ON
  if (!dest) return { mode: "skipped", amount: 0 };
  const bal = await getBalances(customerId);
  const reserved = await getDepositReserve(customerId); // deposits are for funding deals — never auto-swept
  const amount = round2(Math.max(0, bal.available - reserved));
  if (amount <= 0) return { mode: "skipped", amount: 0 };
  try {
    assertAddressUsable(dest.addr);
  } catch {
    // Address still cooling — park the whole balance; the hourly release sends it once usable.
    await sequelize.query(
      `UPDATE tbl_safedeal_profile SET parked_payout_usd = GREATEST(parked_payout_usd, :amt), updated_at = NOW() WHERE customer_id = :id`,
      { replacements: { amt: toFixedStr(amount, 2), id: customerId }, type: QueryTypes.UPDATE }
    );
    return { mode: "parked", amount };
  }
  if (amount < MIN_WITHDRAWAL_USD) return { mode: "skipped", amount }; // below the minimum withdrawal — leave it in the balance
  const customer = await customerById(customerId);
  if (!customer) return { mode: "skipped", amount: 0 };
  try {
    const w = await requestWithdrawal(customer, { address_id: dest.addr.address_id, amount, source: "auto" });
    return { mode: "sent", amount, withdrawal: w };
  } catch (err) {
    apiLogger.warn(`[SafeDeal] auto-withdraw enable sweep failed for customer ${customerId}: ${(err as Error).message}`);
    return { mode: "skipped", amount: 0 };
  }
}

/** Send parked settlement money once the auto-withdraw address clears its hold (called on profile change + hourly). */
export async function releaseParkedPayouts(customerId?: number): Promise<number> {
  const rows = await sequelize.query<{ customer_id: number; parked_payout_usd: string }>(
    `SELECT customer_id, parked_payout_usd FROM tbl_safedeal_profile WHERE parked_payout_usd > 0${customerId ? " AND customer_id = :id" : ""} LIMIT 200`,
    { replacements: { id: customerId ?? null }, type: QueryTypes.SELECT }
  );
  let released = 0;
  for (const r of rows) {
    const customer = await customerById(r.customer_id);
    if (!customer) continue;
    const dest = await resolvePayoutDestination(r.customer_id, null);
    if (!dest) {
      // Auto-withdraw is off (or its address is gone): the money simply stays in the balance.
      await clearParked(r.customer_id);
      continue;
    }
    try { assertAddressUsable(dest.addr); } catch { continue; }
    const bal = await getBalances(r.customer_id);
    const amount = Math.min(round2(Number(r.parked_payout_usd)), round2(bal.available));
    if (amount <= 0) {
      await clearParked(r.customer_id);
      continue;
    }
    try {
      await requestWithdrawal(customer, { address_id: dest.addr.address_id, amount, source: "settlement", fee_covered: true, deal_title: "parked deal payout" });
      await sequelize.query(`UPDATE tbl_safedeal_profile SET parked_payout_usd = GREATEST(parked_payout_usd - :amt, 0), updated_at = NOW() WHERE customer_id = :id`, {
        replacements: { amt: toFixedStr(amount, 2), id: r.customer_id },
        type: QueryTypes.UPDATE,
      });
      released++;
    } catch (err) {
      apiLogger.error(`[SafeDeal] releasing parked payout for customer ${r.customer_id} failed: ${(err as Error).message}`);
    }
  }
  return released;
}
