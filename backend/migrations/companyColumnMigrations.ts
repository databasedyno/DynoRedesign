/**
 * companyColumnMigrations — additive, nullable column adds on tbl_company.
 *
 * Extracted from bootMigrations.ts to keep that file under the 500-line R2
 * budget (scripts/check-file-size.mjs). Each `up` is idempotent
 * (ADD COLUMN IF NOT EXISTS) and additive+nullable => metadata-only in
 * Postgres (no table rewrite). Safe on live prod.
 */

/**
 * 0026 — Phase 1b: per-brand minimum order amount. Adds the additive, nullable
 * `min_order_usd` DECIMAL(10,2) column (NULL = inherit the platform surface
 * defaults in services/checkout/orderMinimums.ts; a merchant may raise it).
 */
export const addCompanyMinOrderUsd = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_company"
       ADD COLUMN IF NOT EXISTS "min_order_usd" DECIMAL(10,2) DEFAULT NULL`
  );
};

/**
 * 0027 — two-secret webhook rotation (zero-downtime). Adds the additive,
 * nullable `webhook_secret_previous` + `webhook_secret_previous_expires_at`
 * columns. When a merchant rotates their signing secret the old one is kept
 * here for a 24h grace and co-signed on the company URL.
 */
export const addCompanyWebhookSecretRotation = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_company"
       ADD COLUMN IF NOT EXISTS "webhook_secret_previous" VARCHAR(100) DEFAULT NULL`
  );
  await sequelize.query(
    `ALTER TABLE "tbl_company"
       ADD COLUMN IF NOT EXISTS "webhook_secret_previous_expires_at" TIMESTAMPTZ DEFAULT NULL`
  );
};

/**
 * 0028 — creator supporter wall (opt-in, off by default). Adds the additive,
 * nullable `support_widget_show_wall` BOOLEAN to tbl_company + tbl_user
 * (NULL = off). Metadata-only, safe on live prod.
 */
export const addSupportWidgetShowWall = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  for (const table of ["tbl_company", "tbl_user"]) {
    await sequelize.query(
      `ALTER TABLE "${table}"
         ADD COLUMN IF NOT EXISTS "support_widget_show_wall" BOOLEAN DEFAULT NULL`
    );
  }
};

/**
 * 0029 — creator monthly tip goal (opt-in, NULL = off). Additive, nullable
 * NUMERIC(12,2) on tbl_company + tbl_user. Metadata-only, safe on live prod.
 */
export const addSupportWidgetMonthlyGoal = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  for (const table of ["tbl_company", "tbl_user"]) {
    await sequelize.query(
      `ALTER TABLE "${table}"
         ADD COLUMN IF NOT EXISTS "support_widget_monthly_goal" NUMERIC(12,2) DEFAULT NULL`
    );
  }
};
