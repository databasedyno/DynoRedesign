import { apiLogger } from "../utils/loggers";
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../utils/dbInstance';
import User from '../models/userModels/userModel';
import Referral from '../models/referralModels/referralModel';
import ReferralReward from '../models/referralModels/referralRewardModel';
import { PROCESSED_STATUS_SQL } from '../utils/processedVolume';
import { sendReferralAccrualEmail } from './email/referralEmails';

// ============================================
// REVENUE-SHARE COMMISSION ACCRUAL (2026-08)
// Referrer earns commission_rate (default 25%) of the platform fees the referred
// merchant generates, for 12 months from activation. Delivered as fee-credit by
// default; opt-in USDT-TRC20 cash-out via Binance is Phase 2.
// ============================================

/**
 * Accrue commission for ONE active referral: commission_rate × the platform fees
 * the referred merchant generated since the last accrual watermark, capped at the
 * 12-month window end. Idempotent via last_accrual_at (a re-run accrues $0).
 *
 * Money-safe: read-only over tbl_user_transaction (settled statuses only), then a
 * bounded UPDATE of the referral's running totals + a running 'commission' reward
 * row. Runs leader-only (referralRewardMonitor) — never in SAFE MODE preview.
 */
export const accrueReferralCommission = async (referral: Referral): Promise<number> => {
  const now = new Date();
  const windowEnds = referral.commission_window_ends_at
    ? new Date(referral.commission_window_ends_at)
    : null;
  // windowCap = LEAST(now, commission_window_ends_at)
  const windowCap = windowEnds && windowEnds.getTime() < now.getTime() ? windowEnds : now;
  const lastAccrual = referral.last_accrual_at
    ? new Date(referral.last_accrual_at)
    : referral.activated_at
      ? new Date(referral.activated_at)
      : null;

  const windowClosed = !!(windowEnds && now.getTime() >= windowEnds.getTime());

  // Nothing to accrue if there's no start point or we've reached the cap.
  if (!lastAccrual || lastAccrual.getTime() >= windowCap.getTime()) {
    if (windowClosed && referral.status === 'active') {
      await referral.update({ status: 'rewarded', rewarded_at: now, last_accrual_at: windowCap });
    }
    return 0;
  }

  const rate = Number(referral.commission_rate ?? 0.25) || 0.25;

  const feeRows = await sequelize.query<{ fees_usd: string | null }>(
    `SELECT COALESCE(SUM(
        (COALESCE(ut.transaction_fee, 0) + COALESCE(ut.fixed_fee, 0))
        * (COALESCE(ut.usd_value, 0) / NULLIF(ut.base_amount, 0))
      ), 0) AS fees_usd
       FROM tbl_user_transaction ut
      WHERE ut.user_id = :referredUserId
        AND ut.base_amount > 0
        AND ${PROCESSED_STATUS_SQL}
        AND ut."createdAt" > :lastAccrual
        AND ut."createdAt" <= :windowCap`,
    {
      replacements: {
        referredUserId: referral.referred_user_id,
        lastAccrual,
        windowCap,
      },
      type: QueryTypes.SELECT,
    }
  );

  const feesUsd = Number(feeRows[0]?.fees_usd || 0);
  const commissionUsd = Math.round(feesUsd * rate * 100) / 100;
  const newAccrued = Math.round((Number(referral.commission_accrued_usd || 0) + commissionUsd) * 100) / 100;

  // Advance the watermark regardless (so we never re-scan the same window slice).
  await referral.update({
    commission_accrued_usd: newAccrued,
    last_accrual_at: windowCap,
    ...(windowClosed ? { status: 'rewarded' as const, rewarded_at: now } : {}),
  });

  if (commissionUsd > 0) {
    // Upsert ONE running 'commission' reward row per referral (audit + earnings feed).
    const existing = await ReferralReward.findOne({
      where: { referral_id: referral.referral_id, reward_type: 'commission' },
    });
    if (existing) {
      await existing.update({ amount: newAccrued });
    } else {
      await ReferralReward.create({
        referral_id: referral.referral_id,
        user_id: referral.referrer_user_id,
        reward_type: 'commission',
        amount: newAccrued,
        currency: 'USDT',
        status: 'pending',
      } as Record<string, unknown>);
    }

    // Keep the legacy dashboard total (User.referral_bonus_earned) in sync.
    await User.increment(
      { referral_bonus_earned: commissionUsd },
      { where: { user_id: referral.referrer_user_id } }
    );
  }

  if (commissionUsd > 0 || windowClosed) {
    apiLogger.info(
      `[Referral] Accrued $${commissionUsd.toFixed(2)} (fees $${feesUsd.toFixed(2)} × ${rate}) ` +
      `for referral ${referral.referral_id}${windowClosed ? ' — window CLOSED' : ''}`
    );
  }

  return commissionUsd;
};

/**
 * Loop all active referrals and accrue commission for each. Called by the
 * referralRewardMonitor cron (leader-only). Returns total accrued USD.
 */
