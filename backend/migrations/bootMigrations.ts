import type { Migration } from "../utils/migrationRunner";
import { perfMigrations } from "./perfMigrations";
import { securityMigrations } from "./securityMigrations";
import { referralMigrations } from "./referralMigrations";
import { addCompanyMinOrderUsd, addCompanyWebhookSecretRotation, addSupportWidgetShowWall, addSupportWidgetMonthlyGoal, addWalletOwnershipVerification } from "./companyColumnMigrations";

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
  const { vatValidationModel } = await import("../models"); // VAT validation cache (0028)
  const { escrowDealModel } = await import("../models"); // Escrow deals (0035)
  const { default: adminSessionModel } = await import("../models/adminSessionModel"); // Admin sessions (0056)
  const { botHitModel } = await import("../models"); // AI crawler analytics (0061)
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
    vatValidationModel,
    escrowDealModel,
    adminSessionModel,
    botHitModel,
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

/**
 * 0023 — B12: per-brand "show fee split to customers" preference (NULL = auto:
 * only when the customer pays the fee). Additive, idempotent, safe on live prod.
 */
const addCompanyFeeSplitVisibility = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_company"
       ADD COLUMN IF NOT EXISTS "show_fee_split_to_customers" BOOLEAN DEFAULT NULL`
  );
};

/**
 * 0024 — account-wide token cutoff behind "sign out all other devices" /
 * "sign out everywhere". authMiddleware rejects any JWT whose `iat` predates
 * it, so every previously issued token dies regardless of how it was issued.
 * Additive, nullable, idempotent — safe on live prod.
 */
const addUserTokensValidAfter = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_user"
       ADD COLUMN IF NOT EXISTS "tokens_valid_after" TIMESTAMPTZ`
  );
};

/**
 * 0054 — SafeDeal session security (account-takeover hardening).
 *  - tbl_safedeal_profile.tokens_valid_after: any SafeDeal JWT with iat before this is rejected
 *    (global "sign out everywhere" after a sensitive change such as an email change).
 *  - tbl_safedeal_profile.cashout_hold_until: cashouts route to admin approval until this instant
 *    (24h hold applied after an email change).
 * Additive + idempotent (nullable, no rewrite) — safe on live prod.
 */
const addSafeDealSessionSecurity = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_safedeal_profile"
       ADD COLUMN IF NOT EXISTS "tokens_valid_after" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "cashout_hold_until" TIMESTAMPTZ`
  );
  // Why a cashout was routed to admin approval (single-large / velocity / email-change hold),
  // shown in the admin cashouts panel so ops can triage at a glance.
  await sequelize.query(
    `ALTER TABLE "tbl_customer_withdrawal" ADD COLUMN IF NOT EXISTS "approval_reason" TEXT`
  );
};

/**
 * 0025 — merchant API keys become one-way hashed (Stripe/Coinbase model).
 * Adds key_hash / key_hint / key_version / key_rotated_at, relaxes the legacy
 * NOT NULL on "apiKey", and backfills sha256("apiKey") for every existing row in
 * Node (same hashing code the auth middleware uses at runtime). ADDITIVE ONLY:
 * the plaintext column is untouched here so the previous deployment keeps
 * validating keys until it is replaced. The wipe is a separate, prod-gated boot
 * job (services/apiKeys/apiKeyHashingRollout.ts). Idempotent.
 */
const addApiKeyHash = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  const { QueryTypes } = await import("sequelize");
  const { hashApiKey, apiKeyHint, API_KEY_VERSION_LEGACY } = await import("../helper/apiKeyToken");
  await sequelize.query(`ALTER TABLE "tbl_api" ADD COLUMN IF NOT EXISTS "key_hash" VARCHAR(64)`);
  await sequelize.query(`ALTER TABLE "tbl_api" ADD COLUMN IF NOT EXISTS "key_hint" VARCHAR(40)`);
  await sequelize.query(
    `ALTER TABLE "tbl_api" ADD COLUMN IF NOT EXISTS "key_version" SMALLINT NOT NULL DEFAULT ${API_KEY_VERSION_LEGACY}`
  );
  await sequelize.query(`ALTER TABLE "tbl_api" ADD COLUMN IF NOT EXISTS "key_rotated_at" TIMESTAMPTZ`);
  await sequelize.query(`ALTER TABLE "tbl_api" ALTER COLUMN "apiKey" DROP NOT NULL`);

  const rows = (await sequelize.query(
    `SELECT api_id, "apiKey", environment FROM "tbl_api" WHERE key_hash IS NULL AND "apiKey" IS NOT NULL`,
    { type: QueryTypes.SELECT }
  )) as Array<{ api_id: number; apiKey: string; environment: string | null }>;
  for (const r of rows) {
    await sequelize.query(
      `UPDATE "tbl_api" SET key_hash = :hash, key_hint = :hint, key_version = ${API_KEY_VERSION_LEGACY} WHERE api_id = :id`,
      { replacements: { hash: hashApiKey(r.apiKey), hint: apiKeyHint(r.apiKey, r.environment), id: r.api_id } }
    );
  }
  await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "tbl_api_key_hash_uq" ON "tbl_api" ("key_hash")`);
};

