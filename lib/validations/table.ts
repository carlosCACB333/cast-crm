import { z } from "zod";

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/**
 * Search, sort and page shared by every list paginated on the server. Each
 * list extends it with its own filters. Sort fields are named like the table
 * columns they sort, so the table can pass them straight through.
 */
export function listQuerySchema<const S extends readonly [string, ...string[]]>(
  sortFields: S,
  defaults: { sort: S[number]; direction: SortDirection },
) {
  return z.object({
    q: z.string().trim().max(100).default(""),
    sort: z.enum(sortFields).default(defaults.sort as never),
    direction: z.enum(SORT_DIRECTIONS).default(defaults.direction),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  });
}

/** Values of a multi-select filter; an empty list means no filter. */
export const filterValues = z
  .array(z.string().trim().min(1).max(128))
  .max(50)
  .default([]);
