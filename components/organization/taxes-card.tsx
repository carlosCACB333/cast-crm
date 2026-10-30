"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import {
  AppAlert,
  AppButton,
  AppCard,
  AppInput,
  AppSwitch,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import {
  useMoneyFormatter,
  useOrganizationTaxes,
} from "@/hooks/use-preferences";
import { updateOrganizationTaxes } from "@/lib/actions/preferences";
import { formatPercent } from "@/lib/pricing";
import { queryKeys } from "@/lib/query-keys";
import { documentTotals, typedNumber } from "@/lib/sales-math";
import {
  type OrganizationTaxesValues,
  organizationTaxesSchema,
} from "@/lib/validations/organization";

/** Base amount of the example shown under the tax on the total. */
const EXAMPLE_BASE = 100;

function TaxesForm({
  defaultValues,
  canEdit,
}: {
  defaultValues: OrganizationTaxesValues;
  canEdit: boolean;
}) {
  const money = useMoneyFormatter();
  const update = useActionMutation(updateOrganizationTaxes, {
    successMessage: "Impuestos guardados",
    invalidate: [queryKeys.taxes, queryKeys.salesSettings, queryKeys.pos],
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<OrganizationTaxesValues>({
    resolver: zodResolver(organizationTaxesSchema),
    defaultValues,
  });
  const values = useWatch({ control }) as OrganizationTaxesValues;
  const lineRate = typedNumber(values.defaultTaxRate);
  const totalRate = typedNumber(values.totalTaxRate);
  const example = documentTotals(
    [{ quantity: 1, unitPrice: EXAMPLE_BASE, discount: 0, taxRate: lineRate }],
    totalRate,
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={handleSubmit((submitted) =>
        update.mutate(submitted, { onSuccess: () => reset(submitted) }),
      )}
    >
      {update.error ? (
        <AppAlert
          description={update.error.message}
          status="danger"
          title="No se pudieron guardar los impuestos"
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput
          control={control}
          description="Se propone en los productos y servicios nuevos y en las líneas escritas a mano, en %."
          inputMode="decimal"
          label="Impuesto por defecto"
          name="defaultTaxRate"
          placeholder="21"
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-separator pt-4">
        <AppSwitch
          control={control}
          description="Un porcentaje de la base imponible de los documentos de venta y tickets que se suma al total, además de los impuestos de cada línea."
          isDisabled={!canEdit}
          label="Aplicar impuesto al total"
          name="totalTaxEnabled"
        />
        {values.totalTaxEnabled ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <AppInput
                isRequired
                control={control}
                description="Como aparece en los totales y en lo impreso."
                label="Nombre"
                name="totalTaxName"
              />
              <AppInput
                isRequired
                control={control}
                inputMode="decimal"
                label="Porcentaje"
                name="totalTaxRate"
                placeholder="0"
              />
            </div>
            <p className="rounded-xl bg-default p-3 text-sm text-muted">
              Ejemplo: {money.format(EXAMPLE_BASE)} de base
              {lineRate
                ? ` + ${money.format(example.taxTotal)} de impuesto de línea (${formatPercent(lineRate)})`
                : " sin impuesto de línea"}{" "}
              + {money.format(example.totalTaxAmount)} de{" "}
              {values.totalTaxName || "impuesto sobre el total"} (
              {formatPercent(totalRate)}) ={" "}
              <span className="font-medium text-foreground">
                {money.format(example.total)}
              </span>
              . Se calcula sobre la base imponible, no sobre los impuestos de
              línea.
            </p>
          </>
        ) : null}
      </div>

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

/** Default tax rate and the optional tax charged on the final total. */
export function TaxesCard({ canEdit }: { canEdit: boolean }) {
  const taxes = useOrganizationTaxes();

  return (
    <AppCard
      description="Se aplican en productos, servicios, ventas y punto de venta. Los documentos ya creados conservan sus importes hasta que se editan."
      title="Impuestos"
    >
      {taxes.error ? (
        <QueryError error={taxes.error} onRetry={() => taxes.refetch()} />
      ) : taxes.data ? (
        <TaxesForm canEdit={canEdit} defaultValues={taxes.data} />
      ) : (
        <ListSkeleton rows={2} />
      )}
    </AppCard>
  );
}
