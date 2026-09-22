import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Payout gas audit (tbl_payout_gas_audit) — one row per merchant payout:
 * what we ESTIMATED / CHARGED for network gas at settlement vs what the
 * forward transaction REALLY burned on-chain. Feeds /admin/fee-reconciliation.
 */
const payoutGasAuditModel = sequelize.define(
  "PayoutGasAudit",
  {
    audit_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    pool_tx_id: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    transaction_id: { type: DataTypes.INTEGER, allowNull: true },
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    wallet_type: { type: DataTypes.STRING(30), allowNull: false },
    gas_token: { type: DataTypes.STRING(20), allowNull: false },
    payout_tx_hash: { type: DataTypes.STRING(160), allowNull: true },
    payout_amount: { type: DataTypes.DECIMAL(24, 8), allowNull: true },
    /** Settlement-time estimate of the gas the payout tx would burn (gas token units). */
    estimated_gas_native: { type: DataTypes.DECIMAL(24, 10), allowNull: true },
    /** Gas the fee wallet sent to the pool address for this payout (gas token units). */
    gas_funded_native: { type: DataTypes.DECIMAL(24, 10), allowNull: true },
    /** Network fee deducted from the merchant, in the payout asset's units. */
    charged_fee_asset: { type: DataTypes.DECIMAL(24, 10), allowNull: true },
    charged_fee_usd: { type: DataTypes.DECIMAL(18, 6), allowNull: true },
    /** Real fee burned by the payout tx (gas token units), read from the chain. */
    actual_gas_native: { type: DataTypes.DECIMAL(24, 10), allowNull: true },
    actual_gas_usd: { type: DataTypes.DECIMAL(18, 6), allowNull: true },
    gas_token_price_usd: { type: DataTypes.DECIMAL(18, 8), allowNull: true },
    /** charged_fee_usd − actual_gas_usd (positive = merchant over-charged). */
    variance_usd: { type: DataTypes.DECIMAL(18, 6), allowNull: true },
    source: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "settlement" },
    actual_source: { type: DataTypes.STRING(40), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pending" },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    settled_at: { type: DataTypes.DATE, allowNull: true },
    reconciled_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "tbl_payout_gas_audit",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["status"] },
      { fields: ["wallet_type"] },
      { fields: ["settled_at"] },
    ],
  }
);

export default payoutGasAuditModel;
