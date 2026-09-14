import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../utils/dbInstance";

interface TrustedDeviceAttributes {
  id: number;
  user_id: number;
  token_hash: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

type Creation = Optional<TrustedDeviceAttributes, "id" | "created_at" | "last_seen_at" | "revoked_at">;

/** A browser that passed the second factor — skips the 2FA challenge for 90 rolling days. */
class TrustedDevice extends Model<TrustedDeviceAttributes, Creation> implements TrustedDeviceAttributes {
  public id!: number;
  public user_id!: number;
  public token_hash!: string;
  public device_name!: string | null;
  public browser!: string | null;
  public os!: string | null;
  public ip_address!: string | null;
  public created_at!: Date;
  public last_seen_at!: Date;
  public expires_at!: Date;
  public revoked_at!: Date | null;
}

TrustedDevice.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    device_name: { type: DataTypes.STRING(120), allowNull: true },
    browser: { type: DataTypes.STRING(60), allowNull: true },
    os: { type: DataTypes.STRING(60), allowNull: true },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    last_seen_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: "tbl_trusted_device",
    timestamps: false,
    indexes: [{ fields: ["user_id", "revoked_at"] }],
  }
);

export default TrustedDevice;
