import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

/**
 * Supported crypto types for merchant pool
 */
export const MERCHANT_POOL_CRYPTO_TYPES = [
  'BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH',
  'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20',
  'SOL', 'XRP', 'RLUSD', 'POLYGON', 'USDT-POLYGON', 'RLUSD-ERC20'
];

/**
 * Chain categories for xpub derivation
 * Tokens use parent chain's xpub
 */
export const CHAIN_XPUB_MAPPING: Record<string, string> = {
  'BTC': 'BTC',
  'ETH': 'ETH',
  'LTC': 'LTC',
  'DOGE': 'DOGE',
  'TRX': 'TRX',
  'BCH': 'BCH',
  'USDT-TRC20': 'TRX',   // Uses TRX xpub
  'USDT-ERC20': 'ETH',   // Uses ETH xpub
  'USDC-ERC20': 'ETH',   // Uses ETH xpub
  'SOL': 'SOL',           // Non-HD: fresh keypair per address
  'XRP': 'XRP',           // Non-HD: fresh account per address
  'RLUSD': 'XRP',         // Token on XRP Ledger, uses XRP accounts
  'POLYGON': 'POLYGON',   // EVM-compatible, HD derivation
  'USDT-POLYGON': 'POLYGON', // Uses POLYGON xpub
  'RLUSD-ERC20': 'ETH',     // ERC-20 token on Ethereum, uses ETH xpub
};

/**
 * Chain types for gas handling
 */
export const UTXO_CHAINS = ['BTC', 'LTC', 'DOGE', 'BCH'];
export const ACCOUNT_CHAINS = ['ETH', 'TRX', 'SOL', 'XRP', 'POLYGON'];
export const TOKEN_CHAINS = ['USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'RLUSD', 'USDT-POLYGON', 'RLUSD-ERC20'];

/**
 * Non-HD chains that generate fresh keypair per address (no xpub derivation)
 */
export const NON_HD_CHAINS = ['SOL', 'XRP'];

/**
 * Gas token mapping for TOKEN chains only
 * 
 * IMPORTANT: This mapping should ONLY include tokens that require external gas funding.
 * Native currencies (ETH, TRX) do NOT need external gas - they pay fees from their own balance.
 * 
 * - USDT-TRC20: Needs TRX for gas (token transfer on TRON)
 * - USDT-ERC20: Needs ETH for gas (token transfer on Ethereum)
 * - USDC-ERC20: Needs ETH for gas (token transfer on Ethereum)
 */
export const GAS_TOKEN_MAPPING: Record<string, string> = {
  'USDT-TRC20': 'TRX',
  'USDT-ERC20': 'ETH',
  'USDC-ERC20': 'ETH',
  'RLUSD': 'XRP',           // RLUSD needs XRP for gas on XRP Ledger
  'USDT-POLYGON': 'POLYGON', // USDT on Polygon needs POL for gas
  'RLUSD-ERC20': 'ETH',     // RLUSD ERC-20 needs ETH for gas on Ethereum
};

/**
 * Merchant Wallet Model
 * 
 * Stores xpub/mnemonic per merchant per chain.
 * Generated lazily on first payment request for each chain.
 */
const merchantWalletModel = sequelize.define(
  "Merchant_Wallet",
  {
    wallet_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      comment: "Merchant user ID",
    },
    wallet_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'SOL', 'XRP', 'POLYGON']],
      },
      comment: "Base chain type (tokens use parent chain xpub)",
    },
    xpub: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Extended public key for HD derivation",
    },
    mnemonic: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Encrypted mnemonic (via KMS XPUB_KEY_ID)",
    },
    last_derivation_index: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Last used derivation index for addresses",
    },
  },
  {
    tableName: "tbl_merchant_wallet",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["user_id", "wallet_type"],
      },
    ],
  }
);

/**
 * Merchant Temp Address Model
 * 
 * Pool of temporary addresses per merchant for receiving crypto payments.
 * Addresses are derived from merchant's xpub and reused after payment completion.
 */
