"use client";

import type { SalesDocumentDetail } from "@/lib/actions/sales";
import type { SalesDocumentType } from "@/config/sales";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  CatalogBackLink,
  CatalogFormSkeleton,
  CatalogNoAccess,
} from "@/components/catalog/catalog-page";
import { CalendarIcon, MapPinIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import {
  SALES_TYPE_ICONS,
  SalesStatusChip,
  salesNumber,
} from "@/components/sales/sales-format";
import { SalesLinesEditor } from "@/components/sales/sales-lines-editor";
import { SalesTotals } from "@/components/sales/sales-totals";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppCard,
  AppEmptyState,
  AppInput,
  AppTextarea,
  notify,
} from "@/components/ui";
import {
  DEFAULT_SALES_DELIVERY_METHOD,
  SALES_DELIVERY_METHODS,
  SALES_TYPES,
  salesDocumentHref,
} from "@/config/sales";
import { useActionMutation } from "@/hooks/use-action-mutation";
import {
  useActiveMember,
  useMyAccess,
  usePermission,
} from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { useSalesDocument, useSalesSettings } from "@/hooks/use-sales";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import {
  createSalesDocument,
  getSalesCustomerAddress,
  updateSalesDocument,
} from "@/lib/actions/sales";
import { optionSources } from "@/lib/option-sources";
import { decimalToText } from "@/lib/pricing";
import { queryKeys } from "@/lib/query-keys";
import { documentTotals, typedNumber } from "@/lib/sales-math";
import {
  storedLinePresentation,
  type SalesDocumentFormValues,
  salesDocumentFormSchema,
} from "@/lib/validations/sales";

const FORM_ID = "sales-document-form";

function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function toFormValues(document: SalesDocumentDetail): SalesDocumentFormValues {
  return {
    customerId: document.customerId ?? "",
    issueDate: document.issueDate,
    dueDate: document.dueDate ?? "",
    reference: document.reference ?? "",
    deliveryMethod: SALES_TYPES[document.type].hasDelivery
      ? ((document.deliveryMethod as SalesDocumentFormValues["deliveryMethod"]) ??
        DEFAULT_SALES_DELIVERY_METHOD)
      : "",
    // Documents saved before delivery existed start with the customer's address.
    shippingAddress:
      document.shippingAddress ??
      (document.deliveryMethod ? "" : (document.customerAddress ?? "")),
    ownerId: document.owner?.id ?? "",
    terms: document.terms ?? "",
    internalNotes: document.internalNotes ?? "",
    lines: document.lines.map((line) => ({
      itemRef: line.productId
        ? `product:${line.productId}`
        : line.serviceId
          ? `service:${line.serviceId}`
          : "",
      presentationId: storedLinePresentation(line),
      description: line.description,
      unit: line.unit ?? "",
      quantity: decimalToText(line.quantity),
      unitPrice: decimalToText(line.unitPrice),
      discount: line.discount ? decimalToText(line.discount) : "",
      taxRate: decimalToText(line.taxRate),
    })),
  };
}

/**
 * Live totals in the sidebar, computed like the server will store them: with
 * the organization's current tax on the total.
 */
function FormSummary({ values }: { values: SalesDocumentFormValues }) {
  const money = useMoneyFormatter();
  const totalTax = useSalesSettings().data?.totalTax;
  const totals = documentTotals(
    (values.lines ?? []).map((line) => ({
      quantity: typedNumber(line.quantity),
      unitPrice: typedNumber(line.unitPrice),
      discount: typedNumber(line.discount),
      taxRate: typedNumber(line.taxRate),
    })),
    totalTax?.rate,
  );

  return (
    <SalesTotals
      format={money.format}
      totalTaxName={totalTax?.name}
      totals={totals}
    />
  );
}

