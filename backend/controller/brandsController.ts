import express from "express";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import { successResponseHelper } from "../helper";
import { apiLogger } from "../utils/loggers";
import { IUserType } from "../utils/types";
import { companyModel, teamMemberModel, userModel } from "../models";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { convertToFiat, getCurrencySymbol, isSupportedDisplayCurrency } from "../utils/currencyUtils";
import { toNumber } from "../utils/money";
import { OverviewScope, coinsWithoutWallet } from "../services/dashboard/overviewQueries";
import { brandStats, brandAttention } from "../services/dashboard/brandsQueries";
import { resolveRange } from "./dashboardOverviewController";

const CACHE_TTL = 60;
const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

interface AccessibleBrand {
  company_id: number;
  company_name: string | null;
  photo: string | null;
  display_currency: string | null;
  account_type: string | null;
  owner_user_id: number;
  is_member: boolean;
  member_role: string;
}

/** Owned + active-team-member companies for the logged-in user (mirrors company/getCompany). */
const resolveAccessibleBrands = async (userId: number): Promise<AccessibleBrand[]> => {
  const owned = await companyModel.findAll({ where: { user_id: userId } });
  const ownedIds = new Set(owned.map((c) => Number(c.dataValues.company_id)));

  const memberships = await teamMemberModel.findAll({
    where: { member_user_id: userId, status: "active" },
  });
  const membershipByCompany = new Map<number, { role?: string }>();
  memberships.forEach((m) => membershipByCompany.set(Number(m.dataValues.company_id), m.dataValues));

  const grantedIds = [...membershipByCompany.keys()].filter((id) => !ownedIds.has(id));
  let granted: Awaited<ReturnType<typeof companyModel.findAll>> = [];
  if (grantedIds.length) {
    granted = await companyModel.findAll({ where: { company_id: { [Op.in]: grantedIds } } });
  }

  const toRow = (c: { dataValues: Record<string, unknown> }, is_member: boolean, role: string): AccessibleBrand => ({
    company_id: Number(c.dataValues.company_id),
    company_name: (c.dataValues.company_name as string) ?? null,
    photo: (c.dataValues.photo as string) ?? null,
    display_currency: (c.dataValues.display_currency as string) ?? null,
    account_type: (c.dataValues.account_type as string) ?? null,
    owner_user_id: Number(c.dataValues.user_id),
    is_member,
    member_role: role,
  });

  return [
    ...owned.map((c) => toRow(c, false, "owner")),
    ...granted.map((c) => toRow(c, true, String(membershipByCompany.get(Number(c.dataValues.company_id))?.role || "member"))),
  ];
};

/**
 * GET /api/dashboard/brands — portfolio overview across every brand the user
 * can access: a combined summary strip + per-brand stats (settled volume,
 * payments, pending, needs-attention, last activity) for the selected range.
 * All monetary values are converted to the ACCOUNT display currency so the
 * brands are comparable; each brand's own native currency is returned too.
 * Query: period (today|7d|30d|90d|1y|all) or startDate&endDate.
 */
const getBrands = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const userId = userData.user_id;
    const { period = "30d", startDate, endDate } = req.query;

    const userRow = await userModel.findOne({ where: { user_id: userId }, attributes: ["display_currency"] });
    const rawCur = String(userRow?.dataValues?.display_currency || "").toUpperCase();
    const currency = isSupportedDisplayCurrency(rawCur) ? rawCur : "USD";

    const range = resolveRange(String(period), startDate as string | undefined, endDate as string | undefined);
    const rangeKey = range.period === "custom"
      ? `${range.start.toISOString().slice(0, 10)}_${range.end.toISOString().slice(0, 10)}`
      : range.period;
    const cacheKey = `dashboard:brands:${userId}:${rangeKey}:${currency}:v1`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Brands retrieved", cached);
    }

    const brands = await resolveAccessibleBrands(userId);

    let rate = 1;
    if (currency !== "USD") {
      try {
        rate = (await convertToFiat("USD", currency, 1)).rate || 1;
      } catch {
        rate = 1;
      }
    }
    const fx = (usd: number) => toNumber(usd * rate, 2);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const prevStart = new Date(range.start.getTime() - (range.end.getTime() - range.start.getTime()));

    const rows = await Promise.all(
      brands.map(async (b) => {
        const scope: OverviewScope = {
          userId: b.owner_user_id,
          companyId: String(b.company_id),
          start: range.start,
          end: range.end,
          prevStart,
          startOfToday,
        };
        const [stats, attention, coins] = await Promise.all([
          brandStats(scope),
          brandAttention(scope),
          coinsWithoutWallet(scope),
        ]);

        const settledNetUsd = num(stats.settled_net);
        const pendingUsd = num(stats.pending_usd_est);
        const stuck = num(attention.stuck_count);
        const failed = num(attention.failed_count);
        const webhookFailed = num(attention.webhook_failed);
        const coinsMissing = coins.length;
        const attentionCount = stuck + failed + coinsMissing + (webhookFailed > 0 ? 1 : 0);
        const lifetimePaid = num(stats.lifetime_paid);

        return {
          company_id: b.company_id,
          company_name: b.company_name,
          photo: b.photo,
          native_currency: b.display_currency || "USD",
          account_type: b.account_type,
          is_member: b.is_member,
          member_role: b.member_role,
          is_new: lifetimePaid === 0,
          settled_net_usd: settledNetUsd,
          settled_amount: fx(settledNetUsd),
          payments_count: num(stats.settled_count),
          pending_amount: fx(pendingUsd),
          pending_count: num(stats.pending_count),
          last_paid_at: stats.last_paid_at ?? null,
          attention_count: attentionCount,
          attention: {
            stuck_forwards: stuck,
            failed_conversions: failed,
            coins_without_wallet: coinsMissing,
            webhook_failures: webhookFailed,
          },
        };
      }),
    );

    // Busiest first (by settled volume); brand-new/empty brands always last.
    rows.sort((a, b) => {
      if (a.is_new !== b.is_new) return a.is_new ? 1 : -1;
      return b.settled_net_usd - a.settled_net_usd;
    });

    const summary = {
      brand_count: rows.length,
      settled_amount: fx(rows.reduce((s, r) => s + r.settled_net_usd, 0)),
      payments_count: rows.reduce((s, r) => s + r.payments_count, 0),
      pending_amount: fx(rows.reduce((s, r) => s + (r.pending_amount / (rate || 1)), 0) * (rate || 1)),
      attention_count: rows.reduce((s, r) => s + r.attention_count, 0),
    };

    const data = {
      range: { period: range.period, start: range.start.toISOString(), end: range.end.toISOString() },
      currency,
      currency_symbol: getCurrencySymbol(currency),
      summary,
      brands: rows.map(({ settled_net_usd, ...rest }) => rest),
      generated_at: now.toISOString(),
    };

    await setRedisItemWithTTL(cacheKey, data, CACHE_TTL);
    return successResponseHelper(res, 200, "Brands retrieved", data);
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger);
  }
};

export default { getBrands };
