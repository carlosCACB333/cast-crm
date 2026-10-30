"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  type CustomerListFilters,
  customerListSchema,
} from "@/lib/validations/customers";

const DEFAULTS = customerListSchema.parse({});

/**
 * List filters stored in the URL, so a filtered view can be shared, bookmarked
 * and restored with the back button.
 */
export function useCustomerFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<CustomerListFilters>(() => {
    const parsed = customerListSchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    return parsed.success ? parsed.data : DEFAULTS;
  }, [searchParams]);

  /** Applies a change; any change other than the page goes back to page 1. */
  const setFilters = useCallback(
    (patch: Partial<CustomerListFilters>) => {
      const next = { ...filters, page: 1, ...patch };
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(next)) {
        if (value !== DEFAULTS[key as keyof CustomerListFilters]) {
          params.set(key, String(value));
        }
      }

      const query = params.toString();

      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [filters, pathname, router],
  );

  const hasActiveFilters = Boolean(
    filters.q ||
    filters.statusId ||
    filters.type ||
    filters.ownerId ||
    filters.tag,
  );

  const clearFilters = useCallback(
    () => router.replace(pathname, { scroll: false }),
    [pathname, router],
  );

  return { filters, setFilters, hasActiveFilters, clearFilters };
}
