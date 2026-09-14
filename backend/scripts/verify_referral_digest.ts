/**
 * REVERSIBLE monthly-digest computation harness (2026-08 fork).
 * Seeds ONE scratch active referral (referrer=user1, referred=user1) so the digest
 * SQL has an active window to sum over, runs computeMonthlyReferralEarnings across a
 * wide window that captures user1's REAL settled fees, asserts the recap math, then
 * deletes the scratch rows + restores user1. Also sanity-checks getPrevMonthWindowUTC
 * and that the digest email builds (suppressed by DISABLE_OUTBOUND_EMAIL). Moves no money.
 */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import User from "../models/userModels/userModel";
import Referral from "../models/referralModels/referralModel";
import ReferralReward from "../models/referralModels/referralRewardModel";
import {
  getPrevMonthWindowUTC,
  computeMonthlyReferralEarnings,
} from "../services/referralDigestService";
import { sendReferralMonthlyDigestEmail } from "../services/email/referralEmails";

const REFERRER = 1;
const SCRATCH_CODE = "AUDIT-DIGEST-2026";
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const results: Array<{ name: string; pass: boolean; detail: string }> = [];
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass, detail });
  // eslint-disable-next-line no-console
  console.log(`${pass ? "✅" : "❌"} ${name} — ${detail}`);
};
let snapshotMode: string = "credit";

(async () => {
  try {
    // window-label sanity (fixed known date)
    const w = getPrevMonthWindowUTC(new Date(Date.UTC(2026, 7, 15))); // Aug 15 2026 -> prev = July 2026
    check("PrevMonthWindow label/key correct", w.label === "July 2026" && w.key === "2026-07", `label=${w.label}, key=${w.key}, start=${w.start.toISOString()}, end=${w.end.toISOString()}`);

    // snapshot + credit mode + seed scratch active referral with a WIDE open window
    const u = (await User.findByPk(REFERRER, { attributes: ["referral_payout_mode"] })) as unknown as Record<string, unknown>;
    snapshotMode = (u?.referral_payout_mode as string) || "credit";
    await User.update({ referral_payout_mode: "credit" } as never, { where: { user_id: REFERRER } });

    const activatedAt = new Date(Date.UTC(2024, 0, 1));       // 2024-01-01
    const windowEndsAt = new Date(Date.UTC(2030, 0, 1));      // far future -> window OPEN
    const r = await Referral.create({
      referrer_user_id: REFERRER,
      referred_user_id: REFERRER, // sums user1's OWN real settled fees -> a live basis
      referral_code: SCRATCH_CODE,
      status: "active",
      activation_requirement: "first_transaction_100",
      bonus_amount: 0, bonus_currency: "USD",
      referee_discount_percent: 0, referee_discount_duration_days: 0,
      referred_at: activatedAt, activated_at: activatedAt,
      commission_rate: 0.25, commission_window_ends_at: windowEndsAt,
      commission_accrued_usd: 0, commission_paid_usd: 0, commission_credited_usd: 0,
      last_accrual_at: activatedAt,
    } as never);
    void r;

    // Compute earnings over 2024-01-01 .. now (captures user1's real settled fees)
    const window = { start: activatedAt, end: new Date() };
    const map = await computeMonthlyReferralEarnings(window);
    const entry = map.get(REFERRER);

    // Cross-check against a direct fee query for the SAME window/basis.
    const feeRow = await sequelize.query<{ fees: number }>(
      `SELECT COALESCE(SUM((COALESCE(ut.transaction_fee,0)+COALESCE(ut.fixed_fee,0))*(COALESCE(ut.usd_value,0)/NULLIF(ut.base_amount,0))),0)::float AS fees
         FROM tbl_user_transaction ut
        WHERE ut.user_id = :u AND ut.base_amount > 0
          AND ut.status IN ('successful','done','completed')
          AND ut."createdAt" >= :s AND ut."createdAt" < :e
          AND ut."createdAt" > :act`,
      { replacements: { u: REFERRER, s: window.start, e: window.end, act: activatedAt }, type: QueryTypes.SELECT }
    );
    const expected = round2(Number(feeRow[0]?.fees || 0) * 0.25);

    check("Digest found the scratch referrer with earnings", !!entry && entry.total > 0, `total=$${entry?.total ?? 0}, merchants=${entry?.perMerchant.length ?? 0}`);
    check("Digest total == 25% of settled fees in window", !!entry && round2(entry.total) === expected, `digest=$${entry?.total ?? 0} vs expected(25% of fees)=$${expected}`);
    check("Per-merchant breakdown present + sorted desc", !!entry && entry.perMerchant.length >= 1 && entry.perMerchant.every((m, i, a) => i === 0 || a[i - 1].usd >= m.usd), `breakdown=${JSON.stringify(entry?.perMerchant.slice(0, 3))}`);

    // Email builds + is suppressed (no throw) — mirrors verify_accrual_email pattern.
    await sendReferralMonthlyDigestEmail("[email protected]", "Test Referrer", w.label, entry?.total ?? 12.34, entry?.perMerchant ?? [{ name: "Acme Store", usd: 12.34 }], "credit");
    check("Digest email built + sent through suppressed transporter", true, "no throw (DISABLE_OUTBOUND_EMAIL suppresses real send)");

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
      await User.update({ referral_payout_mode: snapshotMode } as never, { where: { user_id: REFERRER } });
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
