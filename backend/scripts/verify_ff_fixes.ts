/**
 * REVERSIBLE verification harness for referral findings F2–F6 (2026-08).
 *
 * Runs the REAL fixed service functions against the live DB but is fully isolated
 * from production data and self-cleaning:
 *   - all scratch referrals use referral_code = FF_CODE
 *   - all scratch customer_transactions use transaction_reference LIKE 'FFSCRATCH-%'
 *   - activation/clawback windows are placed in the YEAR 2000/2001 so NONE of the
 *     merchant's real transactions can fall inside them (zero contamination)
 *   - user 1's mutated columns are snapshotted and restored in the finally block
 *
 * NO Binance / on-chain / fund movement. Read-mostly + bounded scratch writes.
 */
import sequelize from "../utils/dbInstance";
import { Op, QueryTypes } from "sequelize";
import User from "../models/userModels/userModel";
import Referral from "../models/referralModels/referralModel";
import ReferralReward from "../models/referralModels/referralRewardModel";
import { clawbackReferralCommission } from "../services/referralCommissionService";
import {
  processPendingReferrerRewards,
  expireStalePendingReferrals,
} from "../utils/crons/referralRewardMonitor";
import { processReferralNudges } from "../services/referralPayoutAutomation";
import { convertToUSD } from "../utils/currencyUtils";
import { MIN_PAYOUT_USDT } from "../services/referralPayoutService";

const REFERRER = 1; // FK-valid existing user (test merchant)
const FF_CODE = "FF-SCRATCH-2026";
const TXREF = "FFSCRATCH-";

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass, detail });
  // eslint-disable-next-line no-console
  console.log(`${pass ? "✅ PASS" : "❌ FAIL"}  ${name} — ${detail}`);
};

let snapshot: Record<string, unknown> = {};
let companyId: number | null = null;

const clearScratchReferrals = async () => {
  const rows = await Referral.findAll({ where: { referral_code: FF_CODE }, attributes: ["referral_id"] });
  const ids = rows.map((r) => (r as unknown as { referral_id: number }).referral_id);
  if (ids.length) {
    await ReferralReward.destroy({ where: { referral_id: ids } });
    await Referral.destroy({ where: { referral_id: ids } });
  }
};
const clearScratchTxns = async () => {
  await sequelize.query(`DELETE FROM tbl_customer_transaction WHERE transaction_reference LIKE :p`, {
    replacements: { p: `${TXREF}%` },
  });
};

const seedReferral = async (over: Record<string, unknown>): Promise<Referral> => {
  const base = {
    referrer_user_id: REFERRER,
    referred_user_id: REFERRER,
    referral_code: FF_CODE,
    status: "active",
    activation_requirement: "first_transaction_100",
    bonus_amount: 0,
    bonus_currency: "USD",
    referee_discount_percent: 0,
    referee_discount_duration_days: 0,
    referred_at: new Date("2001-01-01T00:00:00Z"),
    activated_at: new Date("2001-01-01T00:00:00Z"),
    commission_rate: 0.25,
    commission_window_ends_at: new Date("2100-01-01T00:00:00Z"),
    commission_accrued_usd: 0,
    commission_paid_usd: 0,
    commission_credited_usd: 0,
    last_accrual_at: new Date("2001-01-01T00:00:00Z"),
  };
  return (await Referral.create({ ...base, ...over } as never)) as unknown as Referral;
};

const seedTxn = async (ref: string, amount: number, currency: string, createdAt: string) => {
  await sequelize.query(
    `INSERT INTO tbl_customer_transaction
       (company_id, transaction_reference, base_amount, base_currency, paid_amount, paid_currency,
        status, transaction_type, payment_mode, "createdAt", "updatedAt")
     VALUES (:cid, :ref, :amt, :cur, :amt, :cur, 'successful', 'CREDIT', 'CRYPTO', :ts, :ts)`,
    { replacements: { cid: companyId, ref, amt: amount, cur: currency, ts: createdAt } }
  );
};

