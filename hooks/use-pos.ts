"use client";

import type {
  CashDiscrepancyReportListParams,
  CashRegisterMovementListParams,
  CashRegisterListParams,
  CashSessionListParams,
  PosItemsInput,
} from "@/lib/validations/pos";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { unwrapAction } from "@/hooks/use-organization";
import { listPaymentMethods } from "@/lib/actions/payment-methods";
import {
  getCashSession,
  getPosSettingsAction,
  getPosState,
  getCashRegister,
  listCashDiscrepancyReports,
  listCashRegisterMovements,
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

export function useCashSessions(params: CashSessionListParams) {
  return useQuery({
    queryKey: queryKeys.cashSessionList(params),
    queryFn: () => unwrapAction(listCashSessions(params)),
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

export function useCashRegisters(params: CashRegisterListParams) {
  return useQuery({
    queryKey: queryKeys.cashRegisterList(params),
    queryFn: () => unwrapAction(listCashRegisters(params)),
    placeholderData: keepPreviousData,
  });
}

export function useCashRegister(id: string) {
  return useQuery({
    queryKey: queryKeys.cashRegister(id),
    queryFn: () => unwrapAction(getCashRegister(id)),
    retry: false,
  });
}

/** One page of the movements of a closed register. */
export function useCashRegisterMovements(
  params: CashRegisterMovementListParams,
) {
  return useQuery({
    queryKey: queryKeys.cashRegisterMovements(params),
    queryFn: () => unwrapAction(listCashRegisterMovements(params)),
    placeholderData: keepPreviousData,
  });
}

/** One page of the differences reported at the opening of a register. */
export function useCashDiscrepancyReports(
  params: CashDiscrepancyReportListParams,
) {
  return useQuery({
    queryKey: queryKeys.cashDiscrepancyReports(params),
    queryFn: () => unwrapAction(listCashDiscrepancyReports(params)),
    placeholderData: keepPreviousData,
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
