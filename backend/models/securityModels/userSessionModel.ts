import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';

interface UserSessionAttributes {
  session_id: number;
  user_id: number;
  session_token: string;
  refresh_token?: string;
  ip_address?: string;
  user_agent?: string;
  device_type?: string;
  device_name?: string;
  browser?: string;
  os?: string;
  location?: string;
  is_active: boolean;
  last_activity: Date;
  created_at: Date;
  expires_at: Date;
  revoked_at?: Date;
  revoke_reason?: string;
}

interface UserSessionCreationAttributes extends Optional<UserSessionAttributes, 'session_id' | 'is_active' | 'last_activity' | 'created_at'> {}

class UserSession extends Model<UserSessionAttributes, UserSessionCreationAttributes> implements UserSessionAttributes {
  public session_id!: number;
  public user_id!: number;
  public session_token!: string;
  public refresh_token?: string;
  public ip_address?: string;
  public user_agent?: string;
  public device_type?: string;
  public device_name?: string;
  public browser?: string;
  public os?: string;
  public location?: string;
  public is_active!: boolean;
  public last_activity!: Date;
  public created_at!: Date;
  public expires_at!: Date;
  public revoked_at?: Date;
  public revoke_reason?: string;
}

UserSession.init(
  {
    session_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tbl_user',
        key: 'user_id',
      },
    },
    session_token: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
      unique: true,
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
    device_name: {
      type: DataTypes.STRING(255),
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
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    last_activity: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revoke_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'tbl_user_session',
    timestamps: false,
  }
);

export default UserSession;
