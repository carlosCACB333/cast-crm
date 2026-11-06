"use client";

import type { SalesSettingsValues } from "@/lib/validations/sales";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  AppAlert,
  AppButton,
  AppCard,
  AppInput,
  AppLink,
  AppSwitch,
  AppTextarea,
} from "@/components/ui";
import { SALES_LIMITS, SALES_TYPES } from "@/config/sales";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { usePermission } from "@/hooks/use-organization";
import { useSalesSettings } from "@/hooks/use-sales";
import { updateSalesSettings } from "@/lib/actions/sales";
import { queryKeys } from "@/lib/query-keys";
import { salesSettingsSchema } from "@/lib/validations/sales";

const PREFIX_FIELDS = [
  { name: "quotePrefix", type: "QUOTE" },
  { name: "orderPrefix", type: "ORDER" },
  { name: "deliveryNotePrefix", type: "DELIVERY_NOTE" },
  { name: "invoicePrefix", type: "INVOICE" },
] as const;

const exampleNumber = (prefix: string) =>
  `${prefix}${new Date().getFullYear()}-${"1".padStart(SALES_LIMITS.numberDigits, "0")}`;

function SalesSettingsForm({
  defaultValues,
  canEdit,
}: {
  defaultValues: SalesSettingsValues;
  canEdit: boolean;
}) {
  const update = useActionMutation(updateSalesSettings, {
    successMessage: "Configuración de ventas guardada",
    invalidate: [queryKeys.salesSettings],
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<SalesSettingsValues>({
    resolver: zodResolver(salesSettingsSchema),
    defaultValues,
  });
  const values = useWatch({ control }) as SalesSettingsValues;

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={handleSubmit((formValues) =>
        update.mutate(formValues, { onSuccess: () => reset(formValues) }),
      )}
    >
      {!canEdit ? (
        <AppAlert
          description="Solo quienes pueden editar la organización cambian esta configuración."
          status="accent"
          title="Solo lectura"
        />
      ) : null}
      {update.error ? (
        <AppAlert
          description={update.error.message}
          status="danger"
          title="No se pudo guardar la configuración"
        />
      ) : null}

      <AppCard
        description="Cada tipo de documento se numera por año sin saltos. Las facturas reciben su número al emitirse."
        title="Numeración"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {PREFIX_FIELDS.map(({ name, type }) => (
            <AppInput
              key={name}
              control={control}
              description={`Ejemplo: ${exampleNumber(values[name] ?? "")}`}
              label={`Prefijo de ${SALES_TYPES[type].plural.toLowerCase()}`}
              name={name}
            />
          ))}
        </div>
      </AppCard>

      <AppCard
        description="Valores con los que empiezan los documentos nuevos. Se pueden cambiar en cada uno."
        title="Valores por defecto"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AppInput
            control={control}
            description="Días que es válido un presupuesto."
            inputMode="numeric"
            label="Validez de presupuestos"
            name="quoteValidityDays"
          />
          <AppInput
            control={control}
            description="Días para pagar una factura."
            inputMode="numeric"
            label="Vencimiento de facturas"
            name="invoiceDueDays"
          />
        </div>
        <p className="text-sm text-muted">
          El impuesto por defecto y el impuesto sobre el total se configuran en{" "}
          <AppLink href="/settings">
            la configuración de la organización
          </AppLink>
          .
        </p>
        <AppTextarea
          control={control}
          description="Se copian en cada documento nuevo, por ejemplo la forma de pago o la cuenta bancaria."
          label="Condiciones"
          name="defaultTerms"
          rows={4}
        />
      </AppCard>

      <AppCard title="Inventario">
        <AppSwitch
          control={control}
          description="Al marcar un albarán como entregado, las unidades de los productos con stock controlado salen del inventario. Si se cancela la entrega, vuelven."
          isDisabled={!canEdit}
          label="Descontar stock al entregar albaranes"
          name="stockOnDelivery"
        />
        <AppSwitch
          control={control}
          description="Si está activo, los tickets y albaranes se registran aunque falte stock y este queda en negativo. Si no, la venta se bloquea e indica qué productos no tienen stock suficiente."
          isDisabled={!canEdit}
          label="Permitir vender sin stock suficiente"
          name="allowNegativeStock"
        />
      </AppCard>

      {canEdit ? (
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
      ) : null}
    </form>
  );
}

/** Numbering, defaults and inventory behavior of the sales module. */
export function SalesSettingsView() {
  const settings = useSalesSettings();
  const canEdit = usePermission({ organization: ["update"] });
  const data = settings.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Cómo se numeran y con qué valores empiezan tus documentos de venta."
        title="Configuración de ventas"
      />
      {settings.error ? (
        <QueryError error={settings.error} onRetry={() => settings.refetch()} />
      ) : data ? (
        <SalesSettingsForm
          canEdit={canEdit}
          defaultValues={{
            quotePrefix: data.prefixes.QUOTE,
            orderPrefix: data.prefixes.ORDER,
            deliveryNotePrefix: data.prefixes.DELIVERY_NOTE,
            invoicePrefix: data.prefixes.INVOICE,
            quoteValidityDays: String(data.quoteValidityDays),
            invoiceDueDays: String(data.invoiceDueDays),
            defaultTerms: data.defaultTerms ?? "",
            stockOnDelivery: data.stockOnDelivery,
            allowNegativeStock: data.allowNegativeStock,
          }}
        />
      ) : (
        <ListSkeleton rows={4} />
      )}
    </div>
  );
}
