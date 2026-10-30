"use client";

import type { ServiceDetail } from "@/lib/actions/services";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  CatalogBackLink,
  CatalogFormSkeleton,
  CatalogNoAccess,
} from "@/components/catalog/catalog-page";
import { PricePreview } from "@/components/catalog/price-preview";
import { BriefcaseIcon, ClockIcon, TagIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import {
  ServiceThumb,
  formatDuration,
  priceWithTax,
} from "@/components/services/service-format";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppCard,
  AppEmptyState,
  AppInput,
  AppSwitch,
  AppTagInput,
  AppTextarea,
} from "@/components/ui";
import {
  SERVICE_LIMITS,
  SERVICE_UNITS,
  serviceUnitInfo,
} from "@/config/services";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useMyAccess, usePermission } from "@/hooks/use-organization";
import {
  useMoneyFormatter,
  useOrganizationTaxes,
} from "@/hooks/use-preferences";
import { useService } from "@/hooks/use-services";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { createService, updateService } from "@/lib/actions/services";
import { optionSources } from "@/lib/option-sources";
import { decimalToText, parseTypedDecimal } from "@/lib/pricing";
import { queryKeys } from "@/lib/query-keys";
import {
  EMPTY_SERVICE_FORM,
  type ServiceFormValues,
  serviceFormSchema,
} from "@/lib/validations/services";

const FORM_ID = "service-form";

function toFormValues(service: ServiceDetail): ServiceFormValues {
  const minutes = service.durationMinutes ?? 0;

  return {
    name: service.name,
    code: service.code ?? "",
    description: service.description ?? "",
    categoryId: service.category?.id ?? "",
    tags: service.tags,
    price: decimalToText(service.price),
    unit: service.unit as ServiceFormValues["unit"],
    taxRate: decimalToText(service.taxRate),
    cost: decimalToText(service.cost),
    durationHours: minutes >= 60 ? String(Math.floor(minutes / 60)) : "",
    durationMinutes: minutes % 60 ? String(minutes % 60) : "",
    isActive: service.isActive,
  };
}

