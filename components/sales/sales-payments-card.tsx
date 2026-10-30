"use client";

import type { SalesDocumentDetail } from "@/lib/actions/sales";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";

import { PlusIcon, TrashIcon, WalletIcon } from "@/components/icons";
import { optionSources } from "@/lib/option-sources";
import { formatDay } from "@/components/sales/sales-format";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppCard,
  AppConfirm,
  AppInput,
  AppModal,
  AppSwitch,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { usePermission } from "@/hooks/use-organization";
import { usePaymentMethods, usePosState } from "@/hooks/use-pos";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { useSalesSettings } from "@/hooks/use-sales";
import { addSalesPayment, deleteSalesPayment } from "@/lib/actions/sales";
import { decimalToText } from "@/lib/pricing";
import { queryKeys } from "@/lib/query-keys";
import { roundMoney } from "@/lib/sales-math";
import {
  type SalesPaymentFormValues,
  salesPaymentFormSchema,
} from "@/lib/validations/sales";

const FORM_ID = "sales-payment-form";

function PaymentModal({
  document,
  balance,
  isOpen,
  onOpenChange,
}: {
  document: SalesDocumentDetail;
  balance: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const settings = useSalesSettings();
  const methods = usePaymentMethods();
  const canSell = usePermission({ pos: ["sell"] });
  const cashSession = usePosState({ enabled: canSell }).data?.session;
  const add = useActionMutation(addSalesPayment, {
    successMessage: "Cobro registrado",
    invalidate: [queryKeys.sales],
  });
  const { control, handleSubmit } = useForm<SalesPaymentFormValues>({
    resolver: zodResolver(salesPaymentFormSchema),
    defaultValues: {
      amount: decimalToText(balance),
      paidOn: settings.data?.today ?? new Date().toISOString().slice(0, 10),
      paymentMethodId:
        methods.data?.find((method) => method.isActive)?.id ?? "",
      note: "",
      toCashSession: false,
    },
  });

  return (
    <AppModal
      description="Si cubre todo lo pendiente, la factura pasará a cobrada."
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton form={FORM_ID} isPending={add.isPending} type="submit">
            Registrar cobro
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title="Registrar cobro"
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id={FORM_ID}
        onSubmit={handleSubmit((values) =>
          add.mutate(
            { documentId: document.id, values },
            { onSuccess: () => onOpenChange(false) },
          ),
        )}
      >
        {add.error ? (
          <AppAlert
            description={add.error.message}
            status="danger"
            title="No se pudo registrar el cobro"
          />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <AppInput
            isRequired
            control={control}
            inputMode="decimal"
            label="Importe"
            name="amount"
          />
          <AppInput
            isRequired
            control={control}
            label="Fecha"
            name="paidOn"
            type="date"
          />
        </div>
        <AppAutocomplete
          isRequired
          control={control}
          label="Forma de pago"
          name="paymentMethodId"
          source={optionSources.paymentMethods}
        />
        <AppInput control={control} label="Nota" name="note" />
        {cashSession ? (
          <AppSwitch
            control={control}
            description="El cobro entra en el arqueo de tu caja abierta del punto de venta."
            label={`Registrar en ${cashSession.registerName}`}
            name="toCashSession"
          />
        ) : null}
      </form>
    </AppModal>
  );
}

/** Payments of an invoice, what is still pending and a form to add more. */
export function SalesPaymentsCard({
  document,
}: {
  document: SalesDocumentDetail;
}) {
  const money = useMoneyFormatter();
  const canUpdate = usePermission({ sale: ["update"] });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string>();
  const remove = useActionMutation(deleteSalesPayment, {
    successMessage: "Cobro eliminado",
    invalidate: [queryKeys.sales],
  });

  const balance = roundMoney(document.total - document.paidTotal);
  const progress =
    document.total > 0
      ? Math.min(100, (document.paidTotal / document.total) * 100)
      : 0;
  const canAdd = canUpdate && document.status === "ISSUED" && balance > 0;

  return (
    <AppCard
      description={
        document.status === "DRAFT"
          ? "Emite la factura para registrar sus cobros."
          : balance > 0
            ? `Pendiente: ${money.format(balance)}`
            : "Cobrada por completo."
      }
      title="Cobros"
    >
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Cobrado</span>
          <span className="font-medium tabular-nums">
            {money.format(document.paidTotal)} de {money.format(document.total)}
          </span>
        </div>
        <div
          aria-label="Porcentaje cobrado"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(progress)}
          className="h-2 overflow-hidden rounded-full bg-default"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-success transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {document.payments.length ? (
        <ul className="flex flex-col divide-y divide-separator">
          {document.payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="flex min-w-0 flex-col">
                <span
                  className={clsx(
                    "font-medium tabular-nums",
                    payment.amount < 0 && "text-danger",
                  )}
                >
                  {payment.amount < 0 ? "Devolución " : ""}
                  {money.format(payment.amount)}
                </span>
                <span className="truncate text-xs text-muted">
                  {formatDay(payment.paidOn)} · {payment.paymentMethod.name}
                  {payment.cashSessionId ? " · En caja" : ""}
                  {payment.note ? ` · ${payment.note}` : ""}
                </span>
              </div>
              {canUpdate &&
              document.status !== "CANCELLED" &&
              document.channel !== "POS" &&
              payment.amount > 0 &&
              payment.cashSession?.status !== "CLOSED" ? (
                <AppButton
                  isIconOnly
                  aria-label="Eliminar cobro"
                  size="sm"
                  variant="ghost"
                  onPress={() => setToDelete(payment.id)}
                >
                  <TrashIcon size={16} />
                </AppButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : document.status !== "DRAFT" ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <WalletIcon size={16} />
          Aún no hay cobros registrados.
        </p>
      ) : null}

      {canAdd ? (
        <AppButton variant="secondary" onPress={() => setIsFormOpen(true)}>
          <PlusIcon size={16} />
          Registrar cobro
        </AppButton>
      ) : null}

      {isFormOpen ? (
        <PaymentModal
          balance={balance}
          document={document}
          isOpen={isFormOpen}
          onOpenChange={setIsFormOpen}
        />
      ) : null}

      <AppConfirm
        confirmLabel="Eliminar"
        description="Se eliminará el cobro y se recalculará lo pendiente de la factura."
        isOpen={Boolean(toDelete)}
        isPending={remove.isPending}
        title="Eliminar cobro"
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete, { onSuccess: () => setToDelete(undefined) })
        }
        onOpenChange={(isOpen) => !isOpen && setToDelete(undefined)}
      />
    </AppCard>
  );
}
