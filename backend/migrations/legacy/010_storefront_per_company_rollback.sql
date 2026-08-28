-- ============================================================================
-- Migration 010 — STOREFRONT PER COMPANY (ROLLBACK / DOWN)
--
-- Fully reverses 010_storefront_per_company.sql. Because the UP migration was
-- purely additive (it COPIED from tbl_user and never modified/deleted the
-- original tbl_user storefront columns), dropping the added columns + indexes
-- restores the database to its exact pre-migration state.
--
-- BEFORE RUNNING: set STOREFRONT_PER_COMPANY=false and redeploy/restart so the
-- app is reading from tbl_user again, THEN run this to drop the new columns.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS uniq_tbl_company_handle_lower;
DROP INDEX IF EXISTS idx_tbl_product_company_id;
DROP INDEX IF EXISTS idx_tbl_product_order_company_id;

ALTER TABLE tbl_product_order DROP COLUMN IF EXISTS company_id;
ALTER TABLE tbl_product       DROP COLUMN IF EXISTS company_id;

ALTER TABLE tbl_company DROP COLUMN IF EXISTS handle;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS bio;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS creator_page_enabled;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS cover_image;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS social_links;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS support_widget_enabled;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS support_widget_style;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS support_widget_label;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS support_widget_preset_amounts;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS support_widget_currency;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS support_widget_min_amount;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS support_widget_allow_message;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS support_widget_thanks_message;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS support_widget_show_supporters;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS public_analytics_enabled;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS theme_accent_color;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS theme_cover_style;
ALTER TABLE tbl_company DROP COLUMN IF EXISTS theme_cover_gradient;

COMMIT;
