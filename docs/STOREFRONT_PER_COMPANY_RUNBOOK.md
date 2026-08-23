# Storefront Per Company — Migration Runbook

Each company gets its **own** public handle, storefront/creator page and product
catalog (instead of one shared per account). Ships behind a feature flag so it is
100% inert until you run the migration and flip the flag.

- **Flag:** `STOREFRONT_PER_COMPANY` (backend env). Default `false`.
- **Migration (up):** `backend/migrations/010_storefront_per_company.sql`
- **Rollback (down):** `backend/migrations/010_storefront_per_company_rollback.sql`

## What the migration does (all additive + idempotent)
1. Adds the storefront/creator columns to `tbl_company` (handle, bio, cover_image,
   social_links, support_widget_*, theme_*, public_analytics_enabled,
   creator_page_enabled).
2. Adds nullable `company_id` to `tbl_product` and `tbl_product_order`.
3. **Backfill:** copies each user's existing handle/page/widget settings and all of
   their products/orders to that user's **primary** (lowest `company_id`) company.
   The single public page that exists today keeps working unchanged; the account's
   other companies start with an empty storefront.
4. Adds a unique case-insensitive partial index on `tbl_company(LOWER(handle))`.

It NEVER modifies or drops the original `tbl_user` storefront columns, so the app
runs fine with the flag OFF even after the migration is applied.

## Deploy order (zero-downtime)
1. **Ship the code** (Save to GitHub → redeploy). Flag stays `false` → behavior is
   identical to today. This is safe to do first.
2. **Run the migration** on the production DB inside a maintenance-safe window:
   ```bash
   psql "$DATABASE_URL" -f backend/migrations/010_storefront_per_company.sql
   ```
   (It is transactional; a failure rolls back automatically.)
3. **Sanity check** (read-only) that the backfill worked:
   ```sql
   SELECT company_id, user_id, handle, creator_page_enabled FROM tbl_company WHERE handle IS NOT NULL ORDER BY company_id;
   SELECT count(*) FROM tbl_product WHERE company_id IS NULL;        -- expect 0
   SELECT count(*) FROM tbl_product_order WHERE company_id IS NULL;  -- expect 0
   ```
4. **Flip the flag:** set `STOREFRONT_PER_COMPANY=true` in the backend environment
   and redeploy/restart the backend.
5. **Verify live:** open `https://dynopay.me/<existing-handle>` → the primary
   company's storefront still renders. Create a product while a *second* company is
   selected → it appears only on that company's storefront, not the first.

## Rollback
1. Set `STOREFRONT_PER_COMPANY=false`, redeploy/restart (app reads `tbl_user` again).
2. Optionally drop the added columns:
   ```bash
   psql "$DATABASE_URL" -f backend/migrations/010_storefront_per_company_rollback.sql
   ```
   No data is lost — the source columns on `tbl_user` were never touched.

## Notes / current boundaries
- Handles are **globally unique** across companies (enforced by the new index).
- The public storefront page + shop + product catalog + product checkout are fully
  company-scoped when ON.
- Account-wide surfaces that still read `tbl_user.handle` for display (dashboard
  "claim handle" banner, some onboarding nudges) will show the **primary** company's
  handle — not broken, just not per-company. These can be migrated in a follow-up.
