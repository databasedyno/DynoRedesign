/**
 * Merchant-side customer wallet ledger (store credit). One USD-denominated
 * balance per tbl_customer row; every adjustment writes a CREDIT/DEBIT row to
 * tbl_customer_transaction so the balance is fully auditable.
 */
import crypto from "crypto";
import { QueryTypes, Transaction } from "sequelize";
import sequelize from "../utils/dbInstance";
import { apiLogger } from "../utils/loggers";
import { toFixedStr, toNumber } from "../utils/money";

export class CustomerWalletError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface CustomerRow {
  customer_id: number;
  company_id: number;
  customer_name: string | null;
  email: string | null;
}

interface WalletRow {
  wallet_id: number;
  amount: number | string;
  wallet_type: string;
}

export interface LedgerEntry {
  id: string | null;
  customer_id: number;
  direction: "credit" | "debit";
  amount: number;
  currency: string;
  description: string | null;
  reference: string;
  source: string;
  status: string | null;
  created_at: string;
}

const round2 = (n: number): number => toNumber(Number(n) || 0, 2);

/** Find a customer row that belongs to the brand — by numeric id or by e-mail (creates one when missing). */
export const resolveCustomerForBrand = async (params: {
  companyId: number;
  customerId?: number | null;
  email?: string | null;
  name?: string | null;
  createIfMissing?: boolean;
}): Promise<CustomerRow> => {
  const { companyId } = params;
  if (params.customerId) {
    const rows = await sequelize.query<CustomerRow>(
      `SELECT customer_id, company_id, customer_name, email FROM tbl_customer WHERE customer_id = :id AND company_id = :companyId LIMIT 1`,
      { replacements: { id: params.customerId, companyId }, type: QueryTypes.SELECT }
    );
    if (!rows[0]) throw new CustomerWalletError(404, "Customer not found for this brand");
    return rows[0];
  }
  const email = String(params.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new CustomerWalletError(400, "A customer e-mail is required");
  const rows = await sequelize.query<CustomerRow>(
    `SELECT customer_id, company_id, customer_name, email FROM tbl_customer
      WHERE company_id = :companyId AND LOWER(email) = :email
      ORDER BY customer_id ASC LIMIT 1`,
    { replacements: { companyId, email }, type: QueryTypes.SELECT }
  );
  if (rows[0]) return rows[0];
  if (!params.createIfMissing) throw new CustomerWalletError(404, "Customer not found for this brand");
  const created = await sequelize.query<CustomerRow>(
    `INSERT INTO tbl_customer (id, customer_name, email, mobile, company_id, "createdAt", "updatedAt")
     VALUES (:id, :name, :email, '', :companyId, NOW(), NOW())
     RETURNING customer_id, company_id, customer_name, email`,
    {
      replacements: { id: crypto.randomUUID(), name: String(params.name || "").trim() || email, email, companyId },
      type: QueryTypes.SELECT,
    }
  );
  apiLogger.info(`[CustomerWallet] Created customer ${created[0].customer_id} (${email}) for company ${companyId}`);
  return created[0];
};

const lockOrCreateWallet = async (customerId: number, t: Transaction): Promise<WalletRow> => {
  const rows = await sequelize.query<WalletRow>(
    `SELECT wallet_id, amount, wallet_type FROM tbl_customer_wallet WHERE customer_id = :customerId ORDER BY wallet_id ASC LIMIT 1 FOR UPDATE`,
    { replacements: { customerId }, type: QueryTypes.SELECT, transaction: t }
  );
  if (rows[0]) return rows[0];
  const created = await sequelize.query<WalletRow>(
    `INSERT INTO tbl_customer_wallet (id, customer_id, amount, wallet_type, "createdAt", "updatedAt")
     VALUES (:id, :customerId, 0, 'USD', NOW(), NOW()) RETURNING wallet_id, amount, wallet_type`,
    { replacements: { id: crypto.randomUUID(), customerId }, type: QueryTypes.SELECT, transaction: t }
  );
  return created[0];
};

export const getCustomerWallet = async (customerIds: number[]): Promise<{ amount: number; wallet_type: string } | null> => {
  if (!customerIds.length) return null;
  const rows = await sequelize.query<WalletRow>(
    `SELECT wallet_id, amount, wallet_type FROM tbl_customer_wallet WHERE customer_id IN (:ids) ORDER BY wallet_id ASC`,
    { replacements: { ids: customerIds }, type: QueryTypes.SELECT }
  );
  if (!rows.length) return null;
  return {
    amount: round2(rows.reduce((s, r) => s + Number(r.amount || 0), 0)),
    wallet_type: rows[0].wallet_type || "USD",
  };
};

export const validateAdjustment = (amountRaw: unknown, descriptionRaw: unknown): { amount: number; description: string } => {
  const amount = round2(Number(amountRaw));
  if (!Number.isFinite(amount) || amount <= 0) throw new CustomerWalletError(400, "Amount must be a positive number");
  if (amount > 100000) throw new CustomerWalletError(400, "Amount cannot exceed 100,000 per adjustment");
  const description = String(descriptionRaw || "").trim();
  if (!description) throw new CustomerWalletError(400, "A reason is required");
  if (description.length > 200) throw new CustomerWalletError(400, "Reason must be 200 characters or fewer");
  return { amount, description };
};

/** Credit or debit a customer's balance atomically and write the audit row. */
export const adjustCustomerWallet = async (params: {
  customer: CustomerRow;
  direction: "credit" | "debit";
  amount: number;
  description: string;
  actor: string;
}) => {
  const { amount, description } = validateAdjustment(params.amount, params.description);

  const { customer, direction } = params;
  const result = await sequelize.transaction(async (t) => {
    const wallet = await lockOrCreateWallet(customer.customer_id, t);
    const previous = round2(Number(wallet.amount || 0));
    if (direction === "debit" && amount > previous) {
      throw new CustomerWalletError(400, `Insufficient balance: ${toFixedStr(previous, 2)} ${wallet.wallet_type} available`);
    }
    const next = round2(direction === "credit" ? previous + amount : previous - amount);
    await sequelize.query(
      `UPDATE tbl_customer_wallet SET amount = :next, "updatedAt" = NOW() WHERE wallet_id = :walletId`,
      { replacements: { next: toFixedStr(next, 2), walletId: wallet.wallet_id }, type: QueryTypes.UPDATE, transaction: t }
    );
    const reference = crypto.randomUUID();
    await sequelize.query(
      `INSERT INTO tbl_customer_transaction
         (id, company_id, customer_id, payment_mode, base_amount, base_currency, paid_amount, paid_currency,
          transaction_type, transaction_details, transaction_reference, status, "createdAt", "updatedAt")
       VALUES (:id, :companyId, :customerId, 'MERCHANT', :amount, :currency, :amount, :currency,
               :type, :details, :reference, 'successful', NOW(), NOW())`,
      {
        replacements: {
          id: crypto.randomUUID(),
          companyId: customer.company_id,
          customerId: customer.customer_id,
          amount: toFixedStr(amount, 2),
          currency: wallet.wallet_type || "USD",
          type: direction === "credit" ? "CREDIT" : "DEBIT",
          details: description,
          reference,
        },
        type: QueryTypes.INSERT,
        transaction: t,
      }
    );
    return { previous, next, currency: wallet.wallet_type || "USD", reference };
  });

  apiLogger.info(
    `[CustomerWallet] ${direction.toUpperCase()} ${toFixedStr(amount, 2)} ${result.currency} customer ${customer.customer_id} (company ${customer.company_id}) by ${params.actor}: ${result.previous} → ${result.next}`
  );
  return {
    customer_id: customer.customer_id,
    direction,
    amount,
    previous_balance: result.previous,
    new_balance: result.next,
    currency: result.currency,
    reference: result.reference,
  };
};

export const getCustomerWalletLedger = async (customerIds: number[], limit = 50): Promise<LedgerEntry[]> => {
  if (!customerIds.length) return [];
  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT id, customer_id, payment_mode, transaction_type, paid_amount, paid_currency, transaction_details,
            transaction_reference, status, "createdAt"
       FROM tbl_customer_transaction
      WHERE customer_id IN (:ids) AND transaction_type IN ('CREDIT','DEBIT')
      ORDER BY "createdAt" DESC LIMIT :limit`,
    { replacements: { ids: customerIds, limit }, type: QueryTypes.SELECT }
  );
  return rows.map((r) => ({
    id: (r.id as string) || null,
    customer_id: Number(r.customer_id),
    direction: String(r.transaction_type).toUpperCase() === "DEBIT" ? "debit" : "credit",
    amount: round2(Number(r.paid_amount || 0)),
    currency: (r.paid_currency as string) || "USD",
    description: (r.transaction_details as string) || null,
    reference: String(r.transaction_reference || ""),
    source: String(r.payment_mode || "").toUpperCase(),
    status: (r.status as string) || null,
    created_at: new Date(r.createdAt as string).toISOString(),
  }));
};
