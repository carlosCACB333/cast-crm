"use client";

import type { PosPaymentMethod } from "@/lib/actions/pos";
import type {
  PosCartValues,
  PosCheckoutFormValues,
} from "@/lib/validations/pos";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";

import {
  CheckIcon,
  PlusIcon,
  PrinterIcon,
  TrashIcon,
} from "@/components/icons";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppInput,
  AppModal,
} from "@/components/ui";
import { POS_LIMITS } from "@/config/pos";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { createPosTicket } from "@/lib/actions/pos";
import { decimalToText } from "@/lib/pricing";
import { queryKeys } from "@/lib/query-keys";
import { roundMoney, typedNumber } from "@/lib/sales-math";
import { posCheckoutFormSchema } from "@/lib/validations/pos";

const FORM_ID = "pos-checkout-form";

/** Bills that cover `amount`, to type the cash handed over in one tap. */
function quickCash(amount: number) {
  const bills = [5, 10, 20, 50, 100, 200];
  const options = new Set<number>([amount]);

  for (const bill of bills) {
    const rounded = Math.ceil(amount / bill) * bill;

    if (rounded > amount) options.add(rounded);
    if (options.size >= 4) break;
  }

  return [...options];
}

function SaleDone({
  ticket,
  onPrint,
  onNewSale,
}: {
  ticket: { number: string; change: number };
  onPrint: () => void;
  onNewSale: () => void;
}) {
  const money = useMoneyFormatter();

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckIcon size={28} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">Venta registrada</p>
        <p className="text-sm text-muted tabular-nums">
          Ticket {ticket.number}
        </p>
      </div>
      {ticket.change > 0 ? (
        <div className="w-full rounded-2xl bg-accent/10 p-4">
          <p className="text-sm text-muted">Cambio a devolver</p>
          <p className="text-3xl font-bold tracking-tight tabular-nums">
            {money.format(ticket.change)}
          </p>
        </div>
      ) : null}
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <AppButton fullWidth variant="secondary" onPress={onPrint}>
          <PrinterIcon size={16} />
          Imprimir ticket
        </AppButton>
        <AppButton fullWidth onPress={onNewSale}>
          Nueva venta
        </AppButton>
      </div>
    </div>
  );
}

/**
 * Charges the cart: one or more payment methods that add up to the total,
 * with the cash handed over and its change.
 */
