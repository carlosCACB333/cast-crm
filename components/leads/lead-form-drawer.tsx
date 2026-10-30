"use client";

import type { LeadDetail } from "@/lib/actions/leads";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { MailIcon, PhoneIcon, UserIcon } from "@/components/icons";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppDrawer,
  AppInput,
  AppTagInput,
} from "@/components/ui";
import { LEAD_LIMITS } from "@/config/leads";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { usePipeline } from "@/hooks/use-leads";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { createLead, updateLead } from "@/lib/actions/leads";
import { optionSources } from "@/lib/option-sources";
import { queryKeys } from "@/lib/query-keys";
import {
  EMPTY_LEAD_FORM,
  type LeadFormValues,
  leadFormSchema,
} from "@/lib/validations/leads";

const FORM_ID = "lead-form";

function toFormValues(lead: LeadDetail): LeadFormValues {
  return {
    title: lead.title,
    pipelineId: lead.pipelineId,
    stageId: lead.stageId,
    value: lead.value === null ? "" : String(lead.value).replace(".", ","),
    expectedCloseDate: lead.expectedCloseDate ?? "",
    contactName: lead.contactName ?? "",
    companyName: lead.companyName ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    source: lead.source ?? "",
    lostReason: lead.lostReason ?? "",
    ownerId: lead.owner?.id ?? "",
    customerId: lead.customer?.id ?? "",
    tags: lead.tags,
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

export interface LeadFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Lead to edit; omitted to create a new one. */
  lead?: LeadDetail;
  /** Defaults for a new lead, e.g. the pipeline and stage of a column. */
  defaults?: Partial<LeadFormValues>;
  /** Name of the customer in `defaults.customerId`, shown as linked. */
  customerName?: string;
  onSaved?: (id: string) => void;
}

export function LeadFormDrawer({
  isOpen,
  onOpenChange,
  lead,
  defaults,
  customerName,
  onSaved,
}: LeadFormDrawerProps) {
  const isEdit = Boolean(lead);
  const money = useMoneyFormatter();
  const invalidate = [queryKeys.leads];

  const create = useActionMutation(createLead, {
    successMessage: "Lead creado",
    invalidate,
  });
  const update = useActionMutation(updateLead, {
    successMessage: "Cambios guardados",
    invalidate,
  });
  const mutation = isEdit ? update : create;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { isDirty },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: EMPTY_LEAD_FORM,
  });
  const [pipelineId, stageId, customerId] = useWatch({
    control,
    name: ["pipelineId", "stageId", "customerId"],
  });

  // "" loads the first pipeline, where new leads start.
  const pipelineQuery = usePipeline(pipelineId ?? "", { enabled: isOpen });
  const pipeline = pipelineQuery.data ?? undefined;
  const stage = pipeline?.stages.find((item) => item.id === stageId);
  const linkedCustomer =
    lead?.customer?.id === customerId ? lead.customer.name : customerName;

  // Load fresh values each time the drawer opens.
  useEffect(() => {
    if (!isOpen) return;
    create.reset();
    update.reset();
    reset(lead ? toFormValues(lead) : { ...EMPTY_LEAD_FORM, ...defaults });
  }, [isOpen, lead]);

  // A new lead starts in the first pipeline; changing the pipeline picks its first stage.
  useEffect(() => {
    if (!isOpen || !pipeline) return;
    if (!getValues("pipelineId")) {
      setValue("pipelineId", pipeline.id);
      setValue("stageId", pipeline.stages[0]?.id ?? "");
    } else if (
      pipeline.id === getValues("pipelineId") &&
      !pipeline.stages.some((item) => item.id === getValues("stageId"))
    ) {
      setValue("stageId", pipeline.stages[0]?.id ?? "", { shouldDirty: true });
    }
  }, [isOpen, pipeline, getValues, setValue]);

  const onSubmit = handleSubmit((values) => {
    if (lead) {
      update.mutate(
        { id: lead.id, values },
        {
          onSuccess: () => {
            onOpenChange(false);
            onSaved?.(lead.id);
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

  return (
    <AppDrawer
      description={
        isEdit
          ? "Actualiza los datos de la oportunidad."
          : "Solo el título es obligatorio; puedes completar el resto después."
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
            {isEdit ? "Guardar cambios" : "Crear lead"}
          </AppButton>
        </>
      }
      isOpen={isOpen}
      label={isEdit ? "Editar lead" : "Nuevo lead"}
      placement="right"
      size="panel"
      title={isEdit ? "Editar lead" : "Nuevo lead"}
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
            title="No se pudo guardar el lead"
          />
        ) : null}

        <Section title="Oportunidad">
          <AppInput
            isRequired
            control={control}
            label="Título"
            name="title"
            placeholder="Por ejemplo, Renovación anual de Acme"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AppAutocomplete
              isRequired
              control={control}
              label="Embudo"
              name="pipelineId"
              placeholder="Selecciona"
              source={optionSources.pipelines}
            />
            <AppAutocomplete
              isRequired
              control={control}
              isDisabled={!pipelineId}
              label="Paso"
              name="stageId"
              placeholder="Selecciona un paso"
              source={pipelineId ? optionSources.stages(pipelineId) : undefined}
            />
            <AppInput
              control={control}
              description={`Importe en ${money.currency}.`}
              inputMode="decimal"
              label="Valor estimado"
              name="value"
              placeholder="0"
            />
            <AppInput
              control={control}
              label="Cierre previsto"
              name="expectedCloseDate"
              type="date"
            />
          </div>
          {stage?.kind === "LOST" ? (
            <AppInput
              control={control}
              description="Te ayudará a entender por qué se pierden oportunidades."
              label="Motivo de pérdida"
              name="lostReason"
            />
          ) : null}
        </Section>

        <Section title="Contacto">
          {linkedCustomer && customerId ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-default/60 px-3 py-2 text-sm">
              <span className="truncate">
                <span className="text-muted">Cliente vinculado: </span>
                <span className="font-medium">{linkedCustomer}</span>
              </span>
              <AppButton
                size="sm"
                variant="ghost"
                onPress={() =>
                  setValue("customerId", "", { shouldDirty: true })
                }
              >
                Desvincular
              </AppButton>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput
              autoComplete="name"
              control={control}
              icon={<UserIcon size={16} />}
              label="Persona de contacto"
              name="contactName"
            />
            <AppInput
              autoComplete="organization"
              control={control}
              label="Empresa"
              name="companyName"
            />
            <AppInput
              autoComplete="email"
              control={control}
              icon={<MailIcon size={16} />}
              label="Correo"
              name="email"
              type="email"
            />
            <AppInput
              autoComplete="tel"
              control={control}
              icon={<PhoneIcon size={16} />}
              inputMode="tel"
              label="Teléfono"
              name="phone"
            />
          </div>
        </Section>

        <Section title="Seguimiento">
          <div className="grid gap-4 sm:grid-cols-2">
            <AppAutocomplete
              control={control}
              label="Responsable"
              name="ownerId"
              options={[{ value: "none", label: "Sin asignar" }]}
              placeholder="Sin asignar"
              source={optionSources.members}
            />
            <AppInput
              control={control}
              label="Origen"
              name="source"
              placeholder="Web, referido, feria…"
            />
          </div>
          <AppTagInput
            control={control}
            label="Etiquetas"
            maxLength={LEAD_LIMITS.maxTagLength}
            maxTags={LEAD_LIMITS.maxTags}
            name="tags"
            source={optionSources.leadTags}
          />
        </Section>
      </form>
    </AppDrawer>
  );
}
