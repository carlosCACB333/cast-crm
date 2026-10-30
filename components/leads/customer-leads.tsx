"use client";

import type { CustomerDetail } from "@/lib/actions/customers";
import type { CustomerLead } from "@/lib/actions/leads";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  type CustomerLeadListParams,
  customerLeadListSchema,
} from "@/lib/validations/leads";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { PlusIcon, TargetIcon } from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import { STAGE_KINDS, STAGE_KIND_LABELS, type StageKind } from "@/config/leads";
import {
  AppButton,
  AppCard,
  AppDataTable,
  AppEmptyState,
  AppStatusChip,
} from "@/components/ui";
import { useCustomerLeads } from "@/hooks/use-leads";
import { useListParams } from "@/hooks/use-list-params";
import { useActiveMember, usePermission } from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { formatRelative } from "@/lib/format";
import { optionSources } from "@/lib/option-sources";

type Column = "title" | "pipeline" | "stage" | "value" | "updatedAt";

/** Leads linked to a customer, with a shortcut to open a new one for them. */
export function CustomerLeads({ customer }: { customer: CustomerDetail }) {
  const canRead = usePermission({ lead: ["read"] });
  const canCreate = usePermission({ lead: ["create"] });
  const { data: currentMember } = useActiveMember();
  const money = useMoneyFormatter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const router = useRouter();
  const list = useListParams<CustomerLeadListParams>(
    customerLeadListSchema.parse({ customerId: customer.id }),
  );
  const { params, setParams } = list;
  // The id comes from the page, so navigating to another customer refetches.
  const leads = useCustomerLeads(
    { ...params, customerId: customer.id },
    { enabled: canRead },
  );
  const data = leads.data;

  if (!canRead) return null;

  const isPerson = customer.type === "PERSON";
  const openValue = data?.openValue ?? 0;

  return (
    <AppCard
      description={
        openValue > 0
          ? `${money.format(openValue)} en oportunidades abiertas.`
          : "Oportunidades de venta con este cliente."
      }
      title={
        <span className="flex items-center justify-between gap-2">
          Leads
          {canCreate ? (
            <AppButton
              size="sm"
              variant="secondary"
              onPress={() => setIsFormOpen(true)}
            >
              <PlusIcon size={14} />
              Nuevo lead
            </AppButton>
          ) : null}
        </span>
      }
    >
      {leads.error ? (
        <QueryError error={leads.error} onRetry={() => leads.refetch()} />
      ) : data?.pipelineCount === 0 ? (
        <AppEmptyState
          description="Registra una oportunidad para seguirla en el tablero."
          icon={<TargetIcon size={20} />}
          title="Sin leads"
        />
      ) : (
        <AppDataTable<CustomerLead, Column>
          columns={[
            {
              key: "title",
              label: "Lead",
              isRowHeader: true,
              defaultWidth: "2fr",
              allowsSorting: true,
            },
            {
              key: "pipeline",
              label: "Embudo",
              allowsSorting: true,
              // Only worth filtering when the customer has leads in several pipelines.
              filter:
                (data?.pipelineCount ?? 0) > 1
                  ? {
                      type: "options",
                      label: "Embudo",
                      multiple: true,
                      source: optionSources.pipelines,
                      value: params.pipelineIds,
                      onChange: (pipelineIds) => setParams({ pipelineIds }),
                    }
                  : undefined,
            },
            {
              key: "stage",
              label: "Paso",
              allowsSorting: true,
              filter: {
                type: "options",
                label: "Situación",
                multiple: true,
                options: STAGE_KINDS.map((kind) => ({
                  value: kind,
                  label: STAGE_KIND_LABELS[kind].label,
                })),
                value: params.kinds,
                onChange: (kinds) => setParams({ kinds: kinds as StageKind[] }),
              },
            },
            {
              key: "value",
              label: "Valor",
              className: "text-right",
              allowsSorting: true,
            },
            { key: "updatedAt", label: "Actividad", allowsSorting: true },
          ]}
          getRowKey={(lead) => lead.id}
          label="Leads del cliente"
          pagination={list.pagination(data)}
          query={leads}
          renderCell={(lead, column) => {
            switch (column) {
              case "title":
                return (
                  <span className="block truncate font-medium">
                    {lead.title}
                  </span>
                );
              case "pipeline":
                return (
                  <span className="block truncate text-sm text-muted">
                    {lead.pipeline.name}
                  </span>
                );
              case "stage":
                return (
                  <AppStatusChip
                    color={lead.stage.color}
                    label={lead.stage.name}
                  />
                );
              case "value":
                return lead.value !== null ? (
                  <span className="font-semibold tabular-nums">
                    {money.format(lead.value)}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                );
              case "updatedAt":
                return (
                  <span className="text-sm whitespace-nowrap text-muted">
                    {formatRelative(lead.updatedAt)}
                  </span>
                );
            }
          }}
          rows={data?.items ?? []}
          search={{ ...list.search, placeholder: "Buscar por título…" }}
          sort={list.sort}
          onClearFilters={list.onClearFilters}
          onRowAction={(id) => router.push(`/leads/${id}`)}
          onSortChange={list.onSortChange}
        />
      )}

      <LeadFormDrawer
        customerName={customer.name}
        defaults={{
          title: `Oportunidad con ${customer.name}`,
          customerId: customer.id,
          contactName: isPerson ? customer.name : "",
          companyName: isPerson ? (customer.companyName ?? "") : customer.name,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          ownerId: customer.owner?.id ?? currentMember?.userId ?? "",
        }}
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
      />
    </AppCard>
  );
}
