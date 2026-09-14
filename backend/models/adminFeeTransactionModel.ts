import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const adminFeeTransactionModel = sequelize.define(
  "Admin_Fee_Transaction",
  {
    fee_transaction_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    wallet_address: {
      type: DataTypes.STRING,
    },
    amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    amount_in_usd: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    wallet_type: {
      type: DataTypes.STRING,
    },
    transaction_id: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
    },
    blockchain_fee: {
      type: DataTypes.STRING,
    },
    amount_to_be_paid: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    transaction_type: {
      type: DataTypes.STRING,
      defaultValue: "DEBIT",
    },
  },
  {
    tableName: "tbl_admin_fee_transaction",
  }
);

// adminFeeTransactionModel.sync({ alter: false }).then(() => console.log("tbl_admin_fee_transaction created"));

export default adminFeeTransactionModel;
