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
    // Split name fields (product decision 2026-09-07). Stored alongside the
    // combined `name` so we can greet "Hi {first_name}" and sort merchants by
    // last name. Nullable + backfilled from `name` for legacy accounts; a
    // missing value here never blocks anything that reads `name`.
    first_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Merchant's first / given name. Kept in sync with `name`.",
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Merchant's last / family name. Kept in sync with `name`.",
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
    // Referral revenue-share cash-out (ACCOUNT-level; Phase 2)
    referral_payout_mode: {
      type: DataTypes.STRING(10),
      defaultValue: "credit",
      allowNull: true,
      comment: "Referral reward delivery: 'credit' (default, reduces own fees) or 'cash' (USDT-TRC20 payout)",
    },
    referral_payout_trc20_address: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "Account-level USDT-TRC20 (Tron) address for referral cash-out payouts",
    },
    referral_payout_address_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the referral payout address was verified (saved-wallet reuse or OTP)",
    },
    referral_payout_auto: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
      comment: "Auto cash-out: when true, payouts are created automatically once balance ≥ auto-min",
    },
    referral_payout_auto_min_usd: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "Auto cash-out trigger threshold in USD (null → global MIN_PAYOUT_USDT)",
    },
    referral_payout_nudged_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the 'you can cash out' nudge was last sent; reset after a payout completes",
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
    tokens_valid_after: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Access tokens issued (iat) before this instant are rejected — set by 'sign out all other devices'",
    },
    // Signup origin fingerprint (captured once at account creation, never
    // overwritten by later logins). Real client IP (first x-forwarded-for hop)
    // + geo country — speeds up fraud / abuse investigations. NULL for users
    // created before this column existed.
    signup_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: "Real client IP captured at signup (first x-forwarded-for hop, not the whole chain)",
    },
    signup_country: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "Country resolved from signup_ip at account creation (geo-IP, best-effort)",
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
    // ── Creator vanity page (dynopay.com/{handle}) ──
    handle: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Public vanity handle for the creator page (unique, case-insensitive)",
    },
    // ── Purpose vertical (design audit 2026-08-05, PurposePicker signup step) ──
    purpose_vertical: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Which of Dynopay's four verticals the user identifies with: 'merchants' | 'fundraisers' | 'creators' | 'developers'. Drives sidebar accent tint and post-signup onboarding routing. NULL for legacy users who signed up before this column existed.",
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
      defaultValue: [10, 25, 50],
      comment: "Suggested amount chips (max 5, $10 platform floor)",
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
    support_widget_show_wall: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: "Opt-in supporter wall (recent public tips) on the creator page",
    },
    // ── Creator Page Analytics (Session 2026-08-05) ──
    store_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      comment: "Master storefront on/off. false => /shop + product pages 404 and no products on the creator page.",
    },
    creator_page_show_products: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      comment: "Show the Shop section on the creator page /[handle]. false hides it there only; /shop + product links still work.",
    },
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
    // ── Personalized dashboard Quick Actions (Session: pinnable shortcuts) ──
    dashboard_quick_actions: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Merchant's 4 pinned dashboard Quick Action slugs, e.g. ['paylinks','invoice','wallet','creator']. NULL = default set.",
    },
    // ── 7-DAY ACCOUNT SOFT DELETE (migration 013) ─────────────────────────
    // Explicit soft-delete (NOT Sequelize paranoid — blast radius). Login is
    // gated via helper/accountDeletion.isUserSoftDeleted in finalizeLogin +
    // resolveAuthUser. `scheduled_purge_at` = deleted_at + 7d (cron purges).
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the account was soft-deleted (7-day recovery grace). NULL = active.",
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "user_id that triggered the account deletion (usually the owner).",
    },
    scheduled_purge_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When a soft-deleted account becomes eligible for permanent purge (deleted_at + 7d).",
    },
  },
  {
    tableName: "tbl_user",
  }
);

// userModel.sync({ alter: false }).then(() => console.log("tbl_user created"));

export default userModel;
