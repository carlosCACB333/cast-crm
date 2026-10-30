"use client";

import { RefreshIcon } from "@/components/icons";
import { APP_LOCALE } from "@/config/organization";
import { TABLE_DEFAULTS } from "@/config/tables";

import { AppButton } from "./app-button";
import { AppClearFiltersButton } from "./app-clear-filters-button";
import { AppPagination } from "./app-pagination";
import { AppSearchInput } from "./app-search-input";
import { AppSkeleton } from "./app-skeleton";
import { AppTable, type AppTableProps } from "./app-table";
import { AppTooltip } from "./app-tooltip";
import {
  type AppTableFilter,
  AppToolbarFilter,
  clearFilter,
  isFilterActive,
} from "./app-table-filter";

/** The parts of a TanStack Query result the table uses (pass the query as is). */
export interface AppDataTableQuery {
  isPending: boolean;
  isFetching: boolean;
  isPlaceholderData?: boolean;
  refetch: () => unknown;
}

export interface AppDataTableSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface AppDataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export interface AppDataTableProps<T, K extends string> extends Omit<
  AppTableProps<T, K>,
  "footer" | "isLoading"
> {
  /** Shows a skeleton while loading, dims stale rows and adds "Refrescar". */
  query?: AppDataTableQuery;
  search?: AppDataTableSearch;
  /** Filters shown in the toolbar; column filters go in `columns[].filter`. */
  filters?: AppTableFilter[];
  /** Resets search and filters at once (e.g. a single URL update). */
  onClearFilters?: () => void;
  pagination?: AppDataTablePagination;
}

const numberFormatter = new Intl.NumberFormat(APP_LOCALE);

/**
 * `AppTable` with a toolbar (search, toolbar filters, clear and refresh) and
 * pagination. State is controlled: search, filters, sort and pages are
 * resolved on the server (see `useListParams` and `lib/pagination.ts`).
 */
export function AppDataTable<T, K extends string>({
  query,
  search,
  filters = [],
  onClearFilters,
  pagination,
  emptyContent,
  isResizable = true,
  ...table
}: AppDataTableProps<T, K>) {
  const allFilters = [
    ...filters,
    ...table.columns.flatMap((column) =>
      column.filter ? [column.filter] : [],
    ),
  ];
  const hasActiveFilters =
    Boolean(search?.value) || allFilters.some(isFilterActive);
  const clearAll =
    onClearFilters ??
    (() => {
      search?.onChange("");
      allFilters.forEach(clearFilter);
    });
  const hasToolbar = Boolean(
    search || filters.length || query || hasActiveFilters,
  );

  return (
    <div className="flex flex-col gap-4">
      {hasToolbar ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {search ? (
            <AppSearchInput
              className="sm:max-w-sm"
              debounceMs={TABLE_DEFAULTS.searchDebounceMs}
              label={`Buscar en ${table.label.toLowerCase()}`}
              placeholder={search.placeholder ?? "Buscar…"}
              value={search.value}
              onChange={search.onChange}
            />
          ) : null}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {filters.map((filter) => (
              <AppToolbarFilter key={filter.label} filter={filter} />
            ))}
          </div>
          {hasActiveFilters || query ? (
            <div className="flex items-center gap-2 self-end lg:self-auto">
              {hasActiveFilters ? (
                <AppClearFiltersButton
                  filters={allFilters}
                  search={search?.value}
                  onPress={clearAll}
                />
              ) : null}
              {query ? (
                <AppTooltip content="Refrescar">
                  <AppButton
                    isIconOnly
                    aria-label="Refrescar"
                    isPending={query.isFetching}
                    size="sm"
                    variant="secondary"
                    onPress={() => query.refetch()}
                  >
                    {query.isFetching ? null : <RefreshIcon size={16} />}
                  </AppButton>
                </AppTooltip>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {query?.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <AppSkeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <AppTable
          {...table}
          emptyContent={
            hasActiveFilters ? (
              <div className="flex flex-col items-center gap-2">
                <span>No hay resultados con los filtros aplicados.</span>
                <AppButton size="sm" variant="secondary" onPress={clearAll}>
                  Limpiar filtros
                </AppButton>
              </div>
            ) : (
              emptyContent
            )
          }
          footer={
            pagination && pagination.total > 0 ? (
              <AppPagination
                page={pagination.page}
                pageCount={Math.max(
                  1,
                  Math.ceil(pagination.total / pagination.pageSize),
                )}
                summary={`Mostrando ${numberFormatter.format(
                  (pagination.page - 1) * pagination.pageSize + 1,
                )}–${numberFormatter.format(
                  Math.min(
                    pagination.page * pagination.pageSize,
                    pagination.total,
                  ),
                )} de ${numberFormatter.format(pagination.total)}`}
                onChange={pagination.onChange}
              />
            ) : null
          }
          isLoading={Boolean(query?.isFetching || query?.isPlaceholderData)}
          isResizable={isResizable}
        />
      )}
    </div>
  );
}