const merchantTempAddressModel = sequelize.define(
  "Merchant_Temp_Address",
  {
    temp_address_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    owner_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      comment: "PERMANENT owner - the merchant",
    },
    wallet_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [MERCHANT_POOL_CRYPTO_TYPES],
      },
      comment: "Crypto type: BTC, ETH, USDT-TRC20, etc.",
    },
    wallet_address: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    destination_tag: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: "XRP destination tag for tag-based chains (XRP, RLUSD). Null for other chains.",
    },
    private_key: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Encrypted via KMS (TEMP_KEY_ID)",
    },
    derivation_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Index used for HD wallet derivation",
    },
    subscription_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Tatum webhook subscription ID",
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "AVAILABLE",
      validate: {
        isIn: [['AVAILABLE', 'RESERVED', 'PRE_RESERVED', 'IN_USE', 'PROCESSING', 'SWEEPING', 'DISABLED', 'PENDING_TRUSTLINE']],
      },
      comment: "AVAILABLE=ready, RESERVED=waiting (30min), IN_USE=payment done waiting sweep, PROCESSING=received, SWEEPING=being swept",
    },
    admin_fee_balance: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "Accumulated admin fees in this address",
    },
    gas_balance: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "Remaining gas (TRX/ETH) for transfers",
    },
    total_transactions: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // Current reservation (temporary, cleared after payment)
    current_payment_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Current payment using this address",
    },
    current_company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Company ID for current payment",
    },
    expected_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      comment: "Expected crypto amount for current payment",
    },
    received_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      defaultValue: 0,
      comment: "Amount received so far (for partial payment)",
    },
    is_partial_payment: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "True if partial payment received",
    },
    partial_payment_timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When partial payment was received (30 min grace)",
    },
    reserved_until: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Reservation expires at this time",
    },
    locked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp when address was locked",
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_swept_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_merchant_payout: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp when merchant was last paid (for time-based sweep)",
    },
    last_payment_context: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "JSON snapshot of payment context saved before reservation expiry (for orphan payment recovery)",
    },
    cached_qr_code: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Pre-generated QR code with currency logo (data:image/png;base64,...). Generated at pool creation, reused at payment time to save ~250ms.",
    },
  },
  {
    tableName: "tbl_merchant_temp_address",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["owner_user_id", "wallet_type", "status"],
      },
      {
        unique: true,
        fields: ["wallet_address", "destination_tag"],
        name: "uq_address_tag",
      },
      {
        fields: ["destination_tag"],
        name: "idx_destination_tag",
      },
    ],
  }
);

/**
 * Merchant Pool Transaction Model
 * 
 * Audit trail for all payments processed through merchant pool addresses.
 */
const merchantPoolTransactionModel = sequelize.define(
  "Merchant_Pool_Transaction",
  {
    pool_tx_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    temp_address_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_merchant_temp_address",
        key: "temp_address_id",
      },
    },
    owner_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Merchant who owns the pool address",
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Company for this payment",
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
      comment: "Total crypto received from customer",
    },
    merchant_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "Crypto sent to merchant",
    },
    admin_fee_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "Crypto retained as admin fee",
    },
    gas_funded: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "Gas funded for this transaction",
    },
    gas_used: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "Actual gas consumed",
    },
    incoming_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Blockchain TX ID of incoming payment",
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
        isIn: [['pending', 'gas_funded', 'merchant_sent', 'completed', 'failed', 'below_threshold']],
      },
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_merchant_pool_transaction",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["owner_user_id", "wallet_type"],
      },
      {
        fields: ["company_id"],
      },
    ],
  }
);

/**
 * Merchant Pool Sweep Model
 * 
 * Records of admin fee sweeps from pool addresses to admin wallet.
 */
const merchantPoolSweepModel = sequelize.define(
  "Merchant_Pool_Sweep",
  {
    sweep_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    temp_address_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_merchant_temp_address",
        key: "temp_address_id",
      },
    },
    owner_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Merchant who owns the pool address",
    },
    wallet_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    amount_swept: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "Crypto amount swept to admin wallet",
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
      comment: "Blockchain TX ID of sweep",
    },
    gas_funding_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    admin_wallet: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Destination admin wallet",
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
    tableName: "tbl_merchant_pool_sweep",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["owner_user_id", "wallet_type"],
      },
    ],
  }
);

export {
  merchantWalletModel,
  merchantTempAddressModel,
  merchantPoolTransactionModel,
  merchantPoolSweepModel,
};
