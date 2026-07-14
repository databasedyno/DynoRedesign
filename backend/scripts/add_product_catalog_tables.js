/* Product Catalog — Phase 1 migration (Digital-only MVP).
 *
 * Adds:
 *   - tbl_product              — merchant's catalog SKUs
 *   - tbl_product_variant      — variant rows (size, color, tier, ...)
 *   - tbl_product_asset        — uploaded digital deliverables (files)
 *   - tbl_product_order        — buyer's completed cart (1 row per order)
 *   - tbl_product_order_item   — line items in an order
 *
 * Extends `tbl_payment_link` link_type to accept 'cart' (already a free-text
 * VARCHAR(24), so no ALTER needed — just a documentation note here).
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS + IF NOT EXISTS indexes).
 * Non-destructive. Safe to rerun.
 *
 * Spec: /app/memory/PRODUCT_CATALOG_SPEC.md §4.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

(async () => {
  const client = new Client({
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const stmts = [
    // ── tbl_product ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tbl_product (
      product_id                    BIGSERIAL PRIMARY KEY,
      merchant_user_id              BIGINT NOT NULL REFERENCES tbl_user(user_id) ON DELETE CASCADE,
      product_type                  VARCHAR(16) NOT NULL DEFAULT 'digital',
      title                         VARCHAR(160) NOT NULL,
      slug                          VARCHAR(180) NOT NULL,
      subtitle                      VARCHAR(240),
      description_md                TEXT,
      base_price_cents              BIGINT NOT NULL DEFAULT 0,
      currency                      VARCHAR(3) NOT NULL DEFAULT 'USD',
      cover_image_url               TEXT,
      gallery_images                JSONB DEFAULT '[]'::jsonb,
      category                      VARCHAR(64),
      status                        VARCHAR(16) NOT NULL DEFAULT 'draft',
      has_variants                  BOOLEAN NOT NULL DEFAULT false,
      base_stock                    INT,
      digital_delivery_type         VARCHAR(16),
      digital_delivery_payload      JSONB,
      physical_shipping_flat_cents  BIGINT,
      physical_weight_grams         INT,
      service_duration_minutes      INT,
      service_calendar_url          TEXT,
      sold_count                    INT NOT NULL DEFAULT 0,
      deleted_at                    TIMESTAMPTZ,
      "createdAt"                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_product_slug ON tbl_product (merchant_user_id, slug) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_product_merchant_status ON tbl_product (merchant_user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_product_type ON tbl_product (product_type)`,
    `CREATE INDEX IF NOT EXISTS idx_product_created ON tbl_product ("createdAt" DESC)`,

    // ── tbl_product_variant ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tbl_product_variant (
      variant_id       BIGSERIAL PRIMARY KEY,
      product_id       BIGINT NOT NULL REFERENCES tbl_product(product_id) ON DELETE CASCADE,
      sku              VARCHAR(80),
      attributes       JSONB NOT NULL DEFAULT '{}'::jsonb,
      price_cents      BIGINT NOT NULL DEFAULT 0,
      stock_count      INT,
      image_url        TEXT,
      sort_order       INT DEFAULT 0,
      is_active        BOOLEAN NOT NULL DEFAULT true,
      "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_variant_product ON tbl_product_variant (product_id, is_active, sort_order)`,

    // ── tbl_product_asset ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tbl_product_asset (
      asset_id           BIGSERIAL PRIMARY KEY,
      product_id         BIGINT NOT NULL REFERENCES tbl_product(product_id) ON DELETE CASCADE,
      merchant_user_id   BIGINT NOT NULL,
      filename           VARCHAR(255) NOT NULL,
      mime_type          VARCHAR(100),
      size_bytes         BIGINT,
      storage_backend    VARCHAR(24) NOT NULL DEFAULT 'local',
      storage_bucket     VARCHAR(120),
      storage_object     VARCHAR(500) NOT NULL,
      sha256             CHAR(64),
      is_active          BOOLEAN NOT NULL DEFAULT true,
      "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_asset_product ON tbl_product_asset (product_id, is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_asset_merchant ON tbl_product_asset (merchant_user_id)`,

    // ── tbl_product_order ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tbl_product_order (
      order_id             BIGSERIAL PRIMARY KEY,
      public_ref           VARCHAR(48) NOT NULL UNIQUE,
      merchant_user_id     BIGINT NOT NULL REFERENCES tbl_user(user_id) ON DELETE CASCADE,
      payment_link_id      INTEGER REFERENCES tbl_payment_link(link_id) ON DELETE SET NULL,
      buyer_email          VARCHAR(255) NOT NULL,
      buyer_name           VARCHAR(160),
      buyer_phone          VARCHAR(32),
      shipping_address     JSONB,
      subtotal_cents       BIGINT NOT NULL DEFAULT 0,
      shipping_cents       BIGINT NOT NULL DEFAULT 0,
      tax_cents            BIGINT NOT NULL DEFAULT 0,
      total_cents          BIGINT NOT NULL DEFAULT 0,
      currency             VARCHAR(3) NOT NULL DEFAULT 'USD',
      crypto_currency      VARCHAR(24),
      crypto_network       VARCHAR(24),
      crypto_amount        DECIMAL(28, 8),
      payment_status       VARCHAR(24) NOT NULL DEFAULT 'pending',
      fulfillment_status   VARCHAR(24) NOT NULL DEFAULT 'unfulfilled',
      paid_at              TIMESTAMPTZ,
      locale               VARCHAR(6),
      "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_order_merchant_status ON tbl_product_order (merchant_user_id, payment_status, "createdAt" DESC)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payment_link ON tbl_product_order (payment_link_id) WHERE payment_link_id IS NOT NULL`,

    // ── tbl_product_order_item ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tbl_product_order_item (
      order_item_id        BIGSERIAL PRIMARY KEY,
      order_id             BIGINT NOT NULL REFERENCES tbl_product_order(order_id) ON DELETE CASCADE,
      product_id           BIGINT NOT NULL REFERENCES tbl_product(product_id) ON DELETE RESTRICT,
      variant_id           BIGINT REFERENCES tbl_product_variant(variant_id) ON DELETE SET NULL,
      product_snapshot     JSONB NOT NULL DEFAULT '{}'::jsonb,
      variant_snapshot     JSONB,
      quantity             INT NOT NULL CHECK (quantity > 0),
      unit_price_cents     BIGINT NOT NULL DEFAULT 0,
      line_total_cents     BIGINT NOT NULL DEFAULT 0,
      fulfillment_status   VARCHAR(24) NOT NULL DEFAULT 'unfulfilled',
      delivered_payload    JSONB,
      "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_order_item_order ON tbl_product_order_item (order_id)`,
    `CREATE INDEX IF NOT EXISTS idx_order_item_product ON tbl_product_order_item (product_id)`,
  ];

  for (const s of stmts) {
    try {
      await client.query(s);
      console.log("OK:", s.split("\n")[0].slice(0, 90));
    } catch (e) {
      console.error("FAIL:", s.split("\n")[0].slice(0, 90), "->", e.message);
      throw e;
    }
  }

  // Verification counts
  const tables = [
    "tbl_product",
    "tbl_product_variant",
    "tbl_product_asset",
    "tbl_product_order",
    "tbl_product_order_item",
  ];
  console.log("\n─── Row counts ─────────────────────");
  for (const t of tables) {
    const r = await client.query(`SELECT count(*) AS n FROM ${t}`);
    console.log(`${t}: ${r.rows[0].n}`);
  }
  console.log("\n✅ Migration complete. Product catalog schema is live.");

  await client.end();
})().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
