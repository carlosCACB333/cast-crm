"use client";

import type {
  CashDiscrepancyReportItem,
  CashRegisterItem,
  CashRegisterMovementItem,
} from "@/lib/actions/pos";
import type {
  CashDiscrepancyReportListParams,
  CashRegisterMovementFormValues,
  CashRegisterMovementListParams,
} from "@/lib/validations/pos";

import { useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";

import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowsUpDownIcon,
  BanknoteIcon,
  PencilIcon,
  PlusIcon,
  StoreIcon,
  TrashIcon,
} from "@/components/icons";
import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import { CashRegisterFormModal } from "@/components/pos/cash-register-form-modal";
import {
  AppAlert,
  AppAutocomplete,
  AppAvatar,
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppDataTable,
  AppEmptyState,
  AppInput,
  AppModal,
  AppStatCard,
  AppTextarea,
  AppTooltip,
} from "@/components/ui";
import {
  CASH_DISCREPANCY_STATUSES,
  CASH_REGISTER_MOVEMENT_TYPES,
  type CashDiscrepancyStatus,
  type CashRegisterMovementType,
  cashRegisterMovementLabel,
} from "@/config/pos";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-organization";
import {
  useCashDiscrepancyReports,
  useCashRegister,
  useCashRegisterMovements,
} from "@/hooks/use-pos";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { addCashRegisterMovement, deleteCashRegister } from "@/lib/actions/pos";
import { dateTimeFormatter, formatRelative } from "@/lib/format";
import { optionSources } from "@/lib/option-sources";
import { queryKeys } from "@/lib/query-keys";
import { roundMoney, typedNumber } from "@/lib/sales-math";
import {
  cashDiscrepancyReportListSchema,
  cashRegisterMovementFormSchema,
  cashRegisterMovementListSchema,
} from "@/lib/validations/pos";

const MOVEMENT_FORM = "cash-register-movement-form";

const TYPE_COLORS: Record<CashRegisterMovementType, string> = {
  IN: "bg-success/10 text-success",
  OUT: "bg-danger/10 text-danger",
  ADJUSTMENT: "bg-accent/10 text-accent",
};

