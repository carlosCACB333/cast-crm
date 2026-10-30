"use client";

import type { CashRegisterItem } from "@/lib/actions/pos";

import { useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";

import { PlusIcon, StoreIcon } from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import { CashRegisterFormModal } from "@/components/pos/cash-register-form-modal";
import {
  AppAlert,
  AppButton,
  AppChip,
  AppDataTable,
  AppEmptyState,
  type AppTableColumn,
} from "@/components/ui";
import { POS_LIMITS } from "@/config/pos";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-organization";
import { useCashRegisters } from "@/hooks/use-pos";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { formatRelative } from "@/lib/format";
import {
  type CashRegisterListParams,
  cashRegisterListSchema,
} from "@/lib/validations/pos";

type Column =
  | "name"
  | "status"
  | "cashBalance"
  | "openSession"
  | "sessionCount"
  | "pendingDiscrepancies";

const COLUMNS: AppTableColumn<Column>[] = [
  { key: "name", label: "Caja", isRowHeader: true, allowsSorting: true },
  { key: "status", label: "Estado" },
  {
    key: "cashBalance",
    label: "Efectivo en caja",
    allowsSorting: true,
    className: "text-right",
  },
  { key: "openSession", label: "En uso" },
  {
    key: "sessionCount",
    label: "Aperturas",
    allowsSorting: true,
    className: "text-right",
  },
  { key: "pendingDiscrepancies", label: "Diferencias" },
];

/** Registers of the point of sale; each row opens its detail. */
export function CashRegistersView() {
  const router = useRouter();
  const money = useMoneyFormatter();
  const list = useListParams<CashRegisterListParams>(
    cashRegisterListSchema.parse({}),
  );
  const registers = useCashRegisters(list.params);
  const canManage = usePermission({ pos: ["manage"] });
  const canAdjust = usePermission({ pos: ["adjust"] });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const data = registers.data;
  const withDiscrepancies = data?.withDiscrepancies ?? [];

  const renderCell = (register: CashRegisterItem, column: Column) => {
    switch (column) {
      case "name":
        return <span className="font-medium">{register.name}</span>;
      case "status":
        return (
          <span className="flex flex-wrap gap-1">
            {register.openSession ? (
              <AppChip color="success" size="sm">
                Abierta
              </AppChip>
            ) : (
              <AppChip size="sm">Cerrada</AppChip>
            )}
            {!register.isActive ? (
              <AppChip color="warning" size="sm">
                Inactiva
              </AppChip>
            ) : null}
          </span>
        );
      case "cashBalance":
        return (
          <span className="block text-right font-medium tabular-nums">
            {money.format(register.cashBalance)}
          </span>
        );
      case "openSession":
        return register.openSession ? (
          <span className="text-sm">
            {register.openSession.openedBy?.name ?? "Alguien"} ·{" "}
            <span className="text-muted">
              {formatRelative(register.openSession.openedAt)}
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted">—</span>
        );
      case "sessionCount":
        return (
          <span className="block text-right tabular-nums">
            {register.sessionCount}
          </span>
        );
      case "pendingDiscrepancies":
        return register.pendingDiscrepancies ? (
          <AppChip color="danger" size="sm">
            {register.pendingDiscrepancies === 1
              ? "1 pendiente"
              : `${register.pendingDiscrepancies} pendientes`}
          </AppChip>
        ) : (
          <span className="text-sm text-muted">—</span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          canManage ? (
            <AppButton
              isDisabled={
                !data || data.registerCount >= POS_LIMITS.maxRegisters
              }
              onPress={() => setIsFormOpen(true)}
            >
              <PlusIcon size={16} />
              Nueva caja
            </AppButton>
          ) : null
        }
        description="Los puestos de cobro del punto de venta. Cada caja la abre una persona a la vez."
        title="Cajas"
      />
      {canAdjust && withDiscrepancies.length ? (
        <AppAlert
          description={
            <>
              El efectivo contado al abrir no coincide en{" "}
              {withDiscrepancies.map((register, index) => (
                <span key={register.id}>
                  {index ? ", " : ""}
                  <NextLink
                    className="font-medium underline"
                    href={`/pos/registers/${register.id}`}
                  >
                    {register.name}
                  </NextLink>
                </span>
              ))}
              . Revisa sus diferencias reportadas y registra un ajuste para que
              puedan abrirse.
            </>
          }
          status="danger"
          title="Diferencias de efectivo reportadas"
        />
      ) : null}
      {registers.error ? (
        <QueryError
          error={registers.error}
          onRetry={() => registers.refetch()}
        />
      ) : data?.registerCount === 0 ? (
        <AppEmptyState
          description="Crea una caja para empezar a vender en el punto de venta."
          icon={<StoreIcon size={20} />}
          title="Sin cajas"
        />
      ) : (
        <AppDataTable<CashRegisterItem, Column>
          columns={COLUMNS}
          emptyContent="Ninguna caja coincide con la búsqueda"
          getRowKey={(register) => register.id}
          label="Cajas"
          pagination={list.pagination(data)}
          query={registers}
          renderCell={renderCell}
          rows={data?.items ?? []}
          search={{
            ...list.search,
            placeholder: "Buscar por caja o persona…",
          }}
          sort={list.sort}
          onClearFilters={list.onClearFilters}
          onRowAction={(id) => router.push(`/pos/registers/${id}`)}
          onSortChange={list.onSortChange}
        />
      )}

      <CashRegisterFormModal isOpen={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  );
}
