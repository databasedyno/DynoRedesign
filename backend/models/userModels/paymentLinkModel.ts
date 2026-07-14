import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import crypto from "crypto";

const paymentLinkModel = sequelize.define(
  "Payment_Link",
  {
    link_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    transaction_id: {
      type: DataTypes.STRING,
    },
    wallet_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "tbl_user_wallet",
        key: "wallet_id",
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
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    base_amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    base_currency: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
    paid_amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    paid_currency: {
      type: DataTypes.STRING,
    },
    transaction_reference: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment_link: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    allowedModes: {
      type: DataTypes.TEXT,
    },
    payment_mode: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    times_used: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    callback_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    redirect_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    webhook_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Fee payer - who pays blockchain fees: 'customer' or 'company'
    fee_payer: {
      type: DataTypes.STRING(20),
      defaultValue: 'company',
      allowNull: true,
    },
    // Tax settings - merchant can enable tax calculation based on customer location
    // Tax is OFF by default - merchant must explicitly enable it
    apply_tax: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    // Accepted cryptocurrencies for this payment link
    // If null/empty, all configured wallets are available
    // Format: comma-separated string e.g., "BTC,ETH,USDT-TRC20"
    accepted_currencies: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: "Comma-separated list of accepted cryptocurrencies. If null, all configured wallets are accepted.",
    },
    // Payment link reminder tracking
    reminder_1_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reminder_2_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    final_reminder_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Unsubscribe functionality
    unsubscribe_token: {
      type: DataTypes.STRING(64),
      allowNull: true,
      defaultValue: () => crypto.randomBytes(32).toString('hex'),
    },
    unsubscribed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Customer name - optional field to identify who the payment is for
    customer_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Name of the customer this payment link is created for",
    },
    // ── Donation / crowdfunding support ──────────────────────────────────
    // 'standard' = normal one-off payment link (default)
    // 'donation' = campaign parent link (multi-use, donors pick the amount)
    // 'contribution' = child payment row spawned per donor (flows through the
    //                  regular settlement pipeline untouched)
    link_type: {
      type: DataTypes.STRING(24),
      defaultValue: "standard",
      allowNull: true,
    },
    // Set on 'contribution' rows -> link_id of the donation parent
    parent_link_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Campaign headline / purpose (donation parents)
    title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // Fundraising target in base_currency (optional - open-ended if null)
    goal_amount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    // Comma-separated suggested amounts, e.g. "10,25,50,100"
    preset_amounts: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // Minimum accepted donation in base_currency (default 1 at controller level)
    min_amount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    allow_custom_amount: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: true,
    },
    // Show progress bar (raised / goal) on the public checkout page
    show_progress: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: true,
    },
    // Show recent supporters wall on the public checkout page
    show_supporters: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: true,
    },
    // Stop accepting donations once goal_amount is reached
    auto_close_at_goal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    },
    // Absolute URL of the campaign cover image
    campaign_image: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    // ── Crowdfunding v2 fields (Phase 3 — GoFundMe-lite) ────────────────
    // Rich Markdown campaign story rendered on the public campaign page.
    // NULL / empty = falls back to the plain `description` field.
    donation_story_md: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Photo gallery — JSONB array of { url, caption?, order? }. Cover image
    // stays in `campaign_image`; gallery is additional supporting photos.
    donation_gallery: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: true,
    },
    // Optional campaign end date. Renders a countdown pill on the public page.
    donation_ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Category taxonomy (medical | community | creative | emergency |
    // education | animal | environment | other). Powers the public directory.
    donation_category: {
      type: DataTypes.STRING(48),
      allowNull: true,
    },
    // Custom thank-you message shown on the post-contribution success card
    // and used as the intro of the auto-thank-you email to the contributor.
    donation_organizer_thanks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Beneficiary transparency — { name, description }. Renders as a trust
    // block on the campaign page when the organizer is raising funds for a
    // third party (person or org).
    donation_beneficiary: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    // ── Refund address (CleanCheckoutV2 — Phase 1) ─────────────────────
    // Set by the customer on the checkout page when they want a refund
    // address for wrong-asset/wrong-network mistakes. Never used to send
    // to unless the merchant explicitly triggers a refund flow.
    refund_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // ── Contribution (child row) fields ──────────────────────────────────
    donor_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    donor_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_anonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    },
    // Marks the hidden singleton "tip jar" donation parent per creator (Support Widget).
    // Excluded from merchant pay-links lists and the public creator page campaign list.
    is_tip_jar: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "tbl_payment_link",
  }
);

// paymentLinkModel
//   .sync({ alter: false })
//   .then(() => console.log("tbl_payment_link created"));

export default paymentLinkModel;
