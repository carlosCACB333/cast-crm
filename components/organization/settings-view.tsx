"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { DeleteOrganizationModal } from "@/components/organization/delete-organization-modal";
import { LogoCard } from "@/components/organization/logo-card";
import { PreferencesCard } from "@/components/organization/preferences-card";
import { TaxesCard } from "@/components/organization/taxes-card";
import { PageHeader } from "@/components/page-header";
import {
  AppAlert,
  AppButton,
  AppCard,
  AppConfirm,
  AppInput,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useActiveOrganization, usePermission } from "@/hooks/use-organization";
import {
  leaveOrganization,
  updateOrganization,
} from "@/lib/actions/organization";
import {
  type UpdateOrganizationValues,
  updateOrganizationSchema,
} from "@/lib/validations/organization";

function GeneralForm({
  defaultValues,
  canEdit,
}: {
  defaultValues: UpdateOrganizationValues;
  canEdit: boolean;
}) {
  const update = useActionMutation(updateOrganization, {
    successMessage: "Cambios guardados",
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<UpdateOrganizationValues>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues,
  });

  const { name, slug } = defaultValues;

  // Sync the form when the organization changes (e.g. after saving or switching).
  useEffect(() => reset({ name, slug }), [name, slug, reset]);

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-4">
        <AppAlert
          description="Solo los administradores pueden modificar la organización."
          status="accent"
          title="Acceso de solo lectura"
        />
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Nombre</dt>
            <dd className="font-medium">{defaultValues.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Identificador</dt>
            <dd className="font-medium">{defaultValues.slug}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) => update.mutate(values))}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput isRequired control={control} label="Nombre" name="name" />
        <AppInput
          isRequired
          control={control}
          description="Identificador único en minúsculas, por ejemplo acme-sa."
          label="Identificador"
          name="slug"
        />
      </div>
      <div className="flex justify-end gap-2">
        <AppButton
          isDisabled={!isDirty || update.isPending}
          variant="tertiary"
          onPress={() => reset(defaultValues)}
        >
          Descartar
        </AppButton>
        <AppButton
          isDisabled={!isDirty}
          isPending={update.isPending}
          type="submit"
        >
          Guardar cambios
        </AppButton>
      </div>
    </form>
  );
}

export function SettingsView() {
  const router = useRouter();
  const organization = useActiveOrganization();
  const canEdit = usePermission({ organization: ["update"] });
  const canDelete = usePermission({ organization: ["delete"] });
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const leave = useActionMutation(leaveOrganization);
  const data = organization.data;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        description="Datos generales de la organización activa."
        title="Configuración"
      />

      {organization.error ? (
        <QueryError
          error={organization.error}
          onRetry={() => organization.refetch()}
        />
      ) : (
        <>
          <AppCard
            description="Información visible para los miembros."
            title="General"
          >
            {data ? (
              <GeneralForm
                canEdit={canEdit}
                defaultValues={{ name: data.name, slug: data.slug }}
              />
            ) : (
              <ListSkeleton rows={2} />
            )}
          </AppCard>

          {data ? (
            <LogoCard canEdit={canEdit} logo={data.logo} name={data.name} />
          ) : null}

          <PreferencesCard canEdit={canEdit} />

          <TaxesCard canEdit={canEdit} />

          <AppCard
            description="Acciones que afectan a tu acceso o a toda la organización."
            title="Zona de peligro"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">Salir de la organización</p>
                <p className="text-muted">
                  Perderás el acceso hasta que te vuelvan a invitar. El único
                  propietario no puede salir.
                </p>
              </div>
              <AppButton variant="danger" onPress={() => setIsLeaveOpen(true)}>
                Salir
              </AppButton>
            </div>
            {canDelete && data ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-separator pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium">Eliminar organización</p>
                  <p className="text-muted">
                    Borra para siempre la organización y todos sus datos. No se
                    puede deshacer.
                  </p>
                </div>
                <AppButton
                  variant="danger"
                  onPress={() => setIsDeleteOpen(true)}
                >
                  Eliminar
                </AppButton>
              </div>
            ) : null}
          </AppCard>
        </>
      )}

      <AppConfirm
        confirmLabel="Salir"
        description="Perderás el acceso a sus datos hasta que te vuelvan a invitar."
        isOpen={isLeaveOpen}
        isPending={leave.isPending}
        title="Salir de la organización"
        onConfirm={() =>
          leave.mutate(undefined, {
            onSuccess: () => {
              router.replace("/onboarding");
              router.refresh();
            },
          })
        }
        onOpenChange={setIsLeaveOpen}
      />

      {data ? (
        <DeleteOrganizationModal
          isOpen={isDeleteOpen}
          organizationName={data.name}
          onOpenChange={setIsDeleteOpen}
        />
      ) : null}
    </div>
  );
}
