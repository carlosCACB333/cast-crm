"use client";

import type { CustomerDetail } from "@/lib/actions/customers";
import type { SalesListItem } from "@/lib/actions/sales";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CartIcon, PlusIcon } from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import {
  SALES_TYPE_ICONS,
  SalesStatusChip,
  SalesTypeBadge,
  formatDay,
} from "@/components/sales/sales-format";
import {
  AppButton,
  AppCard,
  AppDataTable,
  AppDropdown,
  AppEmptyState,
} from "@/components/ui";
import {
  SALES_TYPES,
  SALES_TYPE_LIST,
  salesDocumentHref,
} from "@/config/sales";
import { usePermission } from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { useCustomerSales } from "@/hooks/use-sales";

type Column = "document" | "issueDate" | "status" | "total";

/** Quotes, orders, delivery notes and invoices of a customer. */
export function CustomerSales({ customer }: { customer: CustomerDetail }) {
  const router = useRouter();
  const money = useMoneyFormatter();
  const canRead = usePermission({ sale: ["read"] });
  const canCreate = usePermission({ sale: ["create"] });
  const [page, setPage] = useState(1);
  // The id comes from the page, so navigating to another customer refetches.
  const sales = useCustomerSales(
    { customerId: customer.id, page },
    { enabled: canRead },
  );
  const data = sales.data;

  if (!canRead) return null;

  return (
    <AppCard
      description={
        data && data.invoiced > 0
          ? `${money.format(data.invoiced)} facturado${data.outstanding > 0 ? ` · ${money.format(data.outstanding)} pendiente de cobro` : ""}.`
          : "Presupuestos, pedidos, albaranes y facturas de este cliente."
      }
      title={
        <span className="flex items-center justify-between gap-2">
          Ventas
          {canCreate ? (
            <AppDropdown
              items={SALES_TYPE_LIST.map((definition) => {
                const Icon = SALES_TYPE_ICONS[definition.type];

                return {
                  id: definition.slug,
                  label: definition.newLabel,
                  icon: <Icon size={16} />,
                };
              })}
              label="Crear documento para este cliente"
              trigger={
                <AppButton size="sm" variant="secondary">
                  <PlusIcon size={14} />
                  Nuevo documento
                </AppButton>
              }
              onAction={(slug) =>
                router.push(
                  `/sales/${slug}/new?customerId=${encodeURIComponent(customer.id)}`,
                )
              }
            />
          ) : null}
        </span>
      }
    >
      {sales.error ? (
        <QueryError error={sales.error} onRetry={() => sales.refetch()} />
      ) : data?.total === 0 ? (
        <AppEmptyState
          description="Prepara un presupuesto o factura directamente a este cliente."
          icon={<CartIcon size={20} />}
          title="Sin documentos de venta"
        />
      ) : (
        <AppDataTable<SalesListItem, Column>
          columns={[
            {
              key: "document",
              label: "Documento",
              isRowHeader: true,
              defaultWidth: "2fr",
            },
            { key: "issueDate", label: "Fecha" },
            { key: "status", label: "Estado" },
            { key: "total", label: "Total", className: "text-right" },
          ]}
          getRowKey={(row) => row.id}
          label="Documentos de venta del cliente"
          pagination={
            data
              ? {
                  page: data.page,
                  pageSize: data.pageSize,
                  total: data.total,
                  onChange: setPage,
                }
              : undefined
          }
          query={sales}
          renderCell={(row, column) => {
            switch (column) {
              case "document":
                return (
                  <span className="flex min-w-0 items-center gap-2">
                    <SalesTypeBadge type={row.type} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium tabular-nums">
                        {row.number ?? "Borrador"}
                      </span>
                      <span className="truncate text-xs text-muted">
                        {SALES_TYPES[row.type].label}
                      </span>
                    </span>
                  </span>
                );
              case "issueDate":
                return (
                  <span className="text-sm whitespace-nowrap">
                    {formatDay(row.issueDate)}
                  </span>
                );
              case "status":
                return <SalesStatusChip status={row.status} type={row.type} />;
              case "total":
                return (
                  <span className="block text-right font-medium whitespace-nowrap tabular-nums">
                    {money.format(row.total)}
                  </span>
                );
            }
          }}
          rows={data?.items ?? []}
          onRowAction={(key) => {
            const row = data?.items.find((item) => item.id === key);

            if (row) router.push(salesDocumentHref(row.type, row.id));
          }}
        />
      )}
    </AppCard>
  );
}
