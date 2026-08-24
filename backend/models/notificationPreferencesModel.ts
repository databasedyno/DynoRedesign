import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const notificationPreferencesModel = sequelize.define(
  "NotificationPreferences",
  {
    preference_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    company_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    // Notification types
    transaction_updates: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    payment_received: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    payment_pending: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    weekly_summary: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Opt-IN (default false): the richer weekly "payout digest" email summarising
    // settled payouts + anything still pending. Gated in payoutDigestService cron.
    payout_digest_weekly: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    security_alerts: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // When true: only email on genuinely new (unseen) device fingerprints.
    // When false (default): email every fingerprint per 15-min throttle window.
    // Set to true if you want to silence routine repeat logins from the same browser/IP.
    notify_new_device_only: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Delivery channels
    email_notifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    sms_notifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    browser_notifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "tbl_notification_preferences",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default notificationPreferencesModel;
