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
  return [...v1, ...extra];
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

export async function buildBootMigrations(): Promise<Migration[]> {
  const { v1, extra } = await loadBootModelGroups();
  return [
    { version: "0001_boot_model_tables", up: syncGroup(v1) },
    { version: "0002_boot_model_tables_extra", up: syncGroup(extra) },
    { version: "0003_add_payout_digest_pref", up: addPayoutDigestPref },
  ];
}
