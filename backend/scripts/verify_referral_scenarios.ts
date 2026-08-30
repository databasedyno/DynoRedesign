/**
 * REVERSIBLE referral scenario + edge-case harness (2026-06 fork).
 * User approved seeding a scratch referral to exercise the full path reversibly.
 * Creates scratch tbl_referral rows for referrer=user 1, runs the real services,
 * asserts each scenario, then FULLY deletes everything it created and restores
 * user 1 to its exact baseline. Idempotent + self-cleaning (finally block).
 *
 * NO Binance / on-chain calls. Pure accounting/service-layer verification.
 */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import User from "../models/userModels/userModel";
import Referral from "../models/referralModels/referralModel";
import ReferralReward from "../models/referralModels/referralRewardModel";
import {
  getAvailableCreditForFees,
  consumeReferralCreditForTransaction,
} from "../services/referralCreditService";
import { getReferrerCommissionSummary } from "../services/referralCommissionService";
import { MIN_PAYOUT_USDT } from "../services/referralPayoutService";

const REFERRER = 1;
const SCRATCH_CODE = "AUDIT-SCRATCH-2026";
const results: Array<{ name: string; pass: boolean; detail: string }> = [];
const created: number[] = [];
let snapshot: Record<string, unknown> = {};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass, detail });
  // eslint-disable-next-line no-console
  console.log(`${pass ? "✅" : "❌"} ${name} — ${detail}`);
};

const setMode = async (mode: "credit" | "cash", addr?: string) =>
  User.update(
    {
      referral_payout_mode: mode,
      ...(addr !== undefined
        ? { referral_payout_trc20_address: addr, referral_payout_address_verified_at: new Date() }
        : {}),
    } as never,
    { where: { user_id: REFERRER } }
  );

const seedReferral = async (accrued: number, activatedDaysAgo: number): Promise<number> => {
  const activatedAt = new Date(Date.now() - activatedDaysAgo * 864e5);
  const windowEndsAt = new Date(activatedAt);
  windowEndsAt.setMonth(windowEndsAt.getMonth() + 12);
  const r = await Referral.create({
    referrer_user_id: REFERRER,
    referred_user_id: REFERRER, // FK-valid; referred id irrelevant for credit/summary math
    referral_code: SCRATCH_CODE,
    status: "active",
    activation_requirement: "first_transaction_100",
    bonus_amount: 0,
    bonus_currency: "USD",
    referee_discount_percent: 0,
    referee_discount_duration_days: 0,
    referred_at: activatedAt,
    activated_at: activatedAt,
    commission_rate: 0.25,
    commission_window_ends_at: windowEndsAt,
    commission_accrued_usd: accrued,
    commission_paid_usd: 0,
    commission_credited_usd: 0,
    last_accrual_at: activatedAt,
  } as never);
  const id = (r as unknown as { referral_id: number }).referral_id;
  created.push(id);
  return id;
};

