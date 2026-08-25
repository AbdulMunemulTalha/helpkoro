import { encodeCursor, type Page } from '@helpkoro/contracts';

/**
 * Build a cursor page from `limit + 1` fetched rows (keyset pagination).
 *
 * Callers over-fetch by one row: if the extra row is present there is a next
 * page, and the cursor is derived from the last row *of the returned page* via
 * `keyOf`. UUIDv7 ids are time-ordered, so an id keyset is a stable, unique
 * sort key — no offset drift when rows are inserted between requests.
 */
export function pageOf<Row, View>(
  rows: Row[],
  limit: number,
  toView: (row: Row) => View,
  keyOf: (row: Row) => string,
): Page<View> {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map(toView),
    pageInfo: {
      nextCursor: hasMore && last ? encodeCursor(keyOf(last)) : null,
      hasMore,
    },
  };
}
