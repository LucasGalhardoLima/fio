interface PaginatedResult<T> {
  data: T[]
  has_more: boolean
  next_cursor: string | null
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export function normalizePaginationLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_LIMIT
  }
  if (limit < 1) {
    return 1
  }
  if (limit > MAX_LIMIT) {
    return MAX_LIMIT
  }
  return limit
}

/**
 * Cursor-based pagination helper.
 *
 * Takes an already-fetched array of rows (fetched with limit+1) and splits
 * them into a paginated result. Callers should query with `id > starting_after`
 * and `LIMIT effectiveLimit + 1`, then pass the results here.
 *
 * @param rows - Array of rows fetched with limit+1
 * @param effectiveLimit - The actual page size (not limit+1)
 */
export function paginateResults<T extends { id: string }>(
  rows: T[],
  effectiveLimit: number,
): PaginatedResult<T> {
  const hasMore = rows.length > effectiveLimit
  const data = hasMore ? rows.slice(0, effectiveLimit) : rows

  const lastItem = data[data.length - 1]
  const nextCursor = hasMore && lastItem !== undefined ? lastItem.id : null

  return {
    data,
    has_more: hasMore,
    next_cursor: nextCursor,
  }
}
