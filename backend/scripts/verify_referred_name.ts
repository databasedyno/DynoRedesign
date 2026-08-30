/** READ-ONLY: confirm getReferrerCommissionSummary now returns referred_name/email. */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import { getReferrerCommissionSummary } from "../services/referralCommissionService";

(async () => {
  try {
    const rows = await sequelize.query<{ referrer_user_id: number; c: number }>(
      `SELECT referrer_user_id, COUNT(*)::int AS c
         FROM tbl_referral
        WHERE status IN ('active','rewarded')
        GROUP BY referrer_user_id
        ORDER BY c DESC
        LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    if (!rows.length) {
      // eslint-disable-next-line no-console
      console.log("No referrer with active/rewarded referrals — field-shape check only.");
    } else {
      const uid = rows[0].referrer_user_id;
      const s = await getReferrerCommissionSummary(uid);
      // eslint-disable-next-line no-console
      console.log(`referrer=${uid} referrals=${s.referrals.length} totalAccrued=$${s.total_accrued_usd}`);
      s.referrals.slice(0, 6).forEach((r) => {
        const x = r as unknown as { referred_name?: string; referred_email?: string };
        // eslint-disable-next-line no-console
        console.log("  -", JSON.stringify({
          referral_id: r.referral_id,
          referred_user_id: r.referred_user_id,
          referred_name: x.referred_name,
          referred_email: x.referred_email,
          accrued_usd: r.accrued_usd,
        }));
      });
      const hasName = s.referrals.some((r) => (r as unknown as { referred_name?: string }).referred_name);
      // eslint-disable-next-line no-console
      console.log(`FIELD PRESENT: referred_name key exists on rows = ${s.referrals.every((r) => "referred_name" in (r as object))}; any populated = ${hasName}`);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("ERROR:", e);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
})();
