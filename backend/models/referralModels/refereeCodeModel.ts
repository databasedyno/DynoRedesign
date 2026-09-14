import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';
import crypto from 'crypto';

interface RefereeCodeAttributes {
  code_id: number;
  code: string;
  customer_email: string;
  referrer_company_id: number;
  referrer_user_id: number;
  payment_link_id?: number;
  status: 'sent' | 'used' | 'expired';
  used_by_user_id?: number;
  discount_percent: number;
  discount_duration_days: number;
  sent_at: Date;
  used_at?: Date;
  expires_at: Date;
  // Reminder tracking
  reminder_1_sent_at?: Date;
  reminder_2_sent_at?: Date;
  reminder_3_sent_at?: Date;
  final_reminder_sent_at?: Date;
  // Unsubscribe functionality
  unsubscribe_token: string;
  unsubscribed_at?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RefereeCodeCreationAttributes extends Optional<RefereeCodeAttributes, 'code_id' | 'status' | 'discount_percent' | 'discount_duration_days' | 'sent_at' | 'unsubscribe_token' | 'createdAt' | 'updatedAt'> {}

class RefereeCode extends Model<RefereeCodeAttributes, RefereeCodeCreationAttributes> implements RefereeCodeAttributes {
  public code_id!: number;
  public code!: string;
  public customer_email!: string;
  public referrer_company_id!: number;
  public referrer_user_id!: number;
  public payment_link_id?: number;
  public status!: 'sent' | 'used' | 'expired';
  public used_by_user_id?: number;
  public discount_percent!: number;
  public discount_duration_days!: number;
  public sent_at!: Date;
  public used_at?: Date;
  public expires_at!: Date;
  // Reminder tracking
  public reminder_1_sent_at?: Date;
  public reminder_2_sent_at?: Date;
  public reminder_3_sent_at?: Date;
  public final_reminder_sent_at?: Date;
  // Unsubscribe functionality
  public unsubscribe_token!: string;
  public unsubscribed_at?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RefereeCode.init(
  {
    code_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    customer_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    referrer_company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tbl_company',
        key: 'company_id',
      },
    },
    referrer_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tbl_user',
        key: 'user_id',
      },
    },
    payment_link_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('sent', 'used', 'expired'),
      defaultValue: 'sent',
    },
    used_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'tbl_user',
        key: 'user_id',
      },
    },
    discount_percent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 50.00,
    },
    discount_duration_days: {
      type: DataTypes.INTEGER,
      defaultValue: 90,
    },
    sent_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    // Reminder tracking columns
    reminder_1_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reminder_2_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reminder_3_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    final_reminder_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Unsubscribe functionality
    unsubscribe_token: {
      type: DataTypes.STRING(64),
      allowNull: true,
      defaultValue: () => crypto.randomBytes(32).toString('hex'),
    },
    unsubscribed_at: {
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
    tableName: 'tbl_referee_code',
    timestamps: true,
  }
);

export default RefereeCode;
