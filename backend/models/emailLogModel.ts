import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/** One row per outbound email: queued → sent → delivered | bounced, or failed / suppressed / expired. */
const emailLogModel = sequelize.define(
  "EmailLog",
  {
    log_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    to_email: { type: DataTypes.STRING(320), allowNull: false },
    to_name: { type: DataTypes.STRING(255), allowNull: true },
    subject: { type: DataTypes.STRING(500), allowNull: false },
    template: { type: DataTypes.STRING(120), allowNull: true },
    lane: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "default" },
    sender_email: { type: DataTypes.STRING(320), allowNull: true },
    status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: "queued" },
    attempts: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
    job_id: { type: DataTypes.STRING(120), allowNull: true },
    brevo_message_id: { type: DataTypes.STRING(255), allowNull: true },
    last_error: { type: DataTypes.TEXT, allowNull: true },
    last_event: { type: DataTypes.STRING(32), allowNull: true },
    last_event_at: { type: DataTypes.DATE, allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: "tbl_email_log", timestamps: false }
);

export default emailLogModel;
