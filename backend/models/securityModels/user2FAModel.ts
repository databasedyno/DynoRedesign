import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';

interface User2FAAttributes {
  id: number;
  user_id: number;
  secret: string;
  is_enabled: boolean;
  backup_codes?: string[];
  method: 'totp' | 'sms' | 'email';
  phone_number?: string;
  enabled_at?: Date;
  last_used_at?: Date;
  failed_attempts: number;
  locked_until?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface User2FACreationAttributes extends Optional<User2FAAttributes, 'id' | 'is_enabled' | 'method' | 'failed_attempts' | 'createdAt' | 'updatedAt'> {}

class User2FA extends Model<User2FAAttributes, User2FACreationAttributes> implements User2FAAttributes {
  public id!: number;
  public user_id!: number;
  public secret!: string;
  public is_enabled!: boolean;
  public backup_codes?: string[];
  public method!: 'totp' | 'sms' | 'email';
  public phone_number?: string;
  public enabled_at?: Date;
  public last_used_at?: Date;
  public failed_attempts!: number;
  public locked_until?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User2FA.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'tbl_user',
        key: 'user_id',
      },
    },
    secret: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    backup_codes: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
    },
    method: {
      type: DataTypes.STRING(50),
      defaultValue: 'totp',
    },
    phone_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    enabled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failed_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    locked_until: {
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
    tableName: 'tbl_user_2fa',
    timestamps: true,
  }
);

export default User2FA;
