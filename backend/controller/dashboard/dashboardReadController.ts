// Dashboard read handlers extracted from dashboardController.ts (strangler refactor,
// behaviour-neutral). These three endpoints are self-contained — they use only shared
// utils/models, no local dashboard helpers — so they moved verbatim.

import express from "express";
import { apiLogger } from "../../utils/loggers";
import { handleControllerErrorReturn } from "../../helper/controllerErrorHandler";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../../helper";
import { IUserType } from "../../utils/types";
import { userTransactionModel, userWalletModel, companyModel } from "../../models";
import { validateCompanyOwnership } from "../../utils/validateCompanyOwnership";
import sequelize from "../../utils/dbInstance";
import { getRedisItem, setRedisItem, setRedisTTL } from "../../utils/redisInstance";
import { getCurrencySymbol, getCurrencyInfo, formatAmountForDisplay, COMPANY_CURRENCY_QUERY, convertToFiat, convertToUSD, getUserDisplayCurrency } from "../../utils/currencyUtils";
import { resolveTransactionSource } from "../../utils/transactionSource";
import { PROCESSED_USD_EXPR, PROCESSED_STATUS_SQL } from "../../utils/processedVolume";
import { deriveTxDisplayStatus, isPaymentDetected, FRESH_PENDING_SQL } from "../../utils/transactionDisplayStatus";
import { getVolumeTiers } from "../../utils/volumeTierUtils";

/**
 * Get recent transactions for dashboard
 * GET /api/dashboard/recent-transactions
 */
const getRecentTransactions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { limit = 10, company_id } = req.query;
    const userId = userData.user_id;

    // Validate company ownership if company_id is provided. Recent transactions
    // MUST be scoped to the selected company for data isolation — matching
    // getDashboard / getChartData / getFeeTiers. (Bug: previously this endpoint
    // filtered ONLY by user_id, so the Recent Transactions widget leaked
    // transactions across every company owned by the same user.)
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
    }

    // Check Redis cache first (60s TTL — prevent duplicate calls on page load)
    const cacheKey = `recentTx:${userId}:${company_id || 'all'}:${limit}`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Recent transactions retrieved successfully", cached);
    }

    const recentTransactions = await sequelize.query(
      `SELECT 
        ut.transaction_id,
        ut.id,
        ut.base_amount,
        ut.base_currency,
        ut.crypto_currency,
        ut.status,
        ut.transaction_type,
        ut.incoming_tx_hash,
        ut.confirmations,
        ut.usd_value,
        ut.transaction_reference,
        ut."createdAt",
        uw.wallet_type,
        c.customer_name,
        c.email as customer_email,
        -- Source metadata — resolved in JS via resolveTransactionSource() so the
        -- dashboard classifies a transaction IDENTICALLY to the /transactions
        -- page (payment_link / api / tip / product / contribution / direct)
        -- instead of the old email-pattern CASE that used a different taxonomy.
        pl.link_id           as source_link_id,
        pl.link_type         as source_link_type,
        pl.title             as source_link_title,
        pl.parent_link_id    as source_parent_link_id,
        pl.is_tip_jar        as source_is_tip_jar,
        parent_pl.title      as source_parent_title,
        parent_pl.is_tip_jar as source_parent_is_tip_jar,
        po.order_id          as source_order_id,
        po.public_ref        as source_order_ref
       FROM tbl_user_transaction ut
       LEFT JOIN tbl_user_wallet uw ON ut.wallet_id = uw.wallet_id
       LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id
       LEFT JOIN (
         SELECT DISTINCT ON (transaction_reference)
           transaction_reference, link_id, link_type, title, parent_link_id, is_tip_jar
         FROM tbl_payment_link
         WHERE transaction_reference IS NOT NULL AND transaction_reference <> ''
         ORDER BY transaction_reference, link_id DESC
       ) pl ON pl.transaction_reference = ut.transaction_reference
         AND ut.transaction_reference IS NOT NULL AND ut.transaction_reference <> ''
       LEFT JOIN tbl_payment_link parent_pl ON parent_pl.link_id = pl.parent_link_id
       LEFT JOIN tbl_product_order po ON po.payment_link_id = pl.link_id
       WHERE ut.user_id = :userId
         ${company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : ''}
       ORDER BY ut."createdAt" DESC
       LIMIT :limit`,
      {
        replacements: { userId, limit: parseInt(limit as string), companyId: company_id },
        type: QueryTypes.SELECT,
      }
    );

    // Attach the canonical source object (same shape the /transactions page
    // gets) and strip the raw source_* helper columns from the payload.
    const recentTxMapped = (recentTransactions as Array<Record<string, unknown>>).map((row) => {
      const source = resolveTransactionSource({
        source_order_id: row.source_order_id as string | number | null,
        source_order_ref: row.source_order_ref as string | null,
        source_link_id: row.source_link_id as string | number | null,
        source_link_type: row.source_link_type as string | null,
        source_link_title: row.source_link_title as string | null,
        source_parent_link_id: row.source_parent_link_id as string | number | null,
        source_parent_title: row.source_parent_title as string | null,
        source_parent_is_tip_jar: row.source_parent_is_tip_jar as boolean | number | null,
        customer_email: row.customer_email as string | null,
      });
      const {
        source_link_id, source_link_type, source_link_title,
        source_parent_link_id, source_is_tip_jar, source_parent_title,
        source_parent_is_tip_jar, source_order_id, source_order_ref,
        ...clean
      } = row;
      return {
        ...clean,
        // Stale 'pending' → 'unpaid'; fresh pending with nothing on-chain yet
        // → 'awaiting_payment'; a confirming payment stays 'pending'.
        status: deriveTxDisplayStatus(clean.status, clean.createdAt, isPaymentDetected(clean as any)),
        source,
      };
    });

    const recentTxResponse = {
      transactions: recentTxMapped,
      count: recentTxMapped.length,
    };

    // Cache for 60 seconds
    await setRedisItem(cacheKey, recentTxResponse);
    await setRedisTTL(cacheKey, 60);

    return successResponseHelper(res, 200, "Recent transactions retrieved successfully", recentTxResponse);

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Get all conversion records for the merchant (with optional status filter)
 * GET /api/dashboard/conversions
 * Query params: status (optional), company_id (required for scoping), limit (default 20)
 */
