"use client";

import type { CustomerStatusItem } from "@/lib/actions/customer-statuses";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CustomerStatusChip } from "@/components/customers/customer-format";
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
import {
  AppButton,
  AppCard,
  AppColorPicker,
  AppConfirm,
  AppInput,
  AppModal,
} from "@/components/ui";
import { DEFAULT_COLOR } from "@/config/colors";
import { CUSTOMER_LIMITS } from "@/config/customers";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCustomerStatuses } from "@/hooks/use-customers";
import { usePermission } from "@/hooks/use-organization";
import {
  createCustomerStatus,
  deleteCustomerStatus,
  moveCustomerStatus,
  updateCustomerStatusDefinition,
} from "@/lib/actions/customer-statuses";
import { queryKeys } from "@/lib/query-keys";
import {
  type CustomerStatusFormValues,
  customerStatusFormSchema,
} from "@/lib/validations/customers";

const invalidate = [queryKeys.customers];

function StatusFormModal({
  isOpen,
  onOpenChange,
  status,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  status?: CustomerStatusItem;
}) {
  const create = useActionMutation(createCustomerStatus, {
    successMessage: "Estado creado",
    invalidate,
  });
  const update = useActionMutation(updateCustomerStatusDefinition, {
    successMessage: "Estado actualizado",
    invalidate,
  });
  const mutation = status ? update : create;
  const { control, handleSubmit, reset } = useForm<CustomerStatusFormValues>({
    resolver: zodResolver(customerStatusFormSchema),
    defaultValues: { label: "", color: DEFAULT_COLOR },
  });
  const [label, color] = useWatch({ control, name: ["label", "color"] });

  useEffect(() => {
    if (isOpen) {
      reset(
        status
          ? { label: status.label, color: status.color }
          : { label: "", color: DEFAULT_COLOR },
      );
    }
  }, [isOpen, status, reset]);

  const onSubmit = handleSubmit((values) => {
    const close = { onSuccess: () => onOpenChange(false) };

    if (status) update.mutate({ id: status.id, values }, close);
    else create.mutate(values, close);
  });

  return (
    <AppModal
      description="Los estados forman el ciclo de vida de tus clientes."
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton
            form="customer-status-form"
            isPending={mutation.isPending}
            type="submit"
          >
            {status ? "Guardar" : "Crear estado"}
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title={status ? "Editar estado" : "Nuevo estado"}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id="customer-status-form"
        onSubmit={onSubmit}
      >
        <AppInput
          isRequired
          control={control}
          label="Nombre"
          name="label"
          placeholder="Por ejemplo, Negociación"
        />
        <AppColorPicker control={control} label="Color" name="color" />
        <div className="flex items-center gap-2 text-sm text-muted">
          Vista previa:
          <CustomerStatusChip
            status={{
              label: label?.trim() || "Estado",
              color: color || DEFAULT_COLOR,
            }}
          />
        </div>
      </form>
    </AppModal>
  );
}

/** Statuses editor; changing them requires `organization:update`. */
export function CustomerStatusesSettings() {
  const canEdit = usePermission({ organization: ["update"] });
  const statuses = useCustomerStatuses();
  const [editing, setEditing] = useState<CustomerStatusItem>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CustomerStatusItem>();

  const move = useActionMutation(moveCustomerStatus, { invalidate });
  const remove = useActionMutation(deleteCustomerStatus, {
    successMessage: "Estado eliminado",
    invalidate,
  });

  const openForm = (status?: CustomerStatusItem) => {
    setEditing(status);
    setIsFormOpen(true);
  };

  const items = statuses.data ?? [];
  const isFull = items.length >= CUSTOMER_LIMITS.maxStatuses;

  return (
    <AppCard
      description="En orden. Los clientes nuevos empiezan en el primer estado."
      title="Estados"
    >
      {statuses.error ? (
        <QueryError error={statuses.error} onRetry={() => statuses.refetch()} />
      ) : statuses.isPending ? (
        <ListSkeleton rows={3} />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-separator">
            {items.map((status, index) => (
              <li
                key={status.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-5 text-right text-xs tabular-nums text-muted">
                    {index + 1}
                  </span>
                  <CustomerStatusChip status={status} />
                  <span className="text-xs text-muted">
                    {status.customerCount === 1
                      ? "1 cliente"
                      : `${status.customerCount} clientes`}
                  </span>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <AppButton
                      isIconOnly
                      aria-label={`Subir ${status.label}`}
                      isDisabled={index === 0 || move.isPending}
                      size="sm"
                      variant="ghost"
                      onPress={() =>
                        move.mutate({ id: status.id, direction: "up" })
                      }
                    >
                      <ArrowUpIcon size={14} />
                    </AppButton>
                    <AppButton
                      isIconOnly
                      aria-label={`Bajar ${status.label}`}
                      isDisabled={index === items.length - 1 || move.isPending}
                      size="sm"
                      variant="ghost"
                      onPress={() =>
                        move.mutate({ id: status.id, direction: "down" })
                      }
                    >
                      <ArrowDownIcon size={14} />
                    </AppButton>
                    <AppButton
                      isIconOnly
                      aria-label={`Editar ${status.label}`}
                      size="sm"
                      variant="ghost"
                      onPress={() => openForm(status)}
                    >
                      <PencilIcon size={14} />
                    </AppButton>
                    <AppButton
                      isIconOnly
                      aria-label={`Eliminar ${status.label}`}
                      isDisabled={status.customerCount > 0}
                      size="sm"
                      variant="ghost"
                      onPress={() => setToDelete(status)}
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
                Solo se pueden eliminar los estados sin clientes.
              </p>
              <AppButton
                isDisabled={isFull}
                size="sm"
                variant="secondary"
                onPress={() => openForm()}
              >
                <PlusIcon size={14} />
                Añadir estado
              </AppButton>
            </div>
          ) : null}
        </>
      )}

      <StatusFormModal
        isOpen={isFormOpen}
        status={editing}
        onOpenChange={setIsFormOpen}
      />
      <AppConfirm
        confirmLabel="Eliminar"
        description={`El estado «${toDelete?.label ?? ""}» dejará de estar disponible.`}
        isOpen={Boolean(toDelete)}
        isPending={remove.isPending}
        title="Eliminar estado"
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => setToDelete(undefined),
          })
        }
        onOpenChange={(isOpen) => !isOpen && setToDelete(undefined)}
      />
    </AppCard>
  );
}
