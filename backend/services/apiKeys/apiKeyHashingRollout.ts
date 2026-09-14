import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { raw as envRaw } from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { sendApiKeysHashedNoticeEmail } from "../email/billingReportEmails";

/**
 * Production-only rollout of the hashed-API-key model (Phase 1, security audit).
 *
 * Runs at boot on the PRIMARY worker with background jobs enabled — i.e. the
 * live deployment, never the preview pod (SAFE MODE forces WORKER_ROLE=secondary
 * + ENABLE_BACKGROUND_JOBS=false). Both steps are idempotent and race-safe
 * across replicas:
 *   1. wipe the legacy reversible ciphertext from tbl_api."apiKey" once every
 *      row carries key_hash (migration 0025 guarantees that);
 *   2. email each merchant account with an active key exactly once
 *      (tbl_one_time_notice PK insert wins the send).
 *
 * The wipe MUST NOT run from a deployment that still validates keys by
 * plaintext equality — that is why it is not a boot migration.
 */
const NOTICE_KEY = "api_keys_hashed_2026_09";

export const shouldRunApiKeyHashingRollout = (opts: {
  isProduction: boolean;
  enableBackgroundJobs: boolean;
  workerRole: string;
}): boolean =>
  opts.isProduction && opts.enableBackgroundJobs && opts.workerRole === "primary";

export async function wipeLegacyApiKeyPlaintext(): Promise<number> {
  const [, meta] = await sequelize.query(
    `UPDATE "tbl_api" SET "apiKey" = NULL WHERE "apiKey" IS NOT NULL AND key_hash IS NOT NULL`
  );
  const count = Number((meta as { rowCount?: number })?.rowCount ?? 0);
  if (count > 0) apiLogger.info(`[ApiKeyRollout] wiped legacy plaintext from ${count} API key row(s)`);
  return count;
}

export async function sendApiKeyHashingNotices(): Promise<{ sent: number; skipped: number }> {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "tbl_one_time_notice" (
       notice_key VARCHAR(64) NOT NULL,
       user_id INTEGER NOT NULL,
       sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (notice_key, user_id)
     )`
  );
  const users = (await sequelize.query(
    `SELECT DISTINCT u.user_id, u.email, u.name, u.first_name, u.language
       FROM tbl_api a
       JOIN tbl_user u ON u.user_id = a.user_id
      WHERE a.status = 'active' AND u.deleted_at IS NULL AND u.email IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM tbl_one_time_notice n WHERE n.notice_key = :key AND n.user_id = u.user_id
        )
      ORDER BY u.user_id`,
    { replacements: { key: NOTICE_KEY }, type: QueryTypes.SELECT }
  )) as Array<{ user_id: number; email: string; name: string | null; first_name: string | null; language: string | null }>;

  let sent = 0;
  let skipped = 0;
  for (const u of users) {
    // Insert-first: only the replica that wins the PK insert sends the email.
    const claimed = (await sequelize.query(
      `INSERT INTO tbl_one_time_notice (notice_key, user_id) VALUES (:key, :uid)
       ON CONFLICT DO NOTHING RETURNING user_id`,
      { replacements: { key: NOTICE_KEY, uid: u.user_id }, type: QueryTypes.SELECT }
    )) as Array<{ user_id: number }>;
    if (claimed.length === 0) {
      skipped++;
      continue;
    }
    try {
      await sendApiKeysHashedNoticeEmail(u.email, u.first_name || u.name || "", u.language);
      sent++;
    } catch (e) {
      // Release the claim so a later boot retries this account.
      await sequelize.query(
        `DELETE FROM tbl_one_time_notice WHERE notice_key = :key AND user_id = :uid`,
        { replacements: { key: NOTICE_KEY, uid: u.user_id } }
      );
      apiLogger.error(`[ApiKeyRollout] notice to user ${u.user_id} failed: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (sent || skipped) apiLogger.info(`[ApiKeyRollout] notices sent=${sent} skipped=${skipped}`);
  return { sent, skipped };
}

export async function runApiKeyHashingRollout(opts: {
  isProduction: boolean;
  enableBackgroundJobs: boolean;
  workerRole: string;
}): Promise<void> {
  if (!shouldRunApiKeyHashingRollout(opts)) return;
  try {
    await wipeLegacyApiKeyPlaintext();
    if (envRaw("DISABLE_OUTBOUND_EMAIL") === "true") {
      apiLogger.warn("[ApiKeyRollout] outbound email disabled — merchant notices deferred");
      return;
    }
    await sendApiKeyHashingNotices();
  } catch (e) {
    apiLogger.error(`[ApiKeyRollout] failed (will retry next boot): ${(e as Error).message}`);
  }
}
