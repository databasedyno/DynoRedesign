/**
 * Shared query helpers for sort, pagination, and column whitelisting.
 * Used by walletController (getWalletTransactions, exportTransactions, etc.)
 */

export interface SortPaginationResult {
  column: string;
  sortType: string;
  safeColumn: string;
  safeSortType: 'ASC' | 'DESC';
  offset?: number;
  limit?: number;
}

/**
 * Parse sort column, direction, offset, and limit from request filters.
 * Whitelists columns to prevent SQL injection via ORDER BY.
 *
 * @param allowedColumns - Map of user-facing column name → safe SQL expression
 * @param filters - The filters object from the request body (column, asc)
 * @param rowsPerPage - Rows per page for pagination
 * @param page - Current page (1-indexed)
 * @param defaultColumn - Default column key if filters are absent (default: 'createdAt')
 * @param defaultDesc - Whether to sort DESC by default (default: true)
 */
export function parseSortAndPagination(
  allowedColumns: Record<string, string>,
  filters?: { column?: string; asc?: boolean },
  rowsPerPage?: number,
  page?: number,
  defaultColumn: string = 'createdAt',
  defaultDesc: boolean = true,
): SortPaginationResult {
  const column = filters?.column ?? defaultColumn;
  const sortType = filters ? (!filters.asc ? 'DESC' : 'ASC') : (defaultDesc ? 'DESC' : 'ASC');
  const safeColumn = (column && allowedColumns[column]) ? allowedColumns[column] : allowedColumns[defaultColumn] ?? Object.values(allowedColumns)[0];
  const safeSortType: 'ASC' | 'DESC' = sortType === 'ASC' ? 'ASC' : 'DESC';

  const result: SortPaginationResult = { column, sortType, safeColumn, safeSortType };

  if (rowsPerPage && page) {
    result.offset = (page - 1) * rowsPerPage;
    result.limit = rowsPerPage;
  }

  return result;
}
