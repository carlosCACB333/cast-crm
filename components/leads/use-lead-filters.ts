"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  type LeadBoardFilters,
  leadBoardSchema,
} from "@/lib/validations/leads";

type UrlFilters = Pick<LeadBoardFilters, "q" | "ownerId">;

// Short URL names: /leads/pipelines/<id>/kanban?q=…&owner=…
const PARAMS: Record<keyof UrlFilters, string> = { q: "q", ownerId: "owner" };

/** Board filters stored in the URL; the pipeline comes from the route. */
export function useLeadFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<UrlFilters>(() => {
    const parsed = leadBoardSchema.pick({ q: true, ownerId: true }).safeParse({
      q: searchParams.get(PARAMS.q) ?? undefined,
      ownerId: searchParams.get(PARAMS.ownerId) ?? undefined,
    });

    return parsed.success ? parsed.data : { q: "", ownerId: "" };
  }, [searchParams]);

  const setFilters = useCallback(
    (patch: Partial<UrlFilters>) => {
      const next = { ...filters, ...patch };
      const params = new URLSearchParams();

      for (const key of Object.keys(PARAMS) as (keyof UrlFilters)[]) {
        if (next[key]) params.set(PARAMS[key], next[key]);
      }

      const query = params.toString();

      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [filters, pathname, router],
  );

  const hasActiveFilters = Boolean(filters.q || filters.ownerId);

  return { filters, setFilters, hasActiveFilters };
}
