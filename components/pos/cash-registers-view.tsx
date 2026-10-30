"use client";

import type { CashRegisterItem } from "@/lib/actions/pos";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PencilIcon, PlusIcon, StoreIcon, TrashIcon } from "@/components/icons";
import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  AppAlert,
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppEmptyState,
  AppInput,
  AppModal,
  AppSwitch,
} from "@/components/ui";
import { POS_LIMITS } from "@/config/pos";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { usePermission } from "@/hooks/use-organization";
import { useCashRegisters } from "@/hooks/use-pos";
import {
  createCashRegister,
  deleteCashRegister,
  updateCashRegister,
} from "@/lib/actions/pos";
import { formatRelative } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import {
  type CashRegisterFormValues,
  cashRegisterFormSchema,
} from "@/lib/validations/pos";

const FORM_ID = "cash-register-form";
const EMPTY: CashRegisterFormValues = { name: "", isActive: true };

function RegisterModal({
  register,
  isOpen,
  onOpenChange,
}: {
  register?: CashRegisterItem;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const create = useActionMutation(createCashRegister, {
    successMessage: "Caja creada",
    invalidate: [queryKeys.pos],
  });
  const update = useActionMutation(updateCashRegister, {
    successMessage: "Caja actualizada",
    invalidate: [queryKeys.pos],
  });
  const mutation = register ? update : create;
  const { control, handleSubmit, reset } = useForm<CashRegisterFormValues>({
    resolver: zodResolver(cashRegisterFormSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (isOpen) {
      reset(
        register ? { name: register.name, isActive: register.isActive } : EMPTY,
      );
    }
  }, [isOpen, register, reset]);

  return (
    <AppModal
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
            {register ? "Guardar" : "Crear caja"}
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title={register ? "Editar caja" : "Nueva caja"}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id={FORM_ID}
        onSubmit={handleSubmit((values) => {
          const close = { onSuccess: () => onOpenChange(false) };

          if (register) update.mutate({ id: register.id, values }, close);
          else create.mutate(values, close);
        })}
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
          placeholder="Por ejemplo: Caja 1, Mostrador"
        />
        <AppSwitch
          control={control}
          description="Las cajas inactivas no se pueden abrir, pero conservan su historial."
          label="Activa"
          name="isActive"
        />
      </form>
    </AppModal>
  );
}

/** Registers of the point of sale and who has each one open. */
export function CashRegistersView() {
  const registers = useCashRegisters();
  const canManage = usePermission({ pos: ["manage"] });
  const [editing, setEditing] = useState<CashRegisterItem>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CashRegisterItem>();
  const remove = useActionMutation(deleteCashRegister, {
    successMessage: "Caja eliminada",
    invalidate: [queryKeys.pos],
  });
  const items = registers.data ?? [];

  const openForm = (register?: CashRegisterItem) => {
    setEditing(register);
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          canManage ? (
            <AppButton
              isDisabled={items.length >= POS_LIMITS.maxRegisters}
              onPress={() => openForm()}
            >
              <PlusIcon size={16} />
              Nueva caja
            </AppButton>
          ) : null
        }
        description="Los puestos de cobro del punto de venta. Cada caja la abre una persona a la vez."
        title="Cajas"
      />
      {registers.error ? (
        <QueryError
          error={registers.error}
          onRetry={() => registers.refetch()}
        />
      ) : registers.isPending ? (
        <ListSkeleton rows={3} />
      ) : items.length === 0 ? (
        <AppEmptyState
          description="Crea una caja para empezar a vender en el punto de venta."
          icon={<StoreIcon size={20} />}
          title="Sin cajas"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((register) => (
            <AppCard key={register.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-semibold">
                    {register.name}
                  </span>
                  <div className="flex flex-wrap gap-1">
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
                  </div>
                </div>
                {canManage ? (
                  <div className="flex gap-1">
                    <AppButton
                      isIconOnly
                      aria-label={`Editar ${register.name}`}
                      size="sm"
                      variant="ghost"
                      onPress={() => openForm(register)}
                    >
                      <PencilIcon size={14} />
                    </AppButton>
                    <AppButton
                      isIconOnly
                      aria-label={`Eliminar ${register.name}`}
                      isDisabled={register.sessionCount > 0}
                      size="sm"
                      variant="ghost"
                      onPress={() => setToDelete(register)}
                    >
                      <TrashIcon size={14} />
                    </AppButton>
                  </div>
                ) : null}
              </div>
              <p className="text-sm text-muted">
                {register.openSession ? (
                  <>
                    {register.openSession.openedBy?.name ?? "Alguien"} la abrió{" "}
                    {formatRelative(register.openSession.openedAt)} ·{" "}
                    <NextLink
                      className="text-accent hover:underline"
                      href={`/pos/sessions/${register.openSession.id}`}
                    >
                      Ver apertura
                    </NextLink>
                  </>
                ) : register.sessionCount ? (
                  `${register.sessionCount} aperturas registradas`
                ) : (
                  "Aún no se ha abierto."
                )}
              </p>
            </AppCard>
          ))}
        </div>
      )}

      <RegisterModal
        isOpen={isFormOpen}
        register={editing}
        onOpenChange={setIsFormOpen}
      />
      <AppConfirm
        confirmLabel="Eliminar"
        description={`La caja «${toDelete?.name ?? ""}» dejará de existir.`}
        isOpen={Boolean(toDelete)}
        isPending={remove.isPending}
        title="Eliminar caja"
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