export function PosCheckoutModal({
  cart,
  total,
  paymentMethods,
  isOpen,
  onOpenChange,
  onSold,
}: {
  cart: PosCartValues;
  total: number;
  paymentMethods: PosPaymentMethod[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Called after "Nueva venta", to empty the cart. */
  onSold: () => void;
}) {
  const money = useMoneyFormatter();
  const [ticket, setTicket] = useState<{
    id: string;
    number: string;
    change: number;
  }>();
  const sell = useActionMutation(createPosTicket, {
    invalidate: [queryKeys.sales, queryKeys.products],
  });
  const firstMethod =
    paymentMethods.find((method) => method.kind === "CASH") ??
    paymentMethods[0];
  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<PosCheckoutFormValues>({
    resolver: zodResolver(posCheckoutFormSchema),
    defaultValues: {
      payments:
        total > 0 && firstMethod
          ? [
              {
                paymentMethodId: firstMethod.id,
                amount: decimalToText(total),
                tendered: "",
              },
            ]
          : [],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "payments",
  });
  const payments = useWatch({ control, name: "payments" }) ?? [];
  const kindOf = (id: string) =>
    paymentMethods.find((method) => method.id === id)?.kind;
  const paid = roundMoney(
    payments.reduce((sum, payment) => sum + typedNumber(payment?.amount), 0),
  );
  const remaining = roundMoney(total - paid);
  const change = roundMoney(
    payments.reduce((sum, payment) => {
      if (!payment || kindOf(payment.paymentMethodId) !== "CASH") return sum;
      const tendered = typedNumber(payment.tendered);
      const amount = typedNumber(payment.amount);

      return tendered > amount ? sum + tendered - amount : sum;
    }, 0),
  );
  const options = paymentMethods.map((method) => ({
    value: method.id,
    label: method.name,
  }));

  const onSubmit = handleSubmit((values) => {
    if (remaining !== 0) {
      setError("root", {
        message:
          remaining > 0
            ? `Faltan ${money.format(remaining)} por cobrar.`
            : `Los pagos superan el total en ${money.format(-remaining)}.`,
      });

      return;
    }
    sell.mutate({ ...cart, ...values }, { onSuccess: setTicket });
  });

  const close = () => {
    if (ticket) onSold();
    onOpenChange(false);
  };

  return (
    <AppModal
      description={
        ticket ? undefined : "Cobra el total con una o varias formas de pago."
      }
      footer={
        ticket ? undefined : (
          <>
            <AppButton variant="tertiary" onPress={close}>
              Volver
            </AppButton>
            <AppButton
              form={FORM_ID}
              isDisabled={remaining !== 0}
              isPending={sell.isPending}
              type="submit"
            >
              Cobrar {money.format(total)}
            </AppButton>
          </>
        )
      }
      isOpen={isOpen}
      title={ticket ? "Cobro completado" : "Cobrar"}
      onOpenChange={(open) => (open ? onOpenChange(true) : close())}
    >
      {ticket ? (
        <SaleDone
          ticket={ticket}
          onNewSale={close}
          onPrint={() =>
            window.open(`/print/sales/${ticket.id}`, "_blank", "noopener")
          }
        />
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          id={FORM_ID}
          onSubmit={onSubmit}
        >
          {sell.error || errors.root ? (
            <AppAlert
              description={sell.error?.message ?? errors.root?.message}
              status="danger"
              title="No se pudo cobrar"
            />
          ) : null}
          <div className="flex items-baseline justify-between rounded-2xl bg-default p-4">
            <span className="text-sm text-muted">Total</span>
            <span className="text-3xl font-bold tracking-tight tabular-nums">
              {money.format(total)}
            </span>
          </div>

          {fields.map((field, index) => {
            const payment = payments[index];
            const isCash = kindOf(payment?.paymentMethodId ?? "") === "CASH";
            const amount = typedNumber(payment?.amount);

            return (
              <fieldset
                key={field.id}
                className="flex flex-col gap-3 rounded-2xl border border-separator p-3"
              >
                <legend className="sr-only">Pago {index + 1}</legend>
                <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                  <AppAutocomplete
                    isRequired
                    control={control}
                    label="Forma de pago"
                    name={`payments.${index}.paymentMethodId`}
                    options={options}
                  />
                  {fields.length > 1 ? (
                    <div className="pt-6">
                      <AppButton
                        isIconOnly
                        aria-label={`Quitar pago ${index + 1}`}
                        size="sm"
                        variant="ghost"
                        onPress={() => remove(index)}
                      >
                        <TrashIcon size={16} />
                      </AppButton>
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AppInput
                    isRequired
                    control={control}
                    inputMode="decimal"
                    label="Importe"
                    name={`payments.${index}.amount`}
                  />
                  {isCash ? (
                    <AppInput
                      control={control}
                      inputMode="decimal"
                      label="Entregado"
                      name={`payments.${index}.tendered`}
                      placeholder={decimalToText(amount)}
                    />
                  ) : null}
                </div>
                {isCash && amount > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {quickCash(amount).map((value) => (
                      <AppButton
                        key={value}
                        size="sm"
                        variant="tertiary"
                        onPress={() =>
                          setValue(
                            `payments.${index}.tendered`,
                            decimalToText(value),
                          )
                        }
                      >
                        {money.format(value)}
                      </AppButton>
                    ))}
                  </div>
                ) : null}
              </fieldset>
            );
          })}

          {fields.length < POS_LIMITS.maxPaymentsPerTicket && total > 0 ? (
            <AppButton
              isDisabled={remaining <= 0}
              size="sm"
              variant="secondary"
              onPress={() =>
                append({
                  paymentMethodId:
                    paymentMethods.find(
                      (method) =>
                        !payments.some(
                          (payment) => payment?.paymentMethodId === method.id,
                        ),
                    )?.id ?? "",
                  amount: decimalToText(Math.max(remaining, 0)),
                  tendered: "",
                })
              }
            >
              <PlusIcon size={14} />
              Añadir otra forma de pago
            </AppButton>
          ) : null}

          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Pendiente</dt>
              <dd
                className={clsx(
                  "font-medium tabular-nums",
                  remaining !== 0 && "text-danger",
                )}
              >
                {money.format(remaining)}
              </dd>
            </div>
            {change > 0 ? (
              <div className="flex justify-between text-base font-semibold">
                <dt>Cambio</dt>
                <dd className="tabular-nums">{money.format(change)}</dd>
              </div>
            ) : null}
          </dl>
        </form>
      )}
    </AppModal>
  );
}
