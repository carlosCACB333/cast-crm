"use client";

import { useQuery } from "@tanstack/react-query";

import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { unwrapAction } from "@/hooks/use-organization";
import { getCustomerStats, getLeadStats } from "@/lib/actions/dashboard";
import { queryKeys } from "@/lib/query-keys";

/** Lead totals and trends; lives under the leads keys so lead mutations refresh it. */
export function useLeadStats({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.leadStats,
    queryFn: () => unwrapAction(getLeadStats()),
    enabled,
    staleTime: DASHBOARD_CONFIG.staleTime,
  });
}

/** Customer totals and trends; refreshed by customer mutations. */
export function useCustomerStats({
  enabled = true,
}: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.customerStats,
    queryFn: () => unwrapAction(getCustomerStats()),
    enabled,
    staleTime: DASHBOARD_CONFIG.staleTime,
  });
}