const getConversions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { status, company_id, limit = 20 } = req.query;
    const userId = userData.user_id;

    // Validate company ownership when company_id is provided
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
    }

    let whereClause = `sc.user_id = :userId`;
    const replacements: Record<string, unknown> = { userId, limit: parseInt(limit as string) };

    if (company_id) {
      whereClause += ` AND sc.company_id = :companyId`;
      replacements.companyId = company_id;
    }
    if (status) {
      whereClause += ` AND sc.status = :status`;
      replacements.status = status;
    }

    const conversions = await sequelize.query(
      `SELECT 
        sc.conversion_id,
        sc.transaction_id,
        sc.company_id,
        co.company_name,
        sc.source_currency,
        sc.source_amount,
        sc.source_amount_usd,
        sc.target_currency,
        sc.target_amount,
        sc.settlement_wallet_address,
        sc.settlement_chain,
        sc.deposit_tx_hash,
        sc.binance_order_id,
        sc.conversion_rate,
        sc.conversion_fee,
        sc.sweep_fee_usd,
        sc.trade_fee_usd,
        sc.withdrawal_fee,
        sc.withdrawal_tx_hash,
        sc.withdrawal_id,
        sc.merchant_payout_usd,
        sc.locked_merchant_usd,
        sc.actual_sale_usd,
        sc.platform_surplus,
        sc.price_movement_pct,
        sc.sell_method,
        sc.status,
        sc.error_message,
        sc.retry_count,
        sc."createdAt",
        sc.deposit_confirmed_at,
        sc.converted_at,
        sc.withdrawn_at,
        sc.completed_at
       FROM tbl_stablecoin_conversion sc
       LEFT JOIN tbl_company co ON sc.company_id = co.company_id
       WHERE ${whereClause}
       ORDER BY sc."createdAt" DESC
       LIMIT :limit`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    // Count by status for summary
    const statusCounts = await sequelize.query(
      `SELECT sc.status, COUNT(*)::int as count
       FROM tbl_stablecoin_conversion sc
       WHERE sc.user_id = :userId ${company_id ? 'AND sc.company_id = :companyId' : ''}
       GROUP BY sc.status`,
      {
        replacements: { userId, companyId: company_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s: Record<string, unknown>) => {
      statusMap[s.status as string] = s.count as number;
    });

    // Map each conversion to include its pipeline stage
    const DB_STATUS_TO_PIPELINE: Record<string, string> = {
      PENDING_DEPOSIT: "SWEEPING",
      DEPOSIT_CREDITED: "DEPOSITING",
      CONVERTING: "CONVERTING",
      CONVERTED: "CONVERTING",
      WITHDRAWING: "WITHDRAWING",
      COMPLETED: "COMPLETE",
      FAILED: "FAILED",
    };

    const enrichedConversions = conversions.map((c: Record<string, unknown>) => ({
      ...c,
      pipeline_stage: DB_STATUS_TO_PIPELINE[c.status as string] || c.status,
    }));

    return successResponseHelper(res, 200, "Conversions retrieved successfully", {
      conversions: enrichedConversions,
      count: enrichedConversions.length,
      status_summary: statusMap,
      pipeline_stages: ["DETECTED", "SWEEPING", "DEPOSITING", "CONVERTING", "WITHDRAWING", "COMPLETE"],
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Get single conversion with detailed timeline
 * GET /api/dashboard/conversions/:id
 * Query params: company_id (optional, for ownership validation)
 */
const getConversionDetail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { id } = req.params;
    const { company_id } = req.query;
    const userId = userData.user_id;

    // Validate company ownership when company_id is provided
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
    }

    let detailWhere = `sc.conversion_id = :id AND sc.user_id = :userId`;
    const detailReplacements: Record<string, unknown> = { id, userId };
    if (company_id) {
      detailWhere += ` AND sc.company_id = :companyId`;
      detailReplacements.companyId = company_id;
    }

    const conversions = await sequelize.query(
      `SELECT sc.*, co.company_name
       FROM tbl_stablecoin_conversion sc
       LEFT JOIN tbl_company co ON sc.company_id = co.company_id
       WHERE ${detailWhere}`,
      {
        replacements: detailReplacements,
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (conversions.length === 0) {
      return errorResponseHelper(res, 404, "Conversion not found");
    }

    const conversion = conversions[0];

    // Build timeline: Detected → Sweeping → Depositing → Converting → Withdrawing → Complete
    // Maps DB statuses to user-facing pipeline stages
    const STAGES = [
      { key: "DETECTED",    label: "Detected",    dbStatus: "PENDING_DEPOSIT",  field: "createdAt" },
      { key: "SWEEPING",    label: "Sweeping",    dbStatus: "PENDING_DEPOSIT",  field: "createdAt" },
      { key: "DEPOSITING",  label: "Depositing",  dbStatus: "DEPOSIT_CREDITED", field: "deposit_confirmed_at" },
      { key: "CONVERTING",  label: "Converting",  dbStatus: "CONVERTED",        field: "converted_at" },
      { key: "WITHDRAWING", label: "Withdrawing", dbStatus: "WITHDRAWING",      field: "withdrawn_at" },
      { key: "COMPLETE",    label: "Complete",     dbStatus: "COMPLETED",        field: "completed_at" },
    ];

    // Map DB status to pipeline index
    const DB_STATUS_TO_STAGE: Record<string, number> = {
      PENDING_DEPOSIT:  1, // Sweeping (detected + sweep already happened to create record)
      DEPOSIT_CREDITED: 2, // Depositing confirmed, ready for conversion
      CONVERTING:       3, // Converting on exchange
      CONVERTED:        3, // Conversion done, same stage
      WITHDRAWING:      4, // Withdrawing to merchant
      COMPLETED:        5, // Complete
    };
    const currentIdx = DB_STATUS_TO_STAGE[conversion.status as string] ?? -1;

    const timeline = STAGES.map((stage, idx) => ({
      stage: stage.key,
      label: stage.label,
      timestamp: conversion[stage.field] || null,
      completed: idx <= currentIdx && conversion.status !== "FAILED",
      active: idx === currentIdx && conversion.status !== "FAILED",
    }));

    // Fee breakdown
    const feeBreakdown = {
      platform_fee_usd: parseFloat(String(conversion.conversion_fee || "0")),
      sweep_gas_fee_usd: parseFloat(String(conversion.sweep_fee_usd || "0")),
      trade_fee_usd: parseFloat(String(conversion.trade_fee_usd || "0")),
      withdrawal_fee_usd: parseFloat(String(conversion.withdrawal_fee || "0")),
      gross_sale_usd: parseFloat(String(conversion.actual_sale_usd || "0")),
      net_payout_usd: parseFloat(String(conversion.merchant_payout_usd || "0")),
    };

    return successResponseHelper(res, 200, "Conversion detail retrieved", {
      conversion,
      timeline,
      fee_breakdown: feeBreakdown,
      is_failed: conversion.status === "FAILED",
      is_complete: conversion.status === "COMPLETED",
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

export { getRecentTransactions, getConversions, getConversionDetail };
