import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { apiLogger } from "../utils/loggers";

/**
 * Service Health Check Model
 * Stores actual health check results for infrastructure monitoring
 */
const serviceHealthModel = sequelize.define(
  "ServiceHealth",
  {
    health_id: {
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
    status: {
      type: DataTypes.ENUM("operational", "degraded", "outage"),
      defaultValue: "operational",
    },
    latency_ms: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    check_timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    check_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    tableName: "tbl_service_health",
    indexes: [
      {
        fields: ["service_id", "check_date"],
      },
      {
        fields: ["check_timestamp"],
      },
    ],
  }
);

// Create table if not exists — create-only in production (never ALTER on boot); alter only in dev
serviceHealthModel.sync({ alter: process.env.NODE_ENV !== "production" }).then(() => {
  apiLogger.info("tbl_service_health table ready");
}).catch(err => {
  apiLogger.error("Error creating tbl_service_health:", err.message);
});

export default serviceHealthModel;
