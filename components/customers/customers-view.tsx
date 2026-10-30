"use client";

import type { CustomerListItem } from "@/lib/actions/customers";
import type { CustomerListFilters } from "@/lib/validations/customers";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import {
  ContactsIcon,
  DownloadIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  CustomerStatusChip,
  customerSubtitle,
  formatRelative,
} from "@/components/customers/customer-format";
import { CustomerFormDrawer } from "@/components/customers/customer-form-drawer";
import { useCustomerFilters } from "@/components/customers/use-customer-filters";
import { QueryError } from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  type CustomerSortField,
} from "@/config/customers";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppDropdown,
  AppDataTable,
  AppEmptyState,
  notify,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCustomerStatuses, useCustomers } from "@/hooks/use-customers";
import {
  useActiveMember,
  useMyAccess,
  usePermission,
} from "@/hooks/use-organization";
import {
  deleteCustomer,
  exportCustomers,
  updateCustomerStatus,
} from "@/lib/actions/customers";
import { downloadFile, toCsv } from "@/lib/csv";
import { optionSources } from "@/lib/option-sources";
import { queryKeys } from "@/lib/query-keys";

type Column =
  "name" | "contact" | "status" | "owner" | "tags" | "updatedAt" | "actions";

const SORTABLE: Partial<Record<Column, CustomerSortField>> = {
  name: "name",
  updatedAt: "updatedAt",
};

const numberFormatter = new Intl.NumberFormat("es");

/** URL filters hold a single value; "" means no filter. */
const toValues = (value: string) => (value ? [value] : []);

