"use client";

import { useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";

import { CatalogBackLink } from "@/components/catalog/catalog-page";
import { CatalogDetail, PricingCard } from "@/components/catalog/pricing-card";
import {
  BriefcaseIcon,
  CopyIcon,
  MoreIcon,
  PencilIcon,
  PowerIcon,
  TrashIcon,
} from "@/components/icons";
import {
  CatalogActiveChip,
  CategoryChip,
  ServiceThumb,
  dateTimeFormatter,
  formatDuration,
  formatRelative,
} from "@/components/services/service-format";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppDropdown,
  AppEmptyState,
  AppSkeleton,
  notify,
} from "@/components/ui";
import { serviceUnitInfo } from "@/config/services";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { usePermission } from "@/hooks/use-organization";
import { useService } from "@/hooks/use-services";
import {
  deleteService,
  duplicateService,
  setServiceActive,
} from "@/lib/actions/services";
import { queryKeys } from "@/lib/query-keys";

const empty = <span className="text-muted">—</span>;

export function ServiceDetailView({ id }: { id: string }) {
  const router = useRouter();
  const service = useService(id);
  const canCreate = usePermission({ service: ["create"] });
  const canUpdate = usePermission({ service: ["update"] });
  const canDelete = usePermission({ service: ["delete"] });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const invalidate = [queryKeys.services];
  const toggleActive = useActionMutation(setServiceActive, { invalidate });
  const duplicate = useActionMutation(duplicateService, {
    successMessage: "Servicio duplicado",
    invalidate,
  });
  const remove = useActionMutation(deleteService, {
    successMessage: "Servicio eliminado",
    invalidate,
  });

  const data = service.data;

  if (service.error) {
    return (
      <div className="flex flex-col gap-6">
        <CatalogBackLink href="/services" label="Servicios" />
        <AppEmptyState
          action={
            <div className="flex gap-2">
              <AppButton variant="secondary" onPress={() => service.refetch()}>
                Reintentar
              </AppButton>
              <AppButton onPress={() => router.push("/services")}>
                Ir a servicios
              </AppButton>
            </div>
          }
          description={service.error.message}
          icon={<BriefcaseIcon size={20} />}
          title="No se pudo abrir el servicio"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <CatalogBackLink href="/services" label="Servicios" />
        <div className="flex items-center gap-4">
          <AppSkeleton className="size-14 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <AppSkeleton className="h-6 w-64 rounded-lg" />
            <AppSkeleton className="h-4 w-40 rounded-lg" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <AppSkeleton className="h-64 rounded-3xl lg:col-span-2" />
          <AppSkeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  const unit = serviceUnitInfo(data.unit);
  const duration = formatDuration(data.durationMinutes);

  const moreItems = [
    ...(data.code
      ? [
          {
            id: "copy-code",
            label: "Copiar código",
            icon: <CopyIcon size={16} />,
          },
        ]
      : []),
    ...(canCreate
      ? [{ id: "duplicate", label: "Duplicar", icon: <CopyIcon size={16} /> }]
      : []),
    ...(canUpdate
      ? [
          {
            id: "toggle",
            label: data.isActive ? "Desactivar" : "Activar",
            icon: <PowerIcon size={16} />,
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Eliminar servicio",
            icon: <TrashIcon size={16} />,
            isDanger: true,
          },
        ]
      : []),
  ];

  const handleMore = (action: string) => {
    if (action === "copy-code" && data.code) {
      navigator.clipboard
        .writeText(data.code)
        .then(() => notify.success("Código copiado"))
        .catch(() => notify.error("No se pudo copiar"));
    } else if (action === "duplicate") {
      duplicate.mutate(data.id, {
        onSuccess: ({ id: copyId }) => router.push(`/services/${copyId}`),
      });
    } else if (action === "toggle") {
      toggleActive.mutate(
        { id: data.id, isActive: !data.isActive },
        {
          onSuccess: () =>
            notify.success(
              data.isActive ? "Servicio desactivado" : "Servicio activado",
            ),
        },
      );
    } else if (action === "delete") setIsDeleteOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogBackLink href="/services" label="Servicios" />

      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ServiceThumb
            color={data.category?.color}
            name={data.name}
            size="lg"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {data.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <CategoryChip category={data.category} />
              <CatalogActiveChip isActive={data.isActive} />
              {duration ? <AppChip>{duration}</AppChip> : null}
              {data.code ? <span className="truncate">{data.code}</span> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canUpdate ? (
            <AppButton onPress={() => router.push(`/services/${data.id}/edit`)}>
              <PencilIcon size={16} />
              Editar
            </AppButton>
          ) : null}
          {moreItems.length ? (
            <AppDropdown
              items={moreItems}
              label="Más acciones"
              trigger={
                <AppButton
                  isIconOnly
                  aria-label="Más acciones"
                  variant="secondary"
                >
                  <MoreIcon size={16} />
                </AppButton>
              }
              onAction={handleMore}
            />
          ) : null}
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <PricingCard
            cost={data.cost}
            price={data.price}
            taxRate={data.taxRate}
            unitLabel={unit.label}
          />
          <AppCard title="Descripción">
            {data.description ? (
              <p className="text-sm whitespace-pre-line">{data.description}</p>
            ) : (
              <p className="text-sm text-muted">
                Sin descripción. Añade qué incluye el servicio al editarlo.
              </p>
            )}
          </AppCard>
        </div>

        <AppCard title="Detalles">
          <dl className="grid grid-cols-2 gap-4">
            <CatalogDetail label="Código">{data.code ?? empty}</CatalogDetail>
            <CatalogDetail label="Se cobra por">{unit.label}</CatalogDetail>
            <CatalogDetail isWide label="Duración estimada">
              {duration ?? empty}
            </CatalogDetail>
            <CatalogDetail isWide label="Etiquetas">
              {data.tags.length ? (
                <span className="flex flex-wrap gap-1">
                  {data.tags.map((tag) => (
                    <NextLink
                      key={tag}
                      className="rounded-full focus-visible:outline-2 focus-visible:outline-accent"
                      href={`/services?tag=${encodeURIComponent(tag)}`}
                    >
                      <AppChip>{tag}</AppChip>
                    </NextLink>
                  ))}
                </span>
              ) : (
                empty
              )}
            </CatalogDetail>
            <CatalogDetail label="Creado">
              <span title={dateTimeFormatter.format(new Date(data.createdAt))}>
                {formatRelative(data.createdAt)}
              </span>
            </CatalogDetail>
            <CatalogDetail label="Última actividad">
              <span title={dateTimeFormatter.format(new Date(data.updatedAt))}>
                {formatRelative(data.updatedAt)}
              </span>
            </CatalogDetail>
            {data.createdBy ? (
              <CatalogDetail isWide label="Creado por">
                <span className="flex items-center gap-2">
                  <AppAvatar
                    name={data.createdBy.name}
                    size="sm"
                    src={data.createdBy.image}
                  />
                  <span className="truncate">{data.createdBy.name}</span>
                </span>
              </CatalogDetail>
            ) : null}
          </dl>
        </AppCard>
      </div>

      <AppConfirm
        confirmLabel="Eliminar"
        description={`Se eliminará ${data.name}. Si solo quieres dejar de ofrecerlo, desactívalo. Esta acción no se puede deshacer.`}
        isOpen={isDeleteOpen}
        isPending={remove.isPending}
        title="Eliminar servicio"
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => router.replace("/services"),
          })
        }
        onOpenChange={setIsDeleteOpen}
      />
    </div>
  );
}
