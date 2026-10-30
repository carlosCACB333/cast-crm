"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";

import { AppAlert, AppButton, AppInput, AppModal } from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { deleteOrganization } from "@/lib/actions/organization";
import {
  type DeleteOrganizationValues,
  deleteOrganizationFormSchema,
} from "@/lib/validations/organization";

interface DeleteOrganizationModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  organizationName: string;
}

/** Deletes the active organization after the user types its exact name. */
export function DeleteOrganizationModal({
  isOpen,
  onOpenChange,
  organizationName,
}: DeleteOrganizationModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const remove = useActionMutation(deleteOrganization, {
    successMessage: "Organización eliminada",
    invalidate: [],
  });
  const { control, handleSubmit, reset } = useForm<DeleteOrganizationValues>({
    resolver: zodResolver(deleteOrganizationFormSchema(organizationName)),
    defaultValues: { confirmation: "" },
  });
  const confirmation = useWatch({ control, name: "confirmation" });
  const matches = confirmation.trim() === organizationName.trim();

  useEffect(() => {
    if (!isOpen) reset({ confirmation: "" });
  }, [isOpen, reset]);

  const onSubmit = (values: DeleteOrganizationValues) =>
    remove.mutate(values, {
      onSuccess: ({ hasOrganization }) => {
        // Nothing cached belongs to the new active organization.
        queryClient.clear();
        router.replace(hasOrganization ? "/dashboard" : "/onboarding");
        router.refresh();
      },
    });

  return (
    <AppModal
      description="Esta acción es permanente y no se puede deshacer."
      isOpen={isOpen}
      title="Eliminar organización"
      onOpenChange={(open) => {
        if (!remove.isPending) onOpenChange(open);
      }}
    >
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={handleSubmit(onSubmit)}
      >
        <AppAlert
          description="Se borrarán para siempre sus clientes, leads, embudos, productos, servicios, ventas, cobros, cajas, roles, miembros, invitaciones e imágenes. Nadie podrá volver a acceder a ella y no hay forma de recuperarla."
          status="danger"
          title={`Se eliminará todo lo de ${organizationName}`}
        />
        <AppInput
          isRequired
          autoComplete="off"
          control={control}
          description={`Escribe «${organizationName}» para confirmar.`}
          label="Nombre de la organización"
          name="confirmation"
        />
        <div className="flex justify-end gap-2">
          <AppButton
            isDisabled={remove.isPending}
            variant="tertiary"
            onPress={() => onOpenChange(false)}
          >
            Cancelar
          </AppButton>
          <AppButton
            isDisabled={!matches}
            isPending={remove.isPending}
            type="submit"
            variant="danger"
          >
            Eliminar para siempre
          </AppButton>
        </div>
      </form>
    </AppModal>
  );
}
