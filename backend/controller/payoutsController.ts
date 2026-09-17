import express from "express";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import { handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import { successResponseHelper, errorResponseHelper } from "../helper";
import userTransactionModel from "../models/userModels/userTransactionModel";
import { isOpsEmail } from "../utils/config";
import { apiLogger } from "../utils/loggers";
import { IUserType } from "../utils/types";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { getRedisItem, setRedisItemWithTTL, invalidateCache } from "../utils/redisInstance";
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

const callerEmail = (res: express.Response): string | undefined =>
  (res.locals.authUser as { email?: string | null } | undefined)?.email || undefined;

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
    // viewer_is_ops is per-CALLER (not the resolved company owner), so it is
    // attached to the response AFTER the shared cache read — never cached.
    const viewerIsOps = isOpsEmail(callerEmail(res));
    const cacheKey = `dashboard:payouts:${userId}:${company_id || "all"}:${rangeKey}:${currency}:v4`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Payouts retrieved", { ...cached, viewer_is_ops: viewerIsOps });
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
        // Failed conversions are admin-only now (ops settles by hand) — the query
        // excludes FAILED, so this stays empty. Kept in the response shape so the
        // frontend (PayoutAttention) never reads undefined.
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
    return successResponseHelper(res, 200, "Payouts retrieved", { ...data, viewer_is_ops: viewerIsOps });
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * POST /api/dashboard/payouts/:transactionId/acknowledge — OPS-ONLY.
 * Marks a stuck payout as manually resolved (ops has settled the funds by hand),
 * which removes it from the merchant "Needs attention" feed and records who/when.
 * Does NOT move any money — it is an acknowledgement flag on the transaction.
 * Body: { company_id, note? }.
 */
const acknowledgeStuckPayout = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    if (!isOpsEmail(callerEmail(res))) {
      return errorResponseHelper(res, 403, "Only an operator can resolve a stuck payout.");
    }
    const transactionId = parseInt(String(req.params.transactionId), 10);
    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      return errorResponseHelper(res, 400, "Invalid transaction id.");
    }
    const company_id = req.body?.company_id;
    let userId = userData.user_id;
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, String(company_id), userId);
      if (!companyData) return; // helper already responded
      userId = Number((companyData as unknown as { user_id: number }).user_id);
    }
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : null;

    const tx = await userTransactionModel.findOne({
      where: { transaction_id: transactionId },
      attributes: ["transaction_id", "company_id", "user_id"],
    });
    if (!tx) return errorResponseHelper(res, 404, "Transaction not found.");
    const txCompany = (tx.dataValues.company_id ?? null) as number | null;
    const txUser = Number(tx.dataValues.user_id);
    const ownsByCompany = company_id != null && txCompany != null && Number(txCompany) === Number(company_id);
    const ownsByUser = txCompany == null && txUser === Number(userId);
    if (!ownsByCompany && !ownsByUser) {
      return errorResponseHelper(res, 403, "This payout does not belong to the selected brand.");
    }

    // Raw UPDATE of ONLY the three ack columns — deterministically leaves the
    // row's `updatedAt` untouched (it is the payment's settlement timestamp,
    // used across the payout queries for settled_at / the stuck window).
    await userTransactionModel.sequelize!.query(
      `UPDATE "tbl_user_transaction"
         SET "attention_resolved_at" = NOW(),
             "attention_resolved_by" = :by,
             "attention_resolved_note" = :note
       WHERE transaction_id = :tid`,
      {
        replacements: { by: (callerEmail(res) || "ops").slice(0, 200), note, tid: transactionId },
        type: QueryTypes.UPDATE,
      },
    );

    // Best-effort cache bust so the item disappears immediately on the next fetch
    // (across the common preset ranges for this owner + brand + display currency).
    try {
      const currency = company_id ? await getUserDisplayCurrency(userId, String(company_id)) : "USD";
      const scopeKey = company_id || "all";
      await Promise.all(
        ["today", "7d", "30d", "90d", "1y", "all"].map((p) =>
          invalidateCache(`dashboard:payouts:${userId}:${scopeKey}:${p}:${currency}:v4`),
        ),
      );
    } catch {
      // cache bust is best-effort — the 30s TTL clears it regardless.
    }

    return successResponseHelper(res, 200, "Payout marked as resolved", { transaction_id: transactionId });
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger);
  }
};

export default { getPayouts, acknowledgeStuckPayout };
