/**
 * ProductAsset — merchant-uploaded digital deliverable file.
 *
 * MVP stores files on local disk under /app/uploads/products/{merchant}/{product}/.
 * GCS is provisioned by the schema (`storage_backend='gcs'` + bucket/object)
 * but not wired yet — see spec §9.
 *
 * On purchase, the fulfillment service generates a short-lived signed URL
 * pointing at /api/order/:publicRef/download/:assetId (server-side gated).
 */
import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const productAssetModel = sequelize.define(
  "Product_Asset",
  {
    asset_id: {
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
    /** Denormalized for cheap ACL checks. */
    merchant_user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    size_bytes: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    /** 'local' (MVP) | 'gcs' (Phase 2+). */
    storage_backend: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "local",
    },
    storage_bucket: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    /** For local: relative path under uploadsRoot. For gcs: object key. */
    storage_object: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    sha256: {
      type: DataTypes.CHAR(64),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "tbl_product_asset",
    timestamps: true,
  }
);

export default productAssetModel;
