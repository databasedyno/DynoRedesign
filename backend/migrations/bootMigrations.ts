import type { Migration } from "../utils/migrationRunner";
import { perfMigrations } from "./perfMigrations";

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
  // Tier-2 (#4/#10/#8) additive tables — included so the dev alter-sync path
  // also provisions them (prod uses the versioned migrations 0007–0009).
  const { default: inboundEventModel } = await import("../models/inboundEventModel");
  const { default: outboxEventModel } = await import("../models/outboxEventModel");
  const { default: keyAccessAuditModel } = await import("../models/keyAccessAuditModel");
  const { teamMemberModel } = await import("../models"); // Team Members / RBAC (0015)
  const { teamActivityModel } = await import("../models"); // Team Activity Log (0016)
  const { signupAttributionModel } = await import("../models"); // Signup Attribution (0019)
  const { paymentReceiptModel } = await import("../models"); // Shareable receipts (0021)
  return [
    ...v1,
    ...extra,
    refundModel,
    serviceHealthDailyModel,
    inboundEventModel,
    outboxEventModel,
    keyAccessAuditModel,
    teamMemberModel,
    teamActivityModel,
    signupAttributionModel,
    paymentReceiptModel,
  ];
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

/**
 * 0006 — Storefront visibility controls.
 *  - store_enabled: master storefront on/off (false => /shop + product pages 404
 *    and no products on the creator page).
 *  - creator_page_show_products: hide the Shop section from the creator page
 *    /[handle] only (the /shop page + direct product links still work).
 * Additive, nullable, DEFAULT true => metadata-only in Postgres (no table rewrite),
 * fully idempotent. Mirrored on both storefront holders (tbl_company when
 * STOREFRONT_PER_COMPANY is ON, tbl_user for the legacy path).
 */
const addStorefrontVisibilityFlags = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_company"
       ADD COLUMN IF NOT EXISTS "store_enabled" BOOLEAN DEFAULT true,
       ADD COLUMN IF NOT EXISTS "creator_page_show_products" BOOLEAN DEFAULT true`
  );
  await sequelize.query(
    `ALTER TABLE "tbl_user"
       ADD COLUMN IF NOT EXISTS "store_enabled" BOOLEAN DEFAULT true,
       ADD COLUMN IF NOT EXISTS "creator_page_show_products" BOOLEAN DEFAULT true`
  );
};

/**
 * 0007 — Tier-2 Item #4: inbound-event idempotency table (tbl_inbound_events).
 * Brand-new table with UNIQUE(provider, provider_event_id). Create-only sync —
 * no existing data is touched, so this is safe to apply on live prod.
 */
const createInboundEventsTable = async (): Promise<void> => {
  const { default: inboundEventModel } = await import("../models/inboundEventModel");
  if (isSyncable(inboundEventModel)) await inboundEventModel.sync();
};

/**
 * 0008 — Tier-2 Item #10: transactional outbox table (tbl_outbox).
 * Brand-new table. Create-only sync — safe on prod.
 */
const createOutboxTable = async (): Promise<void> => {
  const { default: outboxEventModel } = await import("../models/outboxEventModel");
  if (isSyncable(outboxEventModel)) await outboxEventModel.sync();
};

/**
 * 0009 — Tier-2 Item #8: append-only key-access audit table
 * (tbl_key_access_audit). Brand-new table. Create-only sync — safe on prod.
 */
const createKeyAccessAuditTable = async (): Promise<void> => {
  const { default: keyAccessAuditModel } = await import("../models/keyAccessAuditModel");
  if (isSyncable(keyAccessAuditModel)) await keyAccessAuditModel.sync();
};

/**
 * 0010 — Tier-1 money invariants on tbl_ledger_entries.
 * DB-level backstop so a bad ledger row can NEVER be written:
 *   - amount must be strictly positive (direction decides sign at aggregation).
 *   - direction must be exactly 'DR' or 'CR'.
 * Idempotent (guarded by pg_constraint existence). Verified safe on live prod
 * (1,676 rows, 0 violations at authoring time). The ADD CONSTRAINT scans the
 * table once under a brief lock — negligible at this size.
 */
const addLedgerMoneyInvariants = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_amount_positive'
      ) THEN
        ALTER TABLE "tbl_ledger_entries"
          ADD CONSTRAINT ledger_entries_amount_positive CHECK (amount > 0);
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_direction_valid'
      ) THEN
        ALTER TABLE "tbl_ledger_entries"
          ADD CONSTRAINT ledger_entries_direction_valid CHECK (direction IN ('DR','CR'));
      END IF;
    END $$;
  `);
};

