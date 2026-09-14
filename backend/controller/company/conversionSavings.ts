import express from "express";
import jwt from "jsonwebtoken";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { errorResponseHelper, getErrorMessage, successResponseHelper } from "../../helper";
import { companyLogger } from "../../utils/loggers";
import { stablecoinConversionModel } from "../../models";
import { IUserType } from "../../utils/types";

/**
 * Auto-Convert "volatility protection" savings summary (extracted 2026-08-24)
 * =============================================================================
 * Moved out of controller/company/autoConvert.ts so that file drops back under
 * the 500-line new-file budget (R2). Behaviour is byte-for-byte unchanged; the
 * companyController.ts barrel re-imports and re-exports this under the same name.
 *
 * Route covered (see routes/companyRouter.ts):
 *   GET /api/company/conversion-savings/:id
 */

/**
 * Get auto-convert "volatility protection" summary for a company.
 * GET /api/company/conversion-savings/:id
 * Returns the USD value locked into stablecoins this month + all-time (COMPLETED
 * conversions) plus a count of in-progress conversions and a 6-month trend.
 */
const getConversionSavings = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;
  try {
    const companyId = parseInt(id);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const monthWhere = {
      company_id: companyId,
      status: "COMPLETED",
      createdAt: { [Op.gte]: monthStart },
    };
    const allWhere = { company_id: companyId, status: "COMPLETED" };

    const [monthSum, monthCount, allSum, allCount, inProgress] =
      await Promise.all([
        stablecoinConversionModel.sum("merchant_payout_usd", { where: monthWhere }),
        stablecoinConversionModel.count({ where: monthWhere }),
        stablecoinConversionModel.sum("merchant_payout_usd", { where: allWhere }),
        stablecoinConversionModel.count({ where: allWhere }),
        stablecoinConversionModel.count({
          where: {
            company_id: companyId,
            status: { [Op.notIn]: ["COMPLETED", "FAILED"] },
          },
        }),
      ]);

    // Last 6 months of converted USD (oldest → newest) for the trend sparkline.
    const sixMonthsStart = new Date(monthStart);
    sixMonthsStart.setUTCMonth(sixMonthsStart.getUTCMonth() - 5);
    const monthlyRows = (await sequelize.query(
      `SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as ym,
              COALESCE(SUM(merchant_payout_usd), 0) as usd
       FROM tbl_stablecoin_conversion
       WHERE company_id = :companyId AND status = 'COMPLETED' AND "createdAt" >= :start
       GROUP BY 1 ORDER BY 1`,
      {
        replacements: { companyId, start: sixMonthsStart.toISOString() },
        type: QueryTypes.SELECT,
      }
    )) as Array<{ ym: string; usd: string }>;
    const byMonth = new Map(monthlyRows.map((r) => [r.ym, Number(r.usd) || 0]));
    const monthly: number[] = [];
    const cursor = new Date(sixMonthsStart);
    for (let i = 0; i < 6; i++) {
      const ym = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      monthly.push(byMonth.get(ym) || 0);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    successResponseHelper(res, 200, "Conversion savings retrieved", {
      month_converted_usd: Number(monthSum) || 0,
      month_count: Number(monthCount) || 0,
      all_time_converted_usd: Number(allSum) || 0,
      all_time_count: Number(allCount) || 0,
      in_progress_count: Number(inProgress) || 0,
      monthly,
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    companyLogger.error(errorMessage, { user_id: userData.user_id }, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

export { getConversionSavings };