export const accrueActiveReferralCommissions = async (): Promise<number> => {
  const referrals = await Referral.findAll({ where: { status: 'active' } });
  let total = 0;
  for (const referral of referrals) {
    try {
      const delta = await accrueReferralCommission(referral);
      total += delta;
      // Accrual alert (leader/prod only; suppressed in preview via DISABLE_OUTBOUND_EMAIL).
      if (delta > 0) {
        try {
          const [referrer, merchant] = await Promise.all([
            User.findByPk(referral.referrer_user_id, { attributes: ['email', 'name'] }),
            User.findByPk(referral.referred_user_id, { attributes: ['name', 'email'] }),
          ]);
          const to = (referrer as unknown as { email?: string })?.email;
          if (to) {
            const unpaid = Math.max(
              0,
              Math.round(
                (Number(referral.commission_accrued_usd || 0) -
                  Number(referral.commission_paid_usd || 0) -
                  Number(referral.commission_credited_usd || 0)) * 100
              ) / 100
            );
            const m = merchant as unknown as { name?: string; email?: string };
            const merchantName = m?.name || m?.email || 'a referred merchant';
            const referrerName = (referrer as unknown as { name?: string })?.name || to;
            await sendReferralAccrualEmail(to, referrerName, delta, merchantName, unpaid);
          }
        } catch (mailErr) {
          apiLogger.error(`[Referral] accrual email failed for referral ${referral.referral_id}: ${mailErr}`);
        }
      }
    } catch (e) {
      apiLogger.error(`[Referral] accrual error for referral ${referral.referral_id}: ${e}`);
    }
  }
  if (total > 0) {
    apiLogger.info(`[Referral] Accrual cycle complete — $${total.toFixed(2)} across ${referrals.length} active referral(s)`);
  }
  return total;
};

/**
 * Per-referrer revenue-share summary for GET /api/referral/earnings.
 * Reads the running totals on tbl_referral (source of truth).
 */
export const getReferrerCommissionSummary = async (userId: number): Promise<{
  rate_percent: number;
  window_months: number;
  total_accrued_usd: number;
  total_paid_usd: number;
  total_credited_usd: number;
  unpaid_balance_usd: number;
  active_windows: number;
  referrals: Array<{
    referral_id: number;
    referred_user_id: number;
    referred_name: string | null;
    referred_email: string | null;
    status: string;
    accrued_usd: number;
    paid_usd: number;
    credited_usd: number;
    unpaid_usd: number;
    commission_rate: number;
    window_ends_at: Date | null;
    days_remaining: number | null;
  }>;
}> => {
  const referrals = await Referral.findAll({
    where: {
      referrer_user_id: userId,
      status: { [Op.in]: ['active', 'rewarded'] },
    },
    include: [{ model: User, as: 'referred_user', attributes: ['name', 'email'] }],
    order: [['activated_at', 'DESC']],
  });

  const now = Date.now();
  let totalAccrued = 0;
  let totalPaid = 0;
  let totalCredited = 0;
  let activeWindows = 0;
  let rate = 0.25;

  const list = referrals.map((r) => {
    const accrued = Number(r.commission_accrued_usd || 0);
    const paid = Number(r.commission_paid_usd || 0);
    const credited = Number(r.commission_credited_usd || 0);
    const unpaid = Math.max(0, Math.round((accrued - paid - credited) * 100) / 100);
    const windowEnds = r.commission_window_ends_at ? new Date(r.commission_window_ends_at) : null;
    const daysRemaining = windowEnds
      ? Math.max(0, Math.ceil((windowEnds.getTime() - now) / (24 * 60 * 60 * 1000)))
      : null;
    if (r.status === 'active' && windowEnds && windowEnds.getTime() > now) activeWindows += 1;
    rate = Number(r.commission_rate ?? 0.25) || rate;
    totalAccrued += accrued;
    totalPaid += paid;
    totalCredited += credited;
    return {
      referral_id: r.referral_id,
      referred_user_id: r.referred_user_id,
      referred_name: (r as unknown as { referred_user?: { name?: string } }).referred_user?.name ?? null,
      referred_email: (r as unknown as { referred_user?: { email?: string } }).referred_user?.email ?? null,
      status: r.status,
      accrued_usd: accrued,
      paid_usd: paid,
      credited_usd: credited,
      unpaid_usd: unpaid,
      commission_rate: Number(r.commission_rate ?? 0.25),
      window_ends_at: windowEnds,
      days_remaining: daysRemaining,
    };
  });

  return {
    rate_percent: Math.round(rate * 100),
    window_months: 12,
    total_accrued_usd: Math.round(totalAccrued * 100) / 100,
    total_paid_usd: Math.round(totalPaid * 100) / 100,
    total_credited_usd: Math.round(totalCredited * 100) / 100,
    unpaid_balance_usd: Math.round((totalAccrued - totalPaid - totalCredited) * 100) / 100,
    active_windows: activeWindows,
    referrals: list,
  };
};

