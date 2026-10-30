"use client";

import type { ServiceListItem } from "@/lib/actions/services";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import {
  BriefcaseIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  TrashIcon,
  WalletIcon,
} from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  CatalogActiveChip,
  CategoryChip,
  ServiceThumb,
  formatDuration,
  formatRelative,
  priceWithTax,
} from "@/components/services/service-format";
import {
  AppButton,
  AppCard,
  AppConfirm,
  AppDataTable,
  AppDropdown,
  AppEmptyState,
  AppStatCard,
  notify,
} from "@/components/ui";
import { CATALOG_STATUS_FILTERS } from "@/config/catalog";
import { APP_LOCALE } from "@/config/organization";
import { type ServiceSortField, serviceUnitInfo } from "@/config/services";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useMyAccess, usePermission } from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { useServices } from "@/hooks/use-services";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  deleteService,
  duplicateService,
  exportServices,
  setServiceActive,
} from "@/lib/actions/services";
import { downloadFile, toCsv } from "@/lib/csv";
import { optionSources } from "@/lib/option-sources";
import { queryKeys } from "@/lib/query-keys";
import {
  type ServiceListFilters,
  serviceListSchema,
} from "@/lib/validations/services";

type Column =
  | "name"
  | "category"
  | "price"
  | "duration"
  | "status"
  | "updatedAt"
  | "actions";

const SORTABLE: Partial<Record<Column, ServiceSortField>> = {
  name: "name",
  price: "price",
  updatedAt: "updatedAt",
};

const numberFormatter = new Intl.NumberFormat(APP_LOCALE);
const decimalText = (value: number | null) =>
  value === null ? null : String(value).replace(".", ",");

/** URL filters hold a single value; "" means no filter. */
const toValues = (value: string) => (value ? [value] : []);

