import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Platform super-admin credentials (tbl_admin).
 *
 * Historically referenced only via raw SQL in adminController (login /
 * change-password). This model formalises the schema so the table is created
 * and managed like every other entity. Login continues to match on email +
 * bcrypt password; `role` is reserved for future granularity but the product
 * currently uses a SINGLE super-admin.
 */
const adminModel = sequelize.define(
  "Admin",
  {
    admin_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "ADMIN",
    },
    // SEC-002: mandatory TOTP + revocable sessions + lockout.
    totp_secret: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    totp_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    totp_enrolled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    totp_backup_codes: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    tokens_valid_after: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failed_login_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_admin",
  }
);

export default adminModel;
