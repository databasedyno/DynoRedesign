/**
 * Outbox Event Model — Transactional Outbox (Refactor Tier-2 Item #10).
 *
 * A domain event row written INSIDE the same DB transaction as the state change
 * that produced it (e.g. the ledger settlement post). A separate relay worker
 * then reliably dispatches each row (retries + backoff), so a crash between
 * "DB committed" and "downstream side-effect fired" can never silently drop the
 * event — it stays `pending` and is retried.
 *
 * Lifecycle: pending -> processing -> dispatched   (or -> failed after max attempts)
 *
 * The relay is worker-only (WORKER_ROLE=primary + ENABLE_BACKGROUND_JOBS) and
 * the write path is gated by ENABLE_OUTBOX (default OFF) so production behaviour
 * is byte-identical until the flag is flipped.
 */

import { DataTypes, Model } from "sequelize";
import sequelize from "../utils/dbInstance";

export type OutboxStatus = "pending" | "processing" | "dispatched" | "failed";

export interface OutboxEventAttributes {
  id?: number;
  event_id: string;              // UUID — unique dispatch identity
  aggregate_type: string;        // 'payment' | 'refund' | ...
  aggregate_id: string;          // e.g. payment UUID
  event_type: string;            // 'payment.settled' | 'payment.detected' | ...
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  max_attempts: number;
  available_at: Date;            // Next eligible dispatch time (backoff)
  correlation_id: string | null; // Trace id linking ledger <-> outbox <-> webhook
  last_error: string | null;
  created_at?: Date;
  dispatched_at: Date | null;
}

class OutboxEvent extends Model<OutboxEventAttributes> implements OutboxEventAttributes {
  declare id: number;
  declare event_id: string;
  declare aggregate_type: string;
  declare aggregate_id: string;
  declare event_type: string;
  declare payload: Record<string, unknown>;
  declare status: OutboxStatus;
  declare attempts: number;
  declare max_attempts: number;
  declare available_at: Date;
  declare correlation_id: string | null;
  declare last_error: string | null;
  declare created_at: Date;
  declare dispatched_at: Date | null;
}

OutboxEvent.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    event_id: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    aggregate_type: { type: DataTypes.STRING(64), allowNull: false },
    aggregate_id: { type: DataTypes.STRING(100), allowNull: false },
    event_type: { type: DataTypes.STRING(64), allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "pending" },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20 },
    available_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    correlation_id: { type: DataTypes.STRING(64), allowNull: true },
    last_error: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    dispatched_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: "tbl_outbox",
    timestamps: false,
    indexes: [
      // Relay claim query: WHERE status='pending' AND available_at<=NOW() ORDER BY id
      { name: "tbl_outbox_status_available_idx", fields: ["status", "available_at"] },
      { fields: ["aggregate_type", "aggregate_id"] },
      { fields: ["correlation_id"] },
    ],
  }
);

export default OutboxEvent;
