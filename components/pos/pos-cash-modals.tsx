"use client";

import type { PosPaymentMethod } from "@/lib/actions/pos";
import type { CashSessionSummary } from "@/lib/pos";
import type {
  CashMovementFormValues,
  CloseCashSessionFormValues,
  CollectInvoiceFormValues,
  PosLoadSourceValues,
} from "@/lib/validations/pos";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";

import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppInput,
  AppModal,
  AppTextarea,
} from "@/components/ui";
import { CASH_MOVEMENT_TYPES } from "@/config/pos";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { unwrapAction } from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import {
  addCashMovement,
  closeCashSession,
  collectInvoiceAtPos,
  getPosInvoiceBalance,
  getPosSourceDocument,
} from "@/lib/actions/pos";
import { optionSources } from "@/lib/option-sources";
import { decimalToText } from "@/lib/pricing";
import { queryKeys } from "@/lib/query-keys";
import { roundMoney, typedNumber } from "@/lib/sales-math";
import {
  cashMovementFormSchema,
  closeCashSessionFormSchema,
  collectInvoiceFormSchema,
  posLoadSourceSchema,
} from "@/lib/validations/pos";

/** Figures of a session: what came in by method and the cash in the drawer. */
export function CashSummaryList({ summary }: { summary: CashSessionSummary }) {
  const money = useMoneyFormatter();
  const rows = [
    { label: "Fondo inicial", value: summary.openingAmount },
    { label: "Cobros en efectivo", value: summary.cashPayments },
    ...(summary.cashIn
      ? [{ label: "Entradas de efectivo", value: summary.cashIn }]
      : []),
    ...(summary.cashOut
      ? [{ label: "Salidas de efectivo", value: -summary.cashOut }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-muted">{row.label}</dt>
            <dd className="tabular-nums">{money.format(row.value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-separator pt-2 font-semibold">
          <dt>Efectivo esperado en caja</dt>
          <dd className="tabular-nums">{money.format(summary.expectedCash)}</dd>
        </div>
      </dl>
      {summary.payments.length ? (
        <dl className="flex flex-col gap-2 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Cobrado por forma de pago
          </p>
          {summary.payments.map((method) => (
            <div key={method.id} className="flex justify-between gap-4">
              <dt>{method.name}</dt>
              <dd className="tabular-nums">{money.format(method.amount)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-separator pt-2 font-semibold">
            <dt>Total cobrado</dt>
            <dd className="tabular-nums">
              {money.format(summary.totalCollected)}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

const MOVEMENT_FORM = "cash-movement-form";

export function CashMovementModal({
  sessionId,
  isOpen,
  onOpenChange,
}: {
  sessionId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const add = useActionMutation(addCashMovement, {
    successMessage: "Movimiento registrado",
    invalidate: [queryKeys.pos],
  });
  const { control, handleSubmit } = useForm<CashMovementFormValues>({
    resolver: zodResolver(cashMovementFormSchema),
    defaultValues: { type: "OUT", amount: "", reason: "" },
  });

  return (
    <AppModal
      description="Efectivo que entra o sale del cajón sin ser una venta, por ejemplo cambio o un pequeño gasto."
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
      title="Movimiento de efectivo"
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id={MOVEMENT_FORM}
        onSubmit={handleSubmit((values) =>
          add.mutate(
            { sessionId, values },
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
            options={CASH_MOVEMENT_TYPES.map((item) => ({
              value: item.type,
              label: item.label,
            }))}
          />
          <AppInput
            isRequired
            control={control}
            inputMode="decimal"
            label="Importe"
            name="amount"
          />
        </div>
        <AppInput
          isRequired
          control={control}
          label="Motivo"
          name="reason"
          placeholder="Por ejemplo: cambio del banco, pago a un repartidor"
        />
      </form>
    </AppModal>
  );
}

const CLOSE_FORM = "close-cash-session-form";

/** Cash count: the cash counted against what should be in the drawer. */
export function CloseSessionModal({
  sessionId,
  registerName,
  summary,
  isOpen,
  onOpenChange,
  onClosed,
}: {
  sessionId: string;
  registerName: string;
  summary: CashSessionSummary;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClosed?: () => void;
}) {
  const money = useMoneyFormatter();
  const close = useActionMutation(closeCashSession, {
    successMessage: "Caja cerrada",
    invalidate: [queryKeys.pos],
  });
  const { control, handleSubmit } = useForm<CloseCashSessionFormValues>({
    resolver: zodResolver(closeCashSessionFormSchema),
    defaultValues: { countedCash: "", notes: "" },
  });
  const counted = useWatch({ control, name: "countedCash" });
  const difference = roundMoney(typedNumber(counted) - summary.expectedCash);

  return (
    <AppModal
      description="Cuenta el efectivo del cajón. Una vez cerrada, sus tickets y cobros ya no se pueden anular."
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton
            form={CLOSE_FORM}
            isPending={close.isPending}
            type="submit"
          >
            Cerrar caja
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title={`Cerrar ${registerName}`}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id={CLOSE_FORM}
        onSubmit={handleSubmit((values) =>
          close.mutate(
            { sessionId, values },
            {
              onSuccess: () => {
                onOpenChange(false);
                onClosed?.();
              },
            },
          ),
        )}
      >
        {close.error ? (
          <AppAlert
            description={close.error.message}
            status="danger"
            title="No se pudo cerrar la caja"
          />
        ) : null}
        <CashSummaryList summary={summary} />
        <AppInput
          isRequired
          control={control}
          inputMode="decimal"
          label="Efectivo contado"
          name="countedCash"
        />
        {counted ? (
          <p
            className={clsx(
              "rounded-xl px-3 py-2 text-sm font-medium",
              difference === 0
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger",
            )}
          >
            {difference === 0
              ? "La caja cuadra."
              : difference > 0
                ? `Sobran ${money.format(difference)}.`
                : `Faltan ${money.format(-difference)}.`}
          </p>
        ) : null}
        <AppTextarea
          control={control}
          label="Notas del cierre"
          name="notes"
          rows={3}
        />
      </form>
    </AppModal>
  );
}

const COLLECT_FORM = "collect-invoice-form";

/** Collects an invoice of the sales module into the open till. */
export function CollectInvoiceModal({
  paymentMethods,
  isOpen,
  onOpenChange,
}: {
  paymentMethods: PosPaymentMethod[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const money = useMoneyFormatter();
  const [balance, setBalance] = useState<number>();
  const [change, setChange] = useState<number>();
  const collect = useActionMutation(collectInvoiceAtPos, {
    successMessage: "Cobro registrado en la caja",
    invalidate: [queryKeys.sales],
  });
  const loadBalance = useMutation({
    mutationFn: (id: string) => unwrapAction(getPosInvoiceBalance(id)),
  });
  const { control, handleSubmit, setValue } = useForm<CollectInvoiceFormValues>(
    {
      resolver: zodResolver(collectInvoiceFormSchema),
      defaultValues: {
        documentId: "",
        payment: {
          paymentMethodId:
            (
              paymentMethods.find((method) => method.kind === "CASH") ??
              paymentMethods[0]
            )?.id ?? "",
          amount: "",
          tendered: "",
        },
      },
    },
  );
  const methodId = useWatch({ control, name: "payment.paymentMethodId" });
  const isCash =
    paymentMethods.find((method) => method.id === methodId)?.kind === "CASH";

  const onInvoice = (id: string) => {
    setBalance(undefined);
    if (!id) return;
    loadBalance.mutate(id, {
      onSuccess: (data) => {
        setBalance(data.balance);
        setValue("payment.amount", decimalToText(data.balance));
      },
    });
  };

  return (
    <AppModal
      description="Registra en esta caja el cobro de una factura emitida desde Ventas."
      footer={
        change === undefined ? (
          <>
            <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
              Cancelar
            </AppButton>
            <AppButton
              form={COLLECT_FORM}
              isPending={collect.isPending}
              type="submit"
            >
              Cobrar
            </AppButton>
          </>
        ) : (
          <AppButton onPress={() => onOpenChange(false)}>Hecho</AppButton>
        )
      }
      isOpen={isOpen}
      title="Cobrar factura"
      onOpenChange={onOpenChange}
    >
      {change !== undefined ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-accent/10 p-4 text-center">
          <p className="text-sm text-muted">
            {change > 0 ? "Cambio a devolver" : "Cobro registrado"}
          </p>
          {change > 0 ? (
            <p className="text-3xl font-bold tracking-tight tabular-nums">
              {money.format(change)}
            </p>
          ) : null}
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          id={COLLECT_FORM}
          onSubmit={handleSubmit((values) =>
            collect.mutate(values, {
              onSuccess: (data) => setChange(data.change),
            }),
          )}
        >
          {collect.error ? (
            <AppAlert
              description={collect.error.message}
              status="danger"
              title="No se pudo cobrar"
            />
          ) : null}
          <AppAutocomplete
            isRequired
            control={control}
            label="Factura"
            name="documentId"
            placeholder="Número, cliente o NIF"
            source={optionSources.pendingInvoices}
            onValueChange={onInvoice}
          />
          {balance !== undefined ? (
            <p className="text-sm text-muted">
              Pendiente de cobro:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {money.format(balance)}
              </span>
            </p>
          ) : null}
          <AppAutocomplete
            isRequired
            control={control}
            label="Forma de pago"
            name="payment.paymentMethodId"
            options={paymentMethods.map((method) => ({
              value: method.id,
              label: method.name,
            }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput
              isRequired
              control={control}
              inputMode="decimal"
              label="Importe"
              name="payment.amount"
            />
            {isCash ? (
              <AppInput
                control={control}
                inputMode="decimal"
                label="Entregado"
                name="payment.tendered"
              />
            ) : null}
          </div>
        </form>
      )}
    </AppModal>
  );
}

const LOAD_FORM = "load-pos-source-form";

export type PosSourceDocument = Extract<
  Awaited<ReturnType<typeof getPosSourceDocument>>,
  { ok: true }
>["data"];

/** Picks an open quote or order to charge it at the till. */
export function LoadDocumentModal({
  hasCart,
  isOpen,
  onOpenChange,
  onLoad,
}: {
  hasCart: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onLoad: (document: PosSourceDocument) => void;
}) {
  const load = useMutation({
    mutationFn: (id: string) => unwrapAction(getPosSourceDocument(id)),
  });
  const { control, handleSubmit } = useForm<PosLoadSourceValues>({
    resolver: zodResolver(posLoadSourceSchema),
    defaultValues: { documentId: "" },
  });

  return (
    <AppModal
      description={
        hasCart
          ? "Sustituirá los artículos del ticket actual."
          : "El ticket quedará enlazado al documento en el flujo de la venta."
      }
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton form={LOAD_FORM} isPending={load.isPending} type="submit">
            Cargar
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title="Cargar presupuesto o pedido"
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id={LOAD_FORM}
        onSubmit={handleSubmit(({ documentId }) => {
          load.mutate(documentId, {
            onSuccess: (document) => {
              onLoad(document);
              onOpenChange(false);
            },
          });
        })}
      >
        {load.error ? (
          <AppAlert
            description={load.error.message}
            status="danger"
            title="No se pudo cargar"
          />
        ) : null}
        <AppAutocomplete
          isRequired
          control={control}
          label="Documento"
          name="documentId"
          placeholder="Número, cliente o referencia"
          source={optionSources.posSources}
        />
      </form>
    </AppModal>
  );
}