(async () => {
  try {
    // Snapshot user 1 baseline for exact restore.
    const u = (await User.findByPk(REFERRER, {
      attributes: [
        "referral_payout_mode",
        "referral_payout_trc20_address",
        "referral_payout_address_verified_at",
        "referral_payout_auto",
        "referral_payout_auto_min_usd",
        "referral_payout_nudged_at",
      ],
    })) as unknown as Record<string, unknown>;
    snapshot = {
      referral_payout_mode: u.referral_payout_mode ?? "credit",
      referral_payout_trc20_address: u.referral_payout_trc20_address ?? null,
      referral_payout_address_verified_at: u.referral_payout_address_verified_at ?? null,
      referral_payout_auto: u.referral_payout_auto ?? false,
      referral_payout_auto_min_usd: u.referral_payout_auto_min_usd ?? null,
      referral_payout_nudged_at: u.referral_payout_nudged_at ?? null,
    };
    // eslint-disable-next-line no-console
    console.log("Baseline user1:", JSON.stringify(snapshot), "MIN_PAYOUT_USDT=", MIN_PAYOUT_USDT, "\n");

    // ── SCENARIO 1: accrual visibility (credit mode, single referral $100) ──
    await setMode("credit");
    const rid1 = await seedReferral(100, 40); // activated 40d ago (older)
    let sum = await getReferrerCommissionSummary(REFERRER);
    check("S1 summary unpaid=100", round2(sum.unpaid_balance_usd) === 100, `unpaid=${sum.unpaid_balance_usd}, credited=${sum.total_credited_usd}`);
    let avail = await getAvailableCreditForFees(REFERRER);
    check("S1 available credit=100 (credit mode)", round2(avail) === 100, `available=${avail}`);

    // ── SCENARIO 2: partial credit consumption + idempotency ──
    const c1 = await consumeReferralCreditForTransaction({ userId: REFERRER, maxUsd: 30, transactionRef: "AUDIT-TX-1" });
    check("S2 consume $30", round2(c1) === 30, `consumed=${c1}`);
    const c1again = await consumeReferralCreditForTransaction({ userId: REFERRER, maxUsd: 30, transactionRef: "AUDIT-TX-1" });
    check("S2 idempotent re-run returns 30, no double-spend", round2(c1again) === 30, `re-run=${c1again}`);
    sum = await getReferrerCommissionSummary(REFERRER);
    check("S2 credited=30 & unpaid=70", round2(sum.total_credited_usd) === 30 && round2(sum.unpaid_balance_usd) === 70, `credited=${sum.total_credited_usd}, unpaid=${sum.unpaid_balance_usd}`);

    // ── SCENARIO 3: cap guardrail (request more than remaining) ──
    const c2 = await consumeReferralCreditForTransaction({ userId: REFERRER, maxUsd: 1000, transactionRef: "AUDIT-TX-2" });
    check("S3 cap at remaining $70", round2(c2) === 70, `consumed=${c2}`);
    sum = await getReferrerCommissionSummary(REFERRER);
    check("S3 fully credited (unpaid=0, credited=100)", round2(sum.unpaid_balance_usd) === 0 && round2(sum.total_credited_usd) === 100, `unpaid=${sum.unpaid_balance_usd}, credited=${sum.total_credited_usd}`);
    const c3 = await consumeReferralCreditForTransaction({ userId: REFERRER, maxUsd: 50, transactionRef: "AUDIT-TX-3" });
    check("S3 nothing left to consume", round2(c3) === 0, `consumed=${c3}`);

    // ── SCENARIO 4: cash-mode gate (credit reserved for cash-out, not fees) ──
    await setMode("cash", "TXYZscratchDoNotUse000000000000000");
    avail = await getAvailableCreditForFees(REFERRER);
    check("S4 available credit=0 in cash mode", round2(avail) === 0, `available=${avail}`);
    const c4 = await consumeReferralCreditForTransaction({ userId: REFERRER, maxUsd: 10, transactionRef: "AUDIT-TX-4" });
    check("S4 consume blocked in cash mode", round2(c4) === 0, `consumed=${c4}`);

    // ── SCENARIO 5: DOUBLE-SPEND edge — automation SQL ignores credited ──
    // credited=100, paid=0. requestPayout/summary see unpaid=0 (correct); the
    // nudge/auto SQL (accrued-paid) sees 100 (WRONG → would cash out already-spent $).
    const autoSql = await sequelize.query<{ automation_unpaid: number; true_unpaid: number }>(
      `SELECT SUM(commission_accrued_usd - commission_paid_usd)::float AS automation_unpaid,
              SUM(commission_accrued_usd - commission_paid_usd - commission_credited_usd)::float AS true_unpaid
         FROM tbl_referral WHERE referrer_user_id = :u AND status IN ('active','rewarded')`,
      { replacements: { u: REFERRER }, type: QueryTypes.SELECT }
    );
    const autoUnpaid = round2(autoSql[0]?.automation_unpaid || 0);
    const trueUnpaid = round2(autoSql[0]?.true_unpaid || 0);
    sum = await getReferrerCommissionSummary(REFERRER);
    check(
      "S5 BUG CONFIRMED: automation unpaid overstates true unpaid",
      autoUnpaid === 100 && trueUnpaid === 0 && round2(sum.unpaid_balance_usd) === 0,
      `automation(accrued-paid)=${autoUnpaid}  vs  summary/true(accrued-paid-credited)=${trueUnpaid}  → auto-payout would send $${autoUnpaid} of already-credited funds`
    );
    check(
      "S5 impact: exceeds MIN so a cash+auto user WOULD be paid",
      autoUnpaid >= MIN_PAYOUT_USDT && trueUnpaid < MIN_PAYOUT_USDT,
      `automation ${autoUnpaid} >= min ${MIN_PAYOUT_USDT} while true ${trueUnpaid} < min`
    );

    // ── SCENARIO 6: multi-referral oldest-first distribution ──
    // Reset to a clean 2-referral credit scenario.
    await setMode("credit");
    for (const id of created) await ReferralReward.destroy({ where: { referral_id: id } });
    await Referral.destroy({ where: { referral_id: created } });
    created.length = 0;
    const older = await seedReferral(40, 60); // oldest (activated 60d ago)
    const newer = await seedReferral(40, 10); // newer (activated 10d ago)
    const c6 = await consumeReferralCreditForTransaction({ userId: REFERRER, maxUsd: 50, transactionRef: "AUDIT-TX-6" });
    check("S6 consume $50 across two $40 referrals", round2(c6) === 50, `consumed=${c6}`);
    const rOld = await Referral.findByPk(older);
    const rNew = await Referral.findByPk(newer);
    const oldCredited = round2(Number(rOld?.commission_credited_usd || 0));
    const newCredited = round2(Number(rNew?.commission_credited_usd || 0));
    check("S6 oldest-first: older fully used ($40), newer partial ($10)", oldCredited === 40 && newCredited === 10, `older_credited=${oldCredited}, newer_credited=${newCredited}`);

    const passed = results.filter((r) => r.pass).length;
    // eslint-disable-next-line no-console
    console.log(`\n=== ${passed}/${results.length} checks passed ===`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("HARNESS ERROR:", e);
  } finally {
    // ── FULL CLEANUP — delete every scratch row + restore user 1 exactly ──
    try {
      const scratch = await Referral.findAll({ where: { referral_code: SCRATCH_CODE }, attributes: ["referral_id"] });
      const ids = scratch.map((r) => (r as unknown as { referral_id: number }).referral_id);
      if (ids.length) {
        await ReferralReward.destroy({ where: { referral_id: ids } });
        await Referral.destroy({ where: { referral_id: ids } });
      }
      // Also delete any stray commission_credit reward rows keyed by our test tx refs.
      await ReferralReward.destroy({
        where: { user_id: REFERRER, transaction_id: ["AUDIT-TX-1", "AUDIT-TX-2", "AUDIT-TX-3", "AUDIT-TX-4", "AUDIT-TX-6"] },
      });
      await User.update(snapshot as never, { where: { user_id: REFERRER } });
      const after = await sequelize.query(
        `SELECT (SELECT COUNT(*)::int FROM tbl_referral WHERE referral_code=:c) AS scratch_left,
                (SELECT referral_payout_mode FROM tbl_user WHERE user_id=:u) AS mode,
                (SELECT referral_payout_trc20_address FROM tbl_user WHERE user_id=:u) AS addr`,
        { replacements: { c: SCRATCH_CODE, u: REFERRER }, type: QueryTypes.SELECT }
      );
      // eslint-disable-next-line no-console
      console.log("\nCLEANUP:", JSON.stringify(after[0]), "(scratch_left must be 0, mode restored to", snapshot.referral_payout_mode + ")");
    } catch (ce) {
      // eslint-disable-next-line no-console
      console.error("!!! CLEANUP FAILED — MANUAL REVIEW NEEDED:", ce);
    }
    await sequelize.close();
    process.exit(0);
  }
})();
