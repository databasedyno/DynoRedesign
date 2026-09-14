import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Service Health DAILY ROLLUP model (tbl_service_health_daily).
 *
 * WHY THIS EXISTS
 * ----------------
 * The raw per-check table `tbl_service_health` is pruned to a 7-day window
 * (see monitoringService.pruneOldHealthChecks) to keep it small — but the
 * public status page draws a 90-DAY uptime chart. That mismatch meant ~83/90
 * days were always "no_data" and long-term history effectively vanished after
 * a week (looked like the record "reset" on every redeploy).
 *
 * This table stores ONE permanent row per (service_id, check_date) with the
 * day's aggregated counts + worst status. It is NEVER pruned, so the 90-day
 * chart accumulates a true, redeploy-proof history. Storage is tiny
 * (5 services × 365 days ≈ 1.8k rows/year).
 *
 * `timestamps: false` + a manual `updated_at` keeps the raw upsert SQL free of
 * quoted camelCase identifiers.
 */
const serviceHealthDailyModel = sequelize.define(
  "ServiceHealthDaily",
  {
    daily_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    service_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    service_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    check_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    total_checks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    operational_checks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    degraded_checks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    outage_checks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    avg_latency_ms: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // "operational" | "degraded" | "outage" — worst status seen that day.
    worst_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "operational",
    },
    first_check_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_check_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tbl_service_health_daily",
    timestamps: false,
    indexes: [
      {
        name: "service_health_daily_svc_date_uq",
        unique: true,
        fields: ["service_id", "check_date"],
      },
    ],
  }
);

export default serviceHealthDailyModel;
