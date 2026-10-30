"use client";

import type {
  CustomerLeadListParams,
  LeadBoardFilters,
  PipelineListParams,
} from "@/lib/validations/leads";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { unwrapAction } from "@/hooks/use-organization";
import {
  getLead,
  getLeadBoard,
  listCustomerLeads,
  listLeadNotes,
} from "@/lib/actions/leads";
import { getPipeline, listPipelinePage } from "@/lib/actions/pipelines";
import { queryKeys } from "@/lib/query-keys";

/** Kanban of one pipeline; keeps the previous board visible while filtering. */
export function useLeadBoard(filters: LeadBoardFilters) {
  return useQuery({
    queryKey: queryKeys.leadBoard(filters),
    queryFn: () => unwrapAction(getLeadBoard(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: queryKeys.lead(id),
    queryFn: () => unwrapAction(getLead(id)),
    retry: false,
  });
}

export function useLeadNotes(id: string) {
  return useQuery({
    queryKey: queryKeys.leadNotes(id),
    queryFn: () => unwrapAction(listLeadNotes(id)),
  });
}

/** One page of the leads linked to a customer. */
export function useCustomerLeads(
  params: CustomerLeadListParams,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.customerLeads(params),
    queryFn: () => unwrapAction(listCustomerLeads(params)),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** One page of the pipelines table, with their totals. */
export function usePipelinePage(params: PipelineListParams) {
  return useQuery({
    queryKey: queryKeys.pipelinePage(params),
    queryFn: () => unwrapAction(listPipelinePage(params)),
    placeholderData: keepPreviousData,
  });
}

/** One pipeline with its stages; "" loads the organization's first one. */
export function usePipeline(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.pipeline(id),
    queryFn: () => unwrapAction(getPipeline(id)),
    enabled: options.enabled ?? true,
  });
}