async function runExport(filters: ServiceListFilters) {
  const result = await exportServices(filters);

  if (!result.ok) throw new Error(result.error);

  const { rows, isTruncated } = result.data;
  const csv = toCsv(
    [
      "Nombre",
      "Código",
      "Categoría",
      "Descripción",
      "Se cobra por",
      "Precio",
      "Impuesto (%)",
      "Coste",
      "Duración (min)",
      "Estado",
      "Etiquetas",
      "Creado",
    ],
    rows.map((row) => [
      row.name,
      row.code,
      row.category,
      row.description,
      serviceUnitInfo(row.unit).label,
      decimalText(row.price),
      decimalText(row.taxRate),
      decimalText(row.cost),
      row.durationMinutes === null ? null : String(row.durationMinutes),
      row.isActive ? "Activo" : "Inactivo",
      row.tags.join(", "),
      row.createdAt.slice(0, 10),
    ]),
  );

  downloadFile(
    `servicios-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    "text/csv;charset=utf-8",
  );

  return { count: rows.length, isTruncated };
}

export function ServicesView() {
  const router = useRouter();
  const money = useMoneyFormatter();
  const { filters, setFilters, hasActiveFilters, clearFilters } =
    useUrlFilters(serviceListSchema);
  const services = useServices(filters);
  const access = useMyAccess();

  const canRead = usePermission({ service: ["read"] });
  const canCreate = usePermission({ service: ["create"] });
  const canUpdate = usePermission({ service: ["update"] });
  const canDelete = usePermission({ service: ["delete"] });

  const [toDelete, setToDelete] = useState<ServiceListItem>();

  const invalidate = [queryKeys.services];
  const remove = useActionMutation(deleteService, {
    successMessage: "Servicio eliminado",
    invalidate,
  });
  const toggleActive = useActionMutation(setServiceActive, { invalidate });
  const duplicate = useActionMutation(duplicateService, {
    successMessage: "Servicio duplicado",
    invalidate,
  });
  const exportCsv = useMutation({
    mutationFn: runExport,
    onSuccess: ({ count, isTruncated }) =>
      isTruncated
        ? notify.warning(
            `Se exportaron los primeros ${numberFormatter.format(count)} servicios. Usa filtros para exportar el resto.`,
          )
        : notify.success(
            `${numberFormatter.format(count)} servicios exportados`,
          ),
    onError: (error) => notify.error(error.message),
  });

  const data = services.data;
  const summary = data?.summary;
  const openDetail = (id: string) => router.push(`/services/${id}`);
  const openCreate = () => router.push("/services/new");

  const rowActions = (service: ServiceListItem) => [
    { id: "open", label: "Ver ficha", icon: <BriefcaseIcon size={16} /> },
    ...(canUpdate
      ? [
          { id: "edit", label: "Editar", icon: <PencilIcon size={16} /> },
          {
            id: "toggle",
            label: service.isActive ? "Desactivar" : "Activar",
            icon: <PowerIcon size={16} />,
          },
        ]
      : []),
    ...(canCreate
      ? [{ id: "duplicate", label: "Duplicar", icon: <CopyIcon size={16} /> }]
      : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Eliminar",
            icon: <TrashIcon size={16} />,
            isDanger: true,
          },
        ]
      : []),
  ];

  const handleRowAction = (service: ServiceListItem, id: string) => {
    if (id === "open" || id === "edit") {
      router.push(`/services/${service.id}${id === "edit" ? "/edit" : ""}`);
    } else if (id === "toggle") {
      toggleActive.mutate(
        { id: service.id, isActive: !service.isActive },
        {
          onSuccess: () =>
            notify.success(
              service.isActive ? "Servicio desactivado" : "Servicio activado",
            ),
        },
      );
    } else if (id === "duplicate") {
      duplicate.mutate(service.id, { onSuccess: ({ id }) => openDetail(id) });
    } else if (id === "delete") {
      setToDelete(service);
    }
  };

  const isFirstRun = summary?.total === 0 && !hasActiveFilters;

  if (access.data && !canRead) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Servicios" />
        <AppEmptyState
          description="Pide a un administrador que te dé acceso al catálogo de servicios."
          icon={<BriefcaseIcon size={20} />}
          title="No tienes acceso a los servicios"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <>
            <AppButton
              isDisabled={!data?.total}
              isPending={exportCsv.isPending}
              variant="secondary"
              onPress={() => exportCsv.mutate(filters)}
            >
              {exportCsv.isPending ? null : <DownloadIcon size={16} />}
              Exportar
            </AppButton>
            {canCreate ? (
              <AppButton onPress={openCreate}>
                <PlusIcon size={16} />
                Nuevo servicio
              </AppButton>
            ) : null}
          </>
        }
        description="El trabajo que ofreces: horas, sesiones, proyectos o planes."
        title="Servicios"
      />

      {services.error ? (
        <QueryError error={services.error} onRetry={() => services.refetch()} />
      ) : isFirstRun ? (
        <AppEmptyState
          action={
            canCreate ? (
              <AppButton onPress={openCreate}>
                <PlusIcon size={16} />
                Añadir el primer servicio
              </AppButton>
            ) : null
          }
          description="Registra los servicios que ofreces con su precio, impuesto y duración para presupuestarlos más rápido."
          icon={<BriefcaseIcon size={20} />}
          title="Aún no tienes servicios"
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <AppStatCard
              hint={
                summary
                  ? `${numberFormatter.format(summary.total)} en total`
                  : undefined
              }
              icon={<BriefcaseIcon size={20} />}
              isLoading={!summary}
              label="Servicios activos"
              value={numberFormatter.format(summary?.active ?? 0)}
            />
            <AppStatCard
              hint={
                summary
                  ? `${numberFormatter.format(summary.total - summary.active)} en pausa`
                  : undefined
              }
              icon={<PowerIcon size={20} />}
              isLoading={!summary}
              label="Inactivos"
              tone="warning"
              value={numberFormatter.format(
                summary ? summary.total - summary.active : 0,
              )}
            />
            <AppStatCard
              hint="De los servicios activos, sin impuestos"
              icon={<WalletIcon size={20} />}
              isLoading={!summary}
              label="Precio medio"
              value={money.format(summary?.averagePrice ?? 0)}
            />
          </div>

          <AppCard>
            <AppDataTable<ServiceListItem, Column>
              columns={[
                {
                  key: "name",
                  label: "Servicio",
                  isRowHeader: true,
                  defaultWidth: "2fr",
                  allowsSorting: true,
                },
                {
                  key: "category",
                  label: "Categoría",
                  filter: {
                    type: "options",
                    label: "Categoría",
                    options: [{ value: "none", label: "Sin categoría" }],
                    source: optionSources.serviceCategories,
                    value: toValues(filters.categoryId),
                    onChange: (value) =>
                      setFilters({ categoryId: value[0] ?? "" }),
                  },
                },
                { key: "price", label: "Precio", allowsSorting: true },
                { key: "duration", label: "Duración" },
                {
                  key: "status",
                  label: "Estado",
                  filter: {
                    type: "options",
                    label: "Estado",
                    options: [...CATALOG_STATUS_FILTERS],
                    value: toValues(filters.status),
                    onChange: (value) =>
                      setFilters({
                        status: (value[0] ??
                          "") as ServiceListFilters["status"],
                      }),
                  },
                },
                {
                  key: "updatedAt",
                  label: "Actividad",
                  allowsSorting: true,
                },
                {
                  key: "actions",
                  label: "Acciones",
                  className: "text-right",
                  width: 96,
                },
              ]}
              emptyContent="No hay servicios"
              filters={[
                {
                  type: "options",
                  label: "Etiqueta",
                  allLabel: "Todas las etiquetas",
                  source: optionSources.serviceTags,
                  value: toValues(filters.tag),
                  onChange: (value) => setFilters({ tag: value[0] ?? "" }),
                },
              ]}
              getRowKey={(service) => service.id}
              label="Servicios"
              pagination={
                data
                  ? {
                      page: data.page,
                      pageSize: data.pageSize,
                      total: data.total,
                      onChange: (page) => setFilters({ page }),
                    }
                  : undefined
              }
              query={services}
              renderCell={(service, column) => {
                switch (column) {
                  case "name":
                    return (
                      <div className="flex min-w-0 items-center gap-3">
                        <ServiceThumb
                          color={service.category?.color}
                          name={service.name}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span
                            className={
                              service.isActive
                                ? "truncate font-medium"
                                : "truncate font-medium text-muted"
                            }
                          >
                            {service.name}
                          </span>
                          <span className="truncate text-xs text-muted">
                            {service.code ??
                              `Por ${serviceUnitInfo(service.unit).label.toLowerCase()}`}
                          </span>
                        </div>
                      </div>
                    );
                  case "category":
                    return <CategoryChip category={service.category} />;
                  case "price":
                    return (
                      <div className="flex flex-col text-sm">
                        <span className="font-medium whitespace-nowrap tabular-nums">
                          {money.format(service.price)}
                          <span className="ms-1 text-xs font-normal text-muted">
                            / {serviceUnitInfo(service.unit).short}
                          </span>
                        </span>
                        {service.taxRate ? (
                          <span className="text-xs whitespace-nowrap text-muted tabular-nums">
                            {money.format(
                              priceWithTax(service.price, service.taxRate),
                            )}{" "}
                            con imp.
                          </span>
                        ) : null}
                      </div>
                    );
                  case "duration": {
                    const duration = formatDuration(service.durationMinutes);

                    return duration ? (
                      <span className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                        <ClockIcon className="text-muted" size={14} />
                        {duration}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    );
                  }
                  case "status":
                    return <CatalogActiveChip isActive={service.isActive} />;
                  case "updatedAt":
                    return (
                      <span
                        className="text-sm whitespace-nowrap text-muted"
                        title={new Date(service.updatedAt).toLocaleString(
                          APP_LOCALE,
                        )}
                      >
                        {formatRelative(service.updatedAt)}
                      </span>
                    );
                  case "actions":
                    return (
                      <div className="flex justify-end">
                        <AppDropdown
                          items={rowActions(service)}
                          label={`Acciones para ${service.name}`}
                          trigger={
                            <AppButton
                              isIconOnly
                              aria-label={`Acciones para ${service.name}`}
                              size="sm"
                              variant="ghost"
                            >
                              <MoreIcon size={16} />
                            </AppButton>
                          }
                          onAction={(id) => handleRowAction(service, id)}
                        />
                      </div>
                    );
                }
              }}
              rows={data?.items ?? []}
              search={{
                value: filters.q,
                placeholder: "Buscar por nombre, código o descripción…",
                onChange: (q) => setFilters({ q }),
              }}
              sort={{
                column:
                  (Object.entries(SORTABLE).find(
                    ([, field]) => field === filters.sort,
                  )?.[0] as Column | undefined) ?? "updatedAt",
                direction:
                  filters.direction === "asc" ? "ascending" : "descending",
              }}
              onClearFilters={clearFilters}
              onRowAction={openDetail}
              onSortChange={({ column, direction }) => {
                const sort = SORTABLE[column];

                if (sort) {
                  setFilters({
                    sort,
                    direction: direction === "ascending" ? "asc" : "desc",
                  });
                }
              }}
            />
          </AppCard>
        </>
      )}

      <AppConfirm
        confirmLabel="Eliminar"
        description={`Se eliminará ${toDelete?.name ?? ""}. Si solo quieres dejar de ofrecerlo, desactívalo. Esta acción no se puede deshacer.`}
        isOpen={Boolean(toDelete)}
        isPending={remove.isPending}
        title="Eliminar servicio"
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => setToDelete(undefined),
          })
        }
        onOpenChange={(isOpen) => !isOpen && setToDelete(undefined)}
      />
    </div>
  );
}
