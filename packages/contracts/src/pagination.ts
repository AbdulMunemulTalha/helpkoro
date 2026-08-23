import { z } from 'zod';

/** Cursor pagination query params (ADR-006). */
export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export interface PageInfo {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface Page<T> {
  items: T[];
  pageInfo: PageInfo;
}

export const pageInfo = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

/** Cursors are opaque base64url tokens; clients must not parse them. */
export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}
