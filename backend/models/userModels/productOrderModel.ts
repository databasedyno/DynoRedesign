/**
 * ProductOrder — one row per completed cart.
 *
 * Coupled 1:1 to a `tbl_payment_link` row (with `link_type='cart'`) so the
 * existing crypto settlement / webhook / receipt pipeline is reused. Line
 * items live in tbl_product_order_item. Fulfillment logic branches on
 * `product_snapshot.product_type` — see orderFulfillmentService.
 */
import { raw as envRaw } from "../../utils/config";
import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

// STOREFRONT PER COMPANY (feature-flagged; migration 010). Only define
// `company_id` when the flag is ON (the column only exists post-migration).
const STOREFRONT_PER_COMPANY =
  String(envRaw("STOREFRONT_PER_COMPANY") ?? "false").toLowerCase() === "true";

const ORDER_COMPANY_COLUMN = STOREFRONT_PER_COMPANY
  ? {
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "tbl_company", key: "company_id" },
        onDelete: "SET NULL",
      },
    }
  : {};

const productOrderModel = sequelize.define(
  "Product_Order",
  {
    order_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    /** 24-hex, unguessable, user-facing at /order/<ref>. */
    public_ref: {
      type: DataTypes.STRING(48),
      allowNull: false,
      unique: true,
    },
    merchant_user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "tbl_user", key: "user_id" },
      onDelete: "CASCADE",
    },
    // STOREFRONT PER COMPANY (feature-flagged; migration 010) — see top of file.
    ...ORDER_COMPANY_COLUMN,
    /** FK to tbl_payment_link — hosts the actual crypto payment session. */
    payment_link_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "tbl_payment_link", key: "link_id" },
      onDelete: "SET NULL",
    },
    buyer_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    buyer_name: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    buyer_phone: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    /** { line1, line2, city, region, postal_code, country_code, notes } */
    shipping_address: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    subtotal_cents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    shipping_cents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    tax_cents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    // Rate applied to compute tax_cents (percentage, e.g. 20.00 = 20%).
    // Persisted so a merchant's later rate change doesn't retroactively
    // rewrite historic order tax.
    tax_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    tax_label: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "VAT / GST / Sales Tax / etc — jurisdictional label shown to buyer",
    },
    tax_country_code: {
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: "ISO 3166-1 alpha-2 country whose rate was applied",
    },
    // Buyer-supplied VAT number (B2B EU reverse-charge). Persisted so the
    // merchant can prove the reverse-charge basis on their VAT return.
    customer_vat_id: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    reverse_charge: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if EU B2B reverse-charge applied (buyer supplied valid cross-border VAT ID) — no tax collected",
    },
    // Snapshot of the link's tax_inclusive flag at checkout time
    tax_inclusive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    total_cents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "USD",
    },
    crypto_currency: {
      type: DataTypes.STRING(24),
      allowNull: true,
    },
    crypto_network: {
      type: DataTypes.STRING(24),
      allowNull: true,
    },
    crypto_amount: {
      type: DataTypes.DECIMAL(28, 8),
      allowNull: true,
    },
    /** 'pending' | 'paid' | 'expired' | 'underpaid' | 'refund_requested' | 'refunded' */
    payment_status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "pending",
    },
    /** 'unfulfilled' | 'partial' | 'fulfilled' */
    fulfillment_status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "unfulfilled",
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    locale: {
      type: DataTypes.STRING(6),
      allowNull: true,
    },
  },
  {
    tableName: "tbl_product_order",
    timestamps: true,
  }
);

export default productOrderModel;
