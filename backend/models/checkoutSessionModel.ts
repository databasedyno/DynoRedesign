import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Buyer checkout-session tracking (drop-off analytics). One durable row per
 * checkout "ref" (router.query.d) the moment a buyer OPENS a /pay page — so we
 * can measure "opened a checkout but never paid" (abandonment), which otherwise
 * only lived in the ephemeral Redis crypto-{address} key. Fed by a fire-and-forget
 * beacon; NEVER on the money path. Outcome (paid/underpaid) is read authoritatively
 * from the transaction tables at query time, not written here.
 */
const checkoutSessionModel = sequelize.define(
  "Checkout_Session",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ref: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    address: { type: DataTypes.STRING(120), allowNull: true },
    currency: { type: DataTypes.STRING(20), allowNull: true },
    amount: { type: DataTypes.FLOAT, allowNull: true },
    country: { type: DataTypes.STRING(64), allowNull: true },
    user_agent: { type: DataTypes.STRING(300), allowNull: true },
    view_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    viewed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    address_shown_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: "tbl_checkout_session", timestamps: false }
);

export default checkoutSessionModel;
