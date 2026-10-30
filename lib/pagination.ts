import type { SortDirection } from "@/lib/validations/table";

import { APP_LOCALE } from "@/config/organization";

/** One page of a list paginated on the server. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Clamps the requested page to the last one, so deleting the last row of a
 * page shows the previous page instead of an empty one.
 */
export function pageWindow(page: number, pageSize: number, total: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);

  return {
    page: current,
    pageSize,
    pageCount,
    skip: (current - 1) * pageSize,
    take: pageSize,
  };
}

/** Lowercase without accents, so "jose" finds "José". */
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase(APP_LOCALE);

/**
 * Search, sort and page for lists that are small by design (they have a hard
 * limit) and whose columns are computed, so they cannot be sorted by the
 * database. Runs on the server; the browser only receives one page.
 */
export function paginateInMemory<T>(
  rows: T[],
  {
    q,
    searchText,
    sortValue,
    direction,
    page,
    pageSize,
  }: {
    q: string;
    searchText: (row: T) => (string | null | undefined)[];
    sortValue: (row: T) => string | number;
    direction: SortDirection;
    page: number;
    pageSize: number;
  },
): Page<T> {
  const term = normalizeSearch(q);
  const matches = term
    ? rows.filter((row) =>
        searchText(row).some(
          (text) => text && normalizeSearch(text).includes(term),
        ),
      )
    : rows;
  const sorted = [...matches].sort((a, b) => {
    const first = sortValue(a);
    const second = sortValue(b);
    const cmp =
      typeof first === "number" && typeof second === "number"
        ? first - second
        : String(first).localeCompare(String(second), APP_LOCALE);

    return direction === "desc" ? -cmp : cmp;
  });
  const window = pageWindow(page, pageSize, sorted.length);

  return {
    items: sorted.slice(window.skip, window.skip + window.take),
    total: sorted.length,
    page: window.page,
    pageSize,
    pageCount: window.pageCount,
  };
}
