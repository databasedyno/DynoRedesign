/** REVERSIBLE: create one scratch active referral to a NAMED user, confirm
 *  getReferrerCommissionSummary returns that merchant's real name, then delete. */
import sequelize from "../utils/dbInstance";
import "../models/associations";
import { QueryTypes } from "sequelize";
import Referral from "../models/referralModels/referralModel";
import { getReferrerCommissionSummary } from "../services/referralCommissionService";

const CODE = "REFNAME-TEST";
let referralId = 0;

(async () => {
  try {
    const named = await sequelize.query<{ user_id: number; name: string }>(
      `SELECT user_id, name FROM tbl_user WHERE name IS NOT NULL AND name <> '' ORDER BY user_id ASC LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    const referrer = await sequelize.query<{ user_id: number }>(
      `SELECT u.user_id FROM tbl_user u
        WHERE NOT EXISTS (SELECT 1 FROM tbl_referral r WHERE r.referrer_user_id = u.user_id)
        ORDER BY u.user_id DESC LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    if (!named.length || !referrer.length) throw new Error("no suitable users");
    const merchant = named[0];
    const refUser = referrer[0].user_id;
    // eslint-disable-next-line no-console
    console.log(`scratch referrer=${refUser} -> referred merchant=${merchant.user_id} ("${merchant.name}")`);

    const now = new Date();
    const r = await Referral.create({
      referrer_user_id: refUser,
      referred_user_id: merchant.user_id,
      referral_code: CODE,
      status: "active",
      activation_requirement: "first_transaction_100",
      bonus_amount: 0,
      bonus_currency: "USD",
      referee_discount_percent: 0,
      referee_discount_duration_days: 0,
      referred_at: now,
      activated_at: now,
      commission_rate: 0.25,
      commission_window_ends_at: new Date(now.getTime() + 300 * 864e5),
      commission_accrued_usd: 0,
      commission_paid_usd: 0,
      commission_credited_usd: 0,
      last_accrual_at: now,
    } as never);
    referralId = (r as unknown as { referral_id: number }).referral_id;

    const s = await getReferrerCommissionSummary(refUser);
    const row = s.referrals.find((x) => x.referral_id === referralId) as unknown as {
      referred_name?: string; referred_email?: string; referred_user_id: number;
    } | undefined;
    // eslint-disable-next-line no-console
    console.log("summary row:", JSON.stringify(row));
    const pass = !!row && row.referred_name === merchant.name;
    // eslint-disable-next-line no-console
    console.log(`${pass ? "✅" : "❌"} referred_name resolved to the merchant's real name ("${row?.referred_name}" === "${merchant.name}")`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("ERROR:", e);
  } finally {
    if (referralId) await Referral.destroy({ where: { referral_id: referralId } });
    const left = await sequelize.query(`SELECT COUNT(*)::int AS n FROM tbl_referral WHERE referral_code=:c`, {
      replacements: { c: CODE }, type: QueryTypes.SELECT,
    });
    // eslint-disable-next-line no-console
    console.log("CLEANUP left:", JSON.stringify(left[0]), "(must be 0)");
    await sequelize.close();
    process.exit(0);
  }
})();
