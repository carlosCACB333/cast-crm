"use client";

import type { PipelineItem, PipelineStageItem } from "@/lib/actions/pipelines";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  TargetIcon,
  TrashIcon,
} from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import { DEFAULT_COLOR } from "@/config/colors";
import { LEAD_LIMITS, STAGE_KINDS, STAGE_KIND_LABELS } from "@/config/leads";
import {
  AppAutocomplete,
  AppButton,
  AppCard,
  AppColorPicker,
  AppConfirm,
  AppDataTable,
  AppDrawer,
  AppDropdown,
  AppEmptyState,
  AppFilterAutocomplete,
  AppInput,
  AppModal,
  AppStatusChip,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { usePipeline, usePipelinePage } from "@/hooks/use-leads";
import { useListParams } from "@/hooks/use-list-params";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { useMyAccess, usePermission } from "@/hooks/use-organization";
import {
  createPipeline,
  createStage,
  deletePipeline,
  deleteStage,
  moveStage,
  updatePipeline,
  updateStage,
} from "@/lib/actions/pipelines";
import { queryKeys } from "@/lib/query-keys";
import {
  type PipelineFormValues,
  type PipelineListParams,
  type StageFormValues,
  pipelineFormSchema,
  pipelineListSchema,
  stageFormSchema,
} from "@/lib/validations/leads";

const invalidate = [queryKeys.leads];

function PipelineFormModal({
  isOpen,
  onOpenChange,
  pipeline,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  pipeline?: PipelineItem;
}) {
  const create = useActionMutation(createPipeline, {
    successMessage: "Embudo creado",
    invalidate,
  });
  const update = useActionMutation(updatePipeline, {
    successMessage: "Embudo actualizado",
    invalidate,
  });
  const mutation = pipeline ? update : create;
  const { control, handleSubmit, reset } = useForm<PipelineFormValues>({
    resolver: zodResolver(pipelineFormSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        name: pipeline?.name ?? "",
        description: pipeline?.description ?? "",
      });
    }
  }, [isOpen, pipeline, reset]);

  const onSubmit = handleSubmit((values) => {
    const close = { onSuccess: () => onOpenChange(false) };

    if (pipeline) update.mutate({ id: pipeline.id, values }, close);
    else create.mutate(values, close);
  });

  return (
    <AppModal
      description={
        pipeline
          ? "Cambia el nombre o la descripción del embudo."
          : "Se crea con pasos básicos que puedes adaptar después."
      }
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton
            form="pipeline-form"
            isPending={mutation.isPending}
            type="submit"
          >
            {pipeline ? "Guardar" : "Crear embudo"}
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title={pipeline ? "Editar embudo" : "Nuevo embudo"}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id="pipeline-form"
        onSubmit={onSubmit}
      >
        <AppInput
          isRequired
          control={control}
          label="Nombre"
          name="name"
          placeholder="Por ejemplo, Ventas B2B o Renovaciones"
        />
        <AppInput control={control} label="Descripción" name="description" />
      </form>
    </AppModal>
  );
}

