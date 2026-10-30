"use client";

import type {
  CashSessionListFilters,
  PosItemsInput,
} from "@/lib/validations/pos";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { unwrapAction } from "@/hooks/use-organization";
import { listPaymentMethods } from "@/lib/actions/payment-methods";
import {
  getCashSession,
  getPosSettingsAction,
  getPosState,
  listCashRegisters,
  listCashSessions,
  listHeldCarts,
  searchPosItems,
} from "@/lib/actions/pos";
import { queryKeys } from "@/lib/query-keys";

/** The caller's open session (or null), POS settings and payment methods. */
export function usePosState({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.posState,
    queryFn: () => unwrapAction(getPosState()),
    enabled,
  });
}

/** Carts parked at the till, loaded when their list opens. */
export function useHeldCarts({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.heldCarts,
    queryFn: () => unwrapAction(listHeldCarts()),
    enabled,
  });
}

/** One page of the catalog grid of the till. */
export function usePosItems(params: PosItemsInput) {
  return useQuery({
    queryKey: queryKeys.posItems(params),
    queryFn: () => unwrapAction(searchPosItems(params)),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useCashSessions(filters: CashSessionListFilters) {
  return useQuery({
    queryKey: queryKeys.cashSessionList(filters),
    queryFn: () => unwrapAction(listCashSessions(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useCashSession(id: string) {
  return useQuery({
    queryKey: queryKeys.cashSession(id),
    queryFn: () => unwrapAction(getCashSession(id)),
    retry: false,
  });
}

export function useCashRegisters() {
  return useQuery({
    queryKey: queryKeys.cashRegisters,
    queryFn: () => unwrapAction(listCashRegisters()),
  });
}

export function usePosSettings() {
  return useQuery({
    queryKey: queryKeys.posSettings,
    queryFn: () => unwrapAction(getPosSettingsAction()),
    staleTime: 5 * 60_000,
  });
}

/** Every payment method of the organization, active or not, in order. */
export function usePaymentMethods() {
  return useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: () => unwrapAction(listPaymentMethods()),
  });
}
