"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  AppAlert,
  AppButton,
  AppCheckboxGroup,
  AppInput,
  AppModal,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useMyAccess } from "@/hooks/use-organization";
import { createRole, updateRole } from "@/lib/actions/roles";
import {
  ACTION_LABELS,
  type Permissions,
  RESOURCE_LABELS,
  type Resource,
  statements,
} from "@/lib/permissions";
import { type RoleFormValues, roleFormSchema } from "@/lib/validations/roles";

export interface EditableRole {
  id: string;
  label: string;
  description: string | null;
  permission: Permissions | null;
}

interface RoleFormModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Role to edit; creates a new role when omitted. */
  role?: EditableRole;
}

const resources = Object.keys(statements) as Resource[];

function toFormValues(role?: EditableRole): RoleFormValues {
  return {
    label: role?.label ?? "",
    description: role?.description ?? "",
    permission: Object.fromEntries(
      resources.map((resource) => [
        resource,
        [...((role?.permission?.[resource] as string[] | undefined) ?? [])],
      ]),
    ),
  };
}

export function RoleFormModal({
  isOpen,
  onOpenChange,
  role,
}: RoleFormModalProps) {
  const { data: access } = useMyAccess();
  const create = useActionMutation(createRole, {
    successMessage: "Rol creado",
  });
  const update = useActionMutation(updateRole, {
    successMessage: "Rol actualizado",
  });
  const { control, handleSubmit, reset } = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: toFormValues(role),
  });

  useEffect(() => {
    if (isOpen) reset(toFormValues(role));
  }, [isOpen, role, reset]);

  const canGrant = (resource: Resource, action: string) =>
    access?.isOwner ||
    ((access?.permissions[resource] as string[] | undefined) ?? []).includes(
      action,
    );

  const onSubmit = (values: RoleFormValues) => {
    const options = { onSuccess: () => onOpenChange(false) };

    if (role) update.mutate({ ...values, roleId: role.id }, options);
    else create.mutate(values, options);
  };

  return (
    <AppModal
      description="Define qué puede hacer cada persona con este rol."
      isOpen={isOpen}
      title={role ? `Editar rol: ${role.label}` : "Nuevo rol"}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={handleSubmit(onSubmit)}
      >
        <AppInput
          isRequired
          control={control}
          label="Nombre"
          name="label"
          placeholder="Ej. Vendedor"
        />
        <AppInput
          control={control}
          label="Descripción"
          name="description"
          placeholder="Para qué sirve este rol"
        />

        <div className="flex flex-col gap-4 rounded-xl border border-separator p-4">
          <p className="text-sm font-medium">Permisos</p>
          {!access?.isOwner ? (
            <AppAlert
              status="accent"
              title="Solo puedes conceder permisos que tú también tienes."
            />
          ) : null}
          {resources.map((resource) => (
            <AppCheckboxGroup
              key={resource}
              control={control}
              description={RESOURCE_LABELS[resource].description}
              label={RESOURCE_LABELS[resource].label}
              name={`permission.${resource}`}
              options={statements[resource].map((action) => ({
                value: action,
                label: ACTION_LABELS[action] ?? action,
                isDisabled: !canGrant(resource, action),
              }))}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton
            isPending={create.isPending || update.isPending}
            type="submit"
          >
            {role ? "Guardar cambios" : "Crear rol"}
          </AppButton>
        </div>
      </form>
    </AppModal>
  );
}
