import type { Migration } from "../utils/migrationRunner";

/** Referral revenue-share migrations 0011–0014 (split out of bootMigrations to keep the R2 500-line budget). */

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
  const m = referralPayoutModel as unknown as { sync?: (options?: unknown) => Promise<unknown> };
  if (typeof m?.sync === "function") await m.sync();
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

/** Same version strings as before — schema_migrations rows already recorded stay valid. */
export const referralMigrations: Migration[] = [
  { version: "0011_referral_commission", up: addReferralCommissionColumns },
  { version: "0012_referral_payout", up: addReferralPayoutSupport },
  { version: "0013_referral_payout_automation", up: addReferralPayoutAutomation },
  { version: "0014_referral_fee_credit", up: addReferralFeeCreditColumns },
];
