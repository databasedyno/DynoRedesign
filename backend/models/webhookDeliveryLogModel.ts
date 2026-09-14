import { DataTypes, Model } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Webhook Delivery Log Model
 * Tracks all webhook delivery attempts for payment notifications
 */
class WebhookDeliveryLog extends Model {}

WebhookDeliveryLog.init(
  {
    log_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Company ID that owns this webhook",
    },
    webhook_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: "URL where webhook was sent",
    },
    event_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Event type: payment.pending, payment.confirmed, webhook.test",
    },
    webhook_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Unique webhook delivery ID",
    },
    payload: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "JSON payload that was sent",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
      comment: "Delivery status: pending, success, failed",
    },
    response_status: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "HTTP response status code from webhook endpoint",
    },
    response_time_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Response time in milliseconds",
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Error message if delivery failed",
    },
    retry_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of retry attempts",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "When the webhook delivery was initiated",
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the webhook delivery completed (success or final failure)",
    },
  },
  {
    sequelize,
    tableName: "tbl_webhook_delivery_log",
    timestamps: false,
    indexes: [
      {
        fields: ["company_id"],
        name: "idx_webhook_log_company",
      },
      {
        fields: ["event_type"],
        name: "idx_webhook_log_event_type",
      },
      {
        fields: ["status"],
        name: "idx_webhook_log_status",
      },
      {
        fields: ["created_at"],
        name: "idx_webhook_log_created_at",
      },
    ],
  }
);

export default WebhookDeliveryLog;
