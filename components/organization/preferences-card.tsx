"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { CURRENCIES } from "@/config/organization";
import { AppButton, AppCard, AppAutocomplete } from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import {
  useMoneyFormatter,
  useOrganizationPreferences,
} from "@/hooks/use-preferences";
import { updateOrganizationPreferences } from "@/lib/actions/preferences";
import { queryKeys } from "@/lib/query-keys";
import {
  type OrganizationPreferencesValues,
  organizationPreferencesSchema,
} from "@/lib/validations/organization";

function PreferencesForm({
  defaultValues,
  canEdit,
}: {
  defaultValues: OrganizationPreferencesValues;
  canEdit: boolean;
}) {
  const money = useMoneyFormatter();
  const update = useActionMutation(updateOrganizationPreferences, {
    successMessage: "Preferencias guardadas",
    invalidate: [queryKeys.preferences],
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<OrganizationPreferencesValues>({
    resolver: zodResolver(organizationPreferencesSchema),
    defaultValues,
  });
  const { currency } = defaultValues;

  useEffect(() => reset({ currency }), [currency, reset]);

  if (!canEdit) {
    return (
      <dl className="text-sm">
        <dt className="text-muted">Moneda</dt>
        <dd className="font-medium">
          {CURRENCIES.find((item) => item.code === currency)?.label ?? currency}
        </dd>
      </dl>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) => update.mutate(values))}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <AppAutocomplete
          isRequired
          control={control}
          label="Moneda"
          name="currency"
          options={CURRENCIES.map((item) => ({
            value: item.code,
            label: item.label,
          }))}
        />
        <div className="flex flex-col justify-end text-sm text-muted">
          Ejemplo: {money.format(1234.5)}
        </div>
      </div>
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
    </form>
  );
}

/** Regional preferences of the organization, such as the currency of amounts. */
export function PreferencesCard({ canEdit }: { canEdit: boolean }) {
  const preferences = useOrganizationPreferences();

  return (
    <AppCard
      description="Se aplican a los importes de leads y previsiones."
      title="Preferencias regionales"
    >
      {preferences.error ? (
        <QueryError
          error={preferences.error}
          onRetry={() => preferences.refetch()}
        />
      ) : preferences.data ? (
        <PreferencesForm canEdit={canEdit} defaultValues={preferences.data} />
      ) : (
        <ListSkeleton rows={1} />
      )}
    </AppCard>
  );
}
