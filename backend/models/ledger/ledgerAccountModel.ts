/**
 * Ledger Account Model — Chart of Accounts for Double-Entry Ledger (Tier-1 Item #3)
 *
 * Every ledger entry references an account_code. Standard accounts:
 *   - buyer_escrow        (LIABILITY)  funds held from buyer, owed to merchant/refund
 *   - merchant_payable    (LIABILITY)  net amount owed to a merchant (post-fee)
 *   - fee_revenue         (INCOME)     platform take-rate + fixed fees
 *   - gas_expense         (EXPENSE)    on-chain network fees paid by the platform
 *   - conversion_pnl      (INCOME)     PnL from stablecoin auto-conversion
 *   - refund_liability    (LIABILITY)  refundable amount pending payout
 *   - suspense            (ASSET)      unbalanced/uncategorized transient balances
 *
 * accounts are opinionated but extensible via `bootstrapStandardAccounts()`.
 */

import { DataTypes, Model } from "sequelize";
import sequelize from "../../utils/dbInstance";

export type AccountKind = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";

export interface LedgerAccountAttributes {
  id?: number;
  code: string;              // "buyer_escrow", "merchant_payable", ...
  name: string;
  kind: AccountKind;
  // Which side normally increases the balance: ASSET/EXPENSE = DR, LIABILITY/INCOME/EQUITY = CR
  normal_side: "DR" | "CR";
  description?: string | null;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

class LedgerAccount extends Model<LedgerAccountAttributes> implements LedgerAccountAttributes {
  declare id: number;
  declare code: string;
  declare name: string;
  declare kind: AccountKind;
  declare normal_side: "DR" | "CR";
  declare description: string | null;
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

LedgerAccount.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    kind: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    normal_side: {
      type: DataTypes.STRING(2),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "tbl_ledger_accounts",
    timestamps: false,
    indexes: [{ fields: ["code"], unique: true }],
  }
);

export default LedgerAccount;
