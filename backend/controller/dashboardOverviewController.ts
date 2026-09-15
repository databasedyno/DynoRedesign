import express from "express";
import jwt from "jsonwebtoken";
import { apiLogger } from "../utils/loggers";
import { handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import { successResponseHelper } from "../helper";
import { IUserType } from "../utils/types";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { convertToFiat, convertToUSD, getCurrencySymbol, getUserDisplayCurrency } from "../utils/currencyUtils";
import { toNumber } from "../utils/money";
import {
  OverviewScope,
  autoConvertSummary,
  configGaps,
  forwardedByAsset,
  funnelAggregate,
  settledAggregate,
  topLinks,
  topProducts,
  unlockedAmountsByCurrency,
} from "../services/dashboard/overviewQueries";

const CACHE_TTL = 60;
const STABLE = ["USD", "USDT", "USDC", "BUSD", "DAI", "USDP", "TUSD", "PYUSD", "FDUSD", "RLUSD"];
const PERIOD_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};
const pct = (cur: number, prev: number): number => {
  if (prev > 0) return Math.round(((cur - prev) / prev) * 1000) / 10;
  return cur > 0 ? 100 : 0;
};
const ratio = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const isStable = (cur: string) => STABLE.some((s) => cur === s || cur.startsWith(`${s}-`) || cur.startsWith(`${s}_`));

/** Resolve the analysis window from ?period= (today|7d|30d|90d|1y) or ?startDate&endDate. */
export const resolveRange = (period: string, startDate?: string, endDate?: string) => {
  const now = new Date();
  const s = startDate ? new Date(startDate) : null;
  const e = endDate ? new Date(endDate) : null;
  if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime()) && s.getTime() <= e.getTime()) {
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e, period: "custom" };
  }
  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end: now, period };
  }
  if (period === "all") return { start: new Date(2015, 0, 1), end: now, period };
  const days = PERIOD_DAYS[period] ?? 30;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { start, end: now, period: PERIOD_DAYS[period] ? period : "30d" };
};

/** Sum crypto amounts (grouped by currency) into USD using live rates; stablecoins at face value. */
const sumUnlockedUsd = async (rows: Array<Record<string, unknown>>, kind: string): Promise<number> => {
  let total = 0;
  for (const r of rows) {
    if (String(r.kind) !== kind) continue;
    const cur = String(r.currency || "").toUpperCase();
    const amt = num(r.amount);
    if (amt <= 0) continue;
    if (isStable(cur)) {
      total += amt;
      continue;
    }
    try {
      total += Number(await convertToUSD(cur, amt)) || 0;
    } catch {
      apiLogger.warn(`[Overview] convertToUSD failed for ${cur}`);
    }
  }
  return total;
};

/**
 * GET /api/dashboard/overview — everything the command-centre home needs that
 * the classic /dashboard payload lacks: money in motion (settled gross→net,
 * in flight, forwarded by asset), checkout health, exception counts,
 * configuration gaps and top links/products for the selected range.
 */
