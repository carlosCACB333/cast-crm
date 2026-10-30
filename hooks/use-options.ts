"use client";

import type { OptionSource } from "@/lib/option-sources";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { unwrapAction } from "@/hooks/use-organization";

/** Pages of options matching `q`, loaded on demand while the list is open. */
export function useOptionSearch(
  source: OptionSource | undefined,
  q: string,
  isEnabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: [...(source?.key ?? ["options", "none"]), "search", q],
    queryFn: ({ pageParam }) =>
      unwrapAction(source!.search({ q, page: pageParam })),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length + 1 : undefined,
    enabled: Boolean(source) && isEnabled,
  });
}

/** Labels of selected values that are not in the loaded pages. */
export function useOptionLabels(
  source: OptionSource | undefined,
  ids: string[],
) {
  return useQuery({
    queryKey: [...(source?.key ?? ["options", "none"]), "ids", ids],
    queryFn: () => unwrapAction(source!.search({ q: "", page: 1, ids })),
    enabled: Boolean(source) && ids.length > 0,
    staleTime: 5 * 60_000,
  });
}
