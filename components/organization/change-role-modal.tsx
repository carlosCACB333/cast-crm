"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  AppAutocomplete,
  AppAvatar,
  AppButton,
  AppModal,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { updateMemberRole } from "@/lib/actions/organization";
import { optionSources } from "@/lib/option-sources";
import {
  type UpdateMemberRoleValues,
  updateMemberRoleSchema,
} from "@/lib/validations/organization";

export interface ChangeRoleMember {
  id: string;
  role: string;
  user: { name: string; email: string; image?: string | null };
}

interface ChangeRoleModalProps {
  member?: ChangeRoleMember;
  onOpenChange: (isOpen: boolean) => void;
}

export function ChangeRoleModal({
  member,
  onOpenChange,
}: ChangeRoleModalProps) {
  const changeRole = useActionMutation(updateMemberRole, {
    successMessage: "Rol actualizado",
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<UpdateMemberRoleValues>({
    resolver: zodResolver(updateMemberRoleSchema),
    defaultValues: { memberId: "", role: "" },
  });

  useEffect(() => {
    if (member) reset({ memberId: member.id, role: member.role });
  }, [member, reset]);

  // Only owners are offered the owner role. The server also rejects roles with
  // more permissions than the caller's.
  const onSubmit = (values: UpdateMemberRoleValues) =>
    changeRole.mutate(values, { onSuccess: () => onOpenChange(false) });

  return (
    <AppModal
      description="El nuevo rol se aplica de inmediato a sus permisos."
      isOpen={member !== undefined}
      title="Cambiar rol"
      onOpenChange={onOpenChange}
    >
      {member ? (
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="flex items-center gap-3 rounded-xl border border-separator p-3">
            <AppAvatar
              name={member.user.name}
              size="sm"
              src={member.user.image}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{member.user.name}</span>
              <span className="truncate text-xs text-muted">
                {member.user.email}
              </span>
            </div>
          </div>
          <AppAutocomplete
            isRequired
            control={control}
            label="Rol"
            name="role"
            source={optionSources.roles("assign")}
          />
          <div className="flex justify-end gap-2">
            <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
              Cancelar
            </AppButton>
            <AppButton
              isDisabled={!isDirty}
              isPending={changeRole.isPending}
              type="submit"
            >
              Guardar
            </AppButton>
          </div>
        </form>
      ) : null}
    </AppModal>
  );
}