/**
 * 0026/0027 company column adds live in ./companyColumnMigrations (extracted to
 * keep this file under the 500-line R2 budget). Imported into the registry below.
 */

/**
 * 0028 — Backlog #1 (VIES): create tbl_vat_validation (VAT-number verification
 * cache + proof) and add vies_checked_at / vies_valid / vies_source to
 * tbl_product_order + tbl_user_transaction. Additive, idempotent, safe on prod.
 */
const addViesValidationSupport = async (): Promise<void> => {
  const { vatValidationModel } = await import("../models");
  if (isSyncable(vatValidationModel)) await vatValidationModel.sync();
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_product_order"
       ADD COLUMN IF NOT EXISTS "vies_checked_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "vies_valid" BOOLEAN,
       ADD COLUMN IF NOT EXISTS "vies_source" VARCHAR(24)`
  );
  await sequelize.query(
    `ALTER TABLE "tbl_user_transaction"
       ADD COLUMN IF NOT EXISTS "vies_checked_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "vies_valid" BOOLEAN,
       ADD COLUMN IF NOT EXISTS "vies_source" VARCHAR(24)`
  );
};

/**
 * 0029 — Backlog #5 (reduced/zero VAT): add tax_treatment + reduced_category to
 * tbl_product. Additive, idempotent, safe on prod. Also cleans stale tbl_tax_rate
 * cache rows whose standard_rate is NULL/NaN (from a prior API-shape bug) so they
 * get re-resolved correctly — regenerable reference cache, safe to delete.
 */
const addProductTaxTreatment = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_product"
       ADD COLUMN IF NOT EXISTS "tax_treatment" VARCHAR(16) NOT NULL DEFAULT 'standard',
       ADD COLUMN IF NOT EXISTS "reduced_category" VARCHAR(32)`
  );
  await sequelize.query(
    `DELETE FROM "tbl_tax_rate" WHERE standard_rate IS NULL OR standard_rate::text = 'NaN'`
  );
};

/**
 * 0030 — Backlog #4 (nexus alerts): create tbl_nexus_alert (dedupe store for
 * registration-threshold email escalations). Create-only sync — safe on prod.
 */
const createNexusAlertTable = async (): Promise<void> => {
  const { nexusAlertModel } = await import("../models");
  if (isSyncable(nexusAlertModel)) await nexusAlertModel.sync();
};

/** 0032 — creator monthly tip goal: tbl_tip_goal_milestone (dedupe store for the 50%/100% emails). Create-only. */
const createTipGoalMilestoneTable = async (): Promise<void> => {
  const { tipGoalMilestoneModel } = await import("../models");
  if (isSyncable(tipGoalMilestoneModel)) await tipGoalMilestoneModel.sync();
};

/**
 * 0033 — Customers CRM notes/tags + manual contacts: tbl_customer_annotation.
 * Additive, idempotent (IF NOT EXISTS), merchant-private overlay keyed by
 * (company_id, lowercased email). Safe on live prod.
 */
const createCustomerAnnotationTable = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_customer_annotation" (
       "annotation_id" SERIAL PRIMARY KEY,
       "company_id" INTEGER NOT NULL,
       "email" VARCHAR(255) NOT NULL,
       "display_name" VARCHAR(255),
       "mobile" VARCHAR(64),
       "notes" TEXT,
       "tags" JSONB,
       "created_manually" BOOLEAN NOT NULL DEFAULT FALSE,
       "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await sequelize.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "tbl_customer_annotation_company_email_uq"
       ON "tbl_customer_annotation" ("company_id", "email")`
  );
};

/**
 * 0034 — Ops "Needs attention" resolution flags on tbl_user_transaction.
 * Lets an operator mark a stuck payout as manually resolved (funds settled by
 * hand) so it leaves the merchant Needs-attention feed. Additive, nullable,
 * metadata-only => idempotent, safe on live prod.
 */
const addTxnAttentionResolved = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_user_transaction"
       ADD COLUMN IF NOT EXISTS "attention_resolved_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "attention_resolved_by" VARCHAR(200),
       ADD COLUMN IF NOT EXISTS "attention_resolved_note" TEXT`
  );
};

/**
 * 0035 — Escrow deals (tbl_escrow_deal). Brand-new table (create-only sync —
 * a no-op when it already exists). Additive, safe on live prod: unused until the
 * Escrow feature is exercised, touches no existing table.
 */
const createEscrowTable = async (): Promise<void> => {
  const { escrowDealModel } = await import("../models");
  if (isSyncable(escrowDealModel)) await escrowDealModel.sync();
};

/**
 * 0036 — Escrow custody + two-phase settlement + OTP onboarding columns.
 * Additive ADD COLUMN IF NOT EXISTS on the (new, escrow-only) tbl_escrow_deal —
 * metadata-only, idempotent, safe on live prod.
 */
