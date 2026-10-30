"use client";

import type { PosSettingsValues } from "@/lib/validations/pos";

import NextLink from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ChevronRightIcon, StoreIcon, WalletIcon } from "@/components/icons";
import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import { AppAlert, AppButton, AppCard, AppInput } from "@/components/ui";
import { SALES_LIMITS } from "@/config/sales";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { usePermission } from "@/hooks/use-organization";
import { usePosSettings } from "@/hooks/use-pos";
import { updatePosSettings } from "@/lib/actions/pos";
import { queryKeys } from "@/lib/query-keys";
import { posSettingsSchema } from "@/lib/validations/pos";

const exampleNumber = (prefix: string) =>
  `${prefix}${new Date().getFullYear()}-${"1".padStart(SALES_LIMITS.numberDigits, "0")}`;

function PosSettingsForm({
  defaultValues,
  canEdit,
}: {
  defaultValues: PosSettingsValues;
  canEdit: boolean;
}) {
  const update = useActionMutation(updatePosSettings, {
    successMessage: "Configuración del punto de venta guardada",
    invalidate: [queryKeys.posSettings, queryKeys.pos],
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<PosSettingsValues>({
    resolver: zodResolver(posSettingsSchema),
    defaultValues,
  });
  const prefix = useWatch({ control, name: "ticketPrefix" });

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={handleSubmit((values) =>
        update.mutate(values, { onSuccess: () => reset(values) }),
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
        description="Los tickets son facturas simplificadas con su propia serie. Aparecen en Ventas → Facturas."
        title="Tickets"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AppInput
            control={control}
            description={`Ejemplo: ${exampleNumber(prefix ?? "")}`}
            label="Prefijo de los tickets"
            name="ticketPrefix"
          />
          <AppInput
            control={control}
            description="Nombre de los tickets vendidos sin elegir cliente."
            label="Cliente de mostrador"
            name="walkInCustomerName"
          />
        </div>
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

const LINKS = [
  {
    href: "/pos/registers",
    icon: StoreIcon,
    title: "Cajas",
    description: "Crea, renombra o desactiva los puestos de cobro.",
  },
  {
    href: "/sales/payment-methods",
    icon: WalletIcon,
    title: "Formas de pago",
    description:
      "Las mismas que en las facturas. Las de tipo efectivo cuentan en el arqueo.",
  },
  {
    href: "/sales/settings",
    icon: ChevronRightIcon,
    title: "Configuración de ventas",
    description:
      "Si las ventas descuentan stock (también los tickets). Los impuestos están en la configuración de la organización.",
  },
];

/** Ticket numbering and walk-in customer, plus links to the shared settings. */
export function PosSettingsView() {
  const settings = usePosSettings();
  const canEdit = usePermission({ organization: ["update"] });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Cómo se numeran los tickets y qué se usa al cobrar."
        title="Configuración del punto de venta"
      />
      {settings.error ? (
        <QueryError error={settings.error} onRetry={() => settings.refetch()} />
      ) : settings.data ? (
        <PosSettingsForm canEdit={canEdit} defaultValues={settings.data} />
      ) : (
        <ListSkeleton rows={2} />
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {LINKS.map(({ href, icon: Icon, title, description }) => (
          <NextLink
            key={href}
            className="flex gap-3 rounded-2xl border border-separator bg-surface p-4 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            href={href}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Icon size={18} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-medium">{title}</span>
              <span className="text-sm text-muted">{description}</span>
            </span>
          </NextLink>
        ))}
      </div>
    </div>
  );
}
