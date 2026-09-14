import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Per-session support state for the admin live-chat inbox (2026-09-08).
 *
 * The chat transcript itself lives in tbl_support_chat_message (one row per
 * message). This table adds session-level control so a human admin can take
 * over a conversation from the AI ("Emily") and hand it back:
 *
 *   mode = 'ai'    → POST /api/support/chat is answered by OpenAI (default)
 *   mode = 'human' → the visitor's messages are stored but NOT auto-answered;
 *                    a human agent replies from the admin Support Inbox.
 *
 * Rows are created/updated lazily (upsert) whenever a session sees activity, so
 * historical sessions that predate this table simply default to ai/open.
 */
const supportSessionModel = sequelize.define(
  "Support_Session",
  {
    session_id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    mode: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "ai", // 'ai' | 'human'
    },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "open", // 'open' | 'closed'
    },
    contact_email: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    escalated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Count of visitor messages the admin has not opened yet (inbox badge).
    admin_unread: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_agent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_email_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_support_session",
    indexes: [{ fields: ["status"] }, { fields: ["mode"] }, { fields: ["last_message_at"] }],
  }
);

export default supportSessionModel;
