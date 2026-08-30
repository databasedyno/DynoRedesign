/**
 * REVERSIBLE harness — validates the AUTO-CONVERT referral accrual fix (2026-06).
 *
 * Feeds a simulated auto-convert settlement row (shaped EXACTLY as the patched
 * chainVerification.ts else-branch now writes it: transaction_fee = platform fee
 * only, base_amount = merchant NET crypto, usd_value = USD of that net) through
 * the REAL accrueReferralCommission service and asserts the referrer accrues
 * 25% of the TRUE platform fee.
 *
 * Also prints the OLD (broken) value for contrast — proving why the fix matters.
 *
 * Self-cleaning: deletes the scratch txn + referral + reward rows and restores
 * the scratch user's referral_bonus_earned in a finally block. NO on-chain calls.
 */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import { randomUUID } from "crypto";
import User from "../models/userModels/userModel";
import Referral from "../models/referralModels/referralModel";
import ReferralReward from "../models/referralModels/referralRewardModel";
import userTransactionModel from "../models/userModels/userTransactionModel";
import { accrueReferralCommission } from "../services/referralCommissionService";

const CODE = "AUTOCONV-ACCRUAL-TEST";
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const results: Array<{ name: string; pass: boolean; detail: string }> = [];
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass, detail });
  // eslint-disable-next-line no-console
  console.log(`${pass ? "✅" : "❌"} ${name} — ${detail}`);
};

// Simulated auto-convert payment (DOGE chosen so the OLD bug is dramatic):
//   merchant NET crypto = 1000 DOGE, platform fee = 15 DOGE, gross = 1015 DOGE
//   USD of net = $100  → exchange rate 0.1 USD/DOGE
//   TRUE platform fee USD = 15 * 0.1 = $1.50  → commission @25% = $0.375 → $0.38
const NET_CRYPTO = 1000;
const FEE_CRYPTO = 15;
const GROSS_CRYPTO = NET_CRYPTO + FEE_CRYPTO;
const USD_OF_NET = 100;
const RATE = USD_OF_NET / NET_CRYPTO; // 0.1
const TRUE_FEE_USD = FEE_CRYPTO * RATE; // 1.50
const EXPECTED_COMMISSION = round2(TRUE_FEE_USD * 0.25); // 0.38

// What the OLD broken row would have produced:
//   transaction_fee_old = fee+merchant = 1015 (crypto), base_amount_old = fiat 100
//   usd_value = 100 → ratio 100/100 = 1 → fee_usd = 1015 * 1 = $1015 → 25% = $253.75
const OLD_FEE_USD = GROSS_CRYPTO * (USD_OF_NET / USD_OF_NET);
const OLD_COMMISSION = round2(OLD_FEE_USD * 0.25);

let scratchUser = 0;
let referralId = 0;
let txId = "";
let snapBonus = 0;

