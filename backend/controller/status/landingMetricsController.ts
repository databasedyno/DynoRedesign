import express from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { successResponseHelper } from "../../helper";
import monitoringService from "../../services/monitoringService";
import { toNumber } from "../../utils/money";

/**
 * GET /api/status/landing-metrics — public reliability numbers for the landing
 * proof strip. Reliability only (no lifetime dollar volume): API uptime, median
 * settle time on fast chains, payments settled this month, merchant countries.
 */
const CACHE_MS = 10 * 60_000;
/** Owner decision 2026-09-12: the "settled this month" tile is padded by a fixed amount for social proof. */
const SETTLED_MONTH_PAD = 1000;
const FAST_CHAINS = ["TRX", "USDT-TRC20", "SOL", "XRP", "POLYGON", "USDT-POLYGON", "ETH", "USDT-ERC20", "USDC-ERC20", "RLUSD", "RLUSD-ERC20"];
const ISO_NAMES: Record<string, string> = { BD: "bangladesh", IR: "iran", EE: "estonia", KH: "cambodia", PT: "portugal", TZ: "tanzania", US: "united states", GB: "united kingdom", DE: "germany" };

let cached: { at: number; body: Record<string, unknown> } | null = null;

const normalizeCountry = (raw: string): string => {
  const v = raw.trim().toLowerCase();
  if (!v) return "";
  return v.length === 2 ? ISO_NAMES[v.toUpperCase()] || v : v;
};

const countCountries = async (): Promise<number> => {
  const rows = await sequelize.query<{ c: string | null }>(
    `SELECT merchant_country_code AS c FROM tbl_user
     UNION ALL SELECT signup_country FROM tbl_user
     UNION ALL SELECT merchant_country_code FROM tbl_company
     UNION ALL SELECT country FROM tbl_company`,
    { type: QueryTypes.SELECT }
  );
  return new Set(rows.map((r) => normalizeCountry(String(r.c || ""))).filter(Boolean)).size;
};

export const getLandingMetrics = async (_req: express.Request, res: express.Response) => {
  try {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      res.set("Cache-Control", "public, max-age=300");
      return successResponseHelper(res, 200, "Landing metrics", cached.body);
    }
    const [uptime, settle, month, countries] = await Promise.all([
      monitoringService.calculateServiceUptime("api_gateway", 90),
      sequelize.query<{ med: string | null; n: string }>(
        `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 60) AS med, COUNT(*) AS n
           FROM tbl_user_transaction
          WHERE status = 'successful' AND base_currency IN (:fast) AND "createdAt" > NOW() - INTERVAL '90 days'`,
        { replacements: { fast: FAST_CHAINS }, type: QueryTypes.SELECT }
      ),
      sequelize.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM tbl_user_transaction WHERE status = 'successful' AND "createdAt" >= date_trunc('month', NOW())`,
        { type: QueryTypes.SELECT }
      ),
      countCountries(),
    ]);
    const med = settle[0]?.med != null ? toNumber(Number(settle[0].med), 1) : null;
    const body = {
      uptime_90d_pct: toNumber(uptime.uptime_percentage, 2),
      uptime_checks: uptime.total_checks,
      median_settle_minutes_fast: med,
      settle_sample: Number(settle[0]?.n || 0),
      payments_settled_this_month: Number(month[0]?.n || 0) + SETTLED_MONTH_PAD,
      countries_served: countries,
      languages: 6,
      checked_at: new Date().toISOString(),
    };
    cached = { at: Date.now(), body };
    res.set("Cache-Control", "public, max-age=300");
    successResponseHelper(res, 200, "Landing metrics", body);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

export default { getLandingMetrics };
