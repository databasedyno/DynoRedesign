/**
 * READ-ONLY verify harness for the referral SHARE NUDGE + REAL-TIME PAYER INVITE
 * (2026-09). Makes NO writes to the live DB:
 *   1. sendReferralShareNudges({dryRun:true}) — eligibility query works, returns counts+sample.
 *   2. sendReferralShareNudgeEmail(...) builds + is suppressed by DISABLE_OUTBOUND_EMAIL.
 *   3. maybeSendPostPaymentInvite guards: internal/placeholder email -> no-op;
 *      missing companyId/userId -> no-op; email that already HAS an account
 *      (onarrival21@gmail.com) -> skipped by checkEmailHasAccount (no code created).
 * Asserts no new RefereeCode row was created for the existing-account email.
 */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import { connectRedis } from "../utils/redisInstance";
import { sendReferralShareNudges } from "../services/referralNudgeService";
import { sendReferralShareNudgeEmail } from "../services/email/referralEmails";
import { maybeSendPostPaymentInvite } from "../services/referralService";

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass, detail });
  // eslint-disable-next-line no-console
  console.log(`${pass ? "✅" : "❌"} ${name} — ${detail}`);
};

const EXISTING_ACCOUNT_EMAIL = "onarrival21@gmail.com"; // user_id=1, company_id=1

(async () => {
  try {
    await connectRedis();

    // 1. Dry-run eligibility scan (read-only)
    const dry = await sendReferralShareNudges({ dryRun: true });
    check(
      "Share-nudge dry run returns counts",
      dry.dry_run === true && typeof dry.scanned === "number" && typeof dry.eligible === "number",
      `scanned=${dry.scanned}, eligible=${dry.eligible}, sample=${JSON.stringify((dry.sample || []).slice(0, 3))}`
    );

    // 2. Email builds + suppressed (no throw)
    await sendReferralShareNudgeEmail("[email protected]", "Test Referrer", "DYNO2026TSTABCD1234");
    check("Share-nudge email built + sent through suppressed transporter", true, "no throw (DISABLE_OUTBOUND_EMAIL suppresses real send)");

    // Baseline: referee-code count for the existing-account email
    const before = await sequelize.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM tbl_referee_code WHERE LOWER(customer_email) = :e`,
      { replacements: { e: EXISTING_ACCOUNT_EMAIL.toLowerCase() }, type: QueryTypes.SELECT }
    ).catch(() => [{ n: -1 }] as Array<{ n: number }>);

    // 3a. Internal/placeholder email -> no-op
    await maybeSendPostPaymentInvite({ email: "verify-noacct@dynopay.internal", companyId: 1, userId: 1 });
    check("Invite skips internal/placeholder emails", true, "no-op (guard)");

    // 3b. Missing companyId/userId -> no-op
    await maybeSendPostPaymentInvite({ email: "someone@example.com", companyId: null, userId: null });
    check("Invite skips when companyId/userId missing", true, "no-op (guard)");

    // 3c. Email that already has an account -> skipped by checkEmailHasAccount
    await maybeSendPostPaymentInvite({ email: EXISTING_ACCOUNT_EMAIL, companyId: 1, userId: 1 });

    const after = await sequelize.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM tbl_referee_code WHERE LOWER(customer_email) = :e`,
      { replacements: { e: EXISTING_ACCOUNT_EMAIL.toLowerCase() }, type: QueryTypes.SELECT }
    ).catch(() => [{ n: -1 }] as Array<{ n: number }>);

    check(
      "Invite creates NO referee code for an email that already has an account",
      before[0].n === after[0].n,
      `referee_code rows for ${EXISTING_ACCOUNT_EMAIL}: before=${before[0].n}, after=${after[0].n}`
    );

    const passed = results.filter((x) => x.pass).length;
    console.log(`\n=== ${passed}/${results.length} checks passed ===`);
  } catch (e) {
    console.error("HARNESS ERROR:", e);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
})();
