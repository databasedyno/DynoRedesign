import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';

interface SecurityLogAttributes {
  log_id: number;
  user_id?: number;
  event_type: string;
  event_description?: string;
  ip_address?: string;
  user_agent?: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

interface SecurityLogCreationAttributes extends Optional<SecurityLogAttributes, 'log_id' | 'status' | 'createdAt'> {}

class SecurityLog extends Model<SecurityLogAttributes, SecurityLogCreationAttributes> implements SecurityLogAttributes {
  public log_id!: number;
  public user_id?: number;
  public event_type!: string;
  public event_description?: string;
  public ip_address?: string;
  public user_agent?: string;
  public status!: string;
  public metadata?: Record<string, unknown>;
  public readonly createdAt!: Date;
}

SecurityLog.init(
  {
    log_id: {
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
    event_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    event_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'success',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'tbl_security_log',
    timestamps: false,
  }
);

export default SecurityLog;
