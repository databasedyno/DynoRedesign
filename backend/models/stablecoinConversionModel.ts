import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Stablecoin Conversion Audit Trail
 * 
 * Tracks every step of the auto-conversion flow:
 * 1. PENDING_DEPOSIT  — Crypto sent to admin wallet (Binance), waiting for deposit credit
 * 2. DEPOSIT_CREDITED — Binance has credited the deposit, ready for conversion
 * 3. CONVERTING       — Binance Convert quote requested & accepted
 * 4. CONVERTED        — Conversion complete, stablecoin in Binance balance
 * 5. WITHDRAWING      — Withdrawal to merchant's settlement wallet initiated
 * 6. COMPLETED        — Stablecoin delivered to merchant
 * 7. FAILED           — Error at any step (retryable)
 */
const stablecoinConversionModel = sequelize.define(
  "StablecoinConversion",
  {
    conversion_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // Link to original transaction
    transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to tbl_user_transaction",
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to tbl_company",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to tbl_user",
    },

    // Source (volatile crypto)
    source_currency: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "Original crypto received (e.g., BTC, ETH, SOL)",
    },
    source_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "Amount of source crypto (merchant portion)",
    },
    source_amount_usd: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "USD value at time of payment",
    },

    // Target (stablecoin)
    target_currency: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "Target stablecoin (USDT or USDC)",
    },
    target_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      comment: "Amount of stablecoin after conversion",
    },

    // Merchant settlement wallet
    settlement_wallet_address: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: "Merchant's stablecoin wallet address for withdrawal",
    },
    settlement_chain: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "Blockchain network for withdrawal (e.g., ERC20, TRC20, POLYGON)",
    },

    // On-chain: temp address → admin wallet (Binance deposit)
    deposit_tx_hash: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "TX hash of crypto sent to admin wallet (Binance deposit address)",
    },
    admin_wallet_address: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "Admin wallet address where crypto was sent",
    },

    // Binance Spot Trade
    binance_quote_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Legacy: Binance Convert quote ID (no longer used)",
    },
    binance_order_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Binance spot order ID",
    },
    conversion_rate: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      comment: "Conversion rate from Binance (e.g., 1 BTC = 67000 USDT)",
    },
    conversion_fee: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      comment: "Fee charged by Binance (spread/commission)",
    },

    // Rate lock (locked at payment time)
    locked_merchant_usd: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "Merchant's expected USD payout locked at payment time",
    },
    locked_exchange_rate: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      comment: "Exchange rate at time of payment (e.g., 67880.40 for BTC/USD)",
    },
    locked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the merchant rate was locked",
    },

    // Actual sale results
    actual_sale_usd: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "What the crypto actually sold for in USDT on Binance",
    },
    platform_surplus: {
      type: DataTypes.DECIMAL(20, 4),
      allowNull: true,
      defaultValue: 0,
      comment: "Profit from price increase (0 if price dropped)",
    },
    price_movement_pct: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
      comment: "% price change from locked rate to actual sale",
    },
    merchant_payout_usd: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "Final USDT amount sent to merchant wallet",
    },

    // Adaptive fee tracking
    fee_tier_used: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Sweep fee tier: slow/medium/fast/fastest",
    },
    market_state_at_sweep: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Market volatility state when sweep was initiated",
    },
    sweep_fee_usd: {
      type: DataTypes.DECIMAL(20, 4),
      allowNull: true,
      comment: "Blockchain fee for sweep in USD",
    },
    trade_fee_usd: {
      type: DataTypes.DECIMAL(20, 4),
      allowNull: true,
      comment: "Binance trading fee in USD",
    },
    ioc_fill_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "% of Limit IOC order that was filled",
    },
    sell_method: {
      type: DataTypes.STRING(30),
      allowNull: true,
      comment: "LIMIT_IOC, LIMIT_IOC+MARKET_FALLBACK, or MARKET",
    },

    // Binance Withdrawal
    withdrawal_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Binance withdrawal ID",
    },
    withdrawal_tx_hash: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "On-chain TX hash of stablecoin withdrawal to merchant",
    },
    withdrawal_fee: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      comment: "Binance withdrawal fee",
    },

    // Status tracking
    status: {
      type: DataTypes.ENUM(
        "PENDING_DEPOSIT",
        "DEPOSIT_CREDITED",
        "CONVERTING",
        "CONVERTED",
        "WITHDRAWING",
        "COMPLETED",
        "FAILED"
      ),
      allowNull: false,
      defaultValue: "PENDING_DEPOSIT",
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Error details if status is FAILED",
    },
    retry_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    last_retry_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Timestamps for each phase
    deposit_confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    converted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    withdrawn_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_stablecoin_conversion",
    indexes: [
      { fields: ["status"] },
      { fields: ["company_id"] },
      { fields: ["transaction_id"], unique: true },
    ],
  }
);

export default stablecoinConversionModel;
