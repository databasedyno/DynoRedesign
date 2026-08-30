import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Team Activity Log (2026-06). Append-only audit trail of write actions across a
 * business, attributed to the actor (owner OR a team member). Powers the owner's
 * "who did what, and when" view.
 *
 * Deliberately stores NO request bodies (money app — never persist secrets/PII):
 * just actor, company, a short action + human description, the method/path and
 * the response status. Additive, create-only table (migration 0016) — nothing
 * depends on it until the Team Activity feature ships.
 */
const teamActivityModel = sequelize.define(
  "tbl_team_activity",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // The business the action was performed on.
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Who did it (owner or member). Null only for un-attributable events.
    actor_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    actor_email: {
      type: DataTypes.STRING(190),
      allowNull: true,
    },
    // Short machine action, e.g. "company.update", "apikey.delete".
    action: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    // Human-readable one-liner, e.g. "Changed a payout wallet".
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    method: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    path: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Optional non-sensitive context (ids only). Never request bodies.
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_team_activity",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [{ fields: ["company_id", "created_at"], name: "idx_team_activity_company_time" }],
  }
);

export default teamActivityModel;
