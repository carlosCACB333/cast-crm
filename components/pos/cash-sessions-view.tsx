"use client";

import type { CashSessionRow } from "@/lib/actions/pos";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import { StoreIcon } from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  AppEmptyState,
  AppFilterAutocomplete,
  AppPagination,
  AppStatusChip,
  AppTable,
} from "@/components/ui";
import { CASH_SESSION_STATUSES, cashSessionStatusInfo } from "@/config/pos";
import { useMyAccess, usePermission } from "@/hooks/use-organization";
import { useCashSessions } from "@/hooks/use-pos";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { formatDateTime } from "@/lib/format";
import { optionSources } from "@/lib/option-sources";

type Column =
  | "register"
  | "status"
  | "openedAt"
  | "closedAt"
  | "tickets"
  | "expected"
  | "difference";

const COLUMNS: { key: Column; label: string }[] = [
  { key: "register", label: "Caja" },
  { key: "status", label: "Estado" },
  { key: "openedAt", label: "Apertura" },
  { key: "closedAt", label: "Cierre" },
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
  const [registerId, setRegisterId] = useState("");
  const [status, setStatus] = useState<"" | "OPEN" | "CLOSED">("");
  const [page, setPage] = useState(1);
  const sessions = useCashSessions({ page, registerId, status });
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
      <div className="flex flex-col gap-3 sm:flex-row">
        <AppFilterAutocomplete
          className="sm:w-64"
          label="Caja"
          options={[{ value: "", label: "Todas las cajas" }]}
          source={optionSources.cashRegisters}
          value={registerId}
          onChange={(value) => {
            setRegisterId(value);
            setPage(1);
          }}
        />
        <AppFilterAutocomplete
          className="sm:w-48"
          label="Estado"
          options={[
            { value: "", label: "Todas" },
            ...CASH_SESSION_STATUSES.map((item) => ({
              value: item.status,
              label: item.label,
            })),
          ]}
          value={status}
          onChange={(value) => {
            setStatus(value as typeof status);
            setPage(1);
          }}
        />
      </div>
      {sessions.error ? (
        <QueryError error={sessions.error} onRetry={() => sessions.refetch()} />
      ) : (
        <>
          <AppTable
            columns={COLUMNS}
            emptyContent={
              <AppEmptyState
                description="Abre una caja desde el punto de venta para empezar a vender."
                icon={<StoreIcon size={20} />}
                title="Sin aperturas de caja"
              />
            }
            getRowKey={(row) => row.id}
            isLoading={!data || sessions.isPlaceholderData}
            label="Aperturas de caja"
            renderCell={renderCell}
            rows={data?.items ?? []}
            onRowAction={(id) => router.push(`/pos/sessions/${id}`)}
          />
          {data && data.pageCount > 1 ? (
            <AppPagination
              page={data.page}
              pageCount={data.pageCount}
              summary={`${data.total} aperturas`}
              onChange={setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