const addEscrowSettlementColumns = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_escrow_deal"
       ADD COLUMN IF NOT EXISTS "custody_stablecoin" VARCHAR(20),
       ADD COLUMN IF NOT EXISTS "custody_amount_stable" DECIMAL(18,2),
       ADD COLUMN IF NOT EXISTS "converted_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "outcome" VARCHAR(16),
       ADD COLUMN IF NOT EXISTS "outcome_authorized_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "seller_entitlement_stable" DECIMAL(18,2),
       ADD COLUMN IF NOT EXISTS "seller_payout_state" VARCHAR(16) NOT NULL DEFAULT 'na',
       ADD COLUMN IF NOT EXISTS "seller_paid_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "seller_payout_tx" VARCHAR(255),
       ADD COLUMN IF NOT EXISTS "seller_signed_in" BOOLEAN NOT NULL DEFAULT false,
       ADD COLUMN IF NOT EXISTS "buyer_entitlement_stable" DECIMAL(18,2),
       ADD COLUMN IF NOT EXISTS "buyer_payout_state" VARCHAR(16) NOT NULL DEFAULT 'na',
       ADD COLUMN IF NOT EXISTS "buyer_refund_coin" VARCHAR(20),
       ADD COLUMN IF NOT EXISTS "buyer_paid_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "buyer_payout_tx" VARCHAR(255),
       ADD COLUMN IF NOT EXISTS "buyer_signed_in" BOOLEAN NOT NULL DEFAULT false,
       ADD COLUMN IF NOT EXISTS "fully_paid_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "payout_reminder_count" INTEGER NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "payout_reminder_last_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "needs_admin_review" BOOLEAN NOT NULL DEFAULT false,
       ADD COLUMN IF NOT EXISTS "counterparty_verified_at" TIMESTAMPTZ`
  );
};

/**
 * 0037 — Escrow dispute negotiation (two-tier resolution: parties settle first,
 * admin as fallback). Additive ADD COLUMN IF NOT EXISTS on the (escrow-only)
 * tbl_escrow_deal — metadata-only, idempotent, safe on live prod.
 */
const addEscrowDisputeColumns = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_escrow_deal"
       ADD COLUMN IF NOT EXISTS "dispute_stage" VARCHAR(16),
       ADD COLUMN IF NOT EXISTS "dispute_proposal" JSONB,
       ADD COLUMN IF NOT EXISTS "dispute_proposal_by" VARCHAR(10),
       ADD COLUMN IF NOT EXISTS "dispute_escalated_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "dispute_auto_escalate_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "dispute_thread" JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
};

/**
 * 0038 — SafeDeal (standalone escrow product on top of Dynopay). Additive only:
 *  - tbl_escrow_deal: source/creator_email/customer links + funding method/link
 *    columns; creator_user_id becomes nullable (SafeDeal parties are customers).
 *  - tbl_customer_wallet.held_amount: funds held in escrow (Available vs Held).
 *  - tbl_customer_transaction.meta: machine-readable statement metadata.
 *  - new tables: safedeal profile, customer payout addresses, customer withdrawals.
 */
const addSafeDealTables = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_escrow_deal"
       ADD COLUMN IF NOT EXISTS "source" VARCHAR(16) NOT NULL DEFAULT 'merchant',
       ADD COLUMN IF NOT EXISTS "creator_email" VARCHAR(255),
       ADD COLUMN IF NOT EXISTS "creator_customer_id" INTEGER,
       ADD COLUMN IF NOT EXISTS "counterparty_customer_id" INTEGER,
       ADD COLUMN IF NOT EXISTS "funding_method" VARCHAR(16),
       ADD COLUMN IF NOT EXISTS "funding_link_transaction_id" VARCHAR(64),
       ADD COLUMN IF NOT EXISTS "funding_link_ref" VARCHAR(64)`
  );
  await sequelize.query(`ALTER TABLE "tbl_escrow_deal" ALTER COLUMN "creator_user_id" DROP NOT NULL`);
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS "idx_escrow_deal_source_emails" ON "tbl_escrow_deal" ("source", "creator_email", "counterparty_email")`
  );
  await sequelize.query(
    `ALTER TABLE "tbl_customer_wallet" ADD COLUMN IF NOT EXISTS "held_amount" FLOAT NOT NULL DEFAULT 0`
  );
  await sequelize.query(`ALTER TABLE "tbl_customer_transaction" ADD COLUMN IF NOT EXISTS "meta" JSONB`);
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_safedeal_profile" (
       "customer_id" INTEGER PRIMARY KEY REFERENCES "tbl_customer"("customer_id") ON DELETE CASCADE,
       "company_id" INTEGER NOT NULL,
       "display_name" VARCHAR(120),
       "auto_withdraw" BOOLEAN NOT NULL DEFAULT false,
       "auto_withdraw_address_id" INTEGER,
       "last_login_at" TIMESTAMPTZ,
       "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_customer_payout_address" (
       "address_id" SERIAL PRIMARY KEY,
       "company_id" INTEGER NOT NULL,
       "customer_id" INTEGER NOT NULL REFERENCES "tbl_customer"("customer_id") ON DELETE CASCADE,
       "payout_key" VARCHAR(24) NOT NULL,
       "coin" VARCHAR(10) NOT NULL,
       "network" VARCHAR(16) NOT NULL,
       "address" VARCHAR(255) NOT NULL,
       "label" VARCHAR(80),
       "last_used_at" TIMESTAMPTZ,
       "removed_at" TIMESTAMPTZ,
       "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS "idx_customer_payout_address_customer" ON "tbl_customer_payout_address" ("customer_id")`
  );
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_customer_withdrawal" (
       "withdrawal_id" SERIAL PRIMARY KEY,
       "company_id" INTEGER NOT NULL,
       "customer_id" INTEGER NOT NULL REFERENCES "tbl_customer"("customer_id") ON DELETE CASCADE,
       "address_id" INTEGER,
       "payout_key" VARCHAR(24) NOT NULL,
       "address" VARCHAR(255) NOT NULL,
       "amount_usd" DECIMAL(18,2) NOT NULL,
       "fee_usd" DECIMAL(18,2) NOT NULL DEFAULT 0,
       "net_usd" DECIMAL(18,2) NOT NULL,
       "status" VARCHAR(24) NOT NULL DEFAULT 'queued',
       "requires_approval" BOOLEAN NOT NULL DEFAULT false,
       "approved_by" VARCHAR(120),
       "approved_at" TIMESTAMPTZ,
       "rejected_reason" TEXT,
       "tx_hash" VARCHAR(255),
       "simulated" BOOLEAN NOT NULL DEFAULT false,
       "sent_at" TIMESTAMPTZ,
       "ledger_reference" VARCHAR(64),
       "source" VARCHAR(16) NOT NULL DEFAULT 'manual',
       "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS "idx_customer_withdrawal_status" ON "tbl_customer_withdrawal" ("company_id", "status")`
  );
};