function StageFormModal({
  isOpen,
  onOpenChange,
  pipelineId,
  stage,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  pipelineId: string;
  stage?: PipelineStageItem;
}) {
  const create = useActionMutation(createStage, {
    successMessage: "Paso creado",
    invalidate,
  });
  const update = useActionMutation(updateStage, {
    successMessage: "Paso actualizado",
    invalidate,
  });
  const mutation = stage ? update : create;
  const { control, handleSubmit, reset } = useForm<StageFormValues>({
    resolver: zodResolver(stageFormSchema),
    defaultValues: {
      name: "",
      color: DEFAULT_COLOR,
      kind: "OPEN",
      probability: "",
    },
  });
  const [name, color] = useWatch({ control, name: ["name", "color"] });

  useEffect(() => {
    if (isOpen) {
      reset(
        stage
          ? {
              name: stage.name,
              color: stage.color,
              kind: stage.kind,
              probability:
                stage.probability === null ? "" : String(stage.probability),
            }
          : { name: "", color: DEFAULT_COLOR, kind: "OPEN", probability: "" },
      );
    }
  }, [isOpen, stage, reset]);

  const onSubmit = handleSubmit((values) => {
    const close = { onSuccess: () => onOpenChange(false) };

    if (stage) update.mutate({ id: stage.id, values }, close);
    else create.mutate({ pipelineId, values }, close);
  });

  return (
    <AppModal
      description="Cada paso es una columna del tablero."
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton
            form="stage-form"
            isPending={mutation.isPending}
            type="submit"
          >
            {stage ? "Guardar" : "Crear paso"}
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title={stage ? "Editar paso" : "Nuevo paso"}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id="stage-form"
        onSubmit={onSubmit}
      >
        <AppInput
          isRequired
          control={control}
          label="Nombre"
          name="name"
          placeholder="Por ejemplo, Demo agendada"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <AppColorPicker control={control} label="Color" name="color" />
          <AppInput
            control={control}
            description="De 0 a 100. Pondera la previsión."
            inputMode="numeric"
            label="Probabilidad (%)"
            name="probability"
          />
        </div>
        <AppAutocomplete
          isRequired
          control={control}
          label="Tipo"
          name="kind"
          options={STAGE_KINDS.map((value) => ({
            value,
            label: STAGE_KIND_LABELS[value].label,
            description: STAGE_KIND_LABELS[value].description,
          }))}
        />
        <div className="flex items-center gap-2 text-sm text-muted">
          Vista previa:
          <AppStatusChip
            color={color || DEFAULT_COLOR}
            label={name?.trim() || "Paso"}
          />
        </div>
      </form>
    </AppModal>
  );
}

type PendingDelete =
  | { type: "pipeline"; pipeline: PipelineItem }
  | { type: "stage"; pipeline: PipelineItem; stage: PipelineStageItem };

function IconAction({
  label,
  isDisabled,
  onPress,
  children,
}: {
  label: string;
  isDisabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <AppButton
      isIconOnly
      aria-label={label}
      isDisabled={isDisabled}
      size="sm"
      variant="ghost"
      onPress={onPress}
    >
      {children}
    </AppButton>
  );
}

