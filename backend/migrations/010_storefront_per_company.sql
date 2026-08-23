-- ============================================================================
-- Migration 010 — STOREFRONT PER COMPANY (UP)
--
-- Makes the public storefront handle, creator/storefront page settings and the
-- product catalog belong to a COMPANY instead of the whole account/user.
--
-- SAFETY:
--   * 100% additive + idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT
--     EXISTS). It NEVER drops or rewrites existing tbl_user columns, so the app
--     keeps working with STOREFRONT_PER_COMPANY=false while this is applied.
--   * Backfill copies each user's existing storefront + products to that user's
--     PRIMARY (lowest company_id) company, so the ONE public page that exists
--     today keeps working unchanged. Other companies start empty.
--   * Run this INSIDE a transaction. Only flip STOREFRONT_PER_COMPANY=true AFTER
--     this has committed successfully.
--
-- Rollback: 010_storefront_per_company_rollback.sql
-- ============================================================================

BEGIN;

-- ── 1. Storefront/creator columns on tbl_company (mirror of tbl_user) ────────
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS handle                         VARCHAR(50);
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS bio                            VARCHAR(500);
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS creator_page_enabled           BOOLEAN DEFAULT false;
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS cover_image                    VARCHAR(500);
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS social_links                   JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS support_widget_enabled         BOOLEAN DEFAULT false;
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS support_widget_style           VARCHAR(20) DEFAULT 'coffee';
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS support_widget_label           VARCHAR(80);
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS support_widget_preset_amounts  JSONB DEFAULT '[3,5,10,25]'::jsonb;
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS support_widget_currency        VARCHAR(10) DEFAULT 'USD';
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS support_widget_min_amount      NUMERIC(10,2) DEFAULT 1;
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS support_widget_allow_message   BOOLEAN DEFAULT true;
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS support_widget_thanks_message  TEXT;
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS support_widget_show_supporters BOOLEAN DEFAULT true;
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS public_analytics_enabled       BOOLEAN DEFAULT true;
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS theme_accent_color             VARCHAR(9);
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS theme_cover_style              VARCHAR(20);
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS theme_cover_gradient           VARCHAR(60);

-- ── 2. company_id on catalog tables ──────────────────────────────────────────
ALTER TABLE tbl_product       ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES tbl_company(company_id) ON DELETE CASCADE;
ALTER TABLE tbl_product_order ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES tbl_company(company_id) ON DELETE SET NULL;

-- ── 3. Backfill storefront settings → each user's PRIMARY company ────────────
-- primary = the lowest company_id owned by that user. Only that company inherits
-- the existing handle/page/widget so the single live public page is preserved.
WITH primary_company AS (
  SELECT DISTINCT ON (user_id) company_id, user_id
  FROM tbl_company
  ORDER BY user_id, company_id ASC
)
UPDATE tbl_company c
SET handle                         = u.handle,
    bio                            = u.bio,
    creator_page_enabled           = COALESCE(u.creator_page_enabled, false),
    cover_image                    = u.cover_image,
    social_links                   = COALESCE(u.social_links, '{}'::jsonb),
    support_widget_enabled         = COALESCE(u.support_widget_enabled, false),
    support_widget_style           = COALESCE(u.support_widget_style, 'coffee'),
    support_widget_label           = u.support_widget_label,
    support_widget_preset_amounts  = COALESCE(u.support_widget_preset_amounts, '[3,5,10,25]'::jsonb),
    support_widget_currency        = COALESCE(u.support_widget_currency, 'USD'),
    support_widget_min_amount      = COALESCE(u.support_widget_min_amount, 1),
    support_widget_allow_message   = COALESCE(u.support_widget_allow_message, true),
    support_widget_thanks_message  = u.support_widget_thanks_message,
    support_widget_show_supporters = COALESCE(u.support_widget_show_supporters, true),
    public_analytics_enabled       = COALESCE(u.public_analytics_enabled, true),
    theme_accent_color             = u.theme_accent_color,
    theme_cover_style              = u.theme_cover_style,
    theme_cover_gradient           = u.theme_cover_gradient
FROM primary_company pc
JOIN tbl_user u ON u.user_id = pc.user_id
WHERE c.company_id = pc.company_id
  AND u.handle IS NOT NULL
  AND c.handle IS NULL;  -- idempotent: never re-copy over an already-set handle

-- ── 4. Backfill catalog ownership → each merchant's PRIMARY company ──────────
WITH primary_company AS (
  SELECT DISTINCT ON (user_id) company_id, user_id
  FROM tbl_company
  ORDER BY user_id, company_id ASC
)
UPDATE tbl_product p
SET company_id = pc.company_id
FROM primary_company pc
WHERE pc.user_id = p.merchant_user_id
  AND p.company_id IS NULL;

WITH primary_company AS (
  SELECT DISTINCT ON (user_id) company_id, user_id
  FROM tbl_company
  ORDER BY user_id, company_id ASC
)
UPDATE tbl_product_order o
SET company_id = pc.company_id
FROM primary_company pc
WHERE pc.user_id = o.merchant_user_id
  AND o.company_id IS NULL;

-- ── 5. Indexes ───────────────────────────────────────────────────────────────
-- Global case-insensitive uniqueness for company handles (partial: only rows
-- that actually have a handle participate; unlimited NULLs allowed).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tbl_company_handle_lower
  ON tbl_company (LOWER(handle))
  WHERE handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tbl_product_company_id       ON tbl_product (company_id);
CREATE INDEX IF NOT EXISTS idx_tbl_product_order_company_id ON tbl_product_order (company_id);

COMMIT;

-- ============================================================================
-- POST-MIGRATION: set STOREFRONT_PER_COMPANY=true in the backend environment
-- and redeploy/restart. Verify a company's storefront resolves before flipping
-- on for all traffic.
-- ============================================================================
