import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const taxRateModel = sequelize.define(
  "TaxRate",
  {
    tax_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    country_code: {
      type: DataTypes.STRING(2),
      allowNull: false,
      unique: true,
    },
    country_name: {
      type: DataTypes.STRING(100),
    },
    tax_acronym: {
      type: DataTypes.STRING(10),
    },
    standard_rate: {
      type: DataTypes.DECIMAL(5, 2),
    },
    reduced_rates: {
      type: DataTypes.JSONB,
    },
  },
  {
    tableName: "tbl_tax_rate",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default taxRateModel;