/**
 * 0039 — SafeDeal evidence attachments + delivery proof + multi-fiat pricing.
 * Additive: new tbl_escrow_attachment (private object keys, never public URLs)
 * and nullable columns on tbl_escrow_deal. Idempotent, safe on live prod.
 */
const addSafeDealAttachmentsAndPricing = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_escrow_deal"
       ADD COLUMN IF NOT EXISTS "delivery_proof" JSONB,
       ADD COLUMN IF NOT EXISTS "price_currency" VARCHAR(8),
       ADD COLUMN IF NOT EXISTS "price_amount" DECIMAL(18,2),
       ADD COLUMN IF NOT EXISTS "fx_rate" DECIMAL(18,8),
       ADD COLUMN IF NOT EXISTS "fx_locked_at" TIMESTAMPTZ`
  );
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_escrow_attachment" (
       "attachment_id" SERIAL PRIMARY KEY,
       "escrow_id" INTEGER NOT NULL,
       "company_id" INTEGER,
       "uploaded_by_role" VARCHAR(8),
       "uploaded_by_email" VARCHAR(255),
       "context" VARCHAR(16) NOT NULL DEFAULT 'pending',
       "ref" VARCHAR(32),
       "file_name" VARCHAR(255) NOT NULL,
       "mime" VARCHAR(80) NOT NULL,
       "size_bytes" INTEGER NOT NULL DEFAULT 0,
       "storage" VARCHAR(8) NOT NULL,
       "storage_key" VARCHAR(400) NOT NULL,
       "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "idx_escrow_attachment_deal" ON "tbl_escrow_attachment" ("escrow_id", "context")`);
};

/**
 * 0040 — SafeDeal deal terms: deal type, delivery due date, revision rounds
 * ("request changes"), amend/resend bookkeeping and once-only reminder stamps.
 * Additive + idempotent, safe on live prod.
 */
const addSafeDealDealTerms = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_escrow_deal"
       ADD COLUMN IF NOT EXISTS "deal_type" VARCHAR(16),
       ADD COLUMN IF NOT EXISTS "delivery_due_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "revision_round" INTEGER NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "revision_note" TEXT,
       ADD COLUMN IF NOT EXISTS "amended_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "invite_resent_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "reminders" JSONB`
  );
};

/**
 * 0041 — SafeDeal funding via Dynopay Merchant API + Binance custody hold + payout at close.
 *  - tbl_escrow_deal.funding_payment (Direct-API payment: address/QR/status), payout_prefs
 *    (per-party payout destination), custody_realized_usd/at (USDT realised after auto-convert),
 *    funding_settled_at.
 *  - tbl_safedeal_profile.parked_payout_usd: settlement waiting for a payout address.
 *  - tbl_customer_withdrawal.escrow_id: payouts link back to their deal.
 *  - conversion status HELD: SafeDeal deposits stay on Binance after conversion (no Phase 3 withdrawal).
 * Additive + idempotent, safe on live prod.
 */
const addSafeDealApiFunding = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_escrow_deal"
       ADD COLUMN IF NOT EXISTS "funding_payment" JSONB,
       ADD COLUMN IF NOT EXISTS "payout_prefs" JSONB,
       ADD COLUMN IF NOT EXISTS "custody_realized_usd" NUMERIC(18,2),
       ADD COLUMN IF NOT EXISTS "custody_realized_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "funding_settled_at" TIMESTAMPTZ`
  );
  await sequelize.query(`ALTER TABLE "tbl_safedeal_profile" ADD COLUMN IF NOT EXISTS "parked_payout_usd" NUMERIC(18,2) NOT NULL DEFAULT 0`);
  await sequelize.query(`ALTER TABLE "tbl_customer_withdrawal" ADD COLUMN IF NOT EXISTS "escrow_id" INTEGER`);
  await sequelize.query(`ALTER TYPE "enum_tbl_stablecoin_conversion_status" ADD VALUE IF NOT EXISTS 'HELD'`);
};

