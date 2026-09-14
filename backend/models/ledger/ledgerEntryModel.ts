/**
 * Ledger Entry Model — Immutable Double-Entry Rows (Tier-1 Item #3)
 *
 * Every business event that moves money creates ≥2 rows here that MUST sum to zero
 * (DR - CR = 0) per currency, enforced by `ledgerService.postDoubleEntry()`.
 *
 * IMPORTANT:
 *   - Rows are append-only. NEVER update `amount`, `direction`, `account_code`.
 *   - Corrections happen via reversing entries with `reversal_of` set.
 *   - Uniqueness key `(payment_id, journal_event, dedup_key)` prevents dupes.
 *
 * amount is always POSITIVE. Direction (DR|CR) decides sign at aggregation time.
 * currency is on the LINE, not the batch — a batch can mix currencies for
 * conversion events (e.g., BTC leg + USDT leg with a `fx_rate` in metadata).
 */

import { DataTypes, Model } from "sequelize";
import sequelize from "../../utils/dbInstance";

export type Direction = "DR" | "CR";

export interface LedgerEntryAttributes {
  id?: number;
  batch_id: string;            // UUID grouping all rows in one balanced posting
  line_index: number;          // 0-based position within batch (enables per-line uniq)
  account_code: string;        // FK-by-code to tbl_ledger_accounts.code
  direction: Direction;
  amount: string;              // Stored as DECIMAL string to avoid float loss
  currency: string;            // BTC, ETH, USDT, ... or fiat code (USD)
  payment_id: string | null;   // Payment UUID this posting relates to (if any)
  company_id: number | null;   // Merchant tenant (for per-tenant aggregation)
  journal_event: string;       // Mirrors paymentJournal.event (settlement_sent, ...)
  tx_id: string | null;        // Blockchain TX (in or out)
  dedup_key: string;           // Idempotency: same (payment,event,dedup_key) is a no-op
  reversal_of: string | null;  // batch_id being reversed (for corrections)
  metadata: Record<string, unknown> | null;
  created_at?: Date;
}

class LedgerEntry extends Model<LedgerEntryAttributes> implements LedgerEntryAttributes {
  declare id: number;
  declare batch_id: string;
  declare line_index: number;
  declare account_code: string;
  declare direction: Direction;
  declare amount: string;
  declare currency: string;
  declare payment_id: string | null;
  declare company_id: number | null;
  declare journal_event: string;
  declare tx_id: string | null;
  declare dedup_key: string;
  declare reversal_of: string | null;
  declare metadata: Record<string, unknown> | null;
  declare created_at: Date;
}

LedgerEntry.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    batch_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    line_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    account_code: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    direction: {
      type: DataTypes.STRING(2),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(30, 12),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    payment_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    journal_event: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    tx_id: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    dedup_key: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    reversal_of: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "tbl_ledger_entries",
    timestamps: false,
    indexes: [
      { fields: ["batch_id"] },
      { fields: ["payment_id"] },
      { fields: ["company_id"] },
      { fields: ["account_code"] },
      { fields: ["currency"] },
      { fields: ["journal_event"] },
      { fields: ["created_at"] },
      {
        // Idempotency guarantee — see ledgerService.postDoubleEntry().
        // Uniqueness is per-LINE within an idempotency scope so batches
        // may legitimately contain multiple lines with the same (account,direction).
        name: "tbl_ledger_entries_dedup_uniq",
        fields: ["payment_id", "journal_event", "dedup_key", "line_index"],
        unique: true,
      },
    ],
  }
);

export default LedgerEntry;