/**
 * 0011 — Referral revenue-share accrual columns on tbl_referral.
 * Backs the "earn 25% of a referred merchant's platform fees for 12 months" model.
 * Additive, nullable / constant-default => metadata-only in Postgres (no table
 * rewrite), fully idempotent (ADD COLUMN IF NOT EXISTS). Verified safe on live prod.
 */
const addReferralCommissionColumns = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_referral"
       ADD COLUMN IF NOT EXISTS "commission_rate" DECIMAL(5,4) DEFAULT 0.2500,
       ADD COLUMN IF NOT EXISTS "commission_window_ends_at" TIMESTAMP NULL,
       ADD COLUMN IF NOT EXISTS "commission_accrued_usd" DECIMAL(14,2) DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "commission_paid_usd" DECIMAL(14,2) DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "last_accrual_at" TIMESTAMP NULL`
  );
};

/**
 * 0012 — Referral revenue-share CASH-OUT (Phase 2). ACCOUNT-level payout prefs on
 * tbl_user (additive, constant-default / nullable => metadata-only, idempotent) +
 * a new tbl_referral_payout table (create-only sync). Safe on live prod.
 */
const addReferralPayoutSupport = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_user"
       ADD COLUMN IF NOT EXISTS "referral_payout_mode" VARCHAR(10) DEFAULT 'credit',
       ADD COLUMN IF NOT EXISTS "referral_payout_trc20_address" VARCHAR(64),
       ADD COLUMN IF NOT EXISTS "referral_payout_address_verified_at" TIMESTAMP NULL`
  );
  const { default: referralPayoutModel } = await import("../models/referralModels/referralPayoutModel");
  if (isSyncable(referralPayoutModel)) await referralPayoutModel.sync();
};

/**
 * Migration 0013: referral payout automation — auto cash-out flag + configurable
 * trigger threshold + "you can cash out" nudge tracking. Idempotent; safe on live prod.
 */
const addReferralPayoutAutomation = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_user"
       ADD COLUMN IF NOT EXISTS "referral_payout_auto" BOOLEAN DEFAULT false,
       ADD COLUMN IF NOT EXISTS "referral_payout_auto_min_usd" DECIMAL(12,2) NULL,
       ADD COLUMN IF NOT EXISTS "referral_payout_nudged_at" TIMESTAMP NULL`
  );
};

/**
 * Migration 0014: referral revenue-share FEE-CREDIT consumption.
 * - tbl_referral += "commission_credited_usd" (running total spent as fee credit;
 *   unpaid = accrued − cash_paid − credited, so a dollar can never be both cashed
 *   out AND credited).
 * - tbl_user_transaction += "referral_credit_applied_usd" (per-settlement audit of
 *   how much referral credit reduced the platform fee on that payment).
 * Additive, constant-default => metadata-only, idempotent. Safe on live prod.
 */
const addReferralFeeCreditColumns = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_referral"
       ADD COLUMN IF NOT EXISTS "commission_credited_usd" DECIMAL(14,2) DEFAULT 0`
  );
  await sequelize.query(
    `ALTER TABLE "tbl_user_transaction"
       ADD COLUMN IF NOT EXISTS "referral_credit_applied_usd" DECIMAL(14,2) DEFAULT 0`
  );
};

/**
 * Migration 0015: Team Members / RBAC. Create-only sync of tbl_team_member
 * (additive, idempotent — a no-op when the table already exists). Safe on live
 * prod: a brand-new table, unused until the Team Members feature ships.
 */
const createTeamMemberTable = async (): Promise<void> => {
  const { teamMemberModel } = await import("../models");
  if (isSyncable(teamMemberModel)) await teamMemberModel.sync();
};

/**
 * Migration 0016: Team Activity Log. Create-only sync of tbl_team_activity
 * (append-only audit trail; additive, idempotent — a no-op when the table
 * already exists). Brand-new table, safe on live prod.
 */
const createTeamActivityTable = async (): Promise<void> => {
  const { teamActivityModel } = await import("../models");
  if (isSyncable(teamActivityModel)) await teamActivityModel.sync();
};

/**
 * Migration 0017: durable per-request webhook routing. Adds the additive,
 * nullable `webhook_secret` column to tbl_user_transaction (the table already
 * has webhook_url + callback_url) so a payment's per-request webhook target
 * survives Redis session expiry — resolveWebhookTargets reads it back as a
 * fallback. Additive / metadata-only => idempotent, safe on live prod.
 */