/** Live card in the sidebar: how the service will look once saved. */
function ServiceSummary({ values }: { values: ServiceFormValues }) {
  const money = useMoneyFormatter();
  const price = parseTypedDecimal(values.price);
  const name = values.name.trim();
  const duration = formatDuration(
    Number(values.durationHours || 0) * 60 +
      Number(values.durationMinutes || 0),
  );
  const unit = serviceUnitInfo(values.unit);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <ServiceThumb name={name || "?"} />
        <div className="flex min-w-0 flex-col">
          <span
            className={
              name ? "truncate font-medium" : "truncate font-medium text-muted"
            }
          >
            {name || "Sin nombre"}
          </span>
          <span className="truncate text-xs text-muted">
            Por {unit.label.toLowerCase()}
          </span>
        </div>
      </div>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Precio final</dt>
          <dd className="font-semibold tabular-nums">
            {price === null
              ? "—"
              : `${money.format(priceWithTax(price, parseTypedDecimal(values.taxRate)))} / ${unit.short}`}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Duración</dt>
          <dd>{duration ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

function ServiceForm({ service }: { service?: ServiceDetail }) {
  const router = useRouter();
  const money = useMoneyFormatter();
  const isEdit = Boolean(service);
  const invalidate = [queryKeys.services];

  const create = useActionMutation(createService, {
    successMessage: "Servicio creado",
    invalidate,
  });
  const update = useActionMutation(updateService, {
    successMessage: "Cambios guardados",
    invalidate,
  });
  const mutation = isEdit ? update : create;

  const {
    control,
    handleSubmit,
    getFieldState,
    resetField,
    formState: { isDirty, isSubmitSuccessful },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: service ? toFormValues(service) : EMPTY_SERVICE_FORM,
  });
  const values = useWatch({ control }) as ServiceFormValues;
  const hasUnsavedChanges = isDirty && !isSubmitSuccessful;
  const defaultTaxRate = useOrganizationTaxes().data?.defaultTaxRate;

  // New items start with the organization's tax once it loads, unless the
  // user already typed one.
  useEffect(() => {
    if (!service && defaultTaxRate && !getFieldState("taxRate").isDirty) {
      resetField("taxRate", { defaultValue: defaultTaxRate });
    }
  }, [service, defaultTaxRate, getFieldState, resetField]);

  useUnsavedChangesWarning(hasUnsavedChanges);

  const backHref = service ? `/services/${service.id}` : "/services";

  const onSubmit = handleSubmit((formValues) => {
    if (service) {
      update.mutate(
        { id: service.id, values: formValues },
        { onSuccess: () => router.push(`/services/${service.id}`) },
      );
    } else {
      create.mutate(formValues, {
        onSuccess: ({ id }) => router.replace(`/services/${id}`),
      });
    }
  });

  const submitLabel = isEdit ? "Guardar cambios" : "Crear servicio";

  return (
    <div className="flex flex-col gap-6">
      <CatalogBackLink
        href={backHref}
        label={service ? service.name : "Servicios"}
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
          isEdit
            ? "Actualiza la información, el precio o la duración."
            : "Solo necesitas el nombre y el precio; el resto puedes completarlo después."
        }
        title={isEdit ? "Editar servicio" : "Nuevo servicio"}
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
              title="No se pudo guardar el servicio"
            />
          ) : null}

          <AppCard title="Información básica">
            <AppInput
              isRequired
              control={control}
              label="Nombre"
              name="name"
              placeholder="Por ejemplo, Consultoría"
            />
            <AppTextarea
              control={control}
              description="Qué incluye, cómo se presta y en qué condiciones."
              label="Descripción"
              name="description"
              rows={4}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <AppAutocomplete
                control={control}
                label="Categoría"
                name="categoryId"
                options={[{ value: "none", label: "Sin categoría" }]}
                placeholder="Sin categoría"
                source={optionSources.serviceCategories}
              />
              <AppTagInput
                control={control}
                label="Etiquetas"
                maxLength={SERVICE_LIMITS.maxTagLength}
                maxTags={SERVICE_LIMITS.maxTags}
                name="tags"
                source={optionSources.serviceTags}
              />
            </div>
          </AppCard>

          <AppCard
            description={`Importes en ${money.currency}, sin impuestos.`}
            title="Precio"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <AppInput
                isRequired
                control={control}
                inputMode="decimal"
                label="Precio"
                name="price"
                placeholder="0,00"
              />
              <AppAutocomplete
                isRequired
                control={control}
                label="Se cobra por"
                name="unit"
                options={SERVICE_UNITS.map((unit) => ({
                  value: unit.code,
                  label: unit.label,
                }))}
              />
              <AppInput
                control={control}
                description="IVA u otro impuesto, en %."
                inputMode="decimal"
                label="Impuesto"
                name="taxRate"
                placeholder="21"
              />
              <AppInput
                control={control}
                description="Lo que te cuesta prestarlo. Solo lo ve tu equipo."
                inputMode="decimal"
                label="Coste"
                name="cost"
                placeholder="0,00"
              />
            </div>
            <PricePreview
              cost={parseTypedDecimal(values.cost)}
              price={parseTypedDecimal(values.price)}
              taxRate={parseTypedDecimal(values.taxRate)}
            />
          </AppCard>

          <AppCard
            description="Tiempo estimado para prestar una unidad del servicio. Ayuda a planificar la agenda."
            title="Duración"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <AppInput
                control={control}
                icon={<ClockIcon size={16} />}
                inputMode="numeric"
                label="Horas"
                name="durationHours"
                placeholder="0"
              />
              <AppInput
                control={control}
                inputMode="numeric"
                label="Minutos"
                name="durationMinutes"
                placeholder="0"
              />
            </div>
          </AppCard>

          <AppCard title="Código">
            <AppInput
              control={control}
              description="Tu referencia interna. No se puede repetir."
              icon={<TagIcon size={16} />}
              label="Código"
              name="code"
            />
          </AppCard>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <AppCard title="Resumen">
            <ServiceSummary values={values} />
          </AppCard>
          <AppCard title="Disponibilidad">
            <AppSwitch
              control={control}
              description="Los servicios inactivos se conservan, pero dejan de ofrecerse."
              label="Servicio activo"
              name="isActive"
            />
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

const noAccess = (title: string) => (
  <CatalogNoAccess
    backHref="/services"
    backLabel="Servicios"
    icon={<BriefcaseIcon size={20} />}
    title={title}
  />
);

export function ServiceCreateView() {
  const access = useMyAccess();
  const canCreate = usePermission({ service: ["create"] });

  if (!access.data) return <CatalogFormSkeleton />;
  if (!canCreate) return noAccess("No puedes crear servicios");

  return <ServiceForm />;
}

export function ServiceEditView({ id }: { id: string }) {
  const router = useRouter();
  const access = useMyAccess();
  const canUpdate = usePermission({ service: ["update"] });
  const service = useService(id);

  if (access.data && !canUpdate) return noAccess("No puedes editar servicios");

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

  if (!service.data || !access.data) return <CatalogFormSkeleton />;

  // Keyed by id so another service starts with a fresh form.
  return <ServiceForm key={service.data.id} service={service.data} />;
}