/**
 * 0042 — SafeDeal wallet top-ups: a customer deposits crypto via Dynopay's Direct API and the
 * customer wallet is credited in USD on confirmation. Additive + idempotent.
 */
const addSafeDealTopups = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_safedeal_topup" (
       "topup_id" SERIAL PRIMARY KEY,
       "company_id" INTEGER NOT NULL,
       "customer_id" INTEGER NOT NULL,
       "coin" VARCHAR(32) NOT NULL,
       "amount_usd" NUMERIC(18,2) NOT NULL,
       "network_fee_usd" NUMERIC(18,2) NOT NULL DEFAULT 0,
       "conversion_fee_usd" NUMERIC(18,2) NOT NULL DEFAULT 0,
       "exchange_fee_usd" NUMERIC(18,2) NOT NULL DEFAULT 0,
       "pays_usd" NUMERIC(18,2) NOT NULL,
       "payment_id" VARCHAR(64),
       "address" VARCHAR(160),
       "destination_tag" BIGINT,
       "crypto_amount" VARCHAR(64),
       "qr_code" TEXT,
       "status" VARCHAR(24) NOT NULL DEFAULT 'waiting',
       "seen_tx" VARCHAR(160),
       "received_crypto" NUMERIC(30,12),
       "simulated" BOOLEAN NOT NULL DEFAULT false,
       "expires_at" TIMESTAMPTZ NOT NULL,
       "credited_at" TIMESTAMPTZ,
       "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "idx_safedeal_topup_customer" ON "tbl_safedeal_topup" ("customer_id", "created_at" DESC)`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "idx_safedeal_topup_payment" ON "tbl_safedeal_topup" ("payment_id")`);
};

// 0043 — Telegram login for SafeDeal: store the Telegram user id on the customer row (unique per brand).
const addCustomerTelegramId = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(`ALTER TABLE "tbl_customer" ADD COLUMN IF NOT EXISTS "telegram_id" VARCHAR(64)`);
  await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "tbl_customer_telegram_id_uq" ON "tbl_customer" ("company_id", "telegram_id") WHERE "telegram_id" IS NOT NULL`);
};

// 0044 — SafeDeal deposit reserve: wallet top-ups are "spending money for deals" and must never be auto-withdrawn.
const addSafeDealDepositReserve = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(`ALTER TABLE "tbl_safedeal_profile" ADD COLUMN IF NOT EXISTS "deposit_reserved_usd" DOUBLE PRECISION NOT NULL DEFAULT 0`);
};

/**
 * 0045 — SafeDeal shareable "invite by link" deals + Telegram-friendly invitations.
 *  - tbl_escrow_deal.invite_kind: 'email' (addressed invite, default) | 'link' (open seat,
 *    the first signed-in person who opens the link claims the counterparty seat).
 *  - tbl_escrow_deal.counterparty_claimed_at: when an open-seat link was claimed.
 *  - counterparty_email becomes nullable: an open-seat link has no addressed inbox until claimed.
 * Additive + idempotent, safe on live prod (relaxing NOT NULL never touches existing rows).
 */
const addSafeDealInviteLink = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_escrow_deal"
       ADD COLUMN IF NOT EXISTS "invite_kind" VARCHAR(16) NOT NULL DEFAULT 'email',
       ADD COLUMN IF NOT EXISTS "counterparty_claimed_at" TIMESTAMPTZ`
  );
  await sequelize.query(`ALTER TABLE "tbl_escrow_deal" ALTER COLUMN "counterparty_email" DROP NOT NULL`);
};

/**
 * 0046 — Payment history must outlive the customer row. tbl_user_transaction.customer_id
 * was ON DELETE CASCADE, so deleting a tbl_customer (merchant "delete customer", purge
 * scripts) silently wiped every payment the customer ever made — this is how the two
 * real SafeDeal brand payments vanished from the merchant dashboard (2026-09). Re-point
 * the FK to ON DELETE SET NULL. Idempotent: only rewrites when the rule is still CASCADE.
 */
const relaxTransactionCustomerCascade = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(`
    DO $$
    DECLARE fk RECORD;
    BEGIN
      FOR fk IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'tbl_user_transaction'::regclass
          AND c.contype = 'f'
          AND c.confrelid = 'tbl_customer'::regclass
          AND a.attname = 'customer_id'
          AND c.confdeltype = 'c'
      LOOP
        EXECUTE format('ALTER TABLE "tbl_user_transaction" DROP CONSTRAINT %I', fk.conname);
        EXECUTE format(
          'ALTER TABLE "tbl_user_transaction" ADD CONSTRAINT %I FOREIGN KEY ("customer_id") REFERENCES "tbl_customer"("customer_id") ON UPDATE CASCADE ON DELETE SET NULL',
          fk.conname
        );
      END LOOP;
    END $$;
  `);
};