// ============================================
// F5 — CLAWBACK ON REFUND / CHARGEBACK / REVERSAL (2026-08)
// Accrual is forward-only (watermark), so a transaction counted while SETTLED that
// is LATER reversed (its status leaves the PROCESSED set — e.g. 'refunded'/'failed')
// would otherwise leave its commission accrued forever. This reconciles each
// referral's running accrued total against the CURRENT settled-fee reality over the
// slice we have already accrued (activated_at, last_accrual_at] and claws back any
// excess. Idempotent (after clawback accrued == expected), floored at paid+credited
// so unpaid_balance can never go negative, moves NO funds.
// ============================================

/** Reconcile ONE referral's accrued commission against currently-settled fees. */
export const clawbackReferralCommission = async (referral: Referral): Promise<number> => {
  const rate = Number(referral.commission_rate ?? 0.25) || 0.25;
  const accrued = Number(referral.commission_accrued_usd || 0);
  if (accrued <= 0) return 0;

  const activatedAt = referral.activated_at ? new Date(referral.activated_at) : null;
  const lastAccrual = referral.last_accrual_at ? new Date(referral.last_accrual_at) : null;
  // Nothing accrued yet (no slice to reconcile) if the watermark hasn't advanced.
  if (!activatedAt || !lastAccrual || lastAccrual.getTime() <= activatedAt.getTime()) return 0;

  // Recompute the platform fees for the ALREADY-ACCRUED slice using the SAME
  // formula + status filter as accrual — reversed rows drop out of PROCESSED_STATUS_SQL.
  const feeRows = await sequelize.query<{ fees_usd: string | null }>(
    `SELECT COALESCE(SUM(
        (COALESCE(ut.transaction_fee, 0) + COALESCE(ut.fixed_fee, 0))
        * (COALESCE(ut.usd_value, 0) / NULLIF(ut.base_amount, 0))
      ), 0) AS fees_usd
       FROM tbl_user_transaction ut
      WHERE ut.user_id = :referredUserId
        AND ut.base_amount > 0
        AND ${PROCESSED_STATUS_SQL}
        AND ut."createdAt" > :activatedAt
        AND ut."createdAt" <= :lastAccrual`,
    {
      replacements: {
        referredUserId: referral.referred_user_id,
        activatedAt,
        lastAccrual,
      },
      type: QueryTypes.SELECT,
    }
  );

  const currentFeesUsd = Number(feeRows[0]?.fees_usd || 0);
  const expectedAccrued = Math.round(currentFeesUsd * rate * 100) / 100;

  // Expected still matches (or exceeds) accrued → nothing was reversed.
  if (expectedAccrued >= accrued - 0.005) return 0;

  // Never claw back value already delivered (paid out or applied as fee-credit),
  // so unpaid_balance = accrued − paid − credited stays >= 0.
  const paid = Number(referral.commission_paid_usd || 0);
  const credited = Number(referral.commission_credited_usd || 0);
  const floor = Math.round((paid + credited) * 100) / 100;

  const target = Math.max(expectedAccrued, floor);
  if (target >= accrued - 0.005) return 0;

  const clawback = Math.round((accrued - target) * 100) / 100;

  await referral.update({ commission_accrued_usd: target });

  // Keep the running 'commission' reward row + legacy dashboard total in sync.
  const existing = await ReferralReward.findOne({
    where: { referral_id: referral.referral_id, reward_type: 'commission' },
  });
  if (existing) {
    await existing.update({ amount: target });
  }
  await User.increment(
    { referral_bonus_earned: -clawback },
    { where: { user_id: referral.referrer_user_id } }
  );

  apiLogger.warn(
    `[Referral] Clawed back $${clawback.toFixed(2)} from referral ${referral.referral_id} ` +
    `(accrued $${accrued.toFixed(2)} → $${target.toFixed(2)}; reversed/refunded settled fees; ` +
    `floor paid+credited=$${floor.toFixed(2)})`
  );

  return clawback;
};

/**
 * Reconcile ALL active/rewarded referrals with commission accrued > 0 for
 * refund/chargeback clawbacks. Called by referralRewardMonitor AFTER accrual
 * (leader-only). Returns total USD clawed back.
 */
export const clawbackReversedReferralCommissions = async (): Promise<number> => {
  const referrals = await Referral.findAll({
    where: {
      status: { [Op.in]: ['active', 'rewarded'] },
      commission_accrued_usd: { [Op.gt]: 0 },
    },
  });
  let total = 0;
  for (const referral of referrals) {
    try {
      total += await clawbackReferralCommission(referral);
    } catch (e) {
      apiLogger.error(`[Referral] clawback error for referral ${referral.referral_id}: ${e}`);
    }
  }
  if (total > 0) {
    apiLogger.info(
      `[Referral] Clawback cycle complete — $${total.toFixed(2)} reversed across ${referrals.length} referral(s)`
    );
  }
  return total;
};

