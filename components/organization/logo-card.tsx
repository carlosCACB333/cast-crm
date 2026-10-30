"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { TrashIcon } from "@/components/icons";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppConfirm,
  AppFileDropzone,
  notify,
} from "@/components/ui";
import {
  APP_LOCALE,
  ORGANIZATION_LOGO_FORMATS,
  ORGANIZATION_LOGO_LIMITS,
} from "@/config/organization";
import { useActionMutation } from "@/hooks/use-action-mutation";
import {
  prepareOrganizationLogoUpload,
  removeOrganizationLogo,
  setOrganizationLogo,
} from "@/lib/actions/organization-logo";
import { queryKeys } from "@/lib/query-keys";
import { imageMimeTypes, uploadImage } from "@/lib/upload-image";

const ACCEPT = imageMimeTypes(ORGANIZATION_LOGO_FORMATS);

const megabytes = (bytes: number) =>
  `${new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;

const formatsText = ORGANIZATION_LOGO_FORMATS.filter(
  (format) => format !== "jpeg",
)
  .map((format) => format.toUpperCase())
  .join(", ");

export function LogoCard({
  name,
  logo,
  canEdit,
}: {
  name: string;
  logo?: string | null;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number>();
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const remove = useActionMutation(removeOrganizationLogo, {
    successMessage: "Avatar eliminado",
  });
  const isUploading = progress !== undefined;

  const handleFiles = async ([file]: File[]) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      notify.error(`${file.name}: usa una imagen ${formatsText}.`);

      return;
    }
    if (file.size > ORGANIZATION_LOGO_LIMITS.maxBytes) {
      notify.error(
        `${file.name} pesa ${megabytes(file.size)}; el máximo es ${megabytes(ORGANIZATION_LOGO_LIMITS.maxBytes)}.`,
      );

      return;
    }

    setProgress(0);
    try {
      const signed = await prepareOrganizationLogoUpload();

      if (!signed.ok) throw new Error(signed.error);

      const result = await uploadImage(file, signed.data, setProgress);
      const saved = await setOrganizationLogo({ publicId: result.public_id });

      if (!saved.ok) throw new Error(saved.error);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organizations,
      });
      notify.success("Avatar actualizado");
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "No se pudo subir la imagen",
      );
    } finally {
      setProgress(undefined);
    }
  };

  return (
    <AppCard
      description="Identifica a la organización en el menú y en el selector de organizaciones."
      title="Avatar"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <AppAvatar
            className="size-20 shrink-0 text-xl"
            color="accent"
            name={name}
            size="lg"
            src={logo}
          />
          {canEdit && logo ? (
            <AppButton
              isDisabled={isUploading}
              size="sm"
              variant="tertiary"
              onPress={() => setIsRemoveOpen(true)}
            >
              <TrashIcon size={16} />
              Quitar
            </AppButton>
          ) : null}
        </div>

        {canEdit ? (
          <div className="flex flex-1 flex-col gap-2">
            <AppFileDropzone
              accept={ACCEPT}
              hint={`Imagen cuadrada ${formatsText}, hasta ${megabytes(ORGANIZATION_LOGO_LIMITS.maxBytes)}`}
              isDisabled={isUploading}
              title={
                isUploading
                  ? "Subiendo imagen…"
                  : logo
                    ? "Arrastra una imagen o haz clic para cambiarla"
                    : "Arrastra una imagen o haz clic para elegirla"
              }
              onFiles={handleFiles}
            />
            {isUploading ? (
              <span
                aria-label="Progreso de la subida"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(progress * 100)}
                className="h-1.5 w-full overflow-hidden rounded-full bg-default"
                role="progressbar"
              >
                <span
                  className="block h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${Math.max(progress * 100, 4)}%` }}
                />
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Solo los administradores pueden cambiar el avatar.
          </p>
        )}
      </div>

      <AppConfirm
        confirmLabel="Quitar"
        description="Se mostrarán las iniciales de la organización en su lugar."
        isOpen={isRemoveOpen}
        isPending={remove.isPending}
        title="Quitar avatar"
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => setIsRemoveOpen(false),
          })
        }
        onOpenChange={setIsRemoveOpen}
      />
    </AppCard>
  );
}
