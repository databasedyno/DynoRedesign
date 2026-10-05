import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * One row per AI-crawler page fetch (GPTBot, PerplexityBot, ClaudeBot, CCBot…).
 * Written fire-and-forget from the Next.js Edge middleware via POST
 * /api/track/bot-hit. Powers the admin "AI crawlers" analytics panel.
 * Rows older than 90 days are pruned opportunistically on insert.
 */
const botHitModel = sequelize.define(
  "BotHit",
  {
    hit_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    bot: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    host: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    path: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tbl_bot_hit",
    timestamps: false,
    indexes: [
      { fields: ["bot", "created_at"] },
      { fields: ["created_at"] },
    ],
  }
);

export default botHitModel;
