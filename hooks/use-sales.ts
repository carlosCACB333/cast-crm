"use client";

import type { SalesListFilters } from "@/lib/validations/sales";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { unwrapAction } from "@/hooks/use-organization";
import {
  getSalesDocument,
  getSalesOverview,
  getSalesSettingsAction,
  listCustomerSales,
  listSalesDocuments,
} from "@/lib/actions/sales";
import { queryKeys } from "@/lib/query-keys";

/** Paginated documents of one type; keeps the previous page while the next loads. */
export function useSalesDocuments(filters: SalesListFilters) {
  return useQuery({
    queryKey: queryKeys.salesList(filters),
    queryFn: () => unwrapAction(listSalesDocuments(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useSalesDocument(id: string) {
  return useQuery({
    queryKey: queryKeys.salesDocument(id),
    queryFn: () => unwrapAction(getSalesDocument(id)),
    retry: false,
  });
}

export function useSalesOverview() {
  return useQuery({
    queryKey: queryKeys.salesOverview,
    queryFn: () => unwrapAction(getSalesOverview()),
  });
}

/** Numbering, default dates and terms of the active organization. */
export function useSalesSettings() {
  return useQuery({
    queryKey: queryKeys.salesSettings,
    queryFn: () => unwrapAction(getSalesSettingsAction()),
    staleTime: 5 * 60_000,
  });
}

export function useCustomerSales(
  params: { customerId: string; page: number },
  { enabled }: { enabled: boolean },
) {
  return useQuery({
    queryKey: queryKeys.customerSales(params),
    queryFn: () => unwrapAction(listCustomerSales(params)),
    placeholderData: keepPreviousData,
    enabled,
  });
}
