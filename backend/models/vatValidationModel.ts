import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * tbl_vat_validation — cache + audit trail for VAT-number verification
 * (backlog #1). One row per normalized VAT ID. `verifyVatId` (taxService)
 * reads this cache-first so repeat checkouts are instant and a transient
 * tax-data API outage can still honour a recent positive result. `raw` keeps
 * the full provider response as proof for the merchant's VAT return.
 */
const vatValidationModel = sequelize.define(
  "VatValidation",
  {
    validation_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    vat_id: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    country_code: {
      type: DataTypes.STRING(2),
    },
    valid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    company_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    company_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(16),
      comment: "api | cache | cache_stale | format_invalid | unverified_*",
    },
    raw: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    checked_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "tbl_vat_validation",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default vatValidationModel;
