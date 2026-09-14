import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const userTempAddressModel = sequelize.define(
  "TEMP_ADDRESS",
  {
    temp_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
    // Multi-tenant support: Track which company this payment is for
    company_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    wallet_type: {
      type: DataTypes.STRING,
    },
    wallet_address: {
      type: DataTypes.STRING,
    },
    wallet_account_id: {
      type: DataTypes.STRING,
    },
    subscription_id: {
      type: DataTypes.STRING,
    },
    index: {
      type: DataTypes.INTEGER,
    },
    privateKey: {
      type: DataTypes.TEXT,
    },
    txId: {
      type: DataTypes.TEXT,
    },
    adminTxId: {
      type: DataTypes.TEXT,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
    },
    admin_status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
    },
    partial_payment_timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    blockchain_fee: {
      type: DataTypes.FLOAT,
    },
    check_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    // Fee payer mode: 'company' (default) or 'customer'
    fee_payer: {
      type: DataTypes.STRING(20),
      defaultValue: 'company',
    },
    // Amount merchant should receive (for customer-pays-fees mode)
    merchant_amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    // Original USD amount
    base_amount_usd: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    }
  },
  {
    tableName: "tbl_user_temp_address",
  }
);

// userTempAddressModel.sync({ alter: false }).then(() => console.log("tbl_user_temp_address created"));

export default userTempAddressModel;
