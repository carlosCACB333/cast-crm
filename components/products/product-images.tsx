"use client";

import type { ProductDetail } from "@/lib/actions/products";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  ArrowLeftIcon,
  ImageIcon,
  MoreIcon,
  StarIcon,
  TrashIcon,
} from "@/components/icons";
import {
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppDropdown,
  AppEmptyState,
  AppFileDropzone,
  AppImage,
  notify,
} from "@/components/ui";
import { APP_LOCALE } from "@/config/organization";
import { PRODUCT_IMAGE_FORMATS, PRODUCT_LIMITS } from "@/config/products";
import { useActionMutation } from "@/hooks/use-action-mutation";
import {
  addProductImage,
  deleteProductImage,
  moveProductImage,
  prepareProductImageUpload,
} from "@/lib/actions/product-images";
import { queryKeys } from "@/lib/query-keys";
import { imageMimeTypes, uploadImage } from "@/lib/upload-image";

type ProductImage = ProductDetail["images"][number];

const ACCEPT = imageMimeTypes(PRODUCT_IMAGE_FORMATS);

const megabytes = (bytes: number) =>
  `${new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;

const formatsText = PRODUCT_IMAGE_FORMATS.filter((format) => format !== "jpeg")
  .map((format) => format.toUpperCase())
  .join(", ");

interface Upload {
  key: string;
  name: string;
  progress: number;
}

export function ProductImages({
  product,
  canEdit,
}: {
  product: ProductDetail;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [toDelete, setToDelete] = useState<ProductImage>();

  const invalidate = [queryKeys.products];
  const move = useActionMutation(moveProductImage, { invalidate });
  const remove = useActionMutation(deleteProductImage, {
    successMessage: "Imagen eliminada",
    invalidate,
  });

  const images = product.images;
  const room = PRODUCT_LIMITS.maxImages - images.length - uploads.length;

  const setProgress = (key: string, progress: number) =>
    setUploads((current) =>
      current.map((upload) =>
        upload.key === key ? { ...upload, progress } : upload,
      ),
    );

  /** Uploads one file at a time; Server Actions run in sequence anyway. */
  const handleFiles = async (files: File[]) => {
    const accepted: (Upload & { file: File })[] = [];

    for (const file of files) {
      if (!ACCEPT.includes(file.type)) {
        notify.error(`${file.name}: usa una imagen ${formatsText}.`);
      } else if (file.size > PRODUCT_LIMITS.maxImageBytes) {
        notify.error(
          `${file.name} pesa ${megabytes(file.size)}; el máximo es ${megabytes(PRODUCT_LIMITS.maxImageBytes)}.`,
        );
      } else if (accepted.length >= room) {
        notify.warning(
          `Solo caben ${PRODUCT_LIMITS.maxImages} imágenes por producto.`,
        );
        break;
      } else {
        accepted.push({
          key: `${file.name}-${file.lastModified}-${Math.random()}`,
          name: file.name,
          progress: 0,
          file,
        });
      }
    }

    if (!accepted.length) return;
    setUploads((current) => [...current, ...accepted]);

    let uploaded = 0;

    for (const { key, file, name } of accepted) {
      try {
        const signed = await prepareProductImageUpload(product.id);

        if (!signed.ok) throw new Error(signed.error);

        const result = await uploadImage(file, signed.data, (progress) =>
          setProgress(key, progress),
        );
        const added = await addProductImage({
          productId: product.id,
          publicId: result.public_id,
        });

        if (!added.ok) throw new Error(added.error);
        uploaded += 1;
        await queryClient.invalidateQueries({ queryKey: queryKeys.products });
      } catch (error) {
        notify.error(
          `${name}: ${error instanceof Error ? error.message : "no se pudo subir"}`,
        );
      } finally {
        setUploads((current) => current.filter((item) => item.key !== key));
      }
    }

    if (uploaded) {
      notify.success(
        uploaded === 1 ? "Imagen añadida" : `${uploaded} imágenes añadidas`,
      );
    }
  };

  const actions = (image: ProductImage, index: number) => [
    ...(index > 0
      ? [
          {
            id: "first",
            label: "Usar como principal",
            icon: <StarIcon size={16} />,
          },
          {
            id: "up",
            label: "Mover antes",
            icon: <ArrowLeftIcon size={16} />,
          },
        ]
      : []),
    ...(index < images.length - 1
      ? [
          {
            id: "down",
            label: "Mover después",
            icon: <ArrowLeftIcon className="rotate-180" size={16} />,
          },
        ]
      : []),
    {
      id: "open",
      label: "Ver en tamaño completo",
      icon: <ImageIcon size={16} />,
    },
    {
      id: "delete",
      label: "Eliminar",
      icon: <TrashIcon size={16} />,
      isDanger: true,
    },
  ];

  const handleAction = (image: ProductImage, action: string) => {
    if (action === "open") window.open(image.url, "_blank", "noopener");
    else if (action === "delete") setToDelete(image);
    else {
      move.mutate({
        id: image.id,
        direction: action as "first" | "up" | "down",
      });
    }
  };

  return (
    <AppCard
      description={`La primera es la imagen principal: aparece en el catálogo y en la ficha. Hasta ${PRODUCT_LIMITS.maxImages} imágenes.`}
      title="Imágenes"
    >
      {images.length === 0 && !uploads.length && !canEdit ? (
        <AppEmptyState
          description="Quien pueda editar productos puede añadir fotos."
          icon={<ImageIcon size={20} />}
          title="Este producto no tiene imágenes"
        />
      ) : null}

      {images.length || uploads.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="group relative aspect-square overflow-hidden rounded-2xl bg-default"
            >
              <AppImage
                alt={
                  index === 0
                    ? `Imagen principal de ${product.name}`
                    : `Imagen ${index + 1} de ${product.name}`
                }
                isPriority={index === 0}
                sizes="(min-width: 1280px) 220px, (min-width: 640px) 30vw, 45vw"
                src={image.url}
              />
              {index === 0 ? (
                <span className="absolute top-2 left-2">
                  <AppChip color="accent">Principal</AppChip>
                </span>
              ) : null}
              {canEdit ? (
                <span className="absolute top-2 right-2 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <AppDropdown
                    items={actions(image, index)}
                    label={`Acciones de la imagen ${index + 1}`}
                    trigger={
                      <AppButton
                        isIconOnly
                        aria-label={`Acciones de la imagen ${index + 1}`}
                        size="sm"
                        variant="secondary"
                      >
                        <MoreIcon size={16} />
                      </AppButton>
                    }
                    onAction={(action) => handleAction(image, action)}
                  />
                </span>
              ) : null}
            </li>
          ))}
          {uploads.map((upload) => (
            <li
              key={upload.key}
              aria-label={`Subiendo ${upload.name}`}
              className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-separator p-4 text-center"
            >
              <ImageIcon className="text-muted" size={22} />
              <span className="w-full truncate text-xs text-muted">
                {upload.name}
              </span>
              <span
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(upload.progress * 100)}
                className="h-1.5 w-full overflow-hidden rounded-full bg-default"
                role="progressbar"
              >
                <span
                  className="block h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${Math.max(upload.progress * 100, 4)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {canEdit ? (
        <AppFileDropzone
          isMultiple
          accept={ACCEPT}
          hint={`${formatsText}, hasta ${megabytes(PRODUCT_LIMITS.maxImageBytes)} cada una${room > 0 ? ` · puedes añadir ${room} más` : ""}`}
          isDisabled={room <= 0}
          title={
            room > 0
              ? "Arrastra fotos aquí o haz clic para elegirlas"
              : "Has alcanzado el máximo de imágenes"
          }
          onFiles={handleFiles}
        />
      ) : null}

      <AppConfirm
        confirmLabel="Eliminar"
        description="La imagen se borrará del producto y del almacenamiento. Esta acción no se puede deshacer."
        isOpen={Boolean(toDelete)}
        isPending={remove.isPending}
        title="Eliminar imagen"
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