/**
 * 0047 — SafeDeal money audit.
 *  - tbl_escrow_deal.fee_breakdown_locked: fee/cost lines frozen at funding so the amounts
 *    the buyer actually paid drive settlement, invoices and PDFs (not the live rate table).
 *  - tbl_safedeal_profile.withdrawal_fee_credit_usd: the exchange-withdrawal fee reserved
 *    in a deal quote that was never spent (funds kept in balance) — waives the fee on the
 *    party's next manual withdrawal instead of charging it twice.
 */
const addSafeDealMoneyAudit = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(`ALTER TABLE "tbl_escrow_deal" ADD COLUMN IF NOT EXISTS "fee_breakdown_locked" JSONB`);
  await sequelize.query(`ALTER TABLE "tbl_safedeal_profile" ADD COLUMN IF NOT EXISTS "withdrawal_fee_credit_usd" DOUBLE PRECISION NOT NULL DEFAULT 0`);
};

/**
 * 0048 — SafeDeal cashouts: real blockchain transaction hash.
 *  tbl_customer_withdrawal.tx_hash holds the exchange's withdrawal ORDER id ("BINANCE-<id>")
 *  at dispatch time — not something a user can look up. The hourly/5-min sync fetches the
 *  on-chain hash once the exchange has broadcast, stores it here and emails the user a
 *  "confirmed on-chain" receipt with an explorer link (chain_hash_emailed_at prevents dupes).
 *  Additive + idempotent, safe on live prod.
 */
const addWithdrawalTelegramNotified = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(`ALTER TABLE "tbl_customer_withdrawal" ADD COLUMN IF NOT EXISTS "telegram_notified_at" TIMESTAMPTZ`);
};

const addSafeDealChainTxHash = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_customer_withdrawal"
       ADD COLUMN IF NOT EXISTS "chain_tx_hash" VARCHAR(160),
       ADD COLUMN IF NOT EXISTS "chain_confirmed_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "chain_hash_emailed_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "chain_sync_attempts" INTEGER NOT NULL DEFAULT 0`
  );
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS "idx_customer_withdrawal_chain_pending"
       ON "tbl_customer_withdrawal" ("status") WHERE "chain_tx_hash" IS NULL AND "simulated" = false`
  );
};

const createPayoutGasAuditTable = async (): Promise<void> => {
  const { default: payoutGasAuditModel } = await import("../models/payoutGasAuditModel");
  if (isSyncable(payoutGasAuditModel)) await payoutGasAuditModel.sync();
};

/**
 * 0052 — SafeDeal ledger: the idempotency key (transaction_reference) is enforced by the
 * database, not only by the pre-insert lookup, so a concurrent retry can never double-credit
 * or double-debit a wallet. Scoped to the SafeDeal ledger modes (other Dynopay customer
 * transactions reuse chain tx ids as references and are untouched).
 */
const addSafeDealLedgerUniqueReference = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_customer_transaction_safedeal_reference"
       ON "tbl_customer_transaction" ("transaction_reference")
       WHERE "transaction_reference" IS NOT NULL AND "payment_mode" IN ('ESCROW', 'WITHDRAWAL', 'ADJUSTMENT', 'TOPUP')`
  );
};

/**
 * 0053 — sandbox marker on payments. Adds the additive, nullable `environment`
 * column to tbl_user_transaction ('development' = sandbox / dpk_test_,
 * 'production' = live). Stamped at creation; the sandbox "Simulate payment"
 * flow hard-gates on it so a test key can never settle a real payment. Legacy
 * rows stay NULL (treated as non-sandbox → refused). Additive / metadata-only
 * => idempotent, safe on live prod.
 */
const addTransactionEnvironment = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_user_transaction"
       ADD COLUMN IF NOT EXISTS "environment" VARCHAR(12)`
  );
};

/**
 * 0055 — Admin console 2FA hardening (SEC-002). Additive columns on tbl_admin:
 *   - totp_secret / totp_enabled / totp_enrolled_at: mandatory authenticator enrolment.
 *   - totp_backup_codes (JSONB): sha256-hashed single-use recovery codes.
 *   - tokens_valid_after: "sign out everywhere" cutoff for admin sessions.
 *   - failed_login_count / locked_until: admin login lockout.
 * Additive + nullable/defaulted => metadata-only, idempotent, safe on live prod.
 */
