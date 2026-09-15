import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * tbl_tip_goal_milestone — dedupe store for the creator "monthly tip goal"
 * milestone emails (50% / 100%). One row per (storefront scope, month, milestone);
 * `scope` is "company:<id>" (STOREFRONT_PER_COMPANY) or "user:<id>" (legacy).
 */
const tipGoalMilestoneModel = sequelize.define(
  "TipGoalMilestone",
  {
    milestone_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    scope: { type: DataTypes.STRING(32), allowNull: false },
    month_key: { type: DataTypes.STRING(7), allowNull: false, comment: "YYYY-MM (UTC)" },
    milestone: { type: DataTypes.SMALLINT, allowNull: false, comment: "50 | 100" },
    goal_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    raised_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    emailed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    notified_at: { type: DataTypes.DATE },
  },
  {
    tableName: "tbl_tip_goal_milestone",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ unique: true, fields: ["scope", "month_key", "milestone"] }],
  }
);

export default tipGoalMilestoneModel;
