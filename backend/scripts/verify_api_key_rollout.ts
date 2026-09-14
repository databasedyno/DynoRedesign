/**
 * Verifies the Phase-1 rollout pieces WITHOUT touching prod state:
 *  - gate logic for preview vs prod
 *  - wipe UPDATE inside a rolled-back transaction (row count only)
 *  - renders the merchant notice e-mail (EN + DE) to EMAIL_DUMP_DIR
 * Run: cd /app/backend && EMAIL_DUMP_DIR=/tmp/qa/emails DISABLE_OUTBOUND_EMAIL=true \
 *      node_modules/.bin/ts-node --transpile-only scripts/verify_api_key_rollout.ts
 */
import "dotenv/config";
import sequelize from "../utils/dbInstance";
import { shouldRunApiKeyHashingRollout } from "../services/apiKeys/apiKeyHashingRollout";
import { sendApiKeysHashedNoticeEmail } from "../services/email/billingReportEmails";
import { generateApiKeyToken, hashApiKey, apiKeyHint } from "../helper/apiKeyToken";

(async () => {
  let fail = 0;
  const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "PASS" : "FAIL"} — ${n} ${d}`); if (!ok) fail++; };

  check("gate: preview (secondary, jobs off) → skip", !shouldRunApiKeyHashingRollout({ isProduction: true, enableBackgroundJobs: false, workerRole: "secondary" }));
  check("gate: prod primary → run", shouldRunApiKeyHashingRollout({ isProduction: true, enableBackgroundJobs: true, workerRole: "primary" }));
  check("gate: dev → skip", !shouldRunApiKeyHashingRollout({ isProduction: false, enableBackgroundJobs: true, workerRole: "primary" }));

  const tok = generateApiKeyToken("production");
  check("token shape", /^dpk_live_[0-9A-Za-z]{43}$/.test(tok), tok.slice(0, 12) + "…");
  check("token uniqueness", generateApiKeyToken("development") !== generateApiKeyToken("development"));
  check("hash is 64 hex", /^[0-9a-f]{64}$/.test(hashApiKey(tok)));
  check("hint", /^dpk_live_[0-9A-Za-z]{4}…[0-9A-Za-z]{4}$/.test(apiKeyHint(tok, "production")), apiKeyHint(tok, "production"));

  const t = await sequelize.transaction();
  try {
    const [, meta] = await sequelize.query(
      `UPDATE "tbl_api" SET "apiKey" = NULL WHERE "apiKey" IS NOT NULL AND key_hash IS NOT NULL`,
      { transaction: t }
    );
    const rc = Number((meta as { rowCount?: number })?.rowCount ?? 0);
    const [left] = (await sequelize.query(`SELECT count(*)::int AS n FROM tbl_api WHERE "apiKey" IS NOT NULL`, { transaction: t })) as any;
    check("wipe (rolled back) affects every legacy row", rc > 0 && Number(left[0].n) === 0, `rows=${rc}`);
  } finally {
    await t.rollback();
  }
  const [after] = (await sequelize.query(`SELECT count(*)::int AS n FROM tbl_api WHERE "apiKey" IS NOT NULL`)) as any;
  check("prod plaintext untouched after rollback", Number(after[0].n) > 0, `still ${after[0].n} rows`);

  await sendApiKeysHashedNoticeEmail("qa-en@example.com", "John", "en");
  await sendApiKeysHashedNoticeEmail("qa-de@example.com", "Anna", "de");
  console.log(`done, failures=${fail}`);
  await sequelize.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