(async () => {
  try {
    // 1) pick a clean user: no transactions, not in any referral
    const clean = await sequelize.query<{ user_id: number; referral_bonus_earned: string | null }>(
      `SELECT u.user_id, u.referral_bonus_earned
         FROM tbl_user u
        WHERE NOT EXISTS (SELECT 1 FROM tbl_user_transaction t WHERE t.user_id = u.user_id)
          AND NOT EXISTS (SELECT 1 FROM tbl_referral r WHERE r.referrer_user_id = u.user_id OR r.referred_user_id = u.user_id)
        ORDER BY u.user_id DESC
        LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    if (!clean.length) throw new Error("No clean scratch user available");
    scratchUser = clean[0].user_id;
    snapBonus = Number(clean[0].referral_bonus_earned || 0);
    // eslint-disable-next-line no-console
    console.log(`Scratch user=${scratchUser} (bonus baseline=${snapBonus})`);
    console.log(`Simulated auto-convert DOGE payment: net=${NET_CRYPTO} fee=${FEE_CRYPTO} gross=${GROSS_CRYPTO}, USD(net)=$${USD_OF_NET}`);
    console.log(`→ TRUE platform fee=$${TRUE_FEE_USD.toFixed(2)}, expected commission @25%=$${EXPECTED_COMMISSION.toFixed(2)}`);
    console.log(`→ OLD broken row would have credited=$${OLD_COMMISSION.toFixed(2)} (fee read as gross ${GROSS_CRYPTO} @ ratio 1)\n`);

    // 2) scratch referral (activated 60d ago; window open 12mo; watermark at activation)
    const activatedAt = new Date(Date.now() - 60 * 864e5);
    const windowEndsAt = new Date(activatedAt);
    windowEndsAt.setMonth(windowEndsAt.getMonth() + 12);
    const r = await Referral.create({
      referrer_user_id: scratchUser,
      referred_user_id: scratchUser,
      referral_code: CODE,
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
      commission_accrued_usd: 0,
      commission_paid_usd: 0,
      commission_credited_usd: 0,
      last_accrual_at: activatedAt,
    } as never);
    referralId = (r as unknown as { referral_id: number }).referral_id;

    // 3) scratch auto-convert-shaped settled transaction (as the PATCHED code writes it)
    txId = `AUTOCONV-TEST-${randomUUID()}`;
    await userTransactionModel.create({
      id: txId,
      user_id: scratchUser,
      transaction_type: "CREDIT",
      status: "successful",
      base_currency: "DOGE",
      crypto_currency: "DOGE",
      base_amount: NET_CRYPTO,        // merchant NET crypto (fixed)
      crypto_amount: GROSS_CRYPTO,    // gross received
      usd_value: USD_OF_NET,          // USD of the net (fixed)
      transaction_fee: FEE_CRYPTO,    // platform fee ONLY (fixed)
      fixed_fee: 0,
    } as never);

    // 4) run the REAL accrual service
    const before = await Referral.findByPk(referralId);
    const beforeAccrued = Number(before?.commission_accrued_usd || 0);
    const returned = await accrueReferralCommission(before as Referral);
    const after = await Referral.findByPk(referralId);
    const afterAccrued = Number(after?.commission_accrued_usd || 0);
    const delta = round2(afterAccrued - beforeAccrued);

    check(
      "accrual returns 25% of the TRUE platform fee (not the gross)",
      round2(returned) === EXPECTED_COMMISSION,
      `returned=$${round2(returned).toFixed(2)} expected=$${EXPECTED_COMMISSION.toFixed(2)}`
    );
    check(
      "referral.commission_accrued_usd advanced by exactly that amount",
      delta === EXPECTED_COMMISSION,
      `delta=$${delta.toFixed(2)}`
    );
    check(
      "fixed row is NOT the old broken value",
      round2(returned) !== OLD_COMMISSION,
      `fixed=$${round2(returned).toFixed(2)} vs old-broken=$${OLD_COMMISSION.toFixed(2)}`
    );

    // 5) reward row + referrer dashboard total synced
    const reward = await ReferralReward.findOne({ where: { referral_id: referralId, reward_type: "commission" } });
    check(
      "running 'commission' reward row created with the correct amount",
      !!reward && round2(Number((reward as unknown as { amount: number }).amount)) === EXPECTED_COMMISSION,
      `reward.amount=$${reward ? Number((reward as unknown as { amount: number }).amount).toFixed(2) : "none"}`
    );
    const u = await User.findByPk(scratchUser, { attributes: ["referral_bonus_earned"] });
    const bonusAfter = round2(Number((u as unknown as { referral_bonus_earned: number })?.referral_bonus_earned || 0));
    check(
      "referrer referral_bonus_earned incremented by the commission",
      bonusAfter === round2(snapBonus + EXPECTED_COMMISSION),
      `bonus ${snapBonus} → ${bonusAfter} (expected ${round2(snapBonus + EXPECTED_COMMISSION)})`
    );

    const passed = results.filter((x) => x.pass).length;
    // eslint-disable-next-line no-console
    console.log(`\n=== ${passed}/${results.length} checks passed ===`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("HARNESS ERROR:", e);
  } finally {
    try {
      if (referralId) await ReferralReward.destroy({ where: { referral_id: referralId } });
      if (txId) await userTransactionModel.destroy({ where: { id: txId } });
      if (referralId) await Referral.destroy({ where: { referral_id: referralId } });
      if (scratchUser) await User.update({ referral_bonus_earned: snapBonus } as never, { where: { user_id: scratchUser } });
      const left = await sequelize.query(
        `SELECT (SELECT COUNT(*)::int FROM tbl_referral WHERE referral_code=:c) AS ref_left,
                (SELECT COUNT(*)::int FROM tbl_user_transaction WHERE id=:t) AS tx_left,
                (SELECT referral_bonus_earned FROM tbl_user WHERE user_id=:u) AS bonus`,
        { replacements: { c: CODE, t: txId, u: scratchUser }, type: QueryTypes.SELECT }
      );
      // eslint-disable-next-line no-console
      console.log("CLEANUP:", JSON.stringify(left[0]), "(ref_left & tx_left must be 0, bonus restored to", snapBonus + ")");
    } catch (ce) {
      // eslint-disable-next-line no-console
      console.error("!!! CLEANUP FAILED — MANUAL REVIEW:", ce);
    }
    await sequelize.close();
    process.exit(0);
  }
})();
