"use client";

import type { CashRegisterItem } from "@/lib/actions/pos";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  AppAlert,
  AppButton,
  AppInput,
  AppModal,
  AppSwitch,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { createCashRegister, updateCashRegister } from "@/lib/actions/pos";
import { queryKeys } from "@/lib/query-keys";
import {
  type CashRegisterFormValues,
  cashRegisterFormSchema,
} from "@/lib/validations/pos";

const FORM_ID = "cash-register-form";
const EMPTY: CashRegisterFormValues = { name: "", isActive: true };

/** Creates a register, or edits one when `register` is given. */
export function CashRegisterFormModal({
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
