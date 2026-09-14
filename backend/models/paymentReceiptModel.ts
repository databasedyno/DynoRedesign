import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Shareable payment receipt — an immutable SNAPSHOT of the receipt data taken
 * at settlement (the exact figures the customer email / PDF used), addressable
 * by an unguessable token: https://<app>/receipt/<token>
 *
 * Why a snapshot and not a live query: the checkout state that the PDF is built
 * from lives in Redis (expires), and the ledger rows are rewritten on the
 * auto-convert path — a public "proof of payment" must never drift.
 *
 * `dedupe_key` (blockchain tx hash, else the payment id) makes link creation
 * idempotent across the two producers (settlement email + checkout paid card).
 */
const paymentReceiptModel = sequelize.define(
  "PaymentReceipt",
  {
    receipt_token: { type: DataTypes.STRING(40), primaryKey: true },
    dedupe_key: { type: DataTypes.STRING(191), allowNull: false, unique: true },
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    transaction_ref: { type: DataTypes.STRING(191), allowNull: true },
    lang: { type: DataTypes.STRING(5), allowNull: false, defaultValue: "en" },
    // ReceiptSnapshot (see services/receiptLinkService.ts) — paymentDate as ISO string.
    payload: { type: DataTypes.JSONB, allowNull: false },
    view_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "tbl_payment_receipt",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ fields: ["company_id"] }, { fields: ["created_at"] }],
  }
);

export default paymentReceiptModel;
