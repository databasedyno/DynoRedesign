/**
 * Admin — AI crawler analytics.
 * GET /api/admin/bot-analytics  (adminAuthMiddleware)
 *
 * Aggregates tbl_bot_hit so ops can see which AI search/answer engines
 * (ChatGPT, Perplexity, Claude, Common Crawl, Apple Intelligence…) are
 * crawling the marketing site, how often, and which pages they favour.
 */
import express from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { successResponseHelper } from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { adminLogger } from "../../utils/loggers";

const getReport = async (_req: express.Request, res: express.Response) => {
  try {
    const [counts] = (await sequelize.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS "last24h",
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int   AS "last7d",
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int  AS "last30d",
         COUNT(DISTINCT bot) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS "bots"
       FROM "tbl_bot_hit"`,
      { type: QueryTypes.SELECT }
    )) as Array<{ last24h: number; last7d: number; last30d: number; bots: number }>;

    const byBot = (await sequelize.query(
      `SELECT bot, COUNT(*)::int AS hits, MAX(created_at) AS last_seen
         FROM "tbl_bot_hit"
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY bot
        ORDER BY hits DESC`,
      { type: QueryTypes.SELECT }
    )) as Array<{ bot: string; hits: number; last_seen: string }>;

    const daily = (await sequelize.query(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS hits
         FROM "tbl_bot_hit"
        WHERE created_at > NOW() - INTERVAL '14 days'
        GROUP BY day
        ORDER BY day ASC`,
      { type: QueryTypes.SELECT }
    )) as Array<{ day: string; hits: number }>;

    const topPaths = (await sequelize.query(
      `SELECT path, COUNT(*)::int AS hits
         FROM "tbl_bot_hit"
        WHERE created_at > NOW() - INTERVAL '30 days' AND path IS NOT NULL
        GROUP BY path
        ORDER BY hits DESC
        LIMIT 15`,
      { type: QueryTypes.SELECT }
    )) as Array<{ path: string; hits: number }>;

    const recent = (await sequelize.query(
      `SELECT bot, path, host, created_at
         FROM "tbl_bot_hit"
        ORDER BY created_at DESC
        LIMIT 40`,
      { type: QueryTypes.SELECT }
    )) as Array<{ bot: string; path: string | null; host: string | null; created_at: string }>;

    successResponseHelper(res, 200, "Bot analytics", {
      summary: counts || { last24h: 0, last7d: 0, last30d: 0, bots: 0 },
      byBot,
      daily,
      topPaths,
      recent,
    });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

export default { getReport };
