import { raw as envRaw } from "../../utils/config";
import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

// STOREFRONT PER COMPANY (feature-flagged; migration 010). The storefront/creator
// columns below only EXIST on the DB after the migration runs. We therefore only
// DEFINE them on the model when the flag is ON, otherwise Sequelize would SELECT
// non-existent columns ("column does not exist") on the un-migrated DB.
const STOREFRONT_PER_COMPANY =
  String(envRaw("STOREFRONT_PER_COMPANY") ?? "false").toLowerCase() === "true";

const STOREFRONT_COMPANY_COLUMNS = STOREFRONT_PER_COMPANY
  ? {
      handle: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: "Public vanity handle for THIS company's storefront (globally unique, case-insensitive). Storefront-per-company only.",
      },
      bio: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: "Short bio shown on this company's public storefront page.",
      },
      creator_page_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        comment: "Whether this company's public storefront/creator page is live.",
      },
      cover_image: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: "Public banner image URL behind the avatar on the storefront page.",
      },
      social_links: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: "Social handles: {twitter, instagram, youtube, tiktok, website}",
      },
      support_widget_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      support_widget_style: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: "coffee",
      },
      support_widget_label: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      support_widget_preset_amounts: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [3, 5, 10, 25],
      },
      support_widget_currency: {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: "USD",
      },
      support_widget_min_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 1,
      },
      support_widget_allow_message: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      support_widget_thanks_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      support_widget_show_supporters: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      store_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      creator_page_show_products: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      public_analytics_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      theme_accent_color: {
        type: DataTypes.STRING(9),
        allowNull: true,
      },
      theme_cover_style: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      theme_cover_gradient: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
    }
  : {};

const companyModel = sequelize.define(
  "Company",
  {
    company_id: {
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
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    company_name: {
      type: DataTypes.STRING,
    },
    /**
     * 'individual' | 'business'
     *
     * The Account is the tenant; a "Company" is just an Account that has filled
     * in a business profile. An individual creator gets an Account with
     * account_type='individual' at signup so that company-scoped features
     * (invoices, customers, webhooks, API usage) work for them too — previously
     * a user with no company row could never reach any of them.
     * See docs/IA_AUDIT_2026-08.md §1 and scripts/add_account_model.js.
     */
    account_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "business",
    },
    // Session 39: dashboard DISPLAY currency preference (presentation-only —
    // never affects pricing or stored data). NULL = fall through to the legacy
    // API-key base_currency, then USD. See utils/currencyUtils.ts and
    // migrations/legacy/addDisplayCurrency.ts.
    display_currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: null,
      comment: "Dashboard display currency (USD/EUR/GBP/NGN/CAD/AUD). Display-only preference.",
    },
    // Per-Company Tax (2026-08-23, migrations/legacy/addCompanyTaxSettings.ts).
    // tax_configured=false → company inherits the account values on tbl_user;
    // true → these company values are authoritative. See services/companyTaxService.ts.
    default_apply_tax: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    default_tax_inclusive: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    merchant_country_code: {
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    merchant_vat_id: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    tax_configured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    email: {
      type: DataTypes.STRING,
      validate: {
        isEmail: true,
      },
    },
    mobile: {
      type: DataTypes.STRING,
    },
    photo: {
      type: DataTypes.TEXT,
    },
    website: {
      type: DataTypes.TEXT,
    },
    // Phase 1: Address fields
    address_line1: {
      type: DataTypes.STRING(255),
    },
    address_line2: {
      type: DataTypes.STRING(255),
    },
    city: {
      type: DataTypes.STRING(100),
    },
    state: {
      type: DataTypes.STRING(100),
    },
    country: {
      type: DataTypes.STRING(100),
    },
    zip_code: {
      type: DataTypes.STRING(20),
    },
    // Phase 1: VAT fields
    vat_number: {
      type: DataTypes.STRING(50),
    },
    vat_type: {
      type: DataTypes.STRING(10),
    },
    vat_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Webhook configuration
    webhook_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "URL to receive payment webhook notifications",
    },
    webhook_secret: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Secret key for webhook signature verification",
    },
    // Session 49: Circuit breaker for repeatedly-failing merchant webhook URLs.
    // Auto-set to true after N consecutive DLQ failures (see utils/webhookRetry.ts).
    // The merchant receives a warning email and can re-enable via the dashboard
    // (POST /api/company/:id/webhook/reenable) after fixing their endpoint.
    webhook_disabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "When true, no payment webhooks will be dispatched to webhook_url until re-enabled",
    },
    webhook_disabled_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp when webhook_url was auto-disabled by circuit breaker",
    },
    webhook_disabled_reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Reason webhook was disabled (e.g., '3 consecutive failures — HTTP 404')",
    },
    // Tier-1 audit item #2: opt-in event subscriptions. NULL = legacy events
    // only (unchanged behavior); an array additionally enables the opt-in
    // events listed in services/webhookEvents.ts.
    webhook_events: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: "Opt-in webhook event types (payment.created, payment.expired, payment.overpaid). NULL = legacy events only.",
    },
    // Payment settings
    overpayment_threshold_usd: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      comment: "Minimum overpayment amount in USD to trigger overpayment handling. Default $5 if not set.",
    },
    underpayment_threshold_usd: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      comment: "Maximum underpayment amount in USD to accept as full payment. Default $1 if not set.",
    },
    grace_period_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: "Grace period in minutes for partial payment completion on Payment Links. Max 30, default 30 if not set. Does NOT apply to Direct API payments.",
    },
    // Multi-tenant: Company backend URL for webhooks
    backend_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Company's backend URL for Tatum webhook delivery (e.g., https://company1.mysite.com). If null, uses global SERVER_URL.",
    },
    // Auto-Stablecoin Conversion Settings
    auto_convert_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Enable auto-conversion of volatile crypto (BTC, ETH, etc.) to stablecoin via Binance",
    },
    settlement_currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: "Target stablecoin for auto-conversion: USDT or USDC",
    },
    settlement_wallet_address: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Merchant's stablecoin wallet address for receiving converted funds",
    },
    settlement_chain: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Blockchain network for stablecoin withdrawal: ERC20, TRC20, POLYGON, BEP20, SOL",
    },
    // Per-company contact person (Solution B). Decoupled from the account-level
    // user.name so operating multiple companies no longer clobbers the name shown
    // in another company's merchant emails. Captured from the company-create form
    // (first_name / last_name) and editable via updateCompany.
    contact_first_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Contact person first name for THIS company (used in merchant emails). Independent of the account holder's user.name.",
    },
    contact_last_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Contact person last name for THIS company.",
    },

    // STOREFRONT PER COMPANY (feature-flagged; migration 010) — see top of file.
    ...STOREFRONT_COMPANY_COLUMNS,
  },
  {
    tableName: "tbl_company",
  }
);

// companyModel
//   .sync({ alter: false })
//   .then(() => console.log("tbl_company created"));

export default companyModel;
