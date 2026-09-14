import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const userWalletAddressModel = sequelize.define(
  "Wallet_Addresses",
  {
    user_address_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    // Phase 1: Company scoping
    company_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    // Phase 1: Wallet name
    wallet_name: {
      type: DataTypes.STRING(100),
    },
    label: {
      type: DataTypes.STRING,
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: "BTC",
    },
    wallet_address: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "tbl_user_addresses",
  }
);

// userWalletAddressModel.sync({ alter: false }).then(() => console.log("tbl_user_addresses created"));

export default userWalletAddressModel;
