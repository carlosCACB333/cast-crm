"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";

import { BuildingIcon } from "@/components/icons";
import { AppButton, AppInput, notify } from "@/components/ui";
import {
  createOrganization,
  setActiveOrganization,
} from "@/lib/actions/organization";
import {
  type CreateOrganizationValues,
  createOrganizationSchema,
} from "@/lib/validations/organization";

interface CreateOrganizationFormProps {
  submitLabel?: string;
  onCreated: () => void;
}

export function CreateOrganizationForm({
  submitLabel = "Crear organización",
  onCreated,
}: CreateOrganizationFormProps) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<CreateOrganizationValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = async (values: CreateOrganizationValues) => {
    const created = await createOrganization(values);

    if (!created.ok) {
      setError("name", { message: created.error });

      return;
    }

    const activated = await setActiveOrganization(created.data.id);

    if (!activated.ok) {
      notify.error(activated.error);

      return;
    }

    await queryClient.invalidateQueries();
    notify.success("Organización creada");
    onCreated();
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      <AppInput
        isRequired
        control={control}
        description="Puedes cambiarlo más adelante."
        icon={<BuildingIcon size={16} />}
        label="Nombre de la organización"
        name="name"
        placeholder="Acme S.A."
      />
      <AppButton fullWidth isPending={isSubmitting} type="submit">
        {submitLabel}
      </AppButton>
    </form>
  );
}
