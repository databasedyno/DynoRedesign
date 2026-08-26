import type { Migration } from "../utils/migrationRunner";

/**
 * Refactor Item #1 — the tables historically created by ad-hoc `model.sync()`
 * calls at server boot, centralised here.
 *
 * - Production: driven by the versioned migration runner (run once, recorded in
 *   `schema_migrations`).
 * - Development: `server.ts` iterates `getBootModels()` with `{ alter: true }`
 *   to preserve the existing fast-iteration auto-sync behavior.
 *
 * The create-only `sync()` used by `up()` is idempotent: a no-op when the tables
 * already exist (all current prod/staging databases).
 */
/** Loads the boot model groups, split so each maps to its own migration version. */
async function loadBootModelGroups(): Promise<{ v1: unknown[]; extra: unknown[] }> {
  const {
    merchantWalletModel,
    merchantTempAddressModel,
    merchantPoolTransactionModel,
    merchantPoolSweepModel,
    referralModel,
    referralRewardModel,
    refereeCodeModel,
    kbCategoryModel,
    kbArticleModel,
    supportChatMessageModel,
    userModel,
    onboardingEventModel,
    loginActivityModel,
    stablecoinConversionModel,
    companyModel,
    buyButtonModel,
    publishableKeyModel,
    customerTransactionModel,
  } = await import("../models");
  const { selfTransactionModel } = await import("../models/userModels");
  const { default: pushSubscriptionModel } = await import(
    "../models/pushSubscriptionModel"
  );
  const { default: serviceHealthModel } = await import(
    "../models/serviceHealthModel"
  );

  // v1 — the original boot sequence (migration 0001_boot_model_tables).
  const v1: unknown[] = [
    merchantWalletModel,
    merchantTempAddressModel,
    merchantPoolTransactionModel,
    merchantPoolSweepModel,
    referralModel,
    referralRewardModel,
    refereeCodeModel,
    kbCategoryModel,
    kbArticleModel,
    supportChatMessageModel,
    userModel,
    onboardingEventModel,
    selfTransactionModel,
    loginActivityModel,
    stablecoinConversionModel,
    pushSubscriptionModel,
    companyModel,
  ];

  // extra — Refactor Item #1 (completion): 4 models that previously self-synced
  // at import time, now provisioned via migration 0002_boot_model_tables_extra.
  const extra: unknown[] = [
    buyButtonModel,
    publishableKeyModel,
    customerTransactionModel,
    serviceHealthModel,
  ];

  return { v1, extra };
}

/** All boot models — used by the dev-only `{ alter: true }` auto-sync in server.ts. */
export async function getBootModels(): Promise<unknown[]> {
  const { v1, extra } = await loadBootModelGroups();
  const { refundModel } = await import("../models");
  const { default: serviceHealthDailyModel } = await import(
    "../models/serviceHealthDailyModel"
  );
  return [...v1, ...extra, refundModel, serviceHealthDailyModel];
}

interface SyncableModel {
  sync: (options?: unknown) => Promise<unknown>;
}

function isSyncable(m: unknown): m is SyncableModel {
  return !!m && typeof (m as { sync?: unknown }).sync === "function";
}

/** create-only (no alter) sync of a model group — idempotent, no-op when tables exist. */
const syncGroup = (models: unknown[]) => async (): Promise<void> => {
  for (const m of models) {
    if (isSyncable(m)) await m.sync();
  }
};

/**
 * 0003 — additive opt-in column for the weekly payout digest email.
 * Idempotent (ADD COLUMN IF NOT EXISTS); safe on live prod (metadata-only,
 * constant default). Recorded once in schema_migrations.
 */
const addPayoutDigestPref = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_notification_preferences"
       ADD COLUMN IF NOT EXISTS "payout_digest_weekly" BOOLEAN NOT NULL DEFAULT false`
  );
};

/**
 * 0004 — Crypto Refund Flow.
 *  - Creates tbl_refund (create-only sync of refundModel; no-op if it exists).
 *  - Adds the additive `refund_address` column to tbl_product_order
 *    (payment links already have one). Idempotent + metadata-only → safe on prod.
 */
const createRefundTables = async (): Promise<void> => {
  const { refundModel } = await import("../models");
  if (isSyncable(refundModel)) await refundModel.sync();
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_product_order"
       ADD COLUMN IF NOT EXISTS "refund_address" VARCHAR(255)`
  );
};