async function runExport(filters: CustomerListFilters) {
  const result = await exportCustomers(filters);

  if (!result.ok) throw new Error(result.error);

  const { rows, isTruncated } = result.data;
  const csv = toCsv(
    [
      "Tipo",
      "Nombre",
      "Empresa",
      "Cargo",
      "Correo",
      "Teléfono",
      "Web",
      "Identificación fiscal",
      "Dirección",
      "Ciudad",
      "Provincia",
      "Código postal",
      "País",
      "Estado",
      "Responsable",
      "Etiquetas",
      "Creado",
    ],
    rows.map((row) => [
      CUSTOMER_TYPE_LABELS[row.type as keyof typeof CUSTOMER_TYPE_LABELS] ??
        row.type,
      row.name,
      row.companyName,
      row.jobTitle,
      row.email,
      row.phone,
      row.website,
      row.taxId,
      row.address,
      row.city,
      row.region,
      row.postalCode,
      row.country,
      row.status,
      row.owner,
      row.tags.join(", "),
      row.createdAt.slice(0, 10),
    ]),
  );

  downloadFile(
    `clientes-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    "text/csv;charset=utf-8",
  );

  return { count: rows.length, isTruncated };
}

export function CustomersView() {
  const router = useRouter();
  const { filters, setFilters, hasActiveFilters, clearFilters } =
    useCustomerFilters();
  const customers = useCustomers(filters);
  const statuses = useCustomerStatuses();
  const { data: currentMember } = useActiveMember();
  const access = useMyAccess();

  const canRead = usePermission({ customer: ["read"] });
  const canCreate = usePermission({ customer: ["create"] });
  const canUpdate = usePermission({ customer: ["update"] });
  const canDelete = usePermission({ customer: ["delete"] });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CustomerListItem>();

  const invalidate = [queryKeys.customers];
  const remove = useActionMutation(deleteCustomer, {
    successMessage: "Cliente eliminado",
    invalidate,
  });
  const changeStatus = useActionMutation(updateCustomerStatus, {
    successMessage: "Estado actualizado",
    invalidate,
  });
  const exportCsv = useMutation({
    mutationFn: runExport,
    onSuccess: ({ count, isTruncated }) =>
      isTruncated
        ? notify.warning(
            `Se exportaron los primeros ${numberFormatter.format(count)} clientes. Usa filtros para exportar el resto.`,
          )
        : notify.success(
            `${numberFormatter.format(count)} clientes exportados`,
          ),
    onError: (error) => notify.error(error.message),
  });

  const data = customers.data;
  const openDetail = (id: string) => router.push(`/customers/${id}`);

  const rowActions = (customer: CustomerListItem) => [
    { id: "open", label: "Ver ficha", icon: <ContactsIcon size={16} /> },
    ...(canUpdate
      ? [{ id: "edit", label: "Editar", icon: <PencilIcon size={16} /> }]
      : []),
    ...(canUpdate
      ? (statuses.data ?? []).map((status) => ({
          id: `status:${status.id}`,
          label: `Mover a ${status.label}`,
          isSelected: customer.status?.id === status.id,
        }))
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

  const handleRowAction = (customer: CustomerListItem, id: string) => {
    if (id === "open" || id === "edit") {
      router.push(`/customers/${customer.id}${id === "edit" ? "?edit=1" : ""}`);
    } else if (id === "delete") {
      setToDelete(customer);
    } else if (id.startsWith("status:")) {
      changeStatus.mutate({ id: customer.id, statusId: id.slice(7) });
    }
  };

  const isFirstRun = data?.allCount === 0 && !hasActiveFilters;

  if (access.data && !canRead) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Clientes" />
        <AppEmptyState
          description="Pide a un administrador que te dé acceso al módulo de clientes."
          icon={<ContactsIcon size={20} />}
          title="No tienes acceso a los clientes"
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
              <AppButton onPress={() => setIsFormOpen(true)}>
                <PlusIcon size={16} />
                Nuevo cliente
              </AppButton>
            ) : null}
          </>
        }
        description="Personas y empresas con las que trabaja tu organización."
        title="Clientes"
      />

      {customers.error ? (
        <QueryError
          error={customers.error}
          onRetry={() => customers.refetch()}
        />
      ) : isFirstRun ? (
        <AppEmptyState
          action={
            canCreate ? (
              <AppButton onPress={() => setIsFormOpen(true)}>
                <PlusIcon size={16} />
                Crear el primer cliente
              </AppButton>
            ) : null
          }
          description="Registra a tus clientes para centralizar sus datos de contacto, su estado y el historial de notas del equipo."
          icon={<ContactsIcon size={20} />}
          title="Aún no tienes clientes"
        />
      ) : (
        <AppCard>
          <AppDataTable<CustomerListItem, Column>
            columns={[
              {
                key: "name",
                label: "Cliente",
                isRowHeader: true,
                defaultWidth: "2fr",
                allowsSorting: true,
              },
              { key: "contact", label: "Contacto" },
              {
                key: "status",
                label: "Estado",
                filter: {
                  type: "options",
                  label: "Estado",
                  options: [{ value: "none", label: "Sin estado" }],
                  source: optionSources.customerStatuses,
                  value: toValues(filters.statusId),
                  onChange: (value) => setFilters({ statusId: value[0] ?? "" }),
                },
              },
              {
                key: "owner",
                label: "Responsable",
                filter: {
                  type: "options",
                  label: "Responsable",
                  options: [
                    { value: "me", label: "Mis clientes" },
                    { value: "none", label: "Sin asignar" },
                  ],
                  source: optionSources.members,
                  value: toValues(filters.ownerId),
                  onChange: (value) => setFilters({ ownerId: value[0] ?? "" }),
                },
              },
              {
                key: "tags",
                label: "Etiquetas",
                filter: {
                  type: "options",
                  label: "Etiqueta",
                  source: optionSources.customerTags,
                  value: toValues(filters.tag),
                  onChange: (value) => setFilters({ tag: value[0] ?? "" }),
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
            emptyContent="No hay clientes"
            filters={[
              {
                type: "options",
                label: "Tipo de cliente",
                allLabel: "Todos los tipos",
                options: CUSTOMER_TYPES.map((value) => ({
                  value,
                  label: CUSTOMER_TYPE_LABELS[value],
                })),
                value: toValues(filters.type),
                onChange: (value) =>
                  setFilters({
                    type: (value[0] ?? "") as CustomerListFilters["type"],
                  }),
              },
            ]}
            getRowKey={(customer) => customer.id}
            label="Clientes"
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
            query={customers}
            renderCell={(customer, column) => {
              switch (column) {
                case "name":
                  return (
                    <div className="flex min-w-0 items-center gap-3">
                      <AppAvatar
                        color={
                          customer.type === "COMPANY" ? "accent" : "default"
                        }
                        name={customer.name}
                        size="sm"
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {customer.name}
                        </span>
                        <span className="truncate text-xs text-muted">
                          {customerSubtitle(customer) ??
                            CUSTOMER_TYPE_LABELS[customer.type]}
                        </span>
                      </div>
                    </div>
                  );
                case "contact":
                  return (
                    <div className="flex min-w-0 flex-col text-sm">
                      <span className="truncate">
                        {customer.email ?? (
                          <span className="text-muted">—</span>
                        )}
                      </span>
                      {customer.phone ? (
                        <span className="truncate text-xs text-muted">
                          {customer.phone}
                        </span>
                      ) : null}
                    </div>
                  );
                case "status":
                  return <CustomerStatusChip status={customer.status} />;
                case "owner":
                  return customer.owner ? (
                    <div className="flex items-center gap-2 text-sm">
                      <AppAvatar
                        name={customer.owner.name}
                        size="sm"
                        src={customer.owner.image}
                      />
                      <span className="truncate">{customer.owner.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted">Sin asignar</span>
                  );
                case "tags":
                  return customer.tags.length ? (
                    <div className="flex flex-wrap gap-1">
                      {customer.tags.slice(0, 2).map((tag) => (
                        <AppChip key={tag}>{tag}</AppChip>
                      ))}
                      {customer.tags.length > 2 ? (
                        <AppChip>+{customer.tags.length - 2}</AppChip>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-sm text-muted">—</span>
                  );
                case "updatedAt":
                  return (
                    <span
                      className="text-sm whitespace-nowrap text-muted"
                      title={new Date(customer.updatedAt).toLocaleString("es")}
                    >
                      {formatRelative(customer.updatedAt)}
                    </span>
                  );
                case "actions":
                  return (
                    <div className="flex justify-end">
                      <AppDropdown
                        items={rowActions(customer)}
                        label={`Acciones para ${customer.name}`}
                        trigger={
                          <AppButton
                            isIconOnly
                            aria-label={`Acciones para ${customer.name}`}
                            size="sm"
                            variant="ghost"
                          >
                            <MoreIcon size={16} />
                          </AppButton>
                        }
                        onAction={(id) => handleRowAction(customer, id)}
                      />
                    </div>
                  );
              }
            }}
            rows={data?.items ?? []}
            search={{
              value: filters.q,
              placeholder: "Buscar por nombre, correo, teléfono, empresa…",
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
      )}

      <CustomerFormDrawer
        defaults={currentMember ? { ownerId: currentMember.userId } : undefined}
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSaved={openDetail}
      />

      <AppConfirm
        confirmLabel="Eliminar"
        description={`Se eliminará a ${toDelete?.name ?? ""} junto con sus notas; sus leads se conservarán sin cliente vinculado. Esta acción no se puede deshacer.`}
        isOpen={Boolean(toDelete)}
        isPending={remove.isPending}
        title="Eliminar cliente"
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
