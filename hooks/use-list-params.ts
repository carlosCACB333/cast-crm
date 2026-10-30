"use client";

import type {
  AppDataTablePagination,
  AppDataTableSearch,
  AppTableSort,
} from "@/components/ui";
import type { Page } from "@/lib/pagination";
import type { SortDirection } from "@/lib/validations/table";

import { useCallback, useState } from "react";

export interface ListParams {
  q: string;
  sort: string;
  direction: SortDirection;
  page: number;
}

/**
 * State of a list paginated on the server: search, sort, filters and page,
 * ready to send to its Server Action and to spread into `AppDataTable`.
 * Sortable columns must use the sort field as their key.
 */
export function useListParams<P extends ListParams>(defaults: P) {
  const [params, setState] = useState(defaults);

  /** Applies a change; any change other than the page goes back to page 1. */
  const setParams = useCallback(
    (patch: Partial<P>) =>
      setState((current) => ({ ...current, page: 1, ...patch })),
    [],
  );

  const search: AppDataTableSearch = {
    value: params.q,
    onChange: (q) => setParams({ q } as Partial<P>),
  };
  const sort: AppTableSort<P["sort"]> = {
    column: params.sort,
    direction: params.direction === "asc" ? "ascending" : "descending",
  };

  return {
    params,
    setParams,
    search,
    sort,
    onSortChange: ({ column, direction }: AppTableSort) =>
      setParams({
        sort: column,
        direction: direction === "ascending" ? "asc" : "desc",
      } as Partial<P>),
    /** Clears search and filters but keeps the chosen sort. */
    onClearFilters: () =>
      setState((current) => ({
        ...defaults,
        sort: current.sort,
        direction: current.direction,
      })),
    pagination: (data?: Page<unknown>): AppDataTablePagination | undefined =>
      data
        ? {
            page: data.page,
            pageSize: data.pageSize,
            total: data.total,
            onChange: (page) => setParams({ page } as Partial<P>),
          }
        : undefined,
  };
}