/**
 * 0005 — Permanent daily uptime rollup for the public status page.
 *  - Creates tbl_service_health_daily (create-only sync; no-op if it exists)
 *    + a UNIQUE (service_id, check_date) index for upserts.
 *  - Backfills one row per (service, day) from whatever raw history still
 *    exists in tbl_service_health (the raw table is pruned to 7 days; the
 *    rollup is NEVER pruned, so the 90-day chart accumulates real history that
 *    survives redeploys).
 * Fully idempotent: CREATE ... IF NOT EXISTS + INSERT ... ON CONFLICT DO UPDATE.
 */
const createServiceHealthDailyTable = async (): Promise<void> => {
  const { default: serviceHealthDailyModel } = await import(
    "../models/serviceHealthDailyModel"
  );
  if (isSyncable(serviceHealthDailyModel)) await serviceHealthDailyModel.sync();

  const { default: sequelize } = await import("../utils/dbInstance");

  // Defence-in-depth: guarantee the unique index exists before the upsert
  // (ON CONFLICT (service_id, check_date) requires it).
  await sequelize.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "service_health_daily_svc_date_uq"
       ON "tbl_service_health_daily" ("service_id", "check_date")`
  );

  // One-time backfill from the surviving raw checks.
  await sequelize.query(
    `INSERT INTO "tbl_service_health_daily"
       (service_id, service_name, check_date, total_checks, operational_checks,
        degraded_checks, outage_checks, avg_latency_ms, worst_status,
        first_check_at, last_check_at, updated_at)
     SELECT
       service_id,
       MAX(service_name) AS service_name,
       check_date,
       COUNT(*) AS total_checks,
       SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) AS operational_checks,
       SUM(CASE WHEN status = 'degraded'    THEN 1 ELSE 0 END) AS degraded_checks,
       SUM(CASE WHEN status = 'outage'      THEN 1 ELSE 0 END) AS outage_checks,
       COALESCE(ROUND(AVG(latency_ms))::int, 0) AS avg_latency_ms,
       CASE
         WHEN SUM(CASE WHEN status = 'outage'   THEN 1 ELSE 0 END) > 0 THEN 'outage'
         WHEN SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) > 0 THEN 'degraded'
         ELSE 'operational'
       END AS worst_status,
       MIN(check_timestamp) AS first_check_at,
       MAX(check_timestamp) AS last_check_at,
       NOW() AS updated_at
     FROM "tbl_service_health"
     GROUP BY service_id, check_date
     ON CONFLICT (service_id, check_date) DO UPDATE SET
       service_name       = EXCLUDED.service_name,
       total_checks       = EXCLUDED.total_checks,
       operational_checks = EXCLUDED.operational_checks,
       degraded_checks    = EXCLUDED.degraded_checks,
       outage_checks      = EXCLUDED.outage_checks,
       avg_latency_ms     = EXCLUDED.avg_latency_ms,
       worst_status       = EXCLUDED.worst_status,
       first_check_at     = LEAST("tbl_service_health_daily".first_check_at, EXCLUDED.first_check_at),
       last_check_at      = GREATEST("tbl_service_health_daily".last_check_at, EXCLUDED.last_check_at),
       updated_at         = NOW()`
  );
};

export async function buildBootMigrations(): Promise<Migration[]> {
  const { v1, extra } = await loadBootModelGroups();
  return [
    { version: "0001_boot_model_tables", up: syncGroup(v1) },
    { version: "0002_boot_model_tables_extra", up: syncGroup(extra) },
    { version: "0003_add_payout_digest_pref", up: addPayoutDigestPref },
    { version: "0004_crypto_refund_flow", up: createRefundTables },
    { version: "0005_service_health_daily", up: createServiceHealthDailyTable },
  ];
}
