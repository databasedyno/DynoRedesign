/**
 * Buy Button model — Phase 2D
 *
 * A Buy Button is a pre-created checkout object that a merchant references
 * from a `<dynopay-buy-button button-id="btn_…">` snippet. Because the
 * amount/label/currencies live SERVER-side, a shopper cannot tamper with the
 * HTML on the merchant's page to pay less than the real price. This is the
 * canonical Stripe-style flow.
 *
 * The button_id is a public identifier (prefix "btn_") and is safe to expose
 * in HTML on the merchant's site — it must be paired with a publishable key
 * whose company matches the button's company. All validation happens in the
 * public session endpoint at /api/embed/public/session.
 */

import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const buyButtonModel = sequelize.define(
  "BuyButton",
  {
    // Public identifier used in HTML — e.g. "btn_pXY7cM9k…"
    button_id: {
      type: DataTypes.STRING(48),
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "tbl_company", key: "company_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "tbl_user", key: "user_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    // Display / analytics label shown in the dashboard
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    // Text on the button itself in the merchant's page ("Buy now" / "Donate")
    label: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: "Pay with crypto",
    },
    // "fixed" = amount is baked in at creation time (Stripe-canonical).
    // "customer" = shopper chooses at checkout, clamped by min/max_amount.
    price_type: {
      type: DataTypes.ENUM("fixed", "customer"),
      allowNull: false,
      defaultValue: "fixed",
    },
    // Fixed price (required when price_type='fixed'). Base-currency units.
    amount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    // Only used when price_type='customer'
    min_amount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    max_amount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    // Merchant's base currency (denormalized from the linked secret key).
    // Sessions use the SECRET key's live base_currency at session-creation time.
    base_currency: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: "USD",
    },
    // Optional subset of the company's configured wallet currencies.
    // null / [] = "all configured currencies are allowed".
    allowed_currencies: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    // Optional short description shown in the checkout iframe
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // If set, the checkout iframe redirects here after success. Falls back to
    // the merchant's ?redirect_uri= if this is null.
    success_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Merchant-supplied JSON metadata attached to every session created from
    // this button — useful for reconciling webhooks server-side.
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.ENUM("active", "archived"),
      allowNull: false,
      defaultValue: "active",
    },
    usage_count: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_buy_button",
    indexes: [
      { fields: ["company_id"] },
      { fields: ["status"] },
      { fields: ["company_id", "status"] },
    ],
  }
);

// Refactor Item #1: table provisioning moved to the versioned boot migration
// (migrations/bootMigrations.ts -> getBootModels / buildBootMigrations). No more
// ad-hoc import-time sync — create-only in prod (migration runner), alter in dev.

export default buyButtonModel;
