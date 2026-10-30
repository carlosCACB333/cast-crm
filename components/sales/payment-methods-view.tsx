"use client";

import type { PaymentMethodItem } from "@/lib/actions/payment-methods";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppInput,
  AppModal,
  AppSwitch,
} from "@/components/ui";
import {
  PAYMENT_METHOD_KINDS,
  PAYMENT_METHOD_LIMITS,
  paymentMethodKindLabel,
} from "@/config/payment-methods";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { usePermission } from "@/hooks/use-organization";
import { usePaymentMethods } from "@/hooks/use-pos";
import {
  createPaymentMethod,
  deletePaymentMethod,
  movePaymentMethod,
  updatePaymentMethod,
} from "@/lib/actions/payment-methods";
import { queryKeys } from "@/lib/query-keys";
import {
  type PaymentMethodFormValues,
  paymentMethodFormSchema,
} from "@/lib/validations/payment-methods";

const FORM_ID = "payment-method-form";
const EMPTY: PaymentMethodFormValues = {
  name: "",
  kind: "OTHER",
  isActive: true,
};
// Payment method options and the till read them, so refresh both.
const invalidate = [queryKeys.paymentMethods, queryKeys.pos];

function PaymentMethodModal({
  method,
  isOpen,
  onOpenChange,
}: {
  method?: PaymentMethodItem;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const create = useActionMutation(createPaymentMethod, {
    successMessage: "Forma de pago creada",
    invalidate,
  });
  const update = useActionMutation(updatePaymentMethod, {
    successMessage: "Forma de pago actualizada",
    invalidate,
  });
  const mutation = method ? update : create;
  const { control, handleSubmit, reset } = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodFormSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (isOpen) {
      reset(
        method
          ? { name: method.name, kind: method.kind, isActive: method.isActive }
          : EMPTY,
      );
    }
  }, [isOpen, method, reset]);

  const onSubmit = handleSubmit((values) => {
    const close = { onSuccess: () => onOpenChange(false) };

    if (method) update.mutate({ id: method.id, values }, close);
    else create.mutate(values, close);
  });

  return (
    <AppModal
      description="Se ofrecen al registrar cobros de facturas y al cobrar en el punto de venta."
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton
            form={FORM_ID}
            isPending={mutation.isPending}
            type="submit"
          >
            {method ? "Guardar" : "Crear forma de pago"}
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title={method ? "Editar forma de pago" : "Nueva forma de pago"}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id={FORM_ID}
        onSubmit={onSubmit}
      >
        {mutation.error ? (
          <AppAlert
            description={mutation.error.message}
            status="danger"
            title="No se pudo guardar"
          />
        ) : null}
        <AppInput
          isRequired
          control={control}
          label="Nombre"
          name="name"
          placeholder="Por ejemplo: Bizum, Yape, Vale regalo"
        />
        <AppAutocomplete
          isRequired
          control={control}
          label="Tipo"
          name="kind"
          options={PAYMENT_METHOD_KINDS.map((item) => ({
            value: item.kind,
            label: item.label,
            description: item.description,
          }))}
        />
        <AppSwitch
          control={control}
          description="Las formas de pago inactivas siguen en los cobros antiguos pero no se ofrecen en los nuevos."
          label="Activa"
          name="isActive"
        />
      </form>
    </AppModal>
  );
}

/** Payment methods of the organization, shared by invoices and the till. */
export function PaymentMethodsView() {
  const methods = usePaymentMethods();
  const canEdit = usePermission({ organization: ["update"] });
  const [editing, setEditing] = useState<PaymentMethodItem>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<PaymentMethodItem>();
  const move = useActionMutation(movePaymentMethod, { invalidate });
  const remove = useActionMutation(deletePaymentMethod, {
    successMessage: "Forma de pago eliminada",
    invalidate,
  });
  const items = methods.data ?? [];

  const openForm = (method?: PaymentMethodItem) => {
    setEditing(method);
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Cómo te pagan tus clientes. Las de tipo efectivo entran en el arqueo de caja del punto de venta."
        title="Formas de pago"
      />
      {!canEdit ? (
        <AppAlert
          description="Solo quienes pueden editar la organización cambian las formas de pago."
          status="accent"
          title="Solo lectura"
        />
      ) : null}
      <AppCard>
        {methods.error ? (
          <QueryError error={methods.error} onRetry={() => methods.refetch()} />
        ) : methods.isPending ? (
          <ListSkeleton rows={4} />
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-separator">
              {items.map((method, index) => (
                <li
                  key={method.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="w-5 text-right text-xs tabular-nums text-muted">
                      {index + 1}
                    </span>
                    <span className="font-medium">{method.name}</span>
                    <AppChip
                      color={method.kind === "CASH" ? "success" : "default"}
                      size="sm"
                    >
                      {paymentMethodKindLabel(method.kind)}
                    </AppChip>
                    {!method.isActive ? (
                      <AppChip color="warning" size="sm">
                        Inactiva
                      </AppChip>
                    ) : null}
                    <span className="text-xs text-muted">
                      {method.paymentCount === 1
                        ? "1 cobro"
                        : `${method.paymentCount} cobros`}
                    </span>
                  </div>
                  {canEdit ? (
                    <div className="flex items-center gap-1">
                      <AppButton
                        isIconOnly
                        aria-label={`Subir ${method.name}`}
                        isDisabled={index === 0 || move.isPending}
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          move.mutate({ id: method.id, direction: "up" })
                        }
                      >
                        <ArrowUpIcon size={14} />
                      </AppButton>
                      <AppButton
                        isIconOnly
                        aria-label={`Bajar ${method.name}`}
                        isDisabled={
                          index === items.length - 1 || move.isPending
                        }
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          move.mutate({ id: method.id, direction: "down" })
                        }
                      >
                        <ArrowDownIcon size={14} />
                      </AppButton>
                      <AppButton
                        isIconOnly
                        aria-label={`Editar ${method.name}`}
                        size="sm"
                        variant="ghost"
                        onPress={() => openForm(method)}
                      >
                        <PencilIcon size={14} />
                      </AppButton>
                      <AppButton
                        isIconOnly
                        aria-label={`Eliminar ${method.name}`}
                        isDisabled={method.paymentCount > 0}
                        size="sm"
                        variant="ghost"
                        onPress={() => setToDelete(method)}
                      >
                        <TrashIcon size={14} />
                      </AppButton>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted">
                  Las formas de pago con cobros no se eliminan: desactívalas. El
                  orden es el que se ve al cobrar.
                </p>
                <AppButton
                  isDisabled={items.length >= PAYMENT_METHOD_LIMITS.maxMethods}
                  size="sm"
                  variant="secondary"
                  onPress={() => openForm()}
                >
                  <PlusIcon size={14} />
                  Añadir forma de pago
                </AppButton>
              </div>
            ) : null}
          </>
        )}
      </AppCard>

      <PaymentMethodModal
        isOpen={isFormOpen}
        method={editing}
        onOpenChange={setIsFormOpen}
      />
      <AppConfirm
        confirmLabel="Eliminar"
        description={`«${toDelete?.name ?? ""}» dejará de estar disponible.`}
        isOpen={Boolean(toDelete)}
        isPending={remove.isPending}
        title="Eliminar forma de pago"
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => setToDelete(undefined),
          })
        }
        onOpenChange={(isOpen) => !isOpen && setToDelete(undefined)}
      />
    </div>
  );
}
