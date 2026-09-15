import express from "express";
import jwt from "jsonwebtoken";
import { handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import { successResponseHelper } from "../helper";
import { apiLogger } from "../utils/loggers";
import { IUserType } from "../utils/types";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { convertToFiat, getCurrencySymbol, getUserDisplayCurrency } from "../utils/currencyUtils";
import { toNumber } from "../utils/money";
import { OverviewScope, coinsWithoutWallet } from "../services/dashboard/overviewQueries";
import { resolveRange } from "./dashboardOverviewController";
import {
  conversionsNeedingAttention,
  payoutByAsset,
  payoutTotals,
  payoutWallets,
  recentForwards,
  stuckForwards,
} from "../services/payouts/payoutQueries";

const CACHE_TTL = 30;
const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};
const mask = (a: unknown) => {
  const s = String(a || "");
  return s.length <= 12 ? s : `${s.slice(0, 6)}…${s.slice(-4)}`;
};

/**
 * GET /api/dashboard/payouts — "did my money reach my wallet?" for a range:
 * forwarded totals + per-asset split, per-wallet activity, the latest forwards
 * (with tx hashes) and anything stuck (failed conversions, unswept settlements).
 * Query: company_id, period (today|7d|30d|90d|1y|all) or startDate&endDate.
 */
const getPayouts = async (req: express.Request, res: express.Response) => {
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
    const cacheKey = `dashboard:payouts:${userId}:${company_id || "all"}:${rangeKey}:${currency}:v2`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Payouts retrieved", cached);
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

    const [totals, assets, wallets, recent, stuck, conversions, missingCoins] = await Promise.all([
      payoutTotals(scope),
      payoutByAsset(scope),
      payoutWallets(scope),
      recentForwards(scope),
      stuckForwards(scope),
      conversionsNeedingAttention(scope),
      coinsWithoutWallet(scope),
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

    const data = {
      range: { period: range.period, start: range.start.toISOString(), end: range.end.toISOString() },
      currency,
      currency_symbol: getCurrencySymbol(currency),
      totals: {
        forwarded_count: num(totals.fwd_count),
        forwarded_amount: fx(num(totals.fwd_amount)),
        last_forward_at: totals.last_forward_at ?? null,
        awaiting_count: num(totals.awaiting_count),
        awaiting_amount: fx(num(totals.awaiting_amount)),
      },
      by_asset: assets.map((a) => ({
        asset: String(a.asset || "").toUpperCase(),
        count: num(a.count),
        amount: fx(num(a.amount)),
        crypto_amount: num(a.crypto_amount),
      })),
      wallets: wallets.map((w) => ({
        wallet_id: w.wallet_id,
        wallet_type: String(w.wallet_type || "").toUpperCase(),
        wallet_name: w.wallet_name || null,
        address: w.wallet_address,
        address_masked: mask(w.wallet_address),
        forwarded_count: num(w.fwd_count),
        forwarded_amount: fx(num(w.fwd_amount)),
        last_forward_at: w.last_forward_at ?? null,
        last_tx_hash: w.last_tx_hash || null,
      })),
      coverage: { missing_coins: missingCoins.map((c) => String(c.coin || "").toUpperCase()).filter(Boolean) },
      recent: recent.map((r) => ({
        id: r.id,
        transaction_id: r.transaction_id,
        asset: String(r.asset || "").toUpperCase(),
        crypto_amount: num(r.crypto_amount),
        amount: fx(num(r.amount)),
        forwarded_at: r.forwarded_at ?? null,
        tx_hash: r.tx_hash || null,
        wallet_type: String(r.wallet_type || "").toUpperCase(),
        wallet_address_masked: mask(r.wallet_address),
        converted: r.converted === true,
        target_amount: r.target_amount == null ? null : num(r.target_amount),
        target_currency: r.target_currency ? String(r.target_currency).toUpperCase() : null,
      })),
      attention: {
        failed_conversions: conversions
          .filter((c) => String(c.status).toUpperCase() === "FAILED")
          .map((c) => ({
            conversion_id: c.conversion_id,
            transaction_id: c.transaction_id,
            payment_id: c.payment_id || null,
            source_currency: String(c.source_currency || "").toUpperCase(),
            source_amount: num(c.source_amount),
            amount: fx(num(c.source_amount_usd)),
            target_currency: String(c.target_currency || "").toUpperCase(),
            settlement_chain: c.settlement_chain || null,
            error_message: c.error_message || null,
            retry_count: num(c.retry_count),
            updated_at: c.updatedAt,
          })),
        in_progress_conversions: conversions
          .filter((c) => String(c.status).toUpperCase() !== "FAILED")
          .map((c) => ({
            conversion_id: c.conversion_id,
            transaction_id: c.transaction_id,
            payment_id: c.payment_id || null,
            status: String(c.status).toUpperCase(),
            source_currency: String(c.source_currency || "").toUpperCase(),
            source_amount: num(c.source_amount),
            amount: fx(num(c.source_amount_usd)),
            target_currency: String(c.target_currency || "").toUpperCase(),
            updated_at: c.updatedAt,
          })),
        stuck_forwards: stuck.map((x) => ({
          id: x.id,
          transaction_id: x.transaction_id,
          asset: String(x.asset || "").toUpperCase(),
          crypto_amount: num(x.crypto_amount),
          amount: fx(num(x.amount)),
          settled_at: x.settled_at,
        })),
      },
      generated_at: now.toISOString(),
    };

    await setRedisItemWithTTL(cacheKey, data, CACHE_TTL);
    return successResponseHelper(res, 200, "Payouts retrieved", data);
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger);
  }
};

export default { getPayouts };
