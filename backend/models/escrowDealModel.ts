import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import crypto from "crypto";

/**
 * Escrow deal — a two-party (buyer + seller) crypto escrow arrangement where the
 * platform holds the buyer's funds and releases them to the seller only when the
 * deal is completed (buyer confirmation / auto-release) or a dispute is resolved.
 *
 * v1 holds funds on each deal's OWN dedicated deposit address (no commingled pool)
 * and reuses DynoPay's existing checkout / payout engine. On-chain settlement is
 * gated behind ESCROW_LIVE_SETTLEMENT (default OFF -> simulated, records intent
 * and advances state without broadcasting a transaction).
 *
 * Brand-new table (create-only migration 0035) — additive, safe on live prod.
 */
const escrowDealModel = sequelize.define(
  "Escrow_Deal",
  {
    escrow_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // Unguessable public token used for the shareable counterparty link
    // (/escrow/invite/<token>). Never exposes the sequential escrow_id.
    deal_token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      defaultValue: () => crypto.randomBytes(24).toString("hex"),
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "tbl_company", key: "company_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    creator_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "tbl_user", key: "user_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    // Role the CREATOR takes in this deal. The counterparty takes the opposite.
    creator_role: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "seller", // 'buyer' | 'seller'
    },
    counterparty_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // Linked once the counterparty acts while logged in (optional).
    counterparty_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Deal value in the fiat display currency.
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "USD",
    },
    // Comma-separated accepted coins e.g. "BTC,ETH,USDT-TRC20". null = any configured.
    accepted_coins: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    terms: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // ── Fee model ────────────────────────────────────────────────────────
    fee_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 5.0,
    },
    fee_min_usd: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 1.0,
    },
    // Who pays the escrow fee: 'buyer' (default, added on top) | 'seller' | 'split'
    fee_payer: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "buyer",
    },
    // Days the buyer has to confirm/dispute after "delivered" before auto-release.
    auto_release_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    // draft | invited | declined | awaiting_payment | funded | delivered |
    // disputed | completed | refunded | cancelled | expired
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "draft",
    },
    // ── Lifecycle timestamps ───────────────────────────────────────────────
    invited_at: { type: DataTypes.DATE, allowNull: true },
    accepted_at: { type: DataTypes.DATE, allowNull: true },
    declined_at: { type: DataTypes.DATE, allowNull: true },
    funded_at: { type: DataTypes.DATE, allowNull: true },
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    // When the auto-release fires if the buyer does nothing (set at "delivered").
    auto_release_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    refunded_at: { type: DataTypes.DATE, allowNull: true },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    disputed_at: { type: DataTypes.DATE, allowNull: true },
    dispute_resolved_at: { type: DataTypes.DATE, allowNull: true },
    expired_at: { type: DataTypes.DATE, allowNull: true },
    // ── Delivery / dispute ─────────────────────────────────────────────────
    delivery_note: { type: DataTypes.TEXT, allowNull: true },
    dispute_reason: { type: DataTypes.TEXT, allowNull: true },
    dispute_raised_by: { type: DataTypes.STRING(10), allowNull: true }, // 'buyer'|'seller'
    // 'release' | 'refund' | 'split'
    dispute_resolution: { type: DataTypes.STRING(16), allowNull: true },
    // For a split outcome: percentage of the deal amount released to the SELLER.
    split_percent_seller: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    // ── Settlement destinations ────────────────────────────────────────────
    seller_payout_address: { type: DataTypes.STRING(255), allowNull: true },
    seller_payout_coin: { type: DataTypes.STRING(20), allowNull: true },
    buyer_refund_address: { type: DataTypes.STRING(255), allowNull: true },
    // ── Funding (the money held) ───────────────────────────────────────────
    funding_coin: { type: DataTypes.STRING(20), allowNull: true },
    funding_crypto_amount: { type: DataTypes.DECIMAL(18, 8), allowNull: true },
    // Each deal's OWN dedicated deposit address (funds land + stay here while held).
    funding_deposit_address: { type: DataTypes.STRING(255), allowNull: true },
    funding_tx_hash: { type: DataTypes.STRING(255), allowNull: true },
    funded_amount_usd: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    // True when funding/settlement was simulated (SAFE MODE / no live broadcast).
    simulated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Free-form record of the settlement action (amounts, mock txids, admin note).
    settlement_note: { type: DataTypes.TEXT, allowNull: true },
    // ── Stablecoin custody (pooled custody + per-deal ledger) ──────────────
    // On funding, the buyer's crypto is (simulated) converted to a stablecoin and
    // the stable amount is recorded here. Held in stable so value never drifts.
    custody_stablecoin: { type: DataTypes.STRING(20), allowNull: true },
    custody_amount_stable: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    converted_at: { type: DataTypes.DATE, allowNull: true },
    // ── Two-phase settlement ───────────────────────────────────────────────
    // Phase 1: the AUTHORIZED outcome. Phase 2: the per-leg payout execution.
    outcome: { type: DataTypes.STRING(16), allowNull: true }, // release | refund | split
    outcome_authorized_at: { type: DataTypes.DATE, allowNull: true },
    // Seller leg
    seller_entitlement_stable: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    // na | pending | paid | retrying
    seller_payout_state: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "na" },
    seller_paid_at: { type: DataTypes.DATE, allowNull: true },
    seller_payout_tx: { type: DataTypes.STRING(255), allowNull: true },
    seller_signed_in: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Buyer leg
    buyer_entitlement_stable: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    buyer_payout_state: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "na" },
    buyer_refund_coin: { type: DataTypes.STRING(20), allowNull: true },
    buyer_paid_at: { type: DataTypes.DATE, allowNull: true },
    buyer_payout_tx: { type: DataTypes.STRING(255), allowNull: true },
    buyer_signed_in: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Set once ALL applicable legs are paid (the "payout paid" milestone).
    fully_paid_at: { type: DataTypes.DATE, allowNull: true },
    // ── Unclaimed-funds handling ───────────────────────────────────────────
    payout_reminder_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    payout_reminder_last_at: { type: DataTypes.DATE, allowNull: true },
    needs_admin_review: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // ── Onboarding ─────────────────────────────────────────────────────────
    counterparty_verified_at: { type: DataTypes.DATE, allowNull: true },
    // Timeline / audit trail: array of { at, type, actor, role, note, meta }.
    activity_log: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    tableName: "tbl_escrow_deal",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default escrowDealModel;