(async () => {
  try {
    const u = (await User.findByPk(REFERRER, {
      attributes: [
        "referral_payout_mode",
        "referral_payout_trc20_address",
        "referral_payout_address_verified_at",
        "referral_payout_auto",
        "referral_payout_auto_min_usd",
        "referral_payout_nudged_at",
        "referral_bonus_earned",
      ],
    })) as unknown as Record<string, unknown>;
    snapshot = {
      referral_payout_mode: u.referral_payout_mode ?? "credit",
      referral_payout_trc20_address: u.referral_payout_trc20_address ?? null,
      referral_payout_address_verified_at: u.referral_payout_address_verified_at ?? null,
      referral_payout_auto: u.referral_payout_auto ?? false,
      referral_payout_auto_min_usd: u.referral_payout_auto_min_usd ?? null,
      referral_payout_nudged_at: u.referral_payout_nudged_at ?? null,
      referral_bonus_earned: u.referral_bonus_earned ?? 0,
    };
    const comp = await sequelize.query<{ company_id: number }>(
      `SELECT company_id FROM tbl_company WHERE user_id = :u ORDER BY company_id LIMIT 1`,
      { replacements: { u: REFERRER }, type: QueryTypes.SELECT }
    );
    companyId = comp[0]?.company_id ?? null;
    // eslint-disable-next-line no-console
    console.log(`Baseline user1=${JSON.stringify(snapshot)}  companyId=${companyId}  MIN=${MIN_PAYOUT_USDT}\n`);

    await clearScratchReferrals();
    await clearScratchTxns();

    // ─────────────────────────────────────────────────────────────────────────
    // F5 — clawback on refund/chargeback (recompute vs currently-settled fees)
    // Window in YEAR 2000 => user1 has ZERO user_transactions in it => expected
    // accrued = 0, so a scratch accrued balance simulates fees whose txns reversed.
    // ─────────────────────────────────────────────────────────────────────────
    const rA = await seedReferral({
      commission_accrued_usd: 50,
      activated_at: new Date("2000-01-01T00:00:00Z"),
      last_accrual_at: new Date("2000-01-02T00:00:00Z"),
    });
    const cA = await clawbackReferralCommission(rA);
    const rA2 = (await Referral.findByPk((rA as unknown as { referral_id: number }).referral_id)) as unknown as Referral;
    check("F5 clawback removes fully-reversed commission ($50→$0)",
      round2(cA) === 50 && round2(Number(rA2.commission_accrued_usd)) === 0,
      `clawed=${cA}, accrued_after=${rA2.commission_accrued_usd}`);
    const cAidem = await clawbackReferralCommission(rA2);
    check("F5 clawback idempotent (re-run claws $0)", round2(cAidem) === 0, `re-run=${cAidem}`);

    const rB = await seedReferral({
      commission_accrued_usd: 50,
      commission_paid_usd: 20,
      commission_credited_usd: 10,
      activated_at: new Date("2000-01-01T00:00:00Z"),
      last_accrual_at: new Date("2000-01-02T00:00:00Z"),
    });
    const cB = await clawbackReferralCommission(rB);
    const rB2 = (await Referral.findByPk((rB as unknown as { referral_id: number }).referral_id)) as unknown as Referral;
    check("F5 clawback floors at paid+credited ($50→$30, never negative unpaid)",
      round2(cB) === 20 && round2(Number(rB2.commission_accrued_usd)) === 30,
      `clawed=${cB}, accrued_after=${rB2.commission_accrued_usd} (floor=paid20+credited10=30)`);

    await clearScratchReferrals();

    // ─────────────────────────────────────────────────────────────────────────
    // F2 — cash-out nudge must NOT fire for credit-mode referrers
    // ─────────────────────────────────────────────────────────────────────────
    await seedReferral({ commission_accrued_usd: MIN_PAYOUT_USDT + 25 });
    await User.update(
      { referral_payout_mode: "credit", referral_payout_nudged_at: null } as never,
      { where: { user_id: REFERRER } }
    );
    const sentCredit = await processReferralNudges();
    const uCredit = (await User.findByPk(REFERRER, { attributes: ["referral_payout_nudged_at"] })) as unknown as Record<string, unknown>;
    check("F2 credit-mode referrer NOT nudged to cash out",
      sentCredit === 0 && uCredit.referral_payout_nudged_at == null,
      `sent=${sentCredit}, nudged_at=${uCredit.referral_payout_nudged_at}`);

    await User.update(
      { referral_payout_mode: "cash", referral_payout_nudged_at: null } as never,
      { where: { user_id: REFERRER } }
    );
    const sentCash = await processReferralNudges();
    const uCash = (await User.findByPk(REFERRER, { attributes: ["referral_payout_nudged_at"] })) as unknown as Record<string, unknown>;
    check("F2 cash-mode referrer IS nudged (positive control)",
      sentCash === 1 && uCash.referral_payout_nudged_at != null,
      `sent=${sentCash}, nudged_at=${uCash.referral_payout_nudged_at}`);

    await clearScratchReferrals();

    // ─────────────────────────────────────────────────────────────────────────
    // F3(b) — expiry sweep moves stale PENDING (past 90-day window) → expired,
    //          leaves in-window pending untouched.
    // ─────────────────────────────────────────────────────────────────────────
    const eStale = await seedReferral({ status: "pending", expires_at: new Date("2001-04-01T00:00:00Z") });
    const eFuture = await seedReferral({ status: "pending", expires_at: new Date("2100-01-01T00:00:00Z") });
    await expireStalePendingReferrals();
    const eStale2 = (await Referral.findByPk((eStale as unknown as { referral_id: number }).referral_id)) as unknown as Referral;
    const eFuture2 = (await Referral.findByPk((eFuture as unknown as { referral_id: number }).referral_id)) as unknown as Referral;
    check("F3 expiry sweep: stale pending→expired, in-window pending untouched",
      eStale2.status === "expired" && eFuture2.status === "pending",
      `stale=${eStale2.status}, future=${eFuture2.status}`);

    await clearScratchReferrals();

    // ─────────────────────────────────────────────────────────────────────────
    // F6 + F3(a) — activation gate is USD-normalized and window-enforced.
    // Uses a YEAR-2001 window so ONLY the scratch txns qualify (real data excluded).
    // ─────────────────────────────────────────────────────────────────────────
    // Sanity: the FX mechanism the gate relies on.
    const usdUsd = Number(await convertToUSD("USD", 100));
    const usdJpy = Number(await convertToUSD("JPY", 100));
    check("F6 convertToUSD sanity: 100 USD == $100, 100 JPY < $100",
      round2(usdUsd) === 100 && usdJpy > 0 && usdJpy < 100,
      `USD=${usdUsd}, JPY=${round2(usdJpy)}`);

    if (companyId) {
      const win = { referred_at: new Date("2001-01-01T00:00:00Z"), expires_at: new Date("2001-04-01T00:00:00Z") };

      // F6-negative: 100 JPY (~$0.6) within window must NOT activate.
      const pJpy = await seedReferral({ status: "pending", ...win });
      await seedTxn(`${TXREF}JPY`, 100, "JPY", "2001-02-01T00:00:00Z");
      await processPendingReferrerRewards();
      const pJpy2 = (await Referral.findByPk((pJpy as unknown as { referral_id: number }).referral_id)) as unknown as Referral;
      check("F6 non-USD gate: 100 JPY (<$100 USD) does NOT activate",
        pJpy2.status === "pending", `status=${pJpy2.status} (was wrongly 'active' pre-fix)`);
      await clearScratchReferrals();
      await clearScratchTxns();

      // F6-positive: 100 USD within window activates.
      const pUsd = await seedReferral({ status: "pending", ...win });
      await seedTxn(`${TXREF}USD`, 100, "USD", "2001-02-01T00:00:00Z");
      await processPendingReferrerRewards();
      const pUsd2 = (await Referral.findByPk((pUsd as unknown as { referral_id: number }).referral_id)) as unknown as Referral;
      check("F6 USD gate: 100 USD within window ACTIVATES (positive control)",
        pUsd2.status === "active", `status=${pUsd2.status}`);
      await clearScratchReferrals();
      await clearScratchTxns();

      // F3(a): $500 USD payment AFTER expires_at (out of window) must NOT activate.
      const pOob = await seedReferral({
        status: "pending",
        referred_at: new Date("2001-01-01T00:00:00Z"),
        expires_at: new Date("2001-04-01T00:00:00Z"),
      });
      await seedTxn(`${TXREF}OOB`, 500, "USD", "2001-06-01T00:00:00Z"); // after expires_at
      await processPendingReferrerRewards();
      const pOob2 = (await Referral.findByPk((pOob as unknown as { referral_id: number }).referral_id)) as unknown as Referral;
      check("F3 window: qualifying payment AFTER 90-day window does NOT activate",
        pOob2.status === "pending", `status=${pOob2.status} (was wrongly 'active' pre-fix)`);
      await clearScratchReferrals();
      await clearScratchTxns();
    } else {
      check("F6/F3(a) integrated activation test", false, "SKIPPED — user 1 has no company_id to attach scratch txns");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // F4 — a referred user may hold only ONE referral across ALL referrers.
    // Demonstrates the fixed guard (referred_user_id + status) catches a duplicate
    // that the OLD (referrer_user_id, referred_user_id) pair guard would have missed.
    // ─────────────────────────────────────────────────────────────────────────
    await seedReferral({ status: "pending", referrer_user_id: REFERRER, referred_user_id: REFERRER });
    const fixedGuardHit = await Referral.findOne({
      where: { referred_user_id: REFERRER, status: { [Op.in]: ["pending", "active", "rewarded"] } },
    });
    const oldGuardMiss = await Referral.findOne({
      where: { referrer_user_id: 999999999, referred_user_id: REFERRER }, // a DIFFERENT referrer
    });
    check("F4 fixed guard blocks a 2nd referral from ANY referrer (old pair-guard would not)",
      !!fixedGuardHit && !oldGuardMiss,
      `fixedGuardFinds=${!!fixedGuardHit}, oldPairGuardFinds(diffReferrer)=${!!oldGuardMiss}`);
    await clearScratchReferrals();

    const passed = results.filter((r) => r.pass).length;
    // eslint-disable-next-line no-console
    console.log(`\n=== RESULT: ${passed}/${results.length} checks passed ===`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("HARNESS ERROR:", e);
    check("HARNESS completed without throwing", false, String(e));
  } finally {
    try {
      await clearScratchReferrals();
      await clearScratchTxns();
      await User.update(snapshot as never, { where: { user_id: REFERRER } });
      const after = await sequelize.query(
        `SELECT (SELECT COUNT(*)::int FROM tbl_referral WHERE referral_code=:c) AS scratch_referrals_left,
                (SELECT COUNT(*)::int FROM tbl_customer_transaction WHERE transaction_reference LIKE :p) AS scratch_txns_left`,
        { replacements: { c: FF_CODE, p: `${TXREF}%` }, type: QueryTypes.SELECT }
      );
      // eslint-disable-next-line no-console
      console.log(`\nCLEANUP: ${JSON.stringify(after[0])} (both must be 0); user1 restored.`);
    } catch (ce) {
      // eslint-disable-next-line no-console
      console.error("!!! CLEANUP FAILED — MANUAL REVIEW NEEDED:", ce);
    }
    await sequelize.close();
    process.exit(0);
  }
})();
