import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';

interface ReferralRewardAttributes {
  reward_id: number;
  referral_id: number;
  user_id: number;
  reward_type: 'bonus_credit' | 'discount' | 'commission' | 'commission_credit';
  amount: number;
  currency: string;
  status: 'pending' | 'credited' | 'withdrawn';
  transaction_id?: string;
  credited_at?: Date;
  withdrawn_at?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ReferralRewardCreationAttributes extends Optional<ReferralRewardAttributes, 'reward_id' | 'status' | 'currency' | 'createdAt' | 'updatedAt'> {}

class ReferralReward extends Model<ReferralRewardAttributes, ReferralRewardCreationAttributes> implements ReferralRewardAttributes {
  public reward_id!: number;
  public referral_id!: number;
  public user_id!: number;
  public reward_type!: 'bonus_credit' | 'discount' | 'commission' | 'commission_credit';
  public amount!: number;
  public currency!: string;
  public status!: 'pending' | 'credited' | 'withdrawn';
  public transaction_id?: string;
  public credited_at?: Date;
  public withdrawn_at?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ReferralReward.init(
  {
    reward_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    referral_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tbl_referral',
        key: 'referral_id',
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tbl_user',
        key: 'user_id',
      },
    },
    reward_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'USD',
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'pending',
    },
    transaction_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    credited_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    withdrawn_at: {
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
    tableName: 'tbl_referral_reward',
    timestamps: true,
  }
);

export default ReferralReward;
