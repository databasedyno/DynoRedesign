/**
 * processedVolume.ts — single source of truth for what counts as "processed
 * volume" across the app, so the dashboard "Overall volume" and the /wallet
 * "Total processed" total ALWAYS reconcile exactly (for every merchant).
 *
 * Two SQL fragments, both assuming the transaction table is aliased `ut`:
 *
 *  PROCESSED_USD_EXPR  — the USD value of a transaction, using the value LOCKED
 *                        IN at settlement time (ut.usd_value) with a fallback to
 *                        base_amount for USD-pegged stablecoins.
 *
 *  PROCESSED_STATUS_SQL — restricts to SETTLED transactions only. Previously the
 *                        dashboard all-time total had NO status filter (it
 *                        counted pending/unsettled payments — often with a NULL
 *                        wallet_id — which the wallet page could not attribute),
 *                        while the dashboard's own today/yesterday figures already
 *                        filtered to these statuses. Standardizing on "settled"
 *                        makes every surface agree AND is the correct definition
 *                        of processed volume (pending != processed).
 */

export const PROCESSED_STATUSES = ["successful", "done", "completed"] as const;

const STATUS_LIST_SQL = PROCESSED_STATUSES.map((s) => `'${s}'`).join(", ");

/**
 * SQL `status IN (...)` fragment for the SETTLED statuses, for any table alias.
 * Pass "" for an unaliased column (e.g. `status IN (...)`).
 */
export const processedStatusSql = (alias = "ut"): string =>
  `${alias ? alias + "." : ""}status IN (${STATUS_LIST_SQL})`;

// Back-compat: default `ut`-aliased fragment used by the dashboard/wallet queries.
export const PROCESSED_STATUS_SQL = processedStatusSql("ut");

export const PROCESSED_USD_EXPR = `COALESCE(NULLIF(ut.usd_value, 0), CASE WHEN UPPER(ut.base_currency) IN ('USD','USDT','USDC','USDT-TRC20','USDT-ERC20','USDC-ERC20','BUSD','DAI','USDT_TRC20','USDT_ERC20','USDC_ERC20','USDT-POLYGON') THEN ut.base_amount ELSE 0 END)`;
