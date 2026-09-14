/**
 * Refund — one row per on-chain crypto refund invoice.
 *
 * Crypto Refund Flow (DynoPay-mediated, same-chain, same-asset):
 *  - The merchant triggers a refund on a paid Payment Link or Product Order.
 *  - DynoPay allocates a deposit address on the SAME chain the customer paid on.
 *  - The merchant sends the refund (+ gas the merchant covers) to that address.
 *  - On confirmation, DynoPay forwards the funds to the customer's saved
 *    refund address. (Forwarding = Phase C, gated behind ENABLE_CRYPTO_REFUNDS
 *    + background jobs; never runs in the safe-mode preview.)
 *
 * Single-refund-per-source, custom amount up to the original paid amount.
 */
import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import crypto from "crypto";

const refundModel = sequelize.define(
  "Refund",
  {
    refund_id: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    /** 'payment_link' | 'product_order' */
    source_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    /** link_id (as string) for payment links, or order public_ref for orders. */
    source_ref: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    /** Original settled transaction reference (string id), when known. */
    original_transaction_ref: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    merchant_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    customer_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    /** Chain / wallet_type, e.g. 'BTC', 'ETH', 'USDT-TRC20'. */
    chain: {
      type: DataTypes.STRING(24),
      allowNull: false,
    },
    /** Crypto asset symbol shown to the merchant, e.g. 'USDT', 'BTC'. */
    asset: {
      type: DataTypes.STRING(24),
      allowNull: false,
    },
    /** What the customer originally paid in crypto (the refund cap). */
    original_crypto_amount: {
      type: DataTypes.DECIMAL(28, 8),
      allowNull: false,
      defaultValue: 0,
    },
    /** Amount to return to the customer (<= original_crypto_amount). */
    refund_amount: {
      type: DataTypes.DECIMAL(28, 8),
      allowNull: false,
      defaultValue: 0,
    },
    /** Network-fee buffer in the chain's NATIVE gas currency (merchant covers). */
    gas_buffer_native: {
      type: DataTypes.DECIMAL(28, 8),
      allowNull: false,
      defaultValue: 0,
    },
    /** Native gas symbol, e.g. 'TRX', 'ETH', 'BTC'. */
    gas_buffer_symbol: {
      type: DataTypes.STRING(12),
      allowNull: true,
    },
    /** USD value of the gas buffer (display + accounting). */
    gas_buffer_usd: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    /**
     * Total the merchant must deposit, in the DEPOSIT asset.
     * Native-asset refunds: refund_amount + gas_buffer_native (same asset).
     * Token refunds: refund_amount (token); gas is fronted via the fee wallet.
     */
    merchant_deposit_total: {
      type: DataTypes.DECIMAL(28, 8),
      allowNull: false,
      defaultValue: 0,
    },
    /** The asset the merchant deposits (usually == asset). */
    deposit_asset: {
      type: DataTypes.STRING(24),
      allowNull: true,
    },
    /** DynoPay-controlled deposit address on the same chain. */
    dyno_deposit_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    dyno_temp_address_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    /** Where the refund is forwarded — the customer's saved refund wallet. */
    customer_refund_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    /**
     * created | awaiting_deposit | deposit_detected | forwarding |
     * completed | failed | expired | cancelled
     */
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "created",
    },
    merchant_deposit_txid: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    forward_txid: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    /** True when created in preview/sandbox (no real allocation/forwarding). */
    is_dry_run: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_refund",
    timestamps: true,
    indexes: [
      { fields: ["source_type", "source_ref"] },
      { fields: ["merchant_user_id"] },
      { fields: ["status"] },
    ],
  }
);

export default refundModel;