const addTransactionWebhookSecret = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_user_transaction"
       ADD COLUMN IF NOT EXISTS "webhook_secret" VARCHAR(255)`
  );
};

/**
 * Migration 0018: company-scoped notification routing. Adds two additive,
 * nullable/defaulted columns to tbl_company:
 *   - notification_email  (VARCHAR 190, NULL) — the address that receives
 *     COMPANY/business emails (payments, payouts, orders, digests, config).
 *     Resolution order when routing a company email: notification_email ->
 *     existing company.email -> owner's account email (never null in practice).
 *   - notification_prefs  (JSONB, DEFAULT '{}') — company-scoped routing prefs,
 *     e.g. { "team_fanout": true, "categories": { "payments": true, ... } }.
 *     This COMPLEMENTS the per-USER tbl_notification_preferences table (which
 *     stays account-scoped: security/login/OTP prefs live there).
 * Additive + nullable/default => metadata-only in Postgres (no table rewrite),
 * fully idempotent (ADD COLUMN IF NOT EXISTS). Verified-safe pattern on live prod.
 */
const addCompanyNotificationRouting = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_company"
       ADD COLUMN IF NOT EXISTS "notification_email" VARCHAR(190),
       ADD COLUMN IF NOT EXISTS "notification_prefs" JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
};

/**
 * Migration 0019: first-touch signup attribution table (tbl_signup_attribution).
 * Brand-new table (create-only sync — no-op if it exists). Powers the source→
 * conversion report and stores the activation-email marketing opt-out. Safe on prod.
 */
const createSignupAttributionTable = async (): Promise<void> => {
  const { signupAttributionModel } = await import("../models");
  if (isSyncable(signupAttributionModel)) await signupAttributionModel.sync();
};

/**
 * Migration 0021: shareable receipt snapshots (tbl_payment_receipt). Additive,
 * create-only (`sync()` without alter) — safe on live prod. One immutable JSON
 * snapshot per settled payment, addressed by an unguessable token
 * (/receipt/<token>) so buyers can prove payment without keeping the PDF.
 */
const createPaymentReceiptTable = async (): Promise<void> => {
  const { paymentReceiptModel } = await import("../models");
  if (isSyncable(paymentReceiptModel)) await paymentReceiptModel.sync();
};

/**
 * Migration 0020: enforce at most ONE active API key per (company_id, environment).
 * A PARTIAL unique index over active rows only — revoked/inactive duplicates are
 * still permitted (regenerate/revoke history). Verified 0 duplicate active groups
 * before authoring, so it applies cleanly on live prod. Idempotent (IF NOT EXISTS),
 * metadata-only on the tiny tbl_api. Backstops the app-level "1 active key per
 * environment" rule (apiController.addApi / ensureLiveApiKey / ensureSandboxApiKey).
 */
const addApiActiveKeyUniqueIndex = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "tbl_api_active_company_env_uq"
       ON "tbl_api" ("company_id", "environment")
       WHERE status = 'active'`
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
    { version: "0006_add_storefront_visibility_flags", up: addStorefrontVisibilityFlags },
    { version: "0007_inbound_events", up: createInboundEventsTable },
    { version: "0008_outbox", up: createOutboxTable },
    { version: "0009_key_access_audit", up: createKeyAccessAuditTable },
    { version: "0010_ledger_money_invariants", up: addLedgerMoneyInvariants },
    { version: "0011_referral_commission", up: addReferralCommissionColumns },
    { version: "0012_referral_payout", up: addReferralPayoutSupport },
    { version: "0013_referral_payout_automation", up: addReferralPayoutAutomation },
    { version: "0014_referral_fee_credit", up: addReferralFeeCreditColumns },
    { version: "0015_team_members", up: createTeamMemberTable },
    { version: "0016_team_activity", up: createTeamActivityTable },
    { version: "0017_txn_webhook_secret", up: addTransactionWebhookSecret },
    { version: "0018_company_notification_routing", up: addCompanyNotificationRouting },
    { version: "0019_signup_attribution", up: createSignupAttributionTable },
    { version: "0020_api_active_key_unique", up: addApiActiveKeyUniqueIndex },
    { version: "0021_payment_receipt", up: createPaymentReceiptTable },
    ...perfMigrations,
  ];
}
