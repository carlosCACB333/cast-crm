"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { MailIcon } from "@/components/icons";
import {
  AppAutocomplete,
  AppButton,
  AppInput,
  AppModal,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { inviteMember } from "@/lib/actions/organization";
import { optionSources } from "@/lib/option-sources";
import {
  type InviteMemberValues,
  inviteMemberSchema,
} from "@/lib/validations/organization";

interface InviteMemberModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function InviteMemberModal({
  isOpen,
  onOpenChange,
}: InviteMemberModalProps) {
  const invite = useActionMutation(inviteMember, {
    successMessage: "Invitación enviada",
  });
  const { control, handleSubmit, reset } = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "" },
  });

  const close = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const onSubmit = (values: InviteMemberValues) =>
    invite.mutate(values, { onSuccess: () => close(false) });

  return (
    <AppModal
      description="Le enviaremos un correo con un enlace para unirse."
      isOpen={isOpen}
      title="Invitar miembro"
      onOpenChange={close}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <AppInput
          isRequired
          control={control}
          icon={<MailIcon size={16} />}
          label="Correo electrónico"
          name="email"
          placeholder="persona@empresa.com"
          type="email"
        />
        {/* Owners are never invited: ownership is only granted to existing members. */}
        <AppAutocomplete
          isRequired
          control={control}
          label="Rol"
          name="role"
          source={optionSources.roles("invite")}
        />
        <div className="flex justify-end gap-2 pt-2">
          <AppButton variant="tertiary" onPress={() => close(false)}>
            Cancelar
          </AppButton>
          <AppButton isPending={invite.isPending} type="submit">
            Enviar invitación
          </AppButton>
        </div>
      </form>
    </AppModal>
  );
}
