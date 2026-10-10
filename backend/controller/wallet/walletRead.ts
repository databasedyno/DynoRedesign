import express from "express";
import jwt from "jsonwebtoken";
import {
  IUserType,
} from "../../utils/types";
import sequelize from "../../utils/dbInstance";
import { QueryTypes } from "sequelize";
import {
  errorResponseHelper,
  successResponseHelper,
} from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { parseSortAndPagination } from "../../helper/queryHelpers";
import { formatAmountForDisplay, getCurrencyInfo, convertToMultiple, getUserDisplayCurrency, resolveDisplayFx, fxMeta, getUsdPerUnit } from "../../utils/currencyUtils";
import { PROCESSED_USD_EXPR, PROCESSED_STATUS_SQL } from "../../utils/processedVolume";
import {
  getRedisItem,
  setRedisItemWithTTL,
} from "../../utils/redisInstance";
import { userWalletModel, companyModel } from "../../models";
import { validateCompanyOwnership } from "../../utils/validateCompanyOwnership";
import { walletLogger } from "../../utils/loggers";
import {
  selfTransactionModel,
} from "../../models/userModels";
import { toFixedStr, toNumber } from "../../utils/money";

export const getWallet = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id } = req.query;
    
    // Get company's preferred currency from their API key (production preferred)
    let preferredCurrency = 'USD';
    let fiatConversionRate = 1;
    // RBAC: a granted team member reads the OWNER's wallets for a company, so
    // scope every query below to the company owner's user_id (no-op for owners).
    let effectiveUserId = Number(userData.user_id);
    
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userData.user_id, "view_wallets");
      if (!companyData) return; // 403 already sent
      effectiveUserId = Number((companyData as unknown as { user_id: number }).user_id);
      preferredCurrency = await getUserDisplayCurrency(effectiveUserId, company_id as string);
    }
    
    // Check cache first (120 second TTL) - include currency in cache key
    const cacheKey = `wallet:${effectiveUserId}:${company_id || 'all'}:${preferredCurrency}:v6`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      walletLogger.info(`[Wallet] Cache hit for user ${effectiveUserId}`);
      return successResponseHelper(res, 200, "Wallets retrieved", cached);
    }
    
    // Build where clause with optional company_id filter
    // Only return CRYPTO wallets (this is a crypto-focused project)
    const whereClause: Record<string, unknown> = {
      user_id: effectiveUserId,
      currency_type: 'CRYPTO',
    };
    
    if (company_id) {
      whereClause.company_id = company_id;
    }

    // ── B4: independent reads in parallel ────────────────────────────────
    // walletData, the per-wallet processed-volume rollup and the USD→preferred
    // fiat rate are independent of each other, so fetch them concurrently.
    // (company-name + per-currency-rate lookups below depend on walletData, so
    // they run in a 2nd parallel wave.) No money-math changed — only ordering.
    const USD_FALLBACK_EXPR = PROCESSED_USD_EXPR;
    const volCompanyJoin = company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : '';
    const volCompanyFilter = company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : '';

    const [walletData, processedRows, displayFx] = await Promise.all([
      userWalletModel.findAll({
        attributes: {
          exclude: [
            // "wallet_id", // ✅ MUST RETURN: Required for delete operations
            "privateKey",
            "subscription_id",
            "wallet_account_id",
            "xpub",
            "mnemonic",
          ],
        },
        where: whereClause,
      }),
      sequelize.query(
        `SELECT ut.wallet_id AS wallet_id, COALESCE(SUM(${USD_FALLBACK_EXPR}), 0) AS processed_usd
         FROM tbl_user_transaction ut
         ${volCompanyJoin}
         WHERE ut.user_id = :userId AND ${PROCESSED_STATUS_SQL} AND COALESCE(ut.environment, 'production') <> 'development' ${volCompanyFilter}
         GROUP BY ut.wallet_id`,
        {
          replacements: { userId: effectiveUserId, companyId: company_id },
          type: QueryTypes.SELECT,
        }
      ) as Promise<Array<{ wallet_id: string | number | null; processed_usd: string }>>,
      // USD → brand currency with provenance; falls back to USD (symbol AND
      // numbers) when no live / ≤24h rate exists (audit F1 — the old path kept
      // "EUR" with rate 1 whenever the conversion returned 0 without throwing).
      resolveDisplayFx(preferredCurrency),
    ]);

    preferredCurrency = displayFx.currency;
    fiatConversionRate = displayFx.rate;
    if (displayFx.fallback) {
      walletLogger.warn(`[getWallet] No ${displayFx.requested_currency} rate — showing USD`);
    }

    // Per-wallet processed-volume lookup (from the parallel query above).
    // RECONCILED with the dashboard "Overall volume" (dashboardController
    // volumeQuery): sum the USD value LOCKED IN at settlement time
    // (ut.usd_value, with the same stablecoin base_amount fallback) grouped by
    // wallet, using the SAME user/company scope the dashboard uses.
    const processedByWalletId = new Map<string, number>();
    for (const r of processedRows) {
      if (r.wallet_id !== null && r.wallet_id !== undefined) {
        processedByWalletId.set(String(r.wallet_id), parseFloat(String(r.processed_usd)) || 0);
      }
    }

    // ── 2nd wave: company names + per-currency transfer rates (both need walletData) ──
    const companyIds = [...new Set(walletData.map(w => w.dataValues.company_id))];
    const currencyList = [];
    for (let i = 0; i < walletData.length; i++) {
      currencyList.push(walletData[i].dataValues.wallet_type);
    }

    const [companies, currencyData] = await Promise.all([
      companyModel.findAll({
        where: { company_id: companyIds },
        attributes: ['company_id', 'company_name'],
      }),
      convertToMultiple("USD", currencyList, 1, false).catch(() => {
        walletLogger.warn(`[getWallet] Currency conversion failed for some currencies, using fallback rates`);
        // Fallback: explicit "unavailable" rates (0) — never a fake 1
        return currencyList.map((c: string) => ({ currency: c, amount: 0, transferRate: 0, unavailable: true }));
      }),
    ]);

    // Create company lookup map
    const companyMap = new Map<number, string>();
    for (const company of companies) {
      companyMap.set(company.dataValues.company_id, company.dataValues.company_name);
    }

    // Create a map of currency to transfer rate for lookup
    const rateMap = new Map<string, number>();
    for (const cd of currencyData) {
      rateMap.set(cd.currency, cd.transferRate);
    }

    // Build return data - iterate through walletData directly to preserve all wallets
    // Add company_name to each wallet
    const walletsWithCompanyName = [];
    for (const wallet of walletData) {
      const currentWallet = wallet.dataValues;
      // USD→coin rate; null when unavailable (was coerced to a fake 1).
      const transferRate = rateMap.get(currentWallet.wallet_type) || null;
      // Historical processed volume (USD) for THIS wallet — matches dashboard.
      const amountInUSD = processedByWalletId.get(String(currentWallet.wallet_id)) || 0;
      const amountInBaseCurrency = amountInUSD * fiatConversionRate;
      const amountDisplay = formatAmountForDisplay(amountInBaseCurrency, preferredCurrency);
      walletsWithCompanyName.push({
        ...currentWallet,
        company_name: companyMap.get(currentWallet.company_id) || 'Unknown',
        amount_in_usd: toFixedStr(amountInUSD, 2),
        amount_in_base_currency: toFixedStr(amountInBaseCurrency, 2),
        amount_display: amountDisplay, // Full display object with symbol + code
        base_currency: preferredCurrency,
        transfer_rate: transferRate,
      });
    }

    // Group wallets by company
    const currencyInfo = getCurrencyInfo(preferredCurrency);
    const groupedByCompany: { [key: string]: { company_id: number; company_name: string; base_currency: string; currency_info: typeof currencyInfo; fx: ReturnType<typeof fxMeta>; wallets: Array<Record<string, unknown>> } } = {};
    
    for (const wallet of walletsWithCompanyName) {
      const companyKey = `company_${wallet.company_id}`;
      if (!groupedByCompany[companyKey]) {
        groupedByCompany[companyKey] = {
          company_id: wallet.company_id,
          company_name: wallet.company_name,
          base_currency: wallet.base_currency,
          currency_info: getCurrencyInfo(wallet.base_currency),
          fx: fxMeta(displayFx),
          wallets: [],
        };
      }
      // Remove company_name from individual wallet since it's at group level
      const { company_name, base_currency, ...walletWithoutCompanyName } = wallet;
      groupedByCompany[companyKey].wallets.push(walletWithoutCompanyName);
    }

    // Convert to array format
    const returnData = Object.values(groupedByCompany);

    const totalWallets = walletsWithCompanyName.length;
    const message = totalWallets === 0 
      ? "No wallets found. Add your first wallet address to start receiving payments."
      : `Successfully retrieved ${totalWallets} wallet${totalWallets === 1 ? '' : 's'} from ${returnData.length} compan${returnData.length === 1 ? 'y' : 'ies'}`;
    
    // Cache the result (120s TTL — rates update in background cache every 60s).
    // B3: single SET EX round-trip, fire-and-forget so it never blocks the response.
    if (!displayFx.fallback) setRedisItemWithTTL(cacheKey, returnData, 120).catch(() => {});
    
    successResponseHelper(res, 200, message, returnData);
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

