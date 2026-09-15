import express from "express";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import { successResponseHelper } from "../helper";
import { apiLogger } from "../utils/loggers";
import { IUserType } from "../utils/types";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { convertToFiat, getCurrencySymbol, getUserDisplayCurrency, getUsdToFiatRate } from "../utils/currencyUtils";
import { toNumber } from "../utils/money";
import { PROCESSED_STATUS_SQL } from "../utils/processedVolume";
import { GROSS_USD, NET_USD, companyScopeSql, fromClause, OverviewScope } from "../services/dashboard/overviewQueries";

const CACHE_TTL = 60;
const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

const parseDate = (v: unknown, fallback: Date): Date => {
  if (!v) return fallback;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? fallback : d;
};

/**
 * GET /api/invoices/period-summary — the Receipts & Tax header numbers for a period:
 * collected (gross settled payments), Dynopay fees deducted, tax collected from buyers
 * (paid orders) and receipt counts, all in the merchant's display currency.
 * Query: company_id, start_date, end_date (ISO; omit both for all time).
 */
const getPeriodSummary = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id, start_date, end_date } = req.query;
    let userId = userData.user_id;
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
      userId = Number((companyData as unknown as { user_id: number }).user_id);
    }
    const now = new Date();
    const start = parseDate(start_date, new Date(2015, 0, 1));
    const end = parseDate(end_date, now);
    const currency = await getUserDisplayCurrency(userId, (company_id as string) || null);
    const cacheKey = `invoices:period:${userId}:${company_id || "all"}:${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}:${currency}:v1`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Period summary retrieved", cached);
    }

    const scope: OverviewScope = {
      userId,
      companyId: (company_id as string) || null,
      start,
      end,
      prevStart: start,
      startOfToday: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    };
    const replacements = { userId, companyId: scope.companyId, start, end };
    const q = <T = Record<string, unknown>>(sql: string) =>
      sequelize.query(sql, { replacements, type: QueryTypes.SELECT }) as Promise<T[]>;

    const [payments, orderTax, receipts] = await Promise.all([
      q(`SELECT COUNT(*) AS count,
                COALESCE(SUM(${GROSS_USD}), 0) AS gross,
                COALESCE(SUM(${NET_USD}), 0) AS net
         ${fromClause(scope)}
         AND ${PROCESSED_STATUS_SQL}
         AND ut."updatedAt" >= :start AND ut."updatedAt" <= :end`),
      q(`SELECT UPPER(COALESCE(NULLIF(po.currency, ''), 'USD')) AS currency,
                COALESCE(SUM(po.tax_cents), 0) / 100.0 AS tax,
                COUNT(*) AS orders
         FROM tbl_product_order po
         WHERE po.merchant_user_id = :userId
           ${scope.companyId ? "AND po.company_id = :companyId" : ""}
           AND LOWER(COALESCE(po.payment_status, '')) = 'paid'
           AND COALESCE(po.reverse_charge, false) = false
           AND COALESCE(po.paid_at, po."createdAt") >= :start AND COALESCE(po.paid_at, po."createdAt") <= :end
         GROUP BY 1`),
      q(`SELECT COUNT(*) AS count, COALESCE(SUM(inv.vat_amount), 0) AS vat
         FROM tbl_invoice inv
         WHERE ${companyScopeSql(scope, "inv.company_id")}
           AND inv.invoice_date >= :start AND inv.invoice_date <= :end`),
    ]);

    const rate = currency === "USD" ? 1 : (await getUsdToFiatRate(currency)) || 1;
    const fx = (usd: number) => toNumber(usd * rate, 2);

    let taxCollected = 0;
    let taxOrders = 0;
    for (const row of orderTax) {
      const cur = String(row.currency || "USD").toUpperCase();
      const amt = num(row.tax);
      taxOrders += num(row.orders);
      if (amt <= 0) continue;
      if (cur === currency) taxCollected += amt;
      else if (cur === "USD") taxCollected += amt * rate;
      else {
        try {
          taxCollected += (await convertToFiat(cur, currency, amt)).amount || 0;
        } catch {
          taxCollected += amt;
        }
      }
    }

    const gross = num(payments[0]?.gross);
    const net = num(payments[0]?.net);
    const data = {
      range: { start: start.toISOString(), end: end.toISOString() },
      currency,
      currency_symbol: getCurrencySymbol(currency),
      collected: fx(gross),
      net: fx(net),
      fees: fx(Math.max(0, gross - net)),
      payments_count: num(payments[0]?.count),
      tax_collected: toNumber(taxCollected, 2),
      taxed_orders: taxOrders,
      receipts_count: num(receipts[0]?.count),
      receipts_vat: fx(num(receipts[0]?.vat)),
      generated_at: now.toISOString(),
    };
    await setRedisItemWithTTL(cacheKey, data, CACHE_TTL);
    return successResponseHelper(res, 200, "Period summary retrieved", data);
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger);
  }
};

export default { getPeriodSummary };
