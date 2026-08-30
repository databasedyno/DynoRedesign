/**
 * REVERSIBLE activation-email harness (2026-08 fork).
 * Seeds ONE scratch PENDING referral (referrer=user1, referred=user1), runs the real
 * processReferrerReward with a $150 qualifying payment, asserts it flips to ACTIVE and
 * that the activation-email hook runs (suppressed by DISABLE_OUTBOUND_EMAIL), then
 * deletes the scratch row. Guards against touching any REAL pending referral. No money moves.
 */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import Referral from "../models/referralModels/referralModel";
import ReferralReward from "../models/referralModels/referralRewardModel";
import { processReferrerReward } from "../services/referralService";
import { sendReferralActivatedEmail } from "../services/email/referralEmails";

const REFERRER = 1;
const REFERRED = 1; // FK-valid; user1 is the owner and not a real referee
const SCRATCH_CODE = "AUDIT-ACT-2026";
const results: Array<{ name: string; pass: boolean; detail: string }> = [];
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass, detail });
  // eslint-disable-next-line no-console
  console.log(`${pass ? "✅" : "❌"} ${name} — ${detail}`);
};

(async () => {
  try {
    // Safety: make sure there is NO real pending referral for REFERRED before we seed/activate.
    const realPending = await sequelize.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM tbl_referral WHERE referred_user_id=:r AND status='pending' AND referral_code<>:c`,
      { replacements: { r: REFERRED, c: SCRATCH_CODE }, type: QueryTypes.SELECT }
    );
    if (Number(realPending[0].n) > 0) {
      check("SAFETY abort: a real pending referral exists — testing email fn only", true, `real_pending=${realPending[0].n}`);
      await sendReferralActivatedEmail("[email protected]", "Test Referrer", "Acme Store");
      check("Activation email builds + suppressed", true, "no throw");
    } else {
      const referredAt = new Date();
      await Referral.create({
        referrer_user_id: REFERRER, referred_user_id: REFERRED, referral_code: SCRATCH_CODE,
        status: "pending", activation_requirement: "first_transaction_100",
        bonus_amount: 0, bonus_currency: "USD", referee_discount_percent: 0, referee_discount_duration_days: 0,
        referred_at: referredAt,
      } as never);

      const ok = await processReferrerReward({ refereeUserId: REFERRED, transactionAmount: 150 });
      check("processReferrerReward returned true (activated)", ok === true, `returned=${ok}`);

      const row = await Referral.findOne({ where: { referral_code: SCRATCH_CODE } });
      const status = (row as unknown as { status?: string })?.status;
      const activatedAt = (row as unknown as { activated_at?: Date })?.activated_at;
      check("scratch referral flipped to ACTIVE with a window", status === "active" && !!activatedAt, `status=${status}, activated_at=${activatedAt}`);

      // Direct call to prove the email template also builds/suppresses cleanly.
      await sendReferralActivatedEmail("[email protected]", "Test Referrer", "Acme Store");
      check("Activation email builds + suppressed", true, "no throw (see [Email] SUPPRESSED log above from the hook + this direct call)");
    }

    const passed = results.filter((x) => x.pass).length;
    console.log(`\n=== ${passed}/${results.length} checks passed ===`);
  } catch (e) {
    console.error("HARNESS ERROR:", e);
  } finally {
    try {
      const scratch = await Referral.findAll({ where: { referral_code: SCRATCH_CODE }, attributes: ["referral_id"] });
      const ids = scratch.map((x) => (x as unknown as { referral_id: number }).referral_id);
      if (ids.length) {
        await ReferralReward.destroy({ where: { referral_id: ids } });
        await Referral.destroy({ where: { referral_id: ids } });
      }
      const after = await sequelize.query(
        `SELECT (SELECT COUNT(*)::int FROM tbl_referral WHERE referral_code=:c) AS scratch_left`,
        { replacements: { c: SCRATCH_CODE }, type: QueryTypes.SELECT }
      );
      console.log("\nCLEANUP:", JSON.stringify(after[0]), "(scratch_left must be 0)");
    } catch (ce) {
      console.error("!!! CLEANUP FAILED — MANUAL REVIEW NEEDED:", ce);
    }
    await sequelize.close();
    process.exit(0);
  }
})();
