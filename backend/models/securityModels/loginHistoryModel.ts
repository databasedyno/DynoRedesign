import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';

interface LoginHistoryAttributes {
  history_id: number;
  user_id?: number;
  email?: string;
  login_at: Date;
  ip_address?: string;
  user_agent?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  location?: string;
  login_method?: string;
  status: 'success' | 'failed' | 'blocked' | 'suspicious';
  failure_reason?: string;
  requires_2fa: boolean;
  createdAt?: Date;
}

interface LoginHistoryCreationAttributes extends Optional<LoginHistoryAttributes, 'history_id' | 'login_at' | 'requires_2fa' | 'createdAt'> {}

class LoginHistory extends Model<LoginHistoryAttributes, LoginHistoryCreationAttributes> implements LoginHistoryAttributes {
  public history_id!: number;
  public user_id?: number;
  public email?: string;
  public login_at!: Date;
  public ip_address?: string;
  public user_agent?: string;
  public device_type?: string;
  public browser?: string;
  public os?: string;
  public location?: string;
  public login_method?: string;
  public status!: 'success' | 'failed' | 'blocked' | 'suspicious';
  public failure_reason?: string;
  public requires_2fa!: boolean;
  public readonly createdAt!: Date;
}

LoginHistory.init(
  {
    history_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'tbl_user',
        key: 'user_id',
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    login_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    ip_address: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    device_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    browser: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    os: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    login_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    failure_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    requires_2fa: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'tbl_login_history',
    timestamps: false,
  }
);

export default LoginHistory;
