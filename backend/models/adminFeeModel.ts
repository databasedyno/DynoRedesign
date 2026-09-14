import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const adminFeeModel = sequelize.define(
  "Admin_Fee_Wallet",
  {
    fee_wallet_id: {
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
    xpub: {
      type: DataTypes.TEXT,
    },
    mnemonic: {
      type: DataTypes.TEXT,
    },
    privateKey: {
      type: DataTypes.TEXT,
    },
    amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    feeLimit: {
      type: DataTypes.FLOAT,
      defaultValue: 100,
    },
    alert_duration: {
      type: DataTypes.INTEGER,
      defaultValue: 12,
    },
  },
  {
    tableName: "tbl_admin_fee_wallet",
  }
);

// adminFeeModel.sync({ alter: false }).then(() => console.log("tbl_admin_fee_wallet created"));

export default adminFeeModel;
