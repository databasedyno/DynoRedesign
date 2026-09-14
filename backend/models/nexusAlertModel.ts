import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * tbl_nexus_alert — dedupe store for registration-threshold email alerts
 * (backlog #4). One row per (merchant, threshold); `level` records the highest
 * level already emailed so we don't re-send the same warning.
 */
const nexusAlertModel = sequelize.define(
  "NexusAlert",
  {
    alert_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    merchant_user_id: { type: DataTypes.BIGINT, allowNull: false },
    threshold_key: { type: DataTypes.STRING(24), allowNull: false },
    level: { type: DataTypes.STRING(16), allowNull: false, comment: "approaching | crossed" },
    notified_at: { type: DataTypes.DATE },
  },
  {
    tableName: "tbl_nexus_alert",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ unique: true, fields: ["merchant_user_id", "threshold_key"] }],
  }
);

export default nexusAlertModel;
