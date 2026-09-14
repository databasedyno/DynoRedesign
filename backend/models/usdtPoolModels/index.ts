import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

/**
 * USDT Pool Address Model
 * 
 * Global pool of reusable addresses for USDT-TRC20 and USDT-ERC20 payments.
 * Admin fees accumulate in these addresses and are swept when threshold is reached.
 */
const usdtPoolAddressModel = sequelize.define(
  "USDT_Pool_Address",
  {
    pool_address_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    wallet_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['USDT-TRC20', 'USDT-ERC20']],
      },
    },
    wallet_address: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    private_key: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Encrypted via KMS (TEMP_KEY_ID)",
    },
    mnemonic: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Encrypted via KMS (optional)",
    },
    xpub: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    derivation_index: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Index used for HD wallet derivation",
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "AVAILABLE",
      validate: {
        isIn: [['AVAILABLE', 'RESERVED', 'PROCESSING', 'SWEEPING', 'DISABLED']],
      },
      comment: "AVAILABLE=ready, RESERVED=waiting for payment (30min timeout), PROCESSING=payment received, SWEEPING=being swept",
    },
    admin_fee_balance: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "Accumulated USDT admin fees in this address",
    },
    gas_balance: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "Remaining TRX/ETH for gas (estimated)",
    },
    total_transactions: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    current_payment_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Current payment using this address (when RESERVED/PROCESSING)",
    },
    current_company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Merchant company ID for current payment",
    },
    current_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Merchant user ID for current payment",
    },
    expected_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      comment: "Expected USDT amount for current payment",
    },
    received_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      defaultValue: 0,
      comment: "Amount received so far (for partial payment tracking)",
    },
    is_partial_payment: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "True if partial payment received, waiting for more",
    },
    partial_payment_timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When partial payment was received (30 min grace period starts)",
    },
    reserved_until: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Reservation expires at this time if no payment received",
    },
    subscription_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Tatum webhook subscription ID",
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_swept_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    locked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp when address was locked (for timeout handling)",
    },
  },
  {
    tableName: "tbl_usdt_pool_address",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

/**
 * USDT Pool Transaction Model
 * 
 * Audit trail for all payments processed through pool addresses.
 * Tracks which merchant's fees are accumulated where.
 */
const usdtPoolTransactionModel = sequelize.define(
  "USDT_Pool_Transaction",
  {
    pool_tx_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    pool_address_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_usdt_pool_address",
        key: "pool_address_id",
      },
    },
    temp_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Link to tbl_user_temp_address (for backward compatibility)",
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Merchant company ID",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Merchant user ID",
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    payment_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Unique payment reference/ID",
    },
    wallet_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    payment_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "Total USDT received from customer",
    },
    merchant_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "USDT sent to merchant",
    },
    admin_fee_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "USDT retained as admin fee",
    },
    gas_funded: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "TRX/ETH funded for this transaction",
    },
    gas_used: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "Actual gas consumed",
    },
    incoming_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Blockchain TX ID of incoming USDT payment",
    },
    merchant_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Blockchain TX ID of merchant transfer",
    },
    gas_funding_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Blockchain TX ID of gas funding",
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "pending",
      validate: {
        isIn: [['pending', 'gas_funded', 'merchant_sent', 'completed', 'failed']],
      },
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_usdt_pool_transaction",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

/**
 * USDT Pool Sweep Model
 * 
 * Records of admin fee sweeps from pool addresses to admin wallet.
 */
const usdtPoolSweepModel = sequelize.define(
  "USDT_Pool_Sweep",
  {
    sweep_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    pool_address_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_usdt_pool_address",
        key: "pool_address_id",
      },
    },
    wallet_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    amount_swept: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "USDT amount swept to admin wallet",
    },
    amount_in_usd: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
    },
    gas_funded: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
    },
    gas_used: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
    },
    sweep_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Blockchain TX ID of sweep transaction",
    },
    gas_funding_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    to_address: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Admin wallet that received the sweep",
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "pending",
      validate: {
        isIn: [['pending', 'gas_funded', 'completed', 'failed']],
      },
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_usdt_pool_sweep",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Define associations
usdtPoolAddressModel.hasMany(usdtPoolTransactionModel, {
  foreignKey: "pool_address_id",
  as: "transactions",
});

usdtPoolTransactionModel.belongsTo(usdtPoolAddressModel, {
  foreignKey: "pool_address_id",
  as: "poolAddress",
});

usdtPoolAddressModel.hasMany(usdtPoolSweepModel, {
  foreignKey: "pool_address_id",
  as: "sweeps",
});

usdtPoolSweepModel.belongsTo(usdtPoolAddressModel, {
  foreignKey: "pool_address_id",
  as: "poolAddress",
});

export {
  usdtPoolAddressModel,
  usdtPoolTransactionModel,
  usdtPoolSweepModel,
};
