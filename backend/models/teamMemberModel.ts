import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Team Members / RBAC (2026-08).
 *
 * A user ("member") granted access to a company owned by ANOTHER user (the
 * "Owner"). Owner rows are intentionally NOT stored here: ownership stays
 * implicit via tbl_company.user_id. Scope is PER-COMPANY — one row per company
 * the member can access — each carrying a role + a granular permission map.
 *
 * Additive, create-only table (see migration 0015_team_members). Nothing reads
 * or writes it until the Team Members feature is wired up (Phases 2-4), so
 * provisioning it is a no-op for all existing behavior.
 */
const teamMemberModel = sequelize.define(
  "tbl_team_member",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // The business this membership grants access to.
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // The member's user_id — NULL until they accept the invite & set a password.
    member_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Lower-cased email the invite was sent to (used to match on accept).
    invited_email: {
      type: DataTypes.STRING(190),
      allowNull: false,
    },
    // 'admin' | 'member'  (Owner is implicit via tbl_company.user_id).
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "member",
    },
    // Granular permission map, e.g. { view_transactions: true, manage_wallets: false }.
    permissions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    // 'invited' | 'active' | 'revoked'
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "invited",
    },
    invited_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Opaque token embedded in the invite link (validated on accept).
    invite_token: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    invite_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_team_member",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["company_id", "invited_email"],
        name: "uniq_team_company_email",
      },
      { fields: ["member_user_id"] },
      { fields: ["invite_token"] },
    ],
  }
);

export default teamMemberModel;
