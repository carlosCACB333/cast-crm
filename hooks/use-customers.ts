"use client";

import type { CustomerListFilters } from "@/lib/validations/customers";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { unwrapAction } from "@/hooks/use-organization";
import { listCustomerStatuses } from "@/lib/actions/customer-statuses";
import {
  getCustomer,
  listCustomerNotes,
  listCustomers,
} from "@/lib/actions/customers";
import { queryKeys } from "@/lib/query-keys";

/** Paginated customers; keeps the previous page visible while the next one loads. */
export function useCustomers(
  filters: CustomerListFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.customerList(filters),
    queryFn: () => unwrapAction(listCustomers(filters)),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => unwrapAction(getCustomer(id)),
    retry: false,
  });
}

export function useCustomerNotes(id: string) {
  return useQuery({
    queryKey: queryKeys.customerNotes(id),
    queryFn: () => unwrapAction(listCustomerNotes(id)),
  });
}

/** Customer statuses configured by the active organization, in pipeline order. */
export function useCustomerStatuses() {
  return useQuery({
    queryKey: queryKeys.customerStatuses,
    queryFn: () => unwrapAction(listCustomerStatuses()),
  });
}