/** Stage editor of one pipeline, in a side panel opened from the table. */
function StagesDrawer({
  pipeline,
  onClose,
  onEditStage,
  onDelete,
}: {
  pipeline?: PipelineItem;
  onClose: () => void;
  onEditStage: (stage?: PipelineStageItem) => void;
  onDelete: (pending: PendingDelete) => void;
}) {
  const reorderStage = useActionMutation(moveStage, { invalidate });
  const stages = pipeline?.stages ?? [];
  const isStageFull = stages.length >= LEAD_LIMITS.maxStagesPerPipeline;

  return (
    <AppDrawer
      description="Cada paso es una columna del kanban, en este orden. Los pasos «Ganado» y «Perdido» cierran los leads."
      footer={
        <>
          <AppButton variant="tertiary" onPress={onClose}>
            Cerrar
          </AppButton>
          <AppButton isDisabled={isStageFull} onPress={() => onEditStage()}>
            <PlusIcon size={16} />
            Añadir paso
          </AppButton>
        </>
      }
      isOpen={Boolean(pipeline)}
      label={`Pasos de ${pipeline?.name ?? ""}`}
      placement="right"
      size="panel"
      title={`Pasos de ${pipeline?.name ?? ""}`}
      onOpenChange={(isOpen) => !isOpen && onClose()}
    >
      <ol className="flex flex-col divide-y divide-separator">
        {stages.map((stage, index) => (
          <li
            key={stage.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="w-5 text-right text-xs text-muted tabular-nums">
                {index + 1}
              </span>
              <AppStatusChip color={stage.color} label={stage.name} />
              {stage.kind !== "OPEN" ? (
                <span className="text-xs text-muted">
                  {STAGE_KIND_LABELS[stage.kind].label}
                </span>
              ) : null}
              <span className="text-xs text-muted">
                {stage.probability !== null ? `${stage.probability} % · ` : ""}
                {stage.leadCount === 1 ? "1 lead" : `${stage.leadCount} leads`}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <IconAction
                isDisabled={index === 0 || reorderStage.isPending}
                label={`Subir ${stage.name}`}
                onPress={() =>
                  reorderStage.mutate({ id: stage.id, direction: "up" })
                }
              >
                <ArrowUpIcon size={14} />
              </IconAction>
              <IconAction
                isDisabled={
                  index === stages.length - 1 || reorderStage.isPending
                }
                label={`Bajar ${stage.name}`}
                onPress={() =>
                  reorderStage.mutate({ id: stage.id, direction: "down" })
                }
              >
                <ArrowDownIcon size={14} />
              </IconAction>
              <IconAction
                label={`Editar ${stage.name}`}
                onPress={() => onEditStage(stage)}
              >
                <PencilIcon size={14} />
              </IconAction>
              <IconAction
                isDisabled={stages.length <= 1}
                label={`Eliminar ${stage.name}`}
                onPress={() =>
                  pipeline && onDelete({ type: "stage", pipeline, stage })
                }
              >
                <TrashIcon size={14} />
              </IconAction>
            </div>
          </li>
        ))}
      </ol>
    </AppDrawer>
  );
}

/** One segment per stage, sized by its leads, as a quick view of the funnel. */
function StageBar({ stages }: { stages: PipelineStageItem[] }) {
  const total = stages.reduce((sum, stage) => sum + stage.leadCount, 0);

  return (
    <div className="flex min-w-32 flex-col gap-1">
      <div
        aria-hidden
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-default"
      >
        {total > 0
          ? stages
              .filter((stage) => stage.leadCount > 0)
              .map((stage) => (
                <span
                  key={stage.id}
                  className="h-full"
                  style={{
                    backgroundColor: stage.color,
                    width: `${(stage.leadCount / total) * 100}%`,
                  }}
                  title={`${stage.name}: ${stage.leadCount}`}
                />
              ))
          : null}
      </div>
      <span className="text-xs text-muted">
        {stages.length === 1 ? "1 paso" : `${stages.length} pasos`}
      </span>
    </div>
  );
}

// Sortable columns are named like the sort fields of `pipelineListSchema`.
type Column =
  | "name"
  | "stages"
  | "openCount"
  | "openValue"
  | "forecast"
  | "leadCount"
  | "actions";

function DeleteStageDialog({
  pending,
  onClose,
}: {
  pending?: Extract<PendingDelete, { type: "stage" }>;
  onClose: () => void;
}) {
  const [targetStageId, setTargetStageId] = useState("");
  const remove = useActionMutation(deleteStage, {
    successMessage: "Paso eliminado",
    invalidate,
  });
  const others =
    pending?.pipeline.stages.filter((stage) => stage.id !== pending.stage.id) ??
    [];
  const hasLeads = (pending?.stage.leadCount ?? 0) > 0;
  const [syncedId, setSyncedId] = useState<string>();

  // Preselect the first other stage each time a stage is chosen for deletion.
  if (pending?.stage.id !== syncedId) {
    setSyncedId(pending?.stage.id);
    setTargetStageId(others[0]?.id ?? "");
  }

  return (
    <AppModal
      description={
        hasLeads
          ? `«${pending?.stage.name}» tiene ${pending?.stage.leadCount} leads. Elige a qué paso moverlos.`
          : `El paso «${pending?.stage.name ?? ""}» se eliminará del tablero.`
      }
      footer={
        <>
          <AppButton variant="tertiary" onPress={onClose}>
            Cancelar
          </AppButton>
          <AppButton
            isDisabled={hasLeads && !targetStageId}
            isPending={remove.isPending}
            variant="danger"
            onPress={() =>
              pending &&
              remove.mutate(
                { id: pending.stage.id, targetStageId },
                { onSuccess: onClose },
              )
            }
          >
            {hasLeads ? "Mover y eliminar" : "Eliminar"}
          </AppButton>
        </>
      }
      isOpen={Boolean(pending)}
      title="Eliminar paso"
      onOpenChange={(isOpen) => !isOpen && onClose()}
    >
      {hasLeads ? (
        <AppFilterAutocomplete
          className="w-full"
          label="Mover los leads a"
          options={others.map((stage) => ({
            value: stage.id,
            label: stage.name,
          }))}
          value={targetStageId}
          onChange={setTargetStageId}
        />
      ) : null}
    </AppModal>
  );
}

const kanbanHref = (id: string) => `/leads/pipelines/${id}/kanban`;

/** Settings tab of the pipelines; the boards themselves live under Leads. */

export function PipelinesView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const money = useMoneyFormatter();
  // `?edit=<id>` (from the board's "Editar pasos") opens that pipeline's stages.
  const [stagesFor, setStagesFor] = useState<string | null>(
    searchParams.get("edit"),
  );

  const closeStages = () => {
    setStagesFor(null);
    if (searchParams.has("edit")) router.replace(pathname, { scroll: false });
  };
  const access = useMyAccess();
  const canRead = usePermission({ lead: ["read"] });
  const canManage = usePermission({ pipeline: ["manage"] });
  const [pipelineForm, setPipelineForm] = useState<{
    pipeline?: PipelineItem;
  }>();
  const [stageForm, setStageForm] = useState<{
    pipelineId: string;
    stage?: PipelineStageItem;
  }>();
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>();
  const removePipeline = useActionMutation(deletePipeline, {
    successMessage: "Embudo eliminado",
    invalidate,
  });

  const stagesPipeline = usePipeline(stagesFor ?? "", {
    enabled: Boolean(stagesFor),
  });
  const list = useListParams<PipelineListParams>(pipelineListSchema.parse({}));
  const page = usePipelinePage(list.params);

  if (access.data && !canRead) {
    return (
      <AppEmptyState
        description="Pide a un administrador que te dé acceso al módulo de leads."
        icon={<TargetIcon size={20} />}
        title="No tienes acceso a los leads"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Cada embudo es un tablero kanban con sus propios pasos: ventas,
          renovaciones, partners… Los pasos «Ganado» y «Perdido» cierran los
          leads.
        </p>
        {canManage ? (
          <AppButton className="shrink-0" onPress={() => setPipelineForm({})}>
            <PlusIcon size={16} />
            Nuevo embudo
          </AppButton>
        ) : null}
      </div>

      {page.error ? (
        <QueryError error={page.error} onRetry={() => page.refetch()} />
      ) : (
        <AppCard>
          <AppDataTable<PipelineItem, Column>
            columns={[
              {
                key: "name",
                label: "Embudo",
                isRowHeader: true,
                defaultWidth: "2fr",
                allowsSorting: true,
              },
              { key: "stages", label: "Pasos", defaultWidth: "2fr" },
              {
                key: "openCount",
                label: "Abiertos",
                className: "text-right",
                allowsSorting: true,
              },
              {
                key: "openValue",
                label: "En juego",
                className: "text-right",
                allowsSorting: true,
              },
              {
                key: "forecast",
                label: "Previsión",
                className: "text-right",
                allowsSorting: true,
              },
              {
                key: "leadCount",
                label: "Total leads",
                className: "text-right",
                allowsSorting: true,
              },
              {
                key: "actions",
                label: "Acciones",
                className: "text-right",
                width: 96,
              },
            ]}
            emptyContent="Aún no hay embudos"
            getRowKey={(pipeline) => pipeline.id}
            label="Embudos"
            pagination={list.pagination(page.data)}
            query={page}
            renderCell={(pipeline, column) => {
              switch (column) {
                case "name":
                  return (
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {pipeline.name}
                      </span>
                      {pipeline.description ? (
                        <span className="truncate text-xs text-muted">
                          {pipeline.description}
                        </span>
                      ) : null}
                    </div>
                  );
                case "stages":
                  return <StageBar stages={pipeline.stages} />;
                case "openCount":
                  return (
                    <span className="tabular-nums">{pipeline.openCount}</span>
                  );
                case "openValue":
                  return (
                    <span className="font-medium tabular-nums">
                      {money.format(pipeline.openValue)}
                    </span>
                  );
                case "forecast":
                  return (
                    <span className="tabular-nums text-muted">
                      {money.format(pipeline.forecast)}
                    </span>
                  );
                case "leadCount":
                  return (
                    <span className="tabular-nums">{pipeline.leadCount}</span>
                  );
                case "actions":
                  return (
                    <div className="flex justify-end">
                      <AppDropdown
                        items={[
                          {
                            id: "open",
                            label: "Abrir kanban",
                            icon: <TargetIcon size={16} />,
                          },
                          ...(canManage
                            ? [
                                {
                                  id: "stages",
                                  label: "Editar pasos",
                                  icon: <SettingsIcon size={16} />,
                                },
                                {
                                  id: "edit",
                                  label: "Renombrar",
                                  icon: <PencilIcon size={16} />,
                                },
                                {
                                  id: "delete",
                                  label: "Eliminar",
                                  icon: <TrashIcon size={16} />,
                                  isDanger: true,
                                  // The server keeps the last pipeline.
                                  isDisabled:
                                    (page.data?.total ?? 0) <= 1 &&
                                    !list.params.q,
                                },
                              ]
                            : []),
                        ]}
                        label={`Acciones para ${pipeline.name}`}
                        trigger={
                          <AppButton
                            isIconOnly
                            aria-label={`Acciones para ${pipeline.name}`}
                            size="sm"
                            variant="ghost"
                          >
                            <MoreIcon size={16} />
                          </AppButton>
                        }
                        onAction={(id) => {
                          if (id === "open")
                            router.push(kanbanHref(pipeline.id));
                          else if (id === "stages") setStagesFor(pipeline.id);
                          else if (id === "edit") setPipelineForm({ pipeline });
                          else if (id === "delete") {
                            setPendingDelete({ type: "pipeline", pipeline });
                          }
                        }}
                      />
                    </div>
                  );
              }
            }}
            rows={page.data?.items ?? []}
            search={{ ...list.search, placeholder: "Buscar embudos…" }}
            sort={list.sort}
            onClearFilters={list.onClearFilters}
            onRowAction={(id) => router.push(kanbanHref(id))}
            onSortChange={list.onSortChange}
          />
        </AppCard>
      )}

      <StagesDrawer
        pipeline={stagesFor ? (stagesPipeline.data ?? undefined) : undefined}
        onClose={closeStages}
        onDelete={setPendingDelete}
        onEditStage={(stage) =>
          stagesFor && setStageForm({ pipelineId: stagesFor, stage })
        }
      />

      <PipelineFormModal
        isOpen={Boolean(pipelineForm)}
        pipeline={pipelineForm?.pipeline}
        onOpenChange={(isOpen) => !isOpen && setPipelineForm(undefined)}
      />
      <StageFormModal
        isOpen={Boolean(stageForm)}
        pipelineId={stageForm?.pipelineId ?? ""}
        stage={stageForm?.stage}
        onOpenChange={(isOpen) => !isOpen && setStageForm(undefined)}
      />
      <AppConfirm
        confirmLabel="Eliminar embudo"
        description={
          pendingDelete?.type === "pipeline"
            ? `Se eliminará «${pendingDelete.pipeline.name}» con sus ${pendingDelete.pipeline.leadCount} leads y sus notas. Esta acción no se puede deshacer.`
            : ""
        }
        isOpen={pendingDelete?.type === "pipeline"}
        isPending={removePipeline.isPending}
        title="Eliminar embudo"
        onConfirm={() =>
          pendingDelete?.type === "pipeline" &&
          removePipeline.mutate(pendingDelete.pipeline.id, {
            onSuccess: () => setPendingDelete(undefined),
          })
        }
        onOpenChange={(isOpen) => !isOpen && setPendingDelete(undefined)}
      />
      <DeleteStageDialog
        pending={pendingDelete?.type === "stage" ? pendingDelete : undefined}
        onClose={() => setPendingDelete(undefined)}
      />
    </div>
  );
}
