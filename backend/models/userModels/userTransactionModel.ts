import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const userTransactionModel = sequelize.define(
  "User_Transaction",
  {
    transaction_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id: {
      type: DataTypes.STRING,
    },
    wallet_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "tbl_user_wallet",
        key: "wallet_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
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
    payment_mode: {
      type: DataTypes.STRING,
      defaultValue: "CARD",
    },
    base_amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    base_currency: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
    // Crypto-specific fields
    crypto_amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    crypto_currency: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    usd_value: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    // Fee breakdown
    transaction_fee: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    fixed_fee: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    blockchain_buffer_fee: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    // Blockchain confirmations
    confirmations: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    required_confirmations: {
      type: DataTypes.INTEGER,
      defaultValue: 6,
    },
    // Transaction hashes
    transaction_reference: {
      type: DataTypes.STRING,
    },
    incoming_tx_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    outgoing_tx_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    transaction_details: {
      type: DataTypes.TEXT,
      defaultValue: "Credited funds into wallet",
    },
    transaction_type: {
      type: DataTypes.ENUM("CREDIT", "DEBIT"),
      defaultValue: "CREDIT",
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "failed",
    },
    // Callback/Webhook
    callback_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    webhook_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    webhook_response: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "tbl_customer",
        key: "customer_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    // ── Tax fields (persisted at settlement for accounting + reporting) ──
    tax_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      comment: "Tax collected in base currency (matches transaction currency)",
    },
    tax_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    tax_label: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    tax_country_code: {
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    customer_vat_id: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    reverse_charge: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "tbl_user_transaction",
  }
);

// userTransactionModel.sync({ alter: false }).then(() => console.log("tbl_user_transaction created"));

export default userTransactionModel;
