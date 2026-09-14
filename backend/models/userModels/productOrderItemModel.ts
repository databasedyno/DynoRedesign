/**
 * ProductOrderItem — line item on a product order.
 *
 * `product_snapshot` and `variant_snapshot` freeze the product's title,
 * cover image, price and delivery details at time of purchase so future
 * product edits (or soft-deletes) don't rewrite historical orders.
 *
 * `delivered_payload` gets populated by the fulfillment fan-out:
 *  - digital-file:      { asset_deliveries: [{ asset_id, filename, download_token, expires_at }] }
 *  - digital-license:   { license_key: "..." }
 *  - digital-url:       { access_url: "..." }
 *  - service:           { calendar_url: "..." }
 *  - physical:          { tracking_number, carrier, shipped_at }
 */
import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const productOrderItemModel = sequelize.define(
  "Product_Order_Item",
  {
    order_item_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "tbl_product_order", key: "order_id" },
      onDelete: "CASCADE",
    },
    product_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "tbl_product", key: "product_id" },
      onDelete: "RESTRICT",
    },
    variant_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: { model: "tbl_product_variant", key: "variant_id" },
      onDelete: "SET NULL",
    },
    product_snapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    variant_snapshot: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unit_price_cents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    line_total_cents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    /** Line-level so mixed carts (digital + physical) support partial fulfill. */
    fulfillment_status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "unfulfilled",
    },
    delivered_payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_product_order_item",
    timestamps: true,
  }
);

export default productOrderItemModel;