const addAdminAuthColumns = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_admin"
       ADD COLUMN IF NOT EXISTS "totp_secret" TEXT,
       ADD COLUMN IF NOT EXISTS "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
       ADD COLUMN IF NOT EXISTS "totp_enrolled_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "totp_backup_codes" JSONB,
       ADD COLUMN IF NOT EXISTS "tokens_valid_after" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "failed_login_count" INTEGER NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ`
  );
};

/**
 * 0056 — Admin console sessions (tbl_admin_session, SEC-002). Brand-new table:
 * one revocable row per admin login (session_id, jti, expiry, revoke, ip, ua).
 * Create-only sync — no existing data touched, safe on live prod.
 */
const createAdminSessionTable = async (): Promise<void> => {
  const { default: adminSessionModel } = await import("../models/adminSessionModel");
  if (isSyncable(adminSessionModel)) await adminSessionModel.sync();
};

// 0057 — outbound email send log (queued → sent → delivered | bounced …). Additive + idempotent.
const createEmailLogTable = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_email_log" (
       "log_id" BIGSERIAL PRIMARY KEY,
       "to_email" VARCHAR(320) NOT NULL,
       "to_name" VARCHAR(255),
       "subject" VARCHAR(500) NOT NULL,
       "template" VARCHAR(120),
       "lane" VARCHAR(16) NOT NULL DEFAULT 'default',
       "sender_email" VARCHAR(320),
       "status" VARCHAR(24) NOT NULL DEFAULT 'queued',
       "attempts" SMALLINT NOT NULL DEFAULT 0,
       "job_id" VARCHAR(120),
       "brevo_message_id" VARCHAR(255),
       "last_error" TEXT,
       "last_event" VARCHAR(32),
       "last_event_at" TIMESTAMPTZ,
       "sent_at" TIMESTAMPTZ,
       "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "idx_email_log_to_created" ON "tbl_email_log" ("to_email", "created_at" DESC)`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "idx_email_log_message_id" ON "tbl_email_log" ("brevo_message_id")`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "idx_email_log_status_created" ON "tbl_email_log" ("status", "created_at" DESC)`);
};

// 0058 — Brevo bounce suppression: when the account email hard-bounces we stop non-critical mail and nudge the user.
const addUserEmailBounce = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_user"
       ADD COLUMN IF NOT EXISTS "email_bounced_at" TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS "email_bounce_reason" VARCHAR(255)`
  );
};

/**
 * 0059 — Platform Settings (Deliverable 2). Dashboard-managed config + append-only
 * audit. tbl_platform_setting holds the DB override (jsonb) per key; resolution
 * is DB → .env → code default so .env keeps working unchanged. History is
 * immutable (who/what/before/after/why). Create-only — safe on live prod.
 */
const createPlatformSettingsTables = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_platform_setting" (
       "key" VARCHAR(120) PRIMARY KEY,
       "value" JSONB NOT NULL,
       "updated_by" VARCHAR(255),
       "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "version" INTEGER NOT NULL DEFAULT 1
     )`
  );
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_platform_setting_history" (
       "history_id" BIGSERIAL PRIMARY KEY,
       "key" VARCHAR(120) NOT NULL,
       "old_value" JSONB,
       "new_value" JSONB,
       "changed_by" VARCHAR(255),
       "reason" TEXT,
       "changed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS "idx_platform_setting_history_key" ON "tbl_platform_setting_history" ("key", "changed_at" DESC)`
  );
};
// 0060 — bounce → owner re-route metadata on the email log (company scope, fallback address, re-sent copy).
const addEmailLogFallback = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `ALTER TABLE "tbl_email_log"
       ADD COLUMN IF NOT EXISTS "company_id" INTEGER,
       ADD COLUMN IF NOT EXISTS "fallback_to" VARCHAR(320),
       ADD COLUMN IF NOT EXISTS "fallback_log_id" BIGINT`
  );
};

/**
 * 0061 — AI crawler analytics (tbl_bot_hit). Brand-new append-only table: one
 * row per AI search/answer-engine page fetch (GPTBot, PerplexityBot, ClaudeBot,
 * CCBot…), written fire-and-forget from the Edge middleware. Create-only — no
 * existing table touched, safe on live prod. Rows pruned to 90 days on insert.
 */
const createBotHitTable = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_bot_hit" (
       "hit_id" BIGSERIAL PRIMARY KEY,
       "bot" VARCHAR(60) NOT NULL,
       "host" VARCHAR(120),
       "path" VARCHAR(500),
       "ip" VARCHAR(45),
       "user_agent" VARCHAR(500),
       "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "idx_bot_hit_bot_created" ON "tbl_bot_hit" ("bot", "created_at" DESC)`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "idx_bot_hit_created" ON "tbl_bot_hit" ("created_at" DESC)`);
};

/**
 * 0062 — tbl_admin_trusted_device: admin browsers that passed TOTP and may skip
 * the TOTP challenge for 30 rolling days (admin password still required). Mirrors
 * tbl_trusted_device for the merchant flow. New table, safe on live prod.
 */
const createAdminTrustedDeviceTable = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_admin_trusted_device" (
       "id" SERIAL PRIMARY KEY,
       "admin_id" INTEGER NOT NULL,
       "token_hash" VARCHAR(64) NOT NULL UNIQUE,
       "device_name" VARCHAR(120),
       "browser" VARCHAR(60),
       "os" VARCHAR(60),
       "ip_address" VARCHAR(45),
       "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "expires_at" TIMESTAMPTZ NOT NULL,
       "revoked_at" TIMESTAMPTZ
     )`
  );
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "idx_admin_trusted_device_admin" ON "tbl_admin_trusted_device" ("admin_id", "revoked_at")`);
};

