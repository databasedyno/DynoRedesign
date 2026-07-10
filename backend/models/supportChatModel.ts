import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * AI Support Chat message storage (session 12, 2026-07-10).
 * One row per message (user or assistant) — grouped by a client-generated
 * session_id (UUID stored in the visitor's localStorage). user_id is set when
 * the visitor was logged in at the time of the message; NULL for anonymous
 * landing-page visitors.
 */

interface SupportChatMessageAttributes {
  message_id: string;
  session_id: string;
  user_id?: number | null;
  role: "user" | "assistant";
  content: string;
  escalated: boolean;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SupportChatMessageCreationAttributes
  extends Optional<
    SupportChatMessageAttributes,
    "message_id" | "user_id" | "escalated" | "attachment_url" | "attachment_name" | "attachment_type" | "createdAt" | "updatedAt"
  > {}

class SupportChatMessage
  extends Model<SupportChatMessageAttributes, SupportChatMessageCreationAttributes>
  implements SupportChatMessageAttributes
{
  public message_id!: string;
  public session_id!: string;
  public user_id?: number | null;
  public role!: "user" | "assistant";
  public content!: string;
  public escalated!: boolean;
  public attachment_url?: string | null;
  public attachment_name?: string | null;
  public attachment_type?: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SupportChatMessage.init(
  {
    message_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    session_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    escalated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    attachment_url: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    attachment_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    attachment_type: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "tbl_support_chat_message",
    indexes: [{ fields: ["session_id"] }],
  }
);

export default SupportChatMessage;
