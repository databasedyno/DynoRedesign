import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const apiModel = sequelize.define(
  "API",
  {
    api_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    // Phase 1: API name field
    api_name: {
      type: DataTypes.STRING(100),
    },
    // Environment: 'production' or 'development'
    environment: {
      type: DataTypes.ENUM('production', 'development'),
      defaultValue: 'production',
      allowNull: false,
    },
    // Status: 'active', 'inactive', 'revoked'
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'revoked'),
      defaultValue: 'active',
      allowNull: false,
    },
    base_currency: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
    // Legacy only (key_version 1). Always NULL for keys minted after migration
    // 0025 — the credential is never persisted, only its hash below.
    apiKey: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    key_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    key_hint: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    key_version: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 2,
    },
    key_rotated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    adminToken: {
      type: DataTypes.TEXT,
    },
    admin_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    withdrawal_whitelist: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Permissions - JSON array of enabled permissions
    permissions: {
      type: DataTypes.TEXT,
      defaultValue: '["payments","transactions","webhooks","wallets"]',
    },
    // Test mode restrictions for development keys
    test_mode_restrictions: {
      type: DataTypes.TEXT,
      defaultValue: '{"max_amount": 100, "allowed_currencies": ["BTC", "ETH", "USDT-TRC20"]}',
    },
    // Last used timestamp
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Usage count
    usage_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    request_count: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },
    rate_limit_per_minute: {
      type: DataTypes.INTEGER,
      defaultValue: 60,
    },
    rate_limit_per_hour: {
      type: DataTypes.INTEGER,
      defaultValue: 3600,
    },
    rate_limit_per_day: {
      type: DataTypes.INTEGER,
      defaultValue: 100000,
    },
    webhook_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    webhook_secret: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_api",
  }
);

// apiModel.sync({ alter: false }).then(() => console.log("tbl_api created"));

export default apiModel;