const getOverview = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id, period = "30d", startDate, endDate } = req.query;
    let userId = userData.user_id;
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
      userId = Number((companyData as unknown as { user_id: number }).user_id);
    }
    const currency = company_id ? await getUserDisplayCurrency(userId, company_id as string) : "USD";
    const range = resolveRange(String(period), startDate as string | undefined, endDate as string | undefined);
    const rangeKey = range.period === "custom"
      ? `${range.start.toISOString().slice(0, 10)}_${range.end.toISOString().slice(0, 10)}`
      : range.period;
    const cacheKey = `dashboard:overview:${userId}:${company_id || "all"}:${rangeKey}:${currency}:v1`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Overview retrieved", cached);
    }

    const now = new Date();
    const scope: OverviewScope = {
      userId,
      companyId: (company_id as string) || null,
      start: range.start,
      end: range.end,
      prevStart: new Date(range.start.getTime() - (range.end.getTime() - range.start.getTime())),
      startOfToday: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    };

    const [settled, fwdAssets, funnel, unlocked, links, products, gaps, autoConvert] = await Promise.all([
      settledAggregate(scope),
      forwardedByAsset(scope),
      funnelAggregate(scope),
      unlockedAmountsByCurrency(scope),
      topLinks(scope),
      topProducts(scope),
      configGaps(scope),
      autoConvertSummary(scope),
    ]);

    const [inFlightUsd, expiredTodayUsd] = await Promise.all([
      sumUnlockedUsd(unlocked, "confirming"),
      sumUnlockedUsd(unlocked, "expired_today"),
    ]);

    let rate = 1;
    if (currency !== "USD") {
      try {
        rate = (await convertToFiat("USD", currency, 1)).rate || 1;
      } catch {
        rate = 1;
      }
    }
    const fx = (usd: number) => toNumber(usd * rate, 2);

    const net = num(settled.net);
    const gross = num(settled.gross);
    const prevNet = num(settled.prev_net);
    const count = num(settled.count);
    const created = num(funnel.created);
    const paid = num(funnel.paid);
    const prevCreated = num(funnel.prev_created);
    const prevPaid = num(funnel.prev_paid);
    const underpaidRange = num(funnel.underpaid_range);
    const expiredRange = num(funnel.expired_range);
    const prevExceptions = num(funnel.prev_exceptions);
    const median = settled.median_settle_min == null ? null : toNumber(num(settled.median_settle_min), 1);
    const prevMedian = settled.prev_median_settle_min == null ? null : toNumber(num(settled.prev_median_settle_min), 1);

    const productsUsd = await Promise.all(
      products.map(async (p) => {
        const cur = String(p.currency || "USD").toUpperCase();
        const amt = num(p.amount);
        if (cur === "USD" || amt === 0) return amt;
        try {
          return (await convertToFiat(cur, "USD", amt)).amount;
        } catch {
          return amt;
        }
      }),
    );

    const topSources = [
      ...links.map((l) => ({
        kind: "link" as const,
        id: l.link_id,
        title: (l.title as string) || null,
        link_type: (l.link_type as string) || "standard",
        is_tip_jar: !!l.is_tip_jar,
        paid_count: num(l.paid_count),
        amount: fx(num(l.amount)),
      })),
      ...products.map((p, i) => ({
        kind: "product" as const,
        id: p.product_id,
        title: (p.title as string) || null,
        link_type: "product",
        is_tip_jar: false,
        paid_count: num(p.paid_count),
        amount: fx(productsUsd[i]),
      })),
    ]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    const data = {
      range: { period: range.period, start: range.start.toISOString(), end: range.end.toISOString() },
      currency,
      currency_symbol: getCurrencySymbol(currency),
      pulse: {
        confirming_count: num(funnel.confirming),
        awaiting_count: num(funnel.awaiting),
        last_paid_at: settled.last_paid_at ?? null,
      },
      settled: {
        net: fx(net),
        gross: fx(gross),
        fees: fx(Math.max(0, gross - net)),
        count,
        previous_net: fx(prevNet),
        previous_count: num(settled.prev_count),
        delta_pct: pct(net, prevNet),
        avg_ticket: count > 0 ? fx(net / count) : 0,
      },
      in_flight: { count: num(funnel.confirming), amount: fx(inFlightUsd) },
      forwarded: {
        count: num(settled.fwd_count),
        amount: fx(num(settled.fwd_net)),
        last_at: settled.last_forward_at ?? null,
        by_asset: fwdAssets.map((a) => ({ asset: String(a.asset || ""), count: num(a.count), amount: fx(num(a.amount)) })),
        auto_convert: autoConvert
          ? {
              enabled: autoConvert.company.auto_convert_enabled === true,
              target: autoConvert.company.settlement_currency
                ? `${autoConvert.company.settlement_currency}${autoConvert.company.settlement_chain ? `-${autoConvert.company.settlement_chain}` : ""}`
                : null,
              converted_amount: fx(num(autoConvert.converted.amount)),
              converted_count: num(autoConvert.converted.count),
            }
          : null,
      },
      health: {
        created,
        paid,
        completion_rate: ratio(paid, created),
        previous_completion_rate: ratio(prevPaid, prevCreated),
        median_settle_minutes: median,
        previous_median_settle_minutes: prevMedian,
        underpaid_count: underpaidRange,
        expired_count: expiredRange,
        exception_rate: ratio(underpaidRange + expiredRange, created),
        previous_exception_rate: ratio(prevExceptions, prevCreated),
      },
      attention: {
        underpaid_open: num(funnel.underpaid_open),
        expired_today: { count: num(funnel.expired_today), amount: fx(expiredTodayUsd) },
        confirming_stale: num(funnel.confirming_stale),
        webhook_failures_24h: num(gaps.webhooks.failed),
        webhook_deliveries_24h: num(gaps.webhooks.total),
        webhook_last_failed_at: gaps.webhooks.last_failed_at ?? null,
        webhook_url: (gaps.webhooks.webhook_url as string) || null,
        stale_api_keys: gaps.keys.map((k) => ({
          hint: (k.key_hint as string) || null,
          name: (k.api_name as string) || null,
          age_days: num(k.age_days),
        })),
        coins_without_wallet: gaps.coins.map((c) => String(c.coin)),
        paylinks_expiring_48h: num(gaps.links.expiring),
      },
      top_sources: topSources,
      generated_at: now.toISOString(),
    };

    setRedisItemWithTTL(cacheKey, data, CACHE_TTL).catch(() => {});
    return successResponseHelper(res, 200, "Overview retrieved", data);
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger);
  }
};

export default { getOverview };
