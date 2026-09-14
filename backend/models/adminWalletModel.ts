import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const adminWalletModel = sequelize.define(
  "Admin_Wallet",
  {
    wallet_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    wallet_type: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
    wallet_address: {
      type: DataTypes.STRING,
    },
    xpub_mnemonic: {
      type: DataTypes.TEXT,
    },
    privateKey: {
      type: DataTypes.TEXT,
    },
    fee: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    currency_type: {
      type: DataTypes.ENUM("FIAT", "CRYPTO"),
      defaultValue: "FIAT",
    },
    customer_id: {
      type: DataTypes.STRING,
    },
    wallet_account_id: {
      type: DataTypes.STRING,
    },
    last_index: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "tbl_admin_wallet",
  }
);

// adminWalletModel.sync({ alter: false }).then(() => console.log("tbl_admin_wallet created"));

export default adminWalletModel;
