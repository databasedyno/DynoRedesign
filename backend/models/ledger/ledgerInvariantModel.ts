/**
 * Ledger Invariant Check Model — Recon result log (Tier-1 Item #3)
 *
 * Records the outcome of each invariant sweep. The cron writes:
 *   - status: "ok" | "drift" | "error"
 *   - drift_by_currency: { BTC: "0.00000000", USDT: "0.001", ... }
 *   - stats: rows_scanned, batches_scanned, window_start, window_end, duration_ms
 *
 * Alerts fire on drift; the log gives operators a historical trend.
 */

import { DataTypes, Model } from "sequelize";
import sequelize from "../../utils/dbInstance";

export interface LedgerInvariantCheckAttributes {
  id?: number;
  status: "ok" | "drift" | "error";
  window_start: Date;
  window_end: Date;
  rows_scanned: number;
  batches_scanned: number;
  drift_by_currency: Record<string, string> | null;
  error_message: string | null;
  duration_ms: number;
  metadata: Record<string, unknown> | null;
  created_at?: Date;
}

class LedgerInvariantCheck extends Model<LedgerInvariantCheckAttributes> implements LedgerInvariantCheckAttributes {
  declare id: number;
  declare status: "ok" | "drift" | "error";
  declare window_start: Date;
  declare window_end: Date;
  declare rows_scanned: number;
  declare batches_scanned: number;
  declare drift_by_currency: Record<string, string> | null;
  declare error_message: string | null;
  declare duration_ms: number;
  declare metadata: Record<string, unknown> | null;
  declare created_at: Date;
}

LedgerInvariantCheck.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    window_start: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    window_end: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    rows_scanned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    batches_scanned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    drift_by_currency: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    duration_ms: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
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
    tableName: "tbl_ledger_invariant_checks",
    timestamps: false,
    indexes: [
      { fields: ["created_at"] },
      { fields: ["status"] },
    ],
  }
);

export default LedgerInvariantCheck;
