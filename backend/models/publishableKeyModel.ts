/**
 * Publishable Key model — Phase 2 (Buy Button)
 *
 * A publishable key (`pk_live_…` / `pk_test_…`) is a BROWSER-safe credential.
 * Unlike a secret key it MAY appear in HTML/JS and MUST therefore be:
 *   1. Origin-locked to a merchant-controlled allow-list of domains
 *   2. Amount-capped per session (merchant-set at creation — no silent default)
 *   3. Optionally currency-restricted to a subset of the company's wallets
 *   4. Rate-limited independently (much stricter than the secret key)
 *
 * We store the plaintext key AND a SHA-256 hash of it so we can do a fast,
 * constant-time lookup without decrypting anything at every request.
 */

import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const publishableKeyModel = sequelize.define(
  "PublishableKey",
  {
    pub_key_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "tbl_company", key: "company_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "tbl_user", key: "user_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    // 'production' → pk_live_… , 'development' → pk_test_…
    environment: {
      type: DataTypes.ENUM("production", "development"),
      defaultValue: "production",
      allowNull: false,
    },
    // The plaintext key handed to the merchant ONCE (at create time and re-listable
    // any time since it's public). Never encrypted — this is safe to expose.
    publishable_key: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // Prefix (first ~18 chars incl. `pk_live_`) — used to render "pk_live_ABC12…"
    // masked previews in the dashboard.
    key_prefix: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    // sha256(publishable_key) — the actual lookup index. UNIQUE + indexed.
    key_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "revoked"),
      defaultValue: "active",
      allowNull: false,
    },
    // JSON string[] — exact origins ("https://shop.com") or wildcard subdomain
    // patterns ("*.shop.com"). Enforced against Origin (then Referer fallback)
    // on every /api/embed/public/* call.
    allowed_domains: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "[]",
    },
    // Merchant-set at creation. Sessions with amount > max_amount are rejected.
    // (In the base currency of the linked secret key, e.g. USD.)
    max_amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    // JSON string[] — optional subset of the company's configured wallet currencies.
    // If NULL / [], all configured currencies are permitted.
    allowed_currencies: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    // Denormalized from the linked secret key at creation time. Purely for display /
    // amount interpretation. Session-creation logic re-reads the live secret key.
    base_currency: {
      type: DataTypes.STRING(8),
      defaultValue: "USD",
      allowNull: false,
    },
    // Optional friendly label (like api_name for secret keys).
    key_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    // Stricter than the secret key's default (60/min).
    rate_limit_per_minute: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
    },
    usage_count: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_publishable_key",
    indexes: [
      { fields: ["company_id"] },
      { fields: ["key_hash"], unique: true },
      { fields: ["status"] },
    ],
  }
);

// Refactor Item #1: table provisioning moved to the versioned boot migration
// (migrations/bootMigrations.ts -> getBootModels / buildBootMigrations). No more
// ad-hoc import-time sync — create-only in prod (migration runner), alter in dev.

export default publishableKeyModel;
