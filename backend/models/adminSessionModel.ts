import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Admin console sessions (tbl_admin_session) — SEC-002 remediation.
 *
 * Each successful admin login (password + TOTP) mints a short-lived, revocable
 * session row. The admin JWT carries this row's `session_id` (sid) + `jti`;
 * adminAuthMiddleware rejects any token whose session is missing, revoked,
 * expired, or whose jti no longer matches. Combined with tbl_admin.tokens_valid_after
 * this gives per-session revoke + "sign out everywhere" for the admin console,
 * replacing the old non-revocable 30-day bearer token.
 */
const adminSessionModel = sequelize.define(
  "AdminSession",
  {
    session_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    jti: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revoke_reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tbl_admin_session",
    timestamps: false,
    indexes: [{ fields: ["admin_id"] }],
  }
);

export default adminSessionModel;
