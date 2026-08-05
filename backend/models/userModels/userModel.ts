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
    // Per-user override for dashboard display currency (Doc-3 workstream E).
    // NULL = fall through to tbl_company.display_currency, which itself
    // falls through to the API-key base_currency, then 'USD'.
    display_currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
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
    // ── Tax settings (merchant defaults; per-link/per-product can override) ──
    default_apply_tax: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Merchant-level default: automatically collect sales tax on new payment links + store checkout",
    },
    default_tax_inclusive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Merchant-level default: prices INCLUDE tax (retail model). If false, tax is added on top (B2B model)",
    },
    merchant_country_code: {
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: "Merchant's ISO 3166-1 alpha-2 country code — used as VAT jurisdiction. Falls back to company.country if unset",
    },
    merchant_vat_id: {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: "Merchant's own VAT / GST / tax registration number, shown on receipts",
    },
    // ── Creator vanity page (dynopay.me/{handle}) ──
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
    cover_image: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Public banner image URL shown behind the avatar on the creator page",
    },
    social_links: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: "Creator's social handles: {twitter, instagram, youtube, tiktok, website}",
    },
    // ── Support Widget (creator-exclusive Tip / Buy-me-a-coffee) ──
    support_widget_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
      comment: "Master toggle for the always-on tip/coffee widget on the creator page",
    },
    support_widget_style: {
      type: DataTypes.STRING(20),
      defaultValue: "coffee",
      allowNull: true,
      comment: "Widget vocabulary/icon: 'coffee' | 'tip' | 'support'",
    },
    support_widget_label: {
      type: DataTypes.STRING(80),
      allowNull: true,
      comment: "Custom heading override (else style-derived default)",
    },
    support_widget_preset_amounts: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [3, 5, 10, 25],
      comment: "Suggested amount chips (max 5)",
    },
    support_widget_currency: {
      type: DataTypes.STRING(10),
      defaultValue: "USD",
      allowNull: true,
      comment: "Display + settle currency for tips",
    },
    support_widget_min_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1,
      allowNull: true,
      comment: "Minimum custom tip amount",
    },
    support_widget_allow_message: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: true,
      comment: "Show supporter message input in the widget",
    },
    support_widget_thanks_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Custom post-tip thank-you copy",
    },
    support_widget_show_supporters: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: true,
      comment: "Show lifetime supporters count on the widget",
    },
    // ── Creator Page Analytics (Session 2026-08-05) ──
    public_analytics_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: "Whether the public 30-day tip chart + top supporters widget is shown on the creator page. Toggle from /creator settings.",
    },
    // ── Custom Creator Theme (Session 60) ──
    theme_accent_color: {
      type: DataTypes.STRING(9),
      allowNull: true,
      comment: "CSS color (hex, e.g. '#CCFF00') used as page accent — buttons, links, highlights",
    },
    theme_cover_style: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Cover style: 'solid' | 'gradient' | 'image' | 'pattern'",
    },
    theme_cover_gradient: {
      type: DataTypes.STRING(60),
      allowNull: true,
      comment: "Gradient preset key ('sunset','ocean','forest','twilight','midnight','candy') or custom 'hex1,hex2'",
    },
  },
  {
    tableName: "tbl_user",
  }
);

// userModel.sync({ alter: false }).then(() => console.log("tbl_user created"));

export default userModel;