function SalesDocumentForm({
  type,
  document,
  defaultValues,
  defaultTaxRate,
}: {
  type: SalesDocumentType;
  document?: SalesDocumentDetail;
  defaultValues: SalesDocumentFormValues;
  defaultTaxRate: number | null;
}) {
  const router = useRouter();
  const money = useMoneyFormatter();
  const definition = SALES_TYPES[type];
  const isEdit = Boolean(document);
  const canReadCustomers = usePermission({ customer: ["read"] });
  const invalidate = [queryKeys.sales];

  const create = useActionMutation(createSalesDocument, {
    successMessage: definition.createdMessage,
    invalidate,
  });
  const update = useActionMutation(updateSalesDocument, {
    successMessage: "Cambios guardados",
    invalidate,
  });
  const mutation = isEdit ? update : create;

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { isDirty, isSubmitSuccessful, errors },
  } = useForm<SalesDocumentFormValues>({
    resolver: zodResolver(salesDocumentFormSchema),
    defaultValues,
  });
  const values = useWatch({ control }) as SalesDocumentFormValues;
  const hasUnsavedChanges = isDirty && !isSubmitSuccessful;

  useUnsavedChangesWarning(hasUnsavedChanges);

  // The shipping address starts as the customer's. It follows the customer
  // while it was not changed by hand, and can be reset with a button.
  const customerAddress = useRef(document?.customerAddress ?? "");
  const loadAddress = useMutation({
    mutationFn: async ({
      customerId,
    }: {
      customerId: string;
      force: boolean;
    }) => {
      const result = await getSalesCustomerAddress(customerId);

      if (!result.ok) throw new Error(result.error);

      return result.data.address;
    },
    onSuccess: (address, { force }) => {
      const current = getValues("shippingAddress");
      const followsCustomer = !current || current === customerAddress.current;

      customerAddress.current = address;
      if (force && !address) {
        notify.warning("El cliente no tiene dirección en su ficha.");
      }
      if (force || followsCustomer) {
        setValue("shippingAddress", address, {
          shouldDirty: true,
          shouldValidate: Boolean(address),
        });
      }
    },
    onError: (error) => notify.error(error.message),
  });
  const fillAddress = (customerId: string, force = false) => {
    if (customerId && getValues("deliveryMethod") === "shipping") {
      loadAddress.mutate({ customerId, force });
    }
  };

  // A new document opened for a customer starts with its address.
  useEffect(() => {
    if (!document && defaultValues.customerId && definition.hasDelivery) {
      fillAddress(defaultValues.customerId);
    }
    // Only once, with the initial values.
  }, []);

  // Documents created from this one lock its customer (see the server rule).
  const derived =
    document?.chain.filter(
      (item) => item.sourceId === document.id && item.status !== "CANCELLED",
    ) ?? [];
  const listHref = `/sales/${definition.slug}`;
  const backHref = document ? salesDocumentHref(type, document.id) : listHref;

  const onSubmit = handleSubmit((formValues) => {
    if (document) {
      update.mutate(
        { id: document.id, values: formValues },
        { onSuccess: () => router.push(backHref) },
      );
    } else {
      create.mutate(
        { type, values: formValues },
        { onSuccess: ({ id }) => router.replace(salesDocumentHref(type, id)) },
      );
    }
  });

  const submitLabel = isEdit
    ? "Guardar cambios"
    : `Crear ${definition.label.toLowerCase()}`;
  const Icon = SALES_TYPE_ICONS[type];

  return (
    <div className="flex flex-col gap-6">
      <CatalogBackLink
        href={backHref}
        label={document ? salesNumber(document) : definition.plural}
      />

      <PageHeader
        actions={
          <>
            <AppButton variant="tertiary" onPress={() => router.push(backHref)}>
              Cancelar
            </AppButton>
            <AppButton
              form={FORM_ID}
              isDisabled={isEdit && !isDirty}
              isPending={mutation.isPending}
              type="submit"
            >
              {submitLabel}
            </AppButton>
          </>
        }
        description={
          document ? (
            <span className="flex flex-wrap items-center gap-2">
              <SalesStatusChip status={document.status} type={type} />
              {document.customerName}
            </span>
          ) : (
            "Elige el cliente y añade las líneas; los totales se calculan solos."
          )
        }
        title={
          document
            ? `Editar ${definition.label.toLowerCase()} ${document.number ?? ""}`.trim()
            : definition.newLabel
        }
      />

      <form
        noValidate
        className="grid items-start gap-6 lg:grid-cols-3"
        id={FORM_ID}
        onSubmit={onSubmit}
      >
        <div className="flex flex-col gap-6 lg:col-span-2">
          {mutation.error ? (
            <AppAlert
              description={mutation.error.message}
              status="danger"
              title="No se pudo guardar el documento"
            />
          ) : null}

          <AppCard title="Cliente y fechas">
            {canReadCustomers ? (
              <div className="flex flex-col gap-1">
                <AppAutocomplete
                  isRequired
                  control={control}
                  isDisabled={derived.length > 0}
                  label="Cliente"
                  name="customerId"
                  placeholder="Busca por nombre, empresa, correo o NIF"
                  source={optionSources.customers}
                  onValueChange={(customerId) => fillAddress(customerId)}
                />
                {derived.length ? (
                  <p className="text-xs text-muted">
                    No se puede cambiar porque ya se generó{" "}
                    {derived
                      .map(
                        (item) =>
                          `${SALES_TYPES[item.type].label.toLowerCase()} ${item.number ?? "en borrador"}`,
                      )
                      .join(", ")}{" "}
                    a partir de este documento. Cancélalo o elimínalo para
                    cambiar el cliente.
                  </p>
                ) : null}
              </div>
            ) : (
              <AppAlert
                description="Pide acceso de lectura a clientes para elegir a quién va dirigido el documento."
                status="accent"
                title="No puedes ver los clientes"
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <AppInput
                isRequired
                control={control}
                icon={<CalendarIcon size={16} />}
                label="Fecha"
                name="issueDate"
                type="date"
              />
              {definition.dueDateLabel ? (
                <AppInput
                  control={control}
                  icon={<CalendarIcon size={16} />}
                  label={definition.dueDateLabel}
                  name="dueDate"
                  type="date"
                />
              ) : null}
              <AppInput
                control={control}
                description="Por ejemplo, el número de pedido del cliente."
                label="Referencia del cliente"
                name="reference"
              />
              <AppAutocomplete
                control={control}
                label="Responsable"
                name="ownerId"
                placeholder="Sin asignar"
                source={optionSources.members}
              />
            </div>
          </AppCard>

          {definition.hasDelivery ? (
            <AppCard
              description="Por defecto se envía a la dirección del cliente, pero puedes indicar otra."
              title="Entrega"
            >
              <AppAutocomplete
                isRequired
                control={control}
                label="Forma de entrega"
                name="deliveryMethod"
                options={SALES_DELIVERY_METHODS.map((method) => ({
                  value: method.code,
                  label: method.label,
                }))}
                onValueChange={(method) =>
                  method === "shipping" &&
                  !getValues("shippingAddress") &&
                  fillAddress(getValues("customerId"))
                }
              />
              {values.deliveryMethod === "shipping" ? (
                <div className="flex flex-col gap-2">
                  <AppTextarea
                    isRequired
                    control={control}
                    description="Calle, número, código postal, ciudad y país. Puedes añadir indicaciones para el reparto."
                    label="Dirección de envío"
                    name="shippingAddress"
                    rows={3}
                  />
                  <div>
                    <AppButton
                      isDisabled={!values.customerId || loadAddress.isPending}
                      isPending={loadAddress.isPending}
                      size="sm"
                      variant="secondary"
                      onPress={() => fillAddress(values.customerId, true)}
                    >
                      {loadAddress.isPending ? null : <MapPinIcon size={14} />}
                      Usar la dirección del cliente
                    </AppButton>
                  </div>
                </div>
              ) : values.deliveryMethod === "pickup" ? (
                <p className="text-sm text-muted">
                  El cliente recogerá la mercancía en tienda; no hace falta
                  dirección.
                </p>
              ) : null}
            </AppCard>
          ) : null}

          <AppCard
            description={`Importes en ${money.currency}, sin impuestos.`}
            title="Líneas"
          >
            <SalesLinesEditor
              control={control}
              defaultTaxRate={defaultTaxRate}
              errors={errors}
            />
          </AppCard>

          <AppCard title="Condiciones y notas">
            <AppTextarea
              control={control}
              description="Forma de pago, plazos o garantías. Aparecen en el documento."
              label="Condiciones"
              name="terms"
              rows={4}
            />
            <AppTextarea
              control={control}
              description="Solo las ve tu equipo; no se imprimen."
              label="Notas internas"
              name="internalNotes"
              rows={3}
            />
          </AppCard>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <AppCard
            title={
              <span className="flex items-center gap-2">
                <Icon size={20} />
                Resumen
              </span>
            }
          >
            <FormSummary values={values} />
          </AppCard>
          <div className="flex flex-col gap-2">
            <AppButton
              fullWidth
              form={FORM_ID}
              isDisabled={isEdit && !isDirty}
              isPending={mutation.isPending}
              type="submit"
            >
              {submitLabel}
            </AppButton>
            {hasUnsavedChanges ? (
              <p className="text-center text-xs text-muted">
                Tienes cambios sin guardar.
              </p>
            ) : null}
          </div>
        </aside>
      </form>
    </div>
  );
}

const noAccess = (type: SalesDocumentType, title: string) => {
  const definition = SALES_TYPES[type];
  const Icon = SALES_TYPE_ICONS[type];

  return (
    <CatalogNoAccess
      backHref={`/sales/${definition.slug}`}
      backLabel={definition.plural}
      icon={<Icon size={20} />}
      title={title}
    />
  );
};

export function SalesCreateView({
  type,
  customerId = "",
}: {
  type: SalesDocumentType;
  /** Customer to start with, e.g. when opened from a customer's page. */
  customerId?: string;
}) {
  const access = useMyAccess();
  const canCreate = usePermission({ sale: ["create"] });
  const settings = useSalesSettings();
  const member = useActiveMember();

  if (access.data && !canCreate) {
    return noAccess(type, "No puedes crear documentos de venta");
  }
  if (settings.error) {
    return (
      <AppEmptyState
        action={
          <AppButton variant="secondary" onPress={() => settings.refetch()}>
            Reintentar
          </AppButton>
        }
        description={settings.error.message}
        title="No se pudo preparar el documento"
      />
    );
  }
  if (!access.data || !settings.data || member.isPending) {
    return <CatalogFormSkeleton />;
  }

  const {
    today,
    quoteValidityDays,
    invoiceDueDays,
    defaultTaxRate,
    defaultTerms,
  } = settings.data;
  const dueDays =
    type === "QUOTE"
      ? quoteValidityDays
      : type === "INVOICE"
        ? invoiceDueDays
        : null;

  return (
    <SalesDocumentForm
      defaultTaxRate={defaultTaxRate}
      defaultValues={{
        customerId,
        issueDate: today,
        dueDate: dueDays === null ? "" : addDays(today, dueDays),
        reference: "",
        deliveryMethod: SALES_TYPES[type].hasDelivery
          ? DEFAULT_SALES_DELIVERY_METHOD
          : "",
        shippingAddress: "",
        ownerId: member.data?.userId ?? "",
        terms: defaultTerms ?? "",
        internalNotes: "",
        lines: [],
      }}
      type={type}
    />
  );
}

export function SalesEditView({
  type,
  id,
}: {
  type: SalesDocumentType;
  id: string;
}) {
  const router = useRouter();
  const access = useMyAccess();
  const canUpdate = usePermission({ sale: ["update"] });
  const document = useSalesDocument(id);
  const settings = useSalesSettings();
  const definition = SALES_TYPES[type];
  const Icon = SALES_TYPE_ICONS[type];

  if (access.data && !canUpdate) {
    return noAccess(type, "No puedes editar documentos de venta");
  }

  if (document.error) {
    return (
      <div className="flex flex-col gap-6">
        <CatalogBackLink
          href={`/sales/${definition.slug}`}
          label={definition.plural}
        />
        <AppEmptyState
          action={
            <div className="flex gap-2">
              <AppButton variant="secondary" onPress={() => document.refetch()}>
                Reintentar
              </AppButton>
              <AppButton
                onPress={() => router.push(`/sales/${definition.slug}`)}
              >
                Ir a {definition.plural.toLowerCase()}
              </AppButton>
            </div>
          }
          description={document.error.message}
          icon={<Icon size={20} />}
          title="No se pudo abrir el documento"
        />
      </div>
    );
  }

  if (!document.data || !access.data || !settings.data) {
    return <CatalogFormSkeleton />;
  }

  const data = document.data;
  const href = salesDocumentHref(data.type, data.id);

  if (!SALES_TYPES[data.type].editableStatuses.includes(data.status)) {
    return (
      <div className="flex flex-col gap-6">
        <CatalogBackLink href={href} label={salesNumber(data)} />
        <AppEmptyState
          action={
            <AppButton onPress={() => router.push(href)}>
              Ver documento
            </AppButton>
          }
          description="En su estado actual ya no se puede modificar. Vuelve a borrador si lo permite, o duplícalo para crear uno nuevo."
          icon={<Icon size={20} />}
          title="Este documento no se puede editar"
        />
      </div>
    );
  }

  // Keyed by id so another document starts with a fresh form.
  return (
    <SalesDocumentForm
      key={data.id}
      defaultTaxRate={settings.data.defaultTaxRate}
      defaultValues={toFormValues(data)}
      document={data}
      type={data.type}
    />
  );
}
