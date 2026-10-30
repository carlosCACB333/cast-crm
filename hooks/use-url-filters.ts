"use client";

import type { z } from "zod";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Keys that order or page a list; they never count as filters. */
const VIEW_KEYS = new Set(["sort", "direction", "page"]);

/**
 * List filters stored in the URL, so a filtered view can be shared, bookmarked
 * and restored with the back button. Values equal to the schema defaults are
 * left out of the URL.
 */
export function useUrlFilters<S extends z.ZodType<Record<string, unknown>>>(
  schema: S,
) {
  type Filters = z.output<S>;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaults = useMemo(() => schema.parse({}) as Filters, [schema]);

  const filters = useMemo<Filters>(() => {
    const parsed = schema.safeParse(Object.fromEntries(searchParams.entries()));

    return parsed.success ? parsed.data : defaults;
  }, [searchParams, schema, defaults]);

  /** Applies a change; any change other than the page goes back to page 1. */
  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      const next = { ...filters, page: 1, ...patch };
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(next)) {
        if (value !== defaults[key as keyof Filters]) {
          params.set(key, String(value));
        }
      }

      const query = params.toString();

      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [filters, defaults, pathname, router],
  );

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) =>
      !VIEW_KEYS.has(key) && value !== defaults[key as keyof Filters],
  );

  const clearFilters = useCallback(
    () => router.replace(pathname, { scroll: false }),
    [pathname, router],
  );

  return { filters, setFilters, hasActiveFilters, clearFilters };
}
