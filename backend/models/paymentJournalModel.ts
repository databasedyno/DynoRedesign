/**
 * Payment Journal Model — Critical State Persistence
 * 
 * Ensures no payment state is lost even if Redis goes down.
 * Every critical state transition is journaled to PostgreSQL.
 * This provides:
 *   1. Audit trail for every payment
 *   2. Recovery source when Redis loses data
 *   3. Idempotency tracking for settlement TX attempts
 *   4. Dead-man's switch for stuck payments
 */

import { DataTypes, Model } from "sequelize";
import sequelize from "../utils/dbInstance";

interface PaymentJournalAttributes {
  id?: number;
  payment_id: string;           // UUID of the payment
  tx_id: string | null;         // Blockchain transaction ID
  address: string;              // Crypto address involved
  currency: string;             // BTC, ETH, etc.
  event: string;                // State transition event name
  from_state: string | null;    // Previous state
  to_state: string;             // New state
  amount: number | null;        // Amount involved
  settlement_tx_id: string | null;  // Outgoing settlement TX (idempotency)
  company_id: number | null;    // Merchant company
  metadata: Record<string, unknown> | null;  // Extra context
  created_at?: Date;
}

class PaymentJournal extends Model<PaymentJournalAttributes> implements PaymentJournalAttributes {
  declare id: number;
  declare payment_id: string;
  declare tx_id: string | null;
  declare address: string;
  declare currency: string;
  declare event: string;
  declare from_state: string | null;
  declare to_state: string;
  declare amount: number | null;
  declare settlement_tx_id: string | null;
  declare company_id: number | null;
  declare metadata: Record<string, unknown> | null;
  declare created_at: Date;
}

PaymentJournal.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    payment_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    tx_id: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    event: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    from_state: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    to_state: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
    },
    settlement_tx_id: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
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
    tableName: "tbl_payment_journal",
    timestamps: false,
    indexes: [
      { fields: ["payment_id"] },
      { fields: ["tx_id"] },
      { fields: ["settlement_tx_id"] },
      { fields: ["address", "currency"] },
      { fields: ["created_at"] },
      { fields: ["event"] },
    ],
  }
);

export default PaymentJournal;
