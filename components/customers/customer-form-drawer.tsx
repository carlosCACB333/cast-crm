"use client";

import type { CustomerDetail } from "@/lib/actions/customers";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { MailIcon, PhoneIcon, GlobeIcon } from "@/components/icons";
import {
  CUSTOMER_LIMITS,
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
} from "@/config/customers";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppDrawer,
  AppInput,
  AppTagInput,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { createCustomer, updateCustomer } from "@/lib/actions/customers";
import { optionSources } from "@/lib/option-sources";
import { queryKeys } from "@/lib/query-keys";
import {
  type CustomerFormValues,
  EMPTY_CUSTOMER_FORM,
  customerFormSchema,
} from "@/lib/validations/customers";

const FORM_ID = "customer-form";

function toFormValues(customer: CustomerDetail): CustomerFormValues {
  return {
    type: customer.type,
    name: customer.name,
    companyName: customer.companyName ?? "",
    jobTitle: customer.jobTitle ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    website: customer.website ?? "",
    taxId: customer.taxId ?? "",
    address: customer.address ?? "",
    city: customer.city ?? "",
    region: customer.region ?? "",
    postalCode: customer.postalCode ?? "",
    country: customer.country ?? "",
    statusId: customer.status?.id ?? "",
    ownerId: customer.owner?.id ?? "",
    tags: customer.tags,
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export interface CustomerFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Customer to edit; omitted to create a new one. */
  customer?: CustomerDetail;
  /** Defaults for a new customer, e.g. the current user as owner. */
  defaults?: Partial<CustomerFormValues>;
  onSaved?: (id: string) => void;
}

export function CustomerFormDrawer({
  isOpen,
  onOpenChange,
  customer,
  defaults,
  onSaved,
}: CustomerFormDrawerProps) {
  const isEdit = Boolean(customer);
  const invalidate = [queryKeys.customers];

  const create = useActionMutation(createCustomer, {
    successMessage: "Cliente creado",
    invalidate,
  });
  const update = useActionMutation(updateCustomer, {
    successMessage: "Cambios guardados",
    invalidate,
  });
  const mutation = isEdit ? update : create;

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: EMPTY_CUSTOMER_FORM,
  });
  const type = useWatch({ control, name: "type" });

  // Load fresh values each time the drawer opens.
  useEffect(() => {
    if (!isOpen) return;
    create.reset();
    update.reset();
    reset(
      customer
        ? toFormValues(customer)
        : { ...EMPTY_CUSTOMER_FORM, ...defaults },
    );
  }, [isOpen, customer]);

  const onSubmit = handleSubmit((values) => {
    if (customer) {
      update.mutate(
        { id: customer.id, values },
        {
          onSuccess: () => {
            onOpenChange(false);
            onSaved?.(customer.id);
          },
        },
      );
    } else {
      create.mutate(values, {
        onSuccess: ({ id }) => {
          onOpenChange(false);
          onSaved?.(id);
        },
      });
    }
  });

  const isPerson = type === "PERSON";

  return (
    <AppDrawer
      description={
        isEdit
          ? "Actualiza los datos del cliente."
          : "Solo el nombre es obligatorio; puedes completar el resto después."
      }
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton
            form={FORM_ID}
            isDisabled={isEdit && !isDirty}
            isPending={mutation.isPending}
            type="submit"
          >
            {isEdit ? "Guardar cambios" : "Crear cliente"}
          </AppButton>
        </>
      }
      isOpen={isOpen}
      label={isEdit ? "Editar cliente" : "Nuevo cliente"}
      placement="right"
      size="panel"
      title={isEdit ? "Editar cliente" : "Nuevo cliente"}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-8 pb-2"
        id={FORM_ID}
        onSubmit={onSubmit}
      >
        {mutation.error ? (
          <AppAlert
            description={mutation.error.message}
            status="danger"
            title="No se pudo guardar el cliente"
          />
        ) : null}

        <Section title="Identificación">
          <AppAutocomplete
            isRequired
            control={control}
            label="Tipo"
            name="type"
            options={CUSTOMER_TYPES.map((value) => ({
              value,
              label: CUSTOMER_TYPE_LABELS[value],
            }))}
          />
          <AppInput
            isRequired
            autoComplete={isPerson ? "name" : "organization"}
            control={control}
            label={
              isPerson ? "Nombre completo" : "Razón social o nombre comercial"
            }
            name="name"
            placeholder={isPerson ? "Ana García" : "Acme S.A."}
          />
          {isPerson ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <AppInput
                autoComplete="organization"
                control={control}
                label="Empresa"
                name="companyName"
              />
              <AppInput
                autoComplete="organization-title"
                control={control}
                label="Cargo"
                name="jobTitle"
              />
            </div>
          ) : null}
        </Section>

        <Section title="Contacto">
          <AppInput
            autoComplete="email"
            control={control}
            icon={<MailIcon size={16} />}
            label="Correo electrónico"
            name="email"
            type="email"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput
              autoComplete="tel"
              control={control}
              icon={<PhoneIcon size={16} />}
              label="Teléfono"
              name="phone"
            />
            <AppInput
              autoComplete="url"
              control={control}
              icon={<GlobeIcon size={16} />}
              label="Sitio web"
              name="website"
              placeholder="acme.com"
            />
          </div>
        </Section>

        <Section title="Seguimiento">
          <div className="grid gap-4 sm:grid-cols-2">
            <AppAutocomplete
              control={control}
              label="Estado"
              name="statusId"
              placeholder="Primer estado del flujo"
              source={optionSources.customerStatuses}
            />
            <AppAutocomplete
              control={control}
              label="Responsable"
              name="ownerId"
              options={[{ value: "none", label: "Sin asignar" }]}
              placeholder="Sin asignar"
              source={optionSources.members}
            />
          </div>
          <AppTagInput
            control={control}
            label="Etiquetas"
            maxLength={CUSTOMER_LIMITS.maxTagLength}
            maxTags={CUSTOMER_LIMITS.maxTags}
            name="tags"
            source={optionSources.customerTags}
          />
        </Section>

        <Section title="Datos fiscales y dirección">
          <AppInput
            control={control}
            description="NIF, CIF, RFC, RUT… según el país."
            label="Identificación fiscal"
            name="taxId"
          />
          <AppInput
            autoComplete="street-address"
            control={control}
            label="Dirección"
            name="address"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput
              autoComplete="address-level2"
              control={control}
              label="Ciudad"
              name="city"
            />
            <AppInput
              autoComplete="address-level1"
              control={control}
              label="Provincia o estado"
              name="region"
            />
            <AppInput
              autoComplete="postal-code"
              control={control}
              label="Código postal"
              name="postalCode"
            />
            <AppInput
              autoComplete="country-name"
              control={control}
              label="País"
              name="country"
            />
          </div>
        </Section>
      </form>
    </AppDrawer>
  );
}
