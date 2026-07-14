/**
 * ProductVariant — one row per SKU when `product.has_variants=true`.
 *
 * Carries the price + stock authoritative values (product.base_price_cents
 * becomes "min-of-variants" purely for display). Buyers pick one variant at
 * checkout; stock is atomically decremented at order creation.
 */
import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const productVariantModel = sequelize.define(
  "Product_Variant",
  {
    variant_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    product_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "tbl_product", key: "product_id" },
      onDelete: "CASCADE",
    },
    sku: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    /** e.g. { size: "L", color: "Black" }. Free-shape but merchant-consistent. */
    attributes: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    price_cents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    /** NULL = infinite (digital). Atomic decrement on order create. */
    stock_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "tbl_product_variant",
    timestamps: true,
  }
);

export default productVariantModel;