export const getWalletTransactions = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const walletId = Number(req.params.id);
    if (!Number.isInteger(walletId) || walletId <= 0) {
      return errorResponseHelper(res, 400, "Invalid wallet id");
    }
    const { rowsPerPage, page, filters } = req.body;
    const ALLOWED_SORT_COLUMNS: Record<string, string> = {
      createdAt: '"createdAt"', updatedAt: '"updatedAt"', base_amount: 'base_amount',
      status: 'status', id: 'id', transaction_reference: 'transaction_reference',
    };
    const sort = parseSortAndPagination(ALLOWED_SORT_COLUMNS, filters, rowsPerPage, page);
    // tbl_user_wallet's key is wallet_id (the old `id` lookup 500'd on every call).
    const walletData = await userWalletModel.findOne({ where: { wallet_id: walletId } });
    if (!walletData) return errorResponseHelper(res, 404, "Wallet not found");

    const { wallet_id, company_id, user_id: walletOwnerId } = walletData.dataValues as {
      wallet_id: number; company_id: number | null; user_id: number;
    };

    // Only the wallet owner, or a team member with view_wallets on its brand.
    if (Number(walletOwnerId) !== Number(userData.user_id)) {
      if (!company_id) return errorResponseHelper(res, 404, "Wallet not found");
      const companyData = await validateCompanyOwnership(res, company_id, userData.user_id, "view_wallets");
      if (!companyData) return; // 403 already sent
      if (Number(companyData.user_id) !== Number(walletOwnerId)) {
        return errorResponseHelper(res, 404, "Wallet not found");
      }
    }
    
    // Get company's preferred currency
    let preferredCurrency = 'USD';
    let conversionRate = 1;
    
    if (company_id) {
      preferredCurrency = await getUserDisplayCurrency(Number(walletOwnerId), company_id);
    }
    
    // USD → brand currency; no rate → USD for symbol AND numbers.
    const txFx = await resolveDisplayFx(preferredCurrency);
    preferredCurrency = txFx.currency;
    conversionRate = txFx.rate;
    
    const selfData = await selfTransactionModel.findAll({
      attributes: { exclude: ["wallet_id", "transaction_id"] },
      where: {
        wallet_id,
      },
      ...(sort.column && sort.sortType && { order: [[sort.column, sort.sortType]] }),
      ...(sort.offset !== undefined && sort.limit && { offset: sort.offset, limit: sort.limit }),
    });

    let query = `
      select ut.*, ${PROCESSED_USD_EXPR} as usd_amount, c.customer_name,c.email,cm.company_name,cm.company_id from tbl_user_transaction ut 
      join tbl_customer c on c.customer_id=ut.customer_id
      join tbl_company cm on cm.company_id=c.company_id where ut.wallet_id=:wallet_id`;
    query += ` order by ${sort.safeColumn} ${sort.safeSortType}`;
    if (sort.offset !== undefined && sort.limit) query += ` offset :offset limit :limit`;

    const tempData = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements: { wallet_id, offset: sort.offset, limit: sort.limit },
    });

    // Display value = USD locked in at settlement × display rate (base_amount may
    // be a coin quantity, so multiplying it by a USD rate was wrong). Unsettled
    // rows have no locked USD yet → estimate at the current unit price; if no
    // price is known the amount is null, never a fake 0.
    const unitUsd = new Map<string, number>();
    for (const cur of new Set(tempData.filter((x: Record<string, unknown>) => !(Number(x.usd_amount) > 0)).map((x: Record<string, unknown>) => String(x.base_currency || "")))) {
      if (cur) unitUsd.set(cur, await getUsdPerUnit(cur));
    }
    const customer_data = tempData.map((x: Record<string, unknown>) => {
      const { wallet_id, transaction_id, usd_amount, ...rest } = x;
      const locked = Number(usd_amount) || 0;
      const unit = unitUsd.get(String(rest.base_currency || "")) || 0;
      const estimated = !(Number(rest.usd_value) > 0);
      const usd = locked > 0 ? locked : unit > 0 ? Number(rest.base_amount || 0) * unit : null;
      return {
        ...rest,
        amount_in_usd: usd === null ? null : toNumber(usd, 2),
        display_amount: usd === null ? null : toNumber(usd * conversionRate, 2),
        display_currency: preferredCurrency,
        usd_estimated: estimated,
      };
    });

    const totalTransactions = (customer_data?.length || 0) + (selfData?.length || 0);
    const message = totalTransactions === 0
      ? "No transaction history found"
      : `Successfully retrieved ${totalTransactions} transaction${totalTransactions === 1 ? '' : 's'}`;
    
    successResponseHelper(res, 200, message, {
      customers_transactions: customer_data,
      self_transactions: selfData,
      currency: preferredCurrency,
      fx: fxMeta(txFx),
    });
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};


