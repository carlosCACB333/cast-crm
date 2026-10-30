"use client";

import type { ServiceListFilters } from "@/lib/validations/services";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { unwrapAction } from "@/hooks/use-organization";
import { listServiceCategories } from "@/lib/actions/service-categories";
import { getService, listServices } from "@/lib/actions/services";
import { queryKeys } from "@/lib/query-keys";

/** Paginated services; keeps the previous page visible while the next one loads. */
export function useServices(filters: ServiceListFilters) {
  return useQuery({
    queryKey: queryKeys.serviceList(filters),
    queryFn: () => unwrapAction(listServices(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: queryKeys.service(id),
    queryFn: () => unwrapAction(getService(id)),
    retry: false,
  });
}

/** Service categories configured by the active organization, in order. */
export function useServiceCategories() {
  return useQuery({
    queryKey: queryKeys.serviceCategories,
    queryFn: () => unwrapAction(listServiceCategories()),
  });
}
