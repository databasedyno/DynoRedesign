/**
 * Product — one row per catalog SKU.
 *
 * Owned by a merchant (`merchant_user_id`). MVP (Phase 1) focuses on
 * `product_type='digital'` deliverables. Physical/service types have the
 * columns provisioned but are wired in later phases.
 *
 * Related tables:
 *   - tbl_product_variant  (per-SKU price + stock, when has_variants=true)
 *   - tbl_product_asset    (uploaded files for digital delivery)
 *   - tbl_product_order    (buyer's completed cart → 1:many order items)
 */
import { raw as envRaw } from "../../utils/config";
import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

// STOREFRONT PER COMPANY (feature-flagged; migration 010). `company_id` only
// exists on the DB after the migration, so only define it on the model when the
// flag is ON — otherwise Sequelize SELECTs a non-existent column.
const STOREFRONT_PER_COMPANY =
  String(envRaw("STOREFRONT_PER_COMPANY") ?? "false").toLowerCase() === "true";

const PRODUCT_COMPANY_COLUMN = STOREFRONT_PER_COMPANY
  ? {
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "tbl_company", key: "company_id" },
        onDelete: "CASCADE",
      },
    }
  : {};

const productModel = sequelize.define(
  "Product",
  {
    product_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    merchant_user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "tbl_user", key: "user_id" },
      onDelete: "CASCADE",
    },
    // STOREFRONT PER COMPANY (feature-flagged; migration 010) — see top of file.
    ...PRODUCT_COMPANY_COLUMN,
    /** 'digital' | 'physical' | 'service' */
    product_type: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "digital",
    },
    title: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    /** URL slug — unique per merchant (soft-delete aware via partial index). */
    slug: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    subtitle: {
      type: DataTypes.STRING(240),
      allowNull: true,
    },
    /** Markdown, rendered via the safe renderer used by donationCampaign. */
    description_md: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Integer minor units (e.g. cents) in `currency`. */
    base_price_cents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    /** ISO 4217. Falls back to merchant's `display_currency` in the controller. */
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "USD",
    },
    cover_image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** JSONB array of { url, alt? }. */
    gallery_images: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    category: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    /** 'draft' | 'live' | 'archived' */
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "draft",
    },
    has_variants: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    /** Base stock — only used when has_variants=false. NULL = infinite (digital). */
    base_stock: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    /** 'file' | 'license_key' | 'url' | NULL (physical/service). */
    digital_delivery_type: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },
    /** Shape depends on delivery type: see spec §4.4. Not exposed to buyer. */
    digital_delivery_payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    /** Phase 2 (physical): flat shipping cost added at checkout. */
    physical_shipping_flat_cents: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    physical_weight_grams: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    /** Phase 3 (service): duration + Calendly-style link. */
    service_duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    service_calendar_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Denormalized — incremented on order completion. "234 sold" social proof. */
    sold_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    /** Soft delete. Kept for FK-safe order history. */
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    /**
     * Tax category — drives jurisdiction rules at checkout:
     *   - 'digital'   : downloadable software/ebook/etc. (customer-IP location)
     *   - 'physical'  : shipped goods (shipping-address location)
     *   - 'service'   : consultation/course (customer-IP location)
     *   - 'exempt'    : product does not attract tax regardless of merchant setting
     */
    tax_category: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "digital",
      comment: "digital | physical | service | exempt",
    },
    /**
     * Per-product override for `apply_tax`. NULL = inherit merchant default
     * (`tbl_user.default_apply_tax`). Set explicitly to TRUE/FALSE to force.
     */
    apply_tax_override: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    /**
     * When TRUE the buyer can't pick a quantity — the product is a one-off
     * service (e.g. "Talk to a Developer"). Product page hides the qty
     * stepper and cart/checkout treat it as quantity = 1.
     */
    hide_quantity: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "tbl_product",
    timestamps: true,
  }
);

export default productModel;
