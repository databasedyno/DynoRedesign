import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { PROCESSED_STATUS_SQL } from "../../utils/processedVolume";
import { GROSS_USD } from "../dashboard/overviewQueries";

export interface LinkPaidStats {
  paid_30d_count: number;
  paid_30d_usd: number;
  paid_total_count: number;
  last_paid_at: string | null;
}

const EMPTY: LinkPaidStats = { paid_30d_count: 0, paid_30d_usd: 0, paid_total_count: 0, last_paid_at: null };

/**
 * Settled payments per payment link (30-day count + gross USD, all-time count, last paid).
 * Contribution children (donations) roll up to their parent link. Settled = PROCESSED_STATUS_SQL,
 * the same definition the dashboard and Receipts use for "collected".
 */
export const paidStatsForLinks = async (linkIds: number[]): Promise<Record<number, LinkPaidStats>> => {
  const out: Record<number, LinkPaidStats> = {};
  if (linkIds.length === 0) return out;
  const rows = (await sequelize.query(
    `SELECT COALESCE(pl.parent_link_id, pl.link_id) AS link_id,
            COUNT(*) FILTER (WHERE ut."updatedAt" >= NOW() - INTERVAL '30 days')::int AS paid_30d_count,
            COALESCE(SUM(${GROSS_USD}) FILTER (WHERE ut."updatedAt" >= NOW() - INTERVAL '30 days'), 0)::float AS paid_30d_usd,
            COUNT(*)::int AS paid_total_count,
            MAX(ut."updatedAt") AS last_paid_at
     FROM tbl_user_transaction ut
     JOIN (
       SELECT DISTINCT ON (transaction_reference) transaction_reference, link_id, parent_link_id
       FROM tbl_payment_link
       WHERE transaction_reference IS NOT NULL AND transaction_reference <> ''
       ORDER BY transaction_reference, link_id DESC
     ) pl ON pl.transaction_reference = ut.transaction_reference
     WHERE COALESCE(pl.parent_link_id, pl.link_id) IN (:ids)
       AND ${PROCESSED_STATUS_SQL}
     GROUP BY 1`,
    { replacements: { ids: linkIds }, type: QueryTypes.SELECT },
  )) as Array<Record<string, unknown>>;
  for (const r of rows) {
    out[Number(r.link_id)] = {
      paid_30d_count: Number(r.paid_30d_count || 0),
      paid_30d_usd: Number(r.paid_30d_usd || 0),
      paid_total_count: Number(r.paid_total_count || 0),
      last_paid_at: r.last_paid_at ? new Date(r.last_paid_at as string).toISOString() : null,
    };
  }
  for (const id of linkIds) if (!out[id]) out[id] = { ...EMPTY };
  return out;
};

export default paidStatsForLinks;
