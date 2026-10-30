"use client";

import type { CashSessionRow } from "@/lib/actions/pos";

import { useRouter } from "next/navigation";
import clsx from "clsx";

import { StoreIcon } from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  AppDataTable,
  AppEmptyState,
  AppStatusChip,
  type AppTableColumn,
} from "@/components/ui";
import { CASH_SESSION_STATUSES, cashSessionStatusInfo } from "@/config/pos";
import { useListParams } from "@/hooks/use-list-params";
import { useMyAccess, usePermission } from "@/hooks/use-organization";
import { useCashSessions } from "@/hooks/use-pos";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { formatDateTime } from "@/lib/format";
import { optionSources } from "@/lib/option-sources";
import {
  type CashSessionListParams,
  cashSessionListSchema,
} from "@/lib/validations/pos";

type Column =
  | "register"
  | "status"
  | "openedAt"
  | "closedAt"
  | "tickets"
  | "expected"
  | "difference";

const COLUMNS: AppTableColumn<Column>[] = [
  { key: "register", label: "Caja", isRowHeader: true },
  { key: "status", label: "Estado" },
  { key: "openedAt", label: "Apertura", allowsSorting: true },
  { key: "closedAt", label: "Cierre", allowsSorting: true },
  { key: "tickets", label: "Tickets" },
  { key: "expected", label: "Efectivo esperado" },
  { key: "difference", label: "Descuadre" },
];

/** Openings and cash counts of every register, most recent first. */
export function CashSessionsView() {
  const router = useRouter();
  const money = useMoneyFormatter();
  const access = useMyAccess();
  const canRead = usePermission({ pos: ["read"] });
  const list = useListParams<CashSessionListParams>(
    cashSessionListSchema.parse({}),
  );
  const sessions = useCashSessions(list.params);
  const data = sessions.data;

  if (access.data && !canRead) {
    return (
      <AppEmptyState
        description="Pide a un administrador acceso al punto de venta."
        icon={<StoreIcon size={20} />}
        title="No tienes acceso a las cajas"
      />
    );
  }

  const renderCell = (row: CashSessionRow, column: Column) => {
    switch (column) {
      case "register":
        return (
          <div className="flex flex-col">
            <span className="font-medium">{row.register.name}</span>
            <span className="text-xs text-muted">
              {row.openedBy?.name ?? "Persona eliminada"}
            </span>
          </div>
        );
      case "status": {
        const info = cashSessionStatusInfo(row.status);

        return <AppStatusChip color={info.color} label={info.label} />;
      }
      case "openedAt":
        return formatDateTime(row.openedAt);
      case "closedAt":
        return row.closedAt ? formatDateTime(row.closedAt) : "—";
      case "tickets":
        return <span className="tabular-nums">{row.ticketCount}</span>;
      case "expected":
        return (
          <span className="tabular-nums">
            {row.expectedCash === null ? "—" : money.format(row.expectedCash)}
          </span>
        );
      case "difference":
        return row.difference === null ? (
          "—"
        ) : (
          <span
            className={clsx(
              "font-medium tabular-nums",
              row.difference === 0
                ? "text-success"
                : row.difference < 0
                  ? "text-danger"
                  : "text-warning",
            )}
          >
            {row.difference === 0 ? "Cuadra" : money.format(row.difference)}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Cada apertura de caja con sus ventas, su arqueo y el descuadre al cerrar."
        title="Aperturas de caja"
      />
      {sessions.error ? (
        <QueryError error={sessions.error} onRetry={() => sessions.refetch()} />
      ) : (
        <AppDataTable<CashSessionRow, Column>
          columns={COLUMNS}
          emptyContent={
            <AppEmptyState
              description="Abre una caja desde el punto de venta para empezar a vender."
              icon={<StoreIcon size={20} />}
              title="Sin aperturas de caja"
            />
          }
          filters={[
            {
              type: "options",
              label: "Caja",
              allLabel: "Todas las cajas",
              source: optionSources.cashRegisters,
              value: list.params.registerId ? [list.params.registerId] : [],
              onChange: (value) =>
                list.setParams({ registerId: value[0] ?? "" }),
            },
            {
              type: "options",
              label: "Estado",
              allLabel: "Todas",
              options: CASH_SESSION_STATUSES.map((item) => ({
                value: item.status,
                label: item.label,
              })),
              value: list.params.status ? [list.params.status] : [],
              onChange: (value) =>
                list.setParams({
                  status: (value[0] ?? "") as CashSessionListParams["status"],
                }),
            },
          ]}
          getRowKey={(row) => row.id}
          label="Aperturas de caja"
          pagination={list.pagination(data)}
          query={sessions}
          renderCell={renderCell}
          rows={data?.items ?? []}
          search={{
            ...list.search,
            placeholder: "Buscar por caja, persona o notas…",
          }}
          sort={list.sort}
          onClearFilters={list.onClearFilters}
          onRowAction={(id) => router.push(`/pos/sessions/${id}`)}
          onSortChange={list.onSortChange}
        />
      )}
    </div>
  );
}