/** Puts cash in, takes it out or adjusts the balance of a closed register. */
function RegisterMovementModal({
  register,
  isOpen,
  onOpenChange,
}: {
  register: CashRegisterItem;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const money = useMoneyFormatter();
  const add = useActionMutation(addCashRegisterMovement, {
    successMessage: "Movimiento registrado",
    invalidate: [queryKeys.pos],
  });
  const { control, handleSubmit } = useForm<CashRegisterMovementFormValues>({
    resolver: zodResolver(cashRegisterMovementFormSchema),
    defaultValues: { type: "IN", amount: "", reason: "" },
  });
  const [type, amount] = useWatch({ control, name: ["type", "amount"] });
  const typed = typedNumber(amount);
  const balanceAfter =
    type === "ADJUSTMENT"
      ? typed
      : roundMoney(register.cashBalance + (type === "OUT" ? -typed : typed));

  return (
    <AppModal
      description={`Ahora tiene ${money.format(register.cashBalance)}. Con la caja abierta, el efectivo se mueve desde su apertura.`}
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton
            form={MOVEMENT_FORM}
            isPending={add.isPending}
            type="submit"
          >
            Registrar
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title={`Movimiento de ${register.name}`}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id={MOVEMENT_FORM}
        onSubmit={handleSubmit((values) =>
          add.mutate(
            { registerId: register.id, values },
            { onSuccess: () => onOpenChange(false) },
          ),
        )}
      >
        {add.error ? (
          <AppAlert
            description={add.error.message}
            status="danger"
            title="No se pudo registrar"
          />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <AppAutocomplete
            isRequired
            control={control}
            label="Tipo"
            name="type"
            options={CASH_REGISTER_MOVEMENT_TYPES.map((item) => ({
              value: item.type,
              label: item.label,
            }))}
          />
          <AppInput
            isRequired
            control={control}
            description={
              type === "ADJUSTMENT"
                ? "Efectivo que hay realmente en el cajón."
                : undefined
            }
            inputMode="decimal"
            label={type === "ADJUSTMENT" ? "Efectivo real" : "Importe"}
            name="amount"
          />
        </div>
        <AppTextarea
          isRequired
          control={control}
          label="Motivo"
          name="reason"
          placeholder={
            type === "ADJUSTMENT"
              ? "Por ejemplo: faltante revisado con el turno anterior"
              : "Por ejemplo: fondo de cambio, depósito en el banco"
          }
          rows={3}
        />
        {amount ? (
          <p
            className={clsx(
              "flex justify-between gap-4 text-sm font-semibold",
              balanceAfter < 0 && "text-danger",
            )}
          >
            <span>Quedará en la caja</span>
            <span className="tabular-nums">{money.format(balanceAfter)}</span>
          </p>
        ) : null}
      </form>
    </AppModal>
  );
}

function DateCell({ value }: { value: string }) {
  return (
    <span className="flex flex-col text-sm">
      <span className="whitespace-nowrap">
        {dateTimeFormatter.format(new Date(value))}
      </span>
      <span className="text-xs text-muted">{formatRelative(value)}</span>
    </span>
  );
}

function AuthorCell({
  author,
}: {
  author: CashRegisterMovementItem["author"];
}) {
  return author ? (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <AppAvatar name={author.name} size="sm" src={author.image} />
      <span className="truncate">{author.name}</span>
    </span>
  ) : (
    <span className="text-sm text-muted">—</span>
  );
}

type MovementColumn =
  "createdAt" | "type" | "amount" | "balanceAfter" | "reason" | "author";

/** Movements of a closed register, searched, filtered and paged on the server. */
function RegisterMovementsTable({ registerId }: { registerId: string }) {
  const money = useMoneyFormatter();
  const list = useListParams<CashRegisterMovementListParams>(
    cashRegisterMovementListSchema.parse({ registerId }),
  );
  const movements = useCashRegisterMovements(list.params);
  const data = movements.data;
  const isEmpty =
    data?.total === 0 &&
    !list.params.q &&
    !list.params.types.length &&
    !list.params.authorId;

  return (
    <AppCard
      description="Ingresos, salidas y ajustes del efectivo mientras la caja está cerrada. Lo que se mueve con la caja abierta queda en su apertura."
      title={`Movimientos${data && !isEmpty ? ` (${data.total})` : ""}`}
    >
      {isEmpty ? (
        <AppEmptyState
          description="Los ingresos, salidas y ajustes de esta caja aparecerán aquí."
          icon={<ArrowsUpDownIcon size={20} />}
          title="Sin movimientos todavía"
        />
      ) : (
        <AppDataTable<CashRegisterMovementItem, MovementColumn>
          columns={[
            {
              key: "createdAt",
              label: "Fecha",
              isRowHeader: true,
              allowsSorting: true,
              defaultWidth: 160,
            },
            {
              key: "type",
              label: "Tipo",
              defaultWidth: 120,
              filter: {
                type: "options",
                label: "Tipo",
                multiple: true,
                options: CASH_REGISTER_MOVEMENT_TYPES.map((item) => ({
                  value: item.type,
                  label: item.label,
                })),
                value: list.params.types,
                onChange: (types) =>
                  list.setParams({
                    types: types as CashRegisterMovementType[],
                  }),
              },
            },
            {
              key: "amount",
              label: "Importe",
              allowsSorting: true,
              className: "text-right",
              defaultWidth: 130,
            },
            {
              key: "balanceAfter",
              label: "Saldo después",
              className: "text-right",
              defaultWidth: 130,
            },
            { key: "reason", label: "Motivo", defaultWidth: "2fr" },
            {
              key: "author",
              label: "Registrado por",
              filter: {
                type: "options",
                label: "Registrado por",
                source: optionSources.members,
                value: list.params.authorId ? [list.params.authorId] : [],
                onChange: (value) =>
                  list.setParams({ authorId: value[0] ?? "" }),
              },
            },
          ]}
          emptyContent="No hay movimientos"
          getRowKey={(movement) => movement.id}
          label="Movimientos de la caja"
          pagination={list.pagination(data)}
          query={movements}
          renderCell={(movement, column) => {
            switch (column) {
              case "createdAt":
                return <DateCell value={movement.createdAt} />;
              case "type":
                return (
                  <span
                    className={clsx(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      TYPE_COLORS[movement.type],
                    )}
                  >
                    {cashRegisterMovementLabel(movement.type)}
                  </span>
                );
              case "amount":
                return (
                  <span
                    className={clsx(
                      "block text-right text-sm font-semibold whitespace-nowrap tabular-nums",
                      movement.amount > 0
                        ? "text-success"
                        : movement.amount < 0
                          ? "text-danger"
                          : "text-muted",
                    )}
                  >
                    {movement.amount > 0 ? "+" : ""}
                    {money.format(movement.amount)}
                  </span>
                );
              case "balanceAfter":
                return (
                  <span className="block text-right text-sm whitespace-nowrap tabular-nums">
                    {money.format(movement.balanceAfter)}
                  </span>
                );
              case "reason":
                return (
                  <span className="block truncate text-sm">
                    {movement.reason || (
                      <span className="text-muted">Sin motivo</span>
                    )}
                  </span>
                );
              case "author":
                return <AuthorCell author={movement.author} />;
            }
          }}
          rows={data?.items ?? []}
          search={{
            ...list.search,
            placeholder: "Buscar por motivo o persona…",
          }}
          sort={list.sort}
          onClearFilters={list.onClearFilters}
          onSortChange={list.onSortChange}
        />
      )}
    </AppCard>
  );
}

type ReportColumn =
  | "createdAt"
  | "author"
  | "expectedAmount"
  | "countedAmount"
  | "difference"
  | "reason"
  | "status";

/** Who found another amount when opening the register. Read only. */
function DiscrepancyReportsTable({ registerId }: { registerId: string }) {
  const money = useMoneyFormatter();
  const list = useListParams<CashDiscrepancyReportListParams>(
    cashDiscrepancyReportListSchema.parse({ registerId }),
  );
  const reports = useCashDiscrepancyReports(list.params);
  const data = reports.data;
  const isEmpty =
    data?.total === 0 &&
    !list.params.q &&
    !list.params.status &&
    !list.params.authorId;

  return (
    <AppCard
      description="Personas que contaron otra cantidad al abrir la caja. Se resuelven con el siguiente movimiento de la caja o al abrirla con el efectivo correcto."
      title={`Diferencias reportadas${data && !isEmpty ? ` (${data.total})` : ""}`}
    >
      {isEmpty ? (
        <AppEmptyState
          description="Nadie ha reportado diferencias al abrir esta caja."
          icon={<AlertTriangleIcon size={20} />}
          title="Sin diferencias reportadas"
        />
      ) : (
        <AppDataTable<CashDiscrepancyReportItem, ReportColumn>
          columns={[
            {
              key: "createdAt",
              label: "Fecha",
              isRowHeader: true,
              allowsSorting: true,
              defaultWidth: 160,
            },
            {
              key: "author",
              label: "Reportado por",
              filter: {
                type: "options",
                label: "Reportado por",
                source: optionSources.members,
                value: list.params.authorId ? [list.params.authorId] : [],
                onChange: (value) =>
                  list.setParams({ authorId: value[0] ?? "" }),
              },
            },
            {
              key: "expectedAmount",
              label: "Esperado",
              className: "text-right",
              defaultWidth: 120,
            },
            {
              key: "countedAmount",
              label: "Contado",
              className: "text-right",
              defaultWidth: 120,
            },
            {
              key: "difference",
              label: "Diferencia",
              className: "text-right",
              defaultWidth: 120,
            },
            { key: "reason", label: "Motivo", defaultWidth: "2fr" },
            {
              key: "status",
              label: "Estado",
              defaultWidth: 120,
              filter: {
                type: "options",
                label: "Estado",
                options: CASH_DISCREPANCY_STATUSES.map((item) => ({
                  value: item.status,
                  label: item.label,
                })),
                value: list.params.status ? [list.params.status] : [],
                onChange: (value) =>
                  list.setParams({
                    status: (value[0] ?? "") as CashDiscrepancyStatus | "",
                  }),
              },
            },
          ]}
          emptyContent="No hay diferencias"
          getRowKey={(report) => report.id}
          label="Diferencias reportadas"
          pagination={list.pagination(data)}
          query={reports}
          renderCell={(report, column) => {
            switch (column) {
              case "createdAt":
                return <DateCell value={report.createdAt} />;
              case "author":
                return <AuthorCell author={report.author} />;
              case "expectedAmount":
                return (
                  <span className="block text-right text-sm tabular-nums">
                    {money.format(report.expectedAmount)}
                  </span>
                );
              case "countedAmount":
                return (
                  <span className="block text-right text-sm tabular-nums">
                    {money.format(report.countedAmount)}
                  </span>
                );
              case "difference":
                return (
                  <span
                    className={clsx(
                      "block text-right text-sm font-semibold tabular-nums",
                      report.difference < 0 ? "text-danger" : "text-warning",
                    )}
                  >
                    {report.difference > 0 ? "+" : ""}
                    {money.format(report.difference)}
                  </span>
                );
              case "reason":
                return (
                  <span className="block truncate text-sm">
                    {report.reason}
                  </span>
                );
              case "status":
                return report.resolvedAt ? (
                  <AppChip size="sm">Resuelta</AppChip>
                ) : (
                  <AppChip color="danger" size="sm">
                    Pendiente
                  </AppChip>
                );
            }
          }}
          rows={data?.items ?? []}
          search={{
            ...list.search,
            placeholder: "Buscar por motivo o persona…",
          }}
          sort={list.sort}
          onClearFilters={list.onClearFilters}
          onSortChange={list.onSortChange}
        />
      )}
    </AppCard>
  );
}

/** A register: its cash, who has it open, its movements and reports. */
export function CashRegisterDetailView({ id }: { id: string }) {
  const money = useMoneyFormatter();
  const register = useCashRegister(id);
  const router = useRouter();
  const canAdjust = usePermission({ pos: ["adjust"] });
  const canManage = usePermission({ pos: ["manage"] });
  const [modal, setModal] = useState<"movement" | "edit" | "delete">();
  // Only the options: refetching this register would fail once deleted.
  const remove = useActionMutation(deleteCashRegister, {
    successMessage: "Caja eliminada",
    invalidate: [queryKeys.cashRegisterOptions],
  });
  const data = register.data;

  if (register.error) {
    return (
      <QueryError error={register.error} onRetry={() => register.refetch()} />
    );
  }
  if (!data) return <ListSkeleton rows={6} />;

  const canDelete = data.sessionCount === 0 && data.movementCount === 0;
  const closeModal = (isOpen: boolean) => !isOpen && setModal(undefined);
  const movementButton = (
    <AppButton
      isDisabled={Boolean(data.openSession)}
      onPress={() => setModal("movement")}
    >
      <PlusIcon size={16} />
      Movimiento
    </AppButton>
  );

  return (
    <div className="flex flex-col gap-6">
      <NextLink
        className="flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground"
        href="/pos/registers"
      >
        <ArrowLeftIcon size={14} />
        Cajas
      </NextLink>
      <PageHeader
        actions={
          <>
            {canManage ? (
              <>
                <AppTooltip content="Editar caja">
                  <AppButton
                    isIconOnly
                    aria-label={`Editar ${data.name}`}
                    variant="secondary"
                    onPress={() => setModal("edit")}
                  >
                    <PencilIcon size={16} />
                  </AppButton>
                </AppTooltip>
                <AppTooltip
                  content={
                    canDelete
                      ? "Eliminar caja"
                      : "Tiene aperturas o movimientos: desactívala desde Editar"
                  }
                >
                  <span>
                    <AppButton
                      isIconOnly
                      aria-label={`Eliminar ${data.name}`}
                      isDisabled={!canDelete}
                      variant="secondary"
                      onPress={() => setModal("delete")}
                    >
                      <TrashIcon size={16} />
                    </AppButton>
                  </span>
                </AppTooltip>
              </>
            ) : null}
            {canAdjust ? (
              data.openSession ? (
                <AppTooltip content="Con la caja abierta, el efectivo se mueve desde su apertura">
                  <span>{movementButton}</span>
                </AppTooltip>
              ) : (
                movementButton
              )
            ) : null}
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            {data.openSession ? (
              <AppChip color="success" size="sm">
                Abierta
              </AppChip>
            ) : (
              <AppChip size="sm">Cerrada</AppChip>
            )}
            {!data.isActive ? (
              <AppChip color="warning" size="sm">
                Inactiva
              </AppChip>
            ) : null}
            {data.openSession ? (
              <span>
                {data.openSession.openedBy?.name ?? "Alguien"} la abrió{" "}
                {formatRelative(data.openSession.openedAt)} ·{" "}
                <NextLink
                  className="text-accent hover:underline"
                  href={`/pos/sessions/${data.openSession.id}`}
                >
                  Ver apertura
                </NextLink>
              </span>
            ) : null}
          </span>
        }
        title={data.name}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <AppStatCard
          hint={
            data.openSession
              ? "Al abrir; se actualiza al cerrar"
              : "Debe contarse al abrirla"
          }
          icon={<BanknoteIcon size={18} />}
          label="Efectivo en caja"
          value={money.format(data.cashBalance)}
        />
        <AppStatCard
          hint={
            <NextLink className="hover:underline" href="/pos/sessions">
              Ver aperturas de caja
            </NextLink>
          }
          icon={<StoreIcon size={18} />}
          label="Aperturas"
          value={data.sessionCount}
        />
        <AppStatCard
          hint="Reportadas al abrir"
          icon={<AlertTriangleIcon size={18} />}
          label="Diferencias pendientes"
          tone={data.pendingDiscrepancies ? "danger" : "success"}
          value={data.pendingDiscrepancies}
        />
      </div>

      <RegisterMovementsTable registerId={data.id} />
      <DiscrepancyReportsTable registerId={data.id} />

      {modal === "movement" ? (
        <RegisterMovementModal
          isOpen
          register={data}
          onOpenChange={closeModal}
        />
      ) : null}
      <CashRegisterFormModal
        isOpen={modal === "edit"}
        register={data}
        onOpenChange={closeModal}
      />
      <AppConfirm
        confirmLabel="Eliminar"
        description={`La caja «${data.name}» dejará de existir.`}
        isOpen={modal === "delete"}
        isPending={remove.isPending}
        title="Eliminar caja"
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => router.replace("/pos/registers"),
          })
        }
        onOpenChange={closeModal}
      />
    </div>
  );
}
