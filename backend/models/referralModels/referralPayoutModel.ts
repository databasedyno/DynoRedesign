import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';

/**
 * tbl_referral_payout — one row per referral cash-out request (Phase 2).
 * Account-level (user_id = referrer). A request is created 'pending' by the API
 * (NO funds move); the leader/prod cron executes the Binance USDT-TRC20 withdrawal
 * and advances the status. idempotency_key prevents double-payout.
 */
interface ReferralPayoutAttributes {
  payout_id: number;
  user_id: number;
  amount_usd: number;
  trc20_address: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  idempotency_key: string;
  binance_withdrawal_id?: string | null;
  tx_hash?: string | null;
  withdrawal_fee_usdt?: number | null;
  error_message?: string | null;
  requested_at?: Date;
  completed_at?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ReferralPayoutCreationAttributes
  extends Optional<
    ReferralPayoutAttributes,
    | 'payout_id'
    | 'status'
    | 'binance_withdrawal_id'
    | 'tx_hash'
    | 'withdrawal_fee_usdt'
    | 'error_message'
    | 'requested_at'
    | 'completed_at'
    | 'createdAt'
    | 'updatedAt'
  > {}

class ReferralPayout
  extends Model<ReferralPayoutAttributes, ReferralPayoutCreationAttributes>
  implements ReferralPayoutAttributes
{
  public payout_id!: number;
  public user_id!: number;
  public amount_usd!: number;
  public trc20_address!: string;
  public status!: 'pending' | 'processing' | 'completed' | 'failed';
  public idempotency_key!: string;
  public binance_withdrawal_id?: string | null;
  public tx_hash?: string | null;
  public withdrawal_fee_usdt?: number | null;
  public error_message?: string | null;
  public requested_at?: Date;
  public completed_at?: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ReferralPayout.init(
  {
    payout_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'tbl_user', key: 'user_id' },
    },
    amount_usd: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    trc20_address: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending',
    },
    idempotency_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    binance_withdrawal_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    tx_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    withdrawal_fee_usdt: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    requested_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'tbl_referral_payout',
    timestamps: true,
  }
);

export default ReferralPayout;
