"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { APP_LOCALE, DEFAULT_CURRENCY } from "@/config/organization";
import { unwrapAction } from "@/hooks/use-organization";
import {
  getOrganizationPreferences,
  getOrganizationTaxes,
} from "@/lib/actions/preferences";
import { queryKeys } from "@/lib/query-keys";

export function useOrganizationPreferences() {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => unwrapAction(getOrganizationPreferences()),
    staleTime: 5 * 60_000,
  });
}

/** Default tax rate and tax on the total of the active organization. */
export function useOrganizationTaxes() {
  return useQuery({
    queryKey: queryKeys.taxes,
    queryFn: () => unwrapAction(getOrganizationTaxes()),
    staleTime: 5 * 60_000,
  });
}

/** Formats amounts in the active organization's currency. */
export function useMoneyFormatter() {
  const { data } = useOrganizationPreferences();
  const currency = data?.currency ?? DEFAULT_CURRENCY;

  return useMemo(() => {
    const full = new Intl.NumberFormat(APP_LOCALE, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    const compact = new Intl.NumberFormat(APP_LOCALE, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    });

    return {
      currency,
      format: (value: number) => full.format(value),
      /** Short form for tight spaces, e.g. "12,5 mil €". */
      compact: (value: number) => compact.format(value),
    };
  }, [currency]);
}
