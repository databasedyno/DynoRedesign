/**
 * tipGoalMilestoneService — "you hit 50% / 100% of your monthly tip goal".
 *
 * Called fire-and-forget from the settlement path right after a contribution
 * (tip) settles. Recomputes the month's confirmed tip total for the creator's
 * tip jar, and emails the creator ONCE per (storefront, month, milestone) via
 * tbl_tip_goal_milestone. A single tip that jumps straight past 100% sends only
 * the 100% email (the 50% row is still recorded so it can never fire later).
 */
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { STOREFRONT_PER_COMPANY } from "../controller/storefrontScope";
import { tipGoalMilestoneModel } from "../models";
import { dispatchCompanyEmail } from "./email/companyDispatch";
import { sendTipGoalMilestoneEmail, TipGoalMilestone } from "./email/tipGoalEmails";
import { FRONTEND_BASE_URL } from "./email/emailShared";
import { normalizeLang } from "../utils/emailI18n";
import { cronLogger } from "../utils/loggers";

export const TIP_GOAL_MILESTONES: TipGoalMilestone[] = [50, 100];

interface JarRow {
  link_id: number;
  user_id: number;
  company_id: number | null;
  is_tip_jar: boolean | null;
  parent_link_id: number | null;
}

interface OwnerRow {
  user_id: number;
  company_id: number | null;
  handle: string | null;
  brand_name: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_language: string | null;
  support_widget_enabled: boolean | null;
  support_widget_monthly_goal: number | string | null;
  support_widget_currency: string | null;
}

export interface TipGoalCheckResult {
  skipped?: string;
  scope?: string;
  monthKey?: string;
  goal?: number;
  raised?: number;
  pct?: number;
  /** Milestone rows newly recorded this call. */
  recorded?: TipGoalMilestone[];
  /** The one milestone emailed this call (highest newly reached), if any. */
  emailed?: TipGoalMilestone | null;
}

export const monthKeyOf = (d: Date): string => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Milestones reached for a raised/goal pair, ascending. */
export const reachedMilestones = (raised: number, goal: number): TipGoalMilestone[] =>
  goal > 0 ? TIP_GOAL_MILESTONES.filter((m) => raised / goal >= m / 100) : [];

const loadOwner = async (jar: JarRow): Promise<OwnerRow | null> => {
  const rows = (STOREFRONT_PER_COMPANY && jar.company_id != null
    ? await sequelize.query(
        `SELECT c.user_id, c.company_id, c.handle, c.company_name AS brand_name, u.name AS owner_name, u.email AS owner_email,
                u.language AS owner_language, c.support_widget_enabled, c.support_widget_monthly_goal, c.support_widget_currency
           FROM tbl_company c JOIN tbl_user u ON u.user_id = c.user_id
          WHERE c.company_id = :cid LIMIT 1`,
        { replacements: { cid: jar.company_id }, type: QueryTypes.SELECT }
      )
    : await sequelize.query(
        `SELECT user_id, NULL::bigint AS company_id, handle, name AS brand_name, name AS owner_name, email AS owner_email,
                language AS owner_language, support_widget_enabled, support_widget_monthly_goal, support_widget_currency
           FROM tbl_user WHERE user_id = :uid LIMIT 1`,
        { replacements: { uid: jar.user_id }, type: QueryTypes.SELECT }
      )) as OwnerRow[];
  return rows[0] || null;
};

/**
 * Evaluate the creator's monthly goal after a tip to `parentLinkId` settled.
 * `now` is injectable for tests. Never throws — logs and returns `{skipped}`.
 */
export const checkTipGoalMilestone = async (
  parentLinkId: number | string | null | undefined,
  opts: { now?: Date; send?: boolean } = {}
): Promise<TipGoalCheckResult> => {
  try {
    const pid = Number(parentLinkId);
    if (!Number.isFinite(pid) || pid <= 0) return { skipped: "no_parent" };
    const [jar] = (await sequelize.query(
      `SELECT link_id, user_id, company_id, is_tip_jar, parent_link_id FROM tbl_payment_link WHERE link_id = :pid LIMIT 1`,
      { replacements: { pid }, type: QueryTypes.SELECT }
    )) as JarRow[];
    if (!jar || jar.is_tip_jar !== true || jar.parent_link_id != null) return { skipped: "not_tip_jar" };

    const owner = await loadOwner(jar);
    const goal = owner?.support_widget_monthly_goal != null ? Number(owner.support_widget_monthly_goal) : 0;
    if (!owner || owner.support_widget_enabled !== true || !(goal > 0)) return { skipped: "no_goal" };

    const now = opts.now ?? new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthKey = monthKeyOf(monthStart);
    const { getDonationAggregatesSince } = await import("../controller/payment/paymentLinkController");
    const agg = await getDonationAggregatesSince(jar.link_id, monthStart);
    const raised = agg.raised_amount;
    const pct = Math.floor((raised / goal) * 100);
    const scope = STOREFRONT_PER_COMPANY && owner.company_id != null ? `company:${owner.company_id}` : `user:${owner.user_id}`;

    const recorded: TipGoalMilestone[] = [];
    for (const m of reachedMilestones(raised, goal)) {
      const [, created] = await tipGoalMilestoneModel.findOrCreate({
        where: { scope, month_key: monthKey, milestone: m },
        defaults: { scope, month_key: monthKey, milestone: m, goal_amount: goal, raised_amount: raised, emailed: false },
      });
      if (created) recorded.push(m);
    }
    const emailed = recorded.length ? recorded[recorded.length - 1] : null;
    if (emailed && opts.send !== false) {
      const pageUrl = owner.handle ? `${FRONTEND_BASE_URL}/${owner.handle}` : `${FRONTEND_BASE_URL}/storefront`;
      await dispatchCompanyEmail(
        owner.company_id,
        "payments",
        { email: owner.owner_email, name: owner.owner_name || "" },
        (email, name) => sendTipGoalMilestoneEmail(email, name, owner.brand_name || "Your page", {
          milestone: emailed, goal, raised, currency: owner.support_widget_currency || "USD",
          supporters: agg.supporters_count, monthStart, pageUrl,
        }, normalizeLang(owner.owner_language)),
      );
      await tipGoalMilestoneModel.update(
        { emailed: true, notified_at: new Date() },
        { where: { scope, month_key: monthKey, milestone: emailed } }
      );
      cronLogger.info(`[tipGoal] ${scope} ${monthKey}: ${emailed}% milestone emailed (${raised}/${goal})`);
    }
    return { scope, monthKey, goal, raised, pct, recorded, emailed };
  } catch (e) {
    cronLogger.warn(`[tipGoal] milestone check failed for parent ${parentLinkId}: ${(e as Error)?.message}`);
    return { skipped: "error" };
  }
};

export default checkTipGoalMilestone;
