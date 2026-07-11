import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const userModel = sequelize.define(
  "User",
  {
    user_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      validate: {
        isEmail: true,
      },
    },
    username: {
      type: DataTypes.STRING,
    },
    password: {
      type: DataTypes.STRING,
    },
    mobile: {
      type: DataTypes.STRING,
    },
    photo: {
      type: DataTypes.TEXT,
      defaultValue: "images/user_image.png",
    },
    login_type: {
      type: DataTypes.ENUM("EMAIL", "GOOGLE", "TELEGRAM", "SMS", "GITHUB"),
      defaultValue: "EMAIL",
    },
    telegram_id: {
      type: DataTypes.STRING,
    },
    customer_id: {
      type: DataTypes.STRING,
    },
    external_id: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "active",
    },
    verified_otp: {
      type: DataTypes.STRING,
    },
    otp_expired: {
      type: DataTypes.DATE,
    },
    otp_currency: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Currency type for OTP validation (BTC, ETH, etc.)",
    },
    // Password reset fields
    reset_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reset_token_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Google Sign-In fields
    google_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Wallet reminder tracking
    wallet_reminder_sent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    },
    // Referral fields
    referral_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },
    referral_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: true,
    },
    referral_bonus_earned: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      allowNull: true,
    },
    referred_by_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    referred_by_referee_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Referee code from payment link email",
    },
    // Fee Discount fields
    fee_discount_percent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      allowNull: true,
      comment: "Current fee discount percentage",
    },
    fee_discount_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the fee discount expires",
    },
    fee_discount_reason: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "referee_code, user_referral_referee, user_referral_referrer, referrer_reward, promo",
    },
    // Email verification
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: "Whether the user has verified their email address via OTP",
    },
    // Security tracking
    last_login_ip: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Last known login IP address for new device detection",
    },
    // Last selected company for session persistence
    last_company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Last company the user was working with, restored on next login",
    },
    // Phase 2: Fee-Free Trial Tracking (user-based)
    cumulative_volume_usd: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Total transaction volume in USD processed by this user",
    },
    fee_free_remaining_usd: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 500,
      comment: "Remaining fee-free volume in USD (starts at FREE_TRIAL_VOLUME_USD, default 500)",
    },
    fee_tier: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "trial",
      comment: "Fee tier: trial (fee-free period), standard (normal fees), premium (volume discount)",
    },
    // Preferred language for emails / UI (ISO 639-1: en, pt, es, fr, de, nl)
    language: {
      type: DataTypes.STRING(5),
      allowNull: true,
      defaultValue: "en",
      comment: "Merchant's preferred language for localized emails",
    },
    // ── Creator vanity page (dynopay.com/{handle}) ──
    handle: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Public vanity handle for the creator page (unique, case-insensitive)",
    },
    bio: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Short creator bio shown on the public vanity page",
    },
    creator_page_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
      comment: "Whether the public creator page is live",
    },
  },
  {
    tableName: "tbl_user",
  }
);

// userModel.sync({ alter: false }).then(() => console.log("tbl_user created"));

export default userModel;