/**
 * 0063 — tbl_checkout_session: one durable row per buyer checkout "ref" (opened a
 * /pay page) for drop-off/abandonment analytics. Beacon-fed, never on the money
 * path. New table, safe on live prod.
 */
const createCheckoutSessionTable = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_checkout_session" (
       "id" SERIAL PRIMARY KEY,
       "ref" VARCHAR(120) NOT NULL UNIQUE,
       "address" VARCHAR(120),
       "currency" VARCHAR(20),
       "amount" DOUBLE PRECISION,
       "country" VARCHAR(64),
       "user_agent" VARCHAR(300),
       "view_count" INTEGER NOT NULL DEFAULT 1,
       "viewed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "address_shown_at" TIMESTAMPTZ,
       "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "idx_checkout_session_viewed" ON "tbl_checkout_session" ("viewed_at" DESC)`);
};


export async function buildBootMigrations(): Promise<Migration[]> {  const { v1, extra } = await loadBootModelGroups();  return [
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
    ...referralMigrations,
    { version: "0015_team_members", up: createTeamMemberTable },
    { version: "0016_team_activity", up: createTeamActivityTable },
    { version: "0017_txn_webhook_secret", up: addTransactionWebhookSecret },
    { version: "0018_company_notification_routing", up: addCompanyNotificationRouting },
    { version: "0019_signup_attribution", up: createSignupAttributionTable },
    { version: "0020_api_active_key_unique", up: addApiActiveKeyUniqueIndex },
    { version: "0021_payment_receipt", up: createPaymentReceiptTable },
    { version: "0023_company_fee_split_visibility", up: addCompanyFeeSplitVisibility },
    { version: "0024_user_tokens_valid_after", up: addUserTokensValidAfter },
    { version: "0025_api_key_hash", up: addApiKeyHash },
    { version: "0026_company_min_order_usd", up: addCompanyMinOrderUsd },
    { version: "0027_company_webhook_secret_rotation", up: addCompanyWebhookSecretRotation },
    { version: "0028_support_widget_show_wall", up: addSupportWidgetShowWall },
    { version: "0029_support_widget_monthly_goal", up: addSupportWidgetMonthlyGoal },
    { version: "0028_vies_vat_validation", up: addViesValidationSupport },
    { version: "0029_product_tax_treatment", up: addProductTaxTreatment },
    { version: "0030_nexus_alert", up: createNexusAlertTable },
    { version: "0032_tip_goal_milestone", up: createTipGoalMilestoneTable },
    { version: "0033_customer_annotation", up: createCustomerAnnotationTable },
    { version: "0034_txn_attention_resolved", up: addTxnAttentionResolved },
    { version: "0035_escrow_deals", up: createEscrowTable },
    { version: "0036_escrow_settlement_columns", up: addEscrowSettlementColumns },
    { version: "0037_escrow_dispute_negotiation", up: addEscrowDisputeColumns },
    { version: "0038_safedeal", up: addSafeDealTables },
    { version: "0039_safedeal_attachments_pricing", up: addSafeDealAttachmentsAndPricing },
    { version: "0040_safedeal_deal_terms", up: addSafeDealDealTerms },
    { version: "0041_safedeal_api_funding", up: addSafeDealApiFunding },
    { version: "0042_safedeal_topups", up: addSafeDealTopups },
    { version: "0043_customer_telegram_id", up: addCustomerTelegramId },
    { version: "0044_safedeal_deposit_reserve", up: addSafeDealDepositReserve },
    { version: "0045_safedeal_invite_link", up: addSafeDealInviteLink },
    { version: "0046_txn_customer_fk_set_null", up: relaxTransactionCustomerCascade },
    { version: "0047_safedeal_money_audit", up: addSafeDealMoneyAudit },
    { version: "0048_safedeal_chain_tx_hash", up: addSafeDealChainTxHash },
    { version: "0049_payout_gas_audit", up: createPayoutGasAuditTable },
    { version: "0050_withdrawal_telegram_notified", up: addWithdrawalTelegramNotified },
    { version: "0051_wallet_ownership_verification", up: addWalletOwnershipVerification },
    { version: "0052_safedeal_ledger_unique_reference", up: addSafeDealLedgerUniqueReference },
    { version: "0053_txn_environment", up: addTransactionEnvironment },
    { version: "0054_safedeal_session_security", up: addSafeDealSessionSecurity },
    { version: "0055_admin_auth_columns", up: addAdminAuthColumns },
    { version: "0056_admin_session", up: createAdminSessionTable },
    { version: "0057_email_log", up: createEmailLogTable },
    { version: "0058_user_email_bounce", up: addUserEmailBounce },
    { version: "0059_platform_settings", up: createPlatformSettingsTables },
    { version: "0060_email_log_fallback", up: addEmailLogFallback },
    { version: "0061_bot_hit", up: createBotHitTable },
    { version: "0062_admin_trusted_device", up: createAdminTrustedDeviceTable },
    { version: "0063_checkout_session", up: createCheckoutSessionTable },
    ...perfMigrations,
    ...securityMigrations,
  ];
}
