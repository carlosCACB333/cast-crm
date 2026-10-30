"use client";

import { useState } from "react";
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  CustomerStatusChip,
  dateTimeFormatter,
  formatRelative,
} from "@/components/customers/customer-format";
import { CustomerFormDrawer } from "@/components/customers/customer-form-drawer";
import { CustomerNotes } from "@/components/customers/customer-notes";
import { CustomerLeads } from "@/components/leads/customer-leads";
import { CustomerSales } from "@/components/sales/customer-sales";
import {
  ArrowLeftIcon,
  ContactsIcon,
  CopyIcon,
  GlobeIcon,
  MailIcon,
  MapPinIcon,
  MoreIcon,
  PencilIcon,
  PhoneIcon,
  TrashIcon,
} from "@/components/icons";
import { CUSTOMER_TYPE_LABELS } from "@/config/customers";
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
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCustomer, useCustomerStatuses } from "@/hooks/use-customers";
import { usePermission } from "@/hooks/use-organization";
import { deleteCustomer, updateCustomerStatus } from "@/lib/actions/customers";
import { queryKeys } from "@/lib/query-keys";

function copy(value: string, label: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => notify.success(`${label} copiado`))
    .catch(() => notify.error("No se pudo copiar"));
}

function InfoRow({
  icon,
  label,
  children,
  copyValue,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  copyValue?: string | null;
}) {
  return (
    <div className="group flex items-start gap-3">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-sm break-words">{children}</span>
      </div>
      {copyValue ? (
        <AppButton
          isIconOnly
          aria-label={`Copiar ${label.toLowerCase()}`}
          className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          size="sm"
          variant="ghost"
          onPress={() => copy(copyValue, label)}
        >
          <CopyIcon size={14} />
        </AppButton>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

const empty = <span className="text-muted">—</span>;

export function CustomerDetailView({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const customer = useCustomer(id);
  const statuses = useCustomerStatuses();
  const canUpdate = usePermission({ customer: ["update"] });
  const canDelete = usePermission({ customer: ["delete"] });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const invalidate = [queryKeys.customers];
  const changeStatus = useActionMutation(updateCustomerStatus, {
    successMessage: "Estado actualizado",
    invalidate,
  });
  const remove = useActionMutation(deleteCustomer, {
    successMessage: "Cliente eliminado",
    invalidate,
  });

  // "Editar" from the list links here with ?edit=1.
  const wantsEdit = searchParams.get("edit") === "1";
  const isEditVisible =
    isEditOpen || (wantsEdit && canUpdate && Boolean(customer.data));

  const handleEditOpenChange = (isOpen: boolean) => {
    setIsEditOpen(isOpen);
    if (!isOpen && wantsEdit) router.replace(pathname, { scroll: false });
  };

  const data = customer.data;

  if (customer.error) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <AppEmptyState
          action={
            <div className="flex gap-2">
              <AppButton variant="secondary" onPress={() => customer.refetch()}>
                Reintentar
              </AppButton>
              <AppButton onPress={() => router.push("/customers")}>
                Ir a clientes
              </AppButton>
            </div>
          }
          description={customer.error.message}
          icon={<ContactsIcon size={20} />}
          title="No se pudo abrir el cliente"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <div className="flex items-center gap-4">
          <AppSkeleton className="size-14 rounded-full" />
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

  const location = [
    data.address,
    data.postalCode,
    data.city,
    data.region,
    data.country,
  ]
    .filter(Boolean)
    .join(", ");
  const subtitle =
    data.type === "PERSON"
      ? [data.jobTitle, data.companyName].filter(Boolean).join(" · ")
      : null;

  const moreItems = [
    ...(data.email
      ? [
          {
            id: "copy-email",
            label: "Copiar correo",
            icon: <CopyIcon size={16} />,
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Eliminar cliente",
            icon: <TrashIcon size={16} />,
            isDanger: true,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <AppAvatar
            className="size-14 text-lg"
            color={data.type === "COMPANY" ? "accent" : "default"}
            name={data.name}
            size="lg"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {data.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <AppChip>{CUSTOMER_TYPE_LABELS[data.type]}</AppChip>
              {canUpdate && statuses.data?.length ? (
                <AppDropdown
                  items={statuses.data.map((status) => ({
                    id: status.id,
                    label: status.label,
                    isSelected: status.id === data.status?.id,
                  }))}
                  label="Cambiar estado"
                  placement="bottom start"
                  trigger={
                    <AppButton
                      aria-label="Cambiar estado"
                      className="h-auto min-w-0 px-1 py-0.5"
                      size="sm"
                      variant="ghost"
                    >
                      <CustomerStatusChip status={data.status} />
                    </AppButton>
                  }
                  onAction={(statusId) =>
                    statusId !== data.status?.id &&
                    changeStatus.mutate({ id: data.id, statusId })
                  }
                />
              ) : (
                <CustomerStatusChip status={data.status} />
              )}
              {subtitle ? <span className="truncate">{subtitle}</span> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.email ? (
            <a
              className="inline-flex h-10 items-center gap-2 rounded-full bg-default px-4 text-sm font-medium transition-colors hover:bg-default/70 focus-visible:outline-2 focus-visible:outline-accent"
              href={`mailto:${data.email}`}
            >
              <MailIcon size={16} />
              Correo
            </a>
          ) : null}
          {data.phone ? (
            <a
              className="inline-flex h-10 items-center gap-2 rounded-full bg-default px-4 text-sm font-medium transition-colors hover:bg-default/70 focus-visible:outline-2 focus-visible:outline-accent"
              href={`tel:${data.phone.replace(/\s/g, "")}`}
            >
              <PhoneIcon size={16} />
              Llamar
            </a>
          ) : null}
          {canUpdate ? (
            <AppButton onPress={() => setIsEditOpen(true)}>
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
              onAction={(action) => {
                if (action === "delete") setIsDeleteOpen(true);
                else if (action === "copy-email" && data.email) {
                  copy(data.email, "Correo");
                }
              }}
            />
          ) : null}
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <CustomerLeads customer={data} />
          <CustomerSales customer={data} />
          <CustomerNotes canWrite={canUpdate} customerId={data.id} />
        </div>

        <div className="flex flex-col gap-6">
          <AppCard title="Contacto">
            <div className="flex flex-col gap-4">
              <InfoRow
                copyValue={data.email}
                icon={<MailIcon size={16} />}
                label="Correo"
              >
                {data.email ? (
                  <a
                    className="hover:text-accent hover:underline"
                    href={`mailto:${data.email}`}
                  >
                    {data.email}
                  </a>
                ) : (
                  empty
                )}
              </InfoRow>
              <InfoRow
                copyValue={data.phone}
                icon={<PhoneIcon size={16} />}
                label="Teléfono"
              >
                {data.phone ?? empty}
              </InfoRow>
              <InfoRow icon={<GlobeIcon size={16} />} label="Sitio web">
                {data.website ? (
                  <a
                    className="hover:text-accent hover:underline"
                    href={data.website}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {data.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  empty
                )}
              </InfoRow>
              <InfoRow
                copyValue={location || null}
                icon={<MapPinIcon size={16} />}
                label="Dirección"
              >
                {location || empty}
              </InfoRow>
            </div>
          </AppCard>

          <AppCard title="Detalles">
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Responsable">
                {data.owner ? (
                  <span className="flex items-center gap-2">
                    <AppAvatar
                      name={data.owner.name}
                      size="sm"
                      src={data.owner.image}
                    />
                    <span className="truncate">{data.owner.name}</span>
                  </span>
                ) : (
                  <span className="text-muted">Sin asignar</span>
                )}
              </Detail>
              <Detail label="Identificación fiscal">
                {data.taxId ?? empty}
              </Detail>
              <div className="col-span-2">
                <Detail label="Etiquetas">
                  {data.tags.length ? (
                    <span className="flex flex-wrap gap-1">
                      {data.tags.map((tag) => (
                        <NextLink
                          key={tag}
                          className="rounded-full focus-visible:outline-2 focus-visible:outline-accent"
                          href={`/customers?tag=${encodeURIComponent(tag)}`}
                        >
                          <AppChip>{tag}</AppChip>
                        </NextLink>
                      ))}
                    </span>
                  ) : (
                    empty
                  )}
                </Detail>
              </div>
              <Detail label="Creado">
                <span
                  title={dateTimeFormatter.format(new Date(data.createdAt))}
                >
                  {formatRelative(data.createdAt)}
                  {data.createdBy ? ` por ${data.createdBy.name}` : ""}
                </span>
              </Detail>
              <Detail label="Última actividad">
                <span
                  title={dateTimeFormatter.format(new Date(data.updatedAt))}
                >
                  {formatRelative(data.updatedAt)}
                </span>
              </Detail>
              <Detail label="Notas">{data._count.notes}</Detail>
            </dl>
          </AppCard>
        </div>
      </div>

      <CustomerFormDrawer
        customer={data}
        isOpen={isEditVisible}
        onOpenChange={handleEditOpenChange}
      />

      <AppConfirm
        confirmLabel="Eliminar"
        description={`Se eliminará a ${data.name} junto con sus notas; sus leads se conservarán sin cliente vinculado. Esta acción no se puede deshacer.`}
        isOpen={isDeleteOpen}
        isPending={remove.isPending}
        title="Eliminar cliente"
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => router.replace("/customers"),
          })
        }
        onOpenChange={setIsDeleteOpen}
      />
    </div>
  );
}

function BackLink() {
  return (
    <NextLink
      className="inline-flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      href="/customers"
    >
      <ArrowLeftIcon size={16} />
      Clientes
    </NextLink>
  );
}
