/**
 * Inbound Event Model — DB-level idempotency for external provider callbacks
 * (Refactor Tier-2 Item #4).
 *
 * Every inbound provider event (Tatum crypto webhook, Flutterwave, Veriff KYC,
 * Binance, ...) can be recorded here BEFORE processing. The UNIQUE
 * (provider, provider_event_id) index makes "process exactly once" a
 * database-level guarantee rather than relying solely on a Redis dedup key.
 *
 * Flow:
 *   1. Verify signature (already done in routes/index.ts)
 *   2. INSERT (provider, provider_event_id) — unique violation => duplicate => no-op
 *   3. Enqueue async processing
 *   4. Return 200 fast
 *
 * Append-only. `status` reflects the async processing outcome for observability.
 */

import { DataTypes, Model } from "sequelize";
import sequelize from "../utils/dbInstance";

export type InboundEventStatus = "received" | "processed" | "failed";

export interface InboundEventAttributes {
  id?: number;
  provider: string;              // 'tatum' | 'flutterwave' | 'veriff' | 'binance' | ...
  provider_event_id: string;     // Stable per-event id (txId:address:asset, subscription ref, ...)
  event_type: string | null;     // Optional classification (e.g. 'crypto.incoming')
  payment_id: string | null;     // Correlated payment UUID, if known
  payload: Record<string, unknown> | null;
  status: InboundEventStatus;
  error: string | null;
  received_at?: Date;
  processed_at: Date | null;
}

class InboundEvent extends Model<InboundEventAttributes> implements InboundEventAttributes {
  declare id: number;
  declare provider: string;
  declare provider_event_id: string;
  declare event_type: string | null;
  declare payment_id: string | null;
  declare payload: Record<string, unknown> | null;
  declare status: InboundEventStatus;
  declare error: string | null;
  declare received_at: Date;
  declare processed_at: Date | null;
}

InboundEvent.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    provider: { type: DataTypes.STRING(32), allowNull: false },
    provider_event_id: { type: DataTypes.STRING(191), allowNull: false },
    event_type: { type: DataTypes.STRING(64), allowNull: true },
    payment_id: { type: DataTypes.STRING(100), allowNull: true },
    payload: { type: DataTypes.JSONB, allowNull: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "received" },
    error: { type: DataTypes.TEXT, allowNull: true },
    received_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    processed_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: "tbl_inbound_events",
    timestamps: false,
    indexes: [
      { fields: ["payment_id"] },
      { fields: ["status"] },
      { fields: ["received_at"] },
      {
        // The idempotency guarantee — one row per external event, forever.
        name: "tbl_inbound_events_provider_evt_uq",
        fields: ["provider", "provider_event_id"],
        unique: true,
      },
    ],
  }
);

export default InboundEvent;
