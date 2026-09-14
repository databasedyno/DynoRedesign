import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../utils/dbInstance";

export type SecurityEventType = "2fa_reset" | "wallet_unfrozen";

interface SecurityEventAttributes {
  id: number;
  user_id: number;
  type: SecurityEventType;
  severity: "info" | "high";
  summary: string;
  meta: Record<string, unknown> | null;
  freeze_until: Date | null;
  resolved_at: Date | null;
  resolved_by: string | null;
  created_at: Date;
}

type Creation = Optional<SecurityEventAttributes, "id" | "meta" | "freeze_until" | "resolved_at" | "resolved_by" | "created_at">;

/** Admin-facing security timeline (2FA resets, wallet freezes / unfreezes). */
class SecurityEvent extends Model<SecurityEventAttributes, Creation> implements SecurityEventAttributes {
  public id!: number;
  public user_id!: number;
  public type!: SecurityEventType;
  public severity!: "info" | "high";
  public summary!: string;
  public meta!: Record<string, unknown> | null;
  public freeze_until!: Date | null;
  public resolved_at!: Date | null;
  public resolved_by!: string | null;
  public created_at!: Date;
}

SecurityEvent.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(40), allowNull: false },
    severity: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "info" },
    summary: { type: DataTypes.STRING(500), allowNull: false },
    meta: { type: DataTypes.JSONB, allowNull: true },
    freeze_until: { type: DataTypes.DATE, allowNull: true },
    resolved_at: { type: DataTypes.DATE, allowNull: true },
    resolved_by: { type: DataTypes.STRING(120), allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "tbl_security_event",
    timestamps: false,
    indexes: [{ fields: ["created_at"] }, { fields: ["user_id"] }],
  }
);

export default SecurityEvent;
