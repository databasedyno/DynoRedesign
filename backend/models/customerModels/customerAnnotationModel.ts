import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

/**
 * tbl_customer_annotation — merchant-PRIVATE notes, tags, name/mobile overrides
 * and manually-added contacts for the CRM-lite Customers directory.
 *
 * Keyed by (company_id, lowercased email) so it layers on top of the
 * payment-derived directory (customerDirectoryService) without touching the
 * transaction/customer tables. Never exposed to payers. Additive.
 */
const customerAnnotationModel = sequelize.define(
  "CustomerAnnotation",
  {
    annotation_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    /** Directory identity key — always stored lowercased. */
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    /** Merchant override for the display name (wins over the derived name). */
    display_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mobile: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** string[] of free-form tags. */
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    /** True when the contact was added manually (vs. enriching a payer). */
    created_manually: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "tbl_customer_annotation",
    indexes: [{ unique: true, fields: ["company_id", "email"] }],
  }
);

export default customerAnnotationModel;
