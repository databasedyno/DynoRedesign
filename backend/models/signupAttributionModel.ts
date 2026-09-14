import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * First-touch signup attribution — one row per user, written once (first-touch
 * wins) shortly after registration/login via POST /api/track/attribution.
 *
 * Answers "where did this signup come from?" (referrer / UTM / AI-assistant),
 * powers the admin source→conversion report, and stores the marketing opt-out
 * that the activation drip honours.
 */
const signupAttributionModel = sequelize.define(
  "SignupAttribution",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    referrer: { type: DataTypes.TEXT, allowNull: true },
    // Derived channel category: chatgpt | perplexity | google | telegram | direct | ...
    source: { type: DataTypes.STRING(40), allowNull: true },
    utm_source: { type: DataTypes.STRING(120), allowNull: true },
    utm_medium: { type: DataTypes.STRING(120), allowNull: true },
    utm_campaign: { type: DataTypes.STRING(160), allowNull: true },
    utm_term: { type: DataTypes.STRING(160), allowNull: true },
    utm_content: { type: DataTypes.STRING(160), allowNull: true },
    landing_page: { type: DataTypes.STRING(255), allowNull: true },
    ip: { type: DataTypes.STRING(45), allowNull: true },
    country: { type: DataTypes.STRING(100), allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: true },
    user_agent: { type: DataTypes.TEXT, allowNull: true },
    // Set true when the user clicks unsubscribe in an activation email.
    marketing_opt_out: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: "tbl_signup_attribution",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ fields: ["source"] }, { fields: ["created_at"] }],
  }
);

export default signupAttributionModel;
