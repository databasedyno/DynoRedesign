import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";

const customerTransactionModel = sequelize.define(
  "Customer_Transaction",
  {
    id: {
      type: DataTypes.STRING,
      unique: false,
    },
    transaction_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,  // Allow null for payment links (anonymous customers)
      // Foreign key removed to allow null values - customer may not exist for payment links
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
    paid_amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    paid_currency: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
    transaction_reference: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    transaction_details: {
      type: DataTypes.TEXT,
      defaultValue: "Credited funds into wallet",
    },
    transaction_type: {
      type: DataTypes.STRING,
      defaultValue: "CREDIT",
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "failed",
    },
    unique_tx_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Payment ID linking this transaction to the payment tracker (crypto-{address} or payment link ID)",
    },
    // Customer language captured at checkout (ISO 639-1: en, pt, es, fr, de, nl)
    language: {
      type: DataTypes.STRING(5),
      allowNull: true,
      defaultValue: "en",
      comment: "Customer's language captured at checkout, used for localized customer emails",
    },
  },
  {
    tableName: "tbl_customer_transaction",
  }
);

// Sync to ensure schema matches model (customer_id should be nullable)
customerTransactionModel
  // create-only in production (never ALTER the live schema on boot); alter only in dev
  .sync({ alter: process.env.NODE_ENV !== "production" })
  .then(() => apiLogger.info("tbl_customer_transaction synced"));

export default customerTransactionModel;
