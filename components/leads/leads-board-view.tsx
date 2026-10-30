"use client";

import type { LeadBoard } from "@/lib/actions/leads";
import type { LeadFormValues } from "@/lib/validations/leads";

import { useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { LeadCard } from "@/components/leads/lead-card";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { useLeadFilters } from "@/components/leads/use-lead-filters";
import { PlusIcon, SettingsIcon, TargetIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import {
  AppButton,
  AppClearFiltersButton,
  AppEmptyState,
  AppFilterAutocomplete,
  AppKanban,
  type AppKanbanMove,
  AppSearchInput,
  AppSkeleton,
  notify,
} from "@/components/ui";
import { useLeadBoard } from "@/hooks/use-leads";
import {
  useActiveMember,
  useMyAccess,
  usePermission,
} from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { moveLead } from "@/lib/actions/leads";
import { optionSources } from "@/lib/option-sources";
import { queryKeys } from "@/lib/query-keys";

const kanbanHref = (id: string) => `/leads/pipelines/${id}/kanban`;

const OWNER_OPTIONS = [
  { value: "me", label: "Mis leads" },
  { value: "none", label: "Sin asignar" },
];

/** Applies a drag and drop move to the cached board before the server confirms it. */
function applyMove(board: LeadBoard, move: AppKanbanMove): LeadBoard {
  const source = board.stages.find((stage) => stage.id === move.fromColumnId);
  const lead = source?.leads.find((item) => item.id === move.itemId);

  if (!lead) return board;

  const value = lead.value ?? 0;

  return {
    ...board,
    stages: board.stages.map((stage) => {
      let leads = stage.leads;
      let { count, totalValue } = stage;

      if (stage.id === move.fromColumnId) {
        leads = leads.filter((item) => item.id !== move.itemId);
        count -= 1;
        totalValue -= value;
      }
      if (stage.id === move.toColumnId) {
        leads = [...leads];
        leads.splice(move.index, 0, { ...lead, stageId: stage.id });
        count += 1;
        totalValue += value;
      }

      return { ...stage, leads, count, totalValue };
    }),
  } as LeadBoard;
}

function BoardSkeleton() {
  return (
    <div className="flex flex-1 gap-3 overflow-hidden">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex w-72 shrink-0 flex-col gap-2 rounded-2xl bg-surface-secondary p-3"
        >
          <AppSkeleton className="h-5 w-32 rounded-lg" />
          <AppSkeleton className="h-24 w-full rounded-xl" />
          <AppSkeleton className="h-24 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function LeadsBoardView({ pipelineId }: { pipelineId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { filters: urlFilters, setFilters } = useLeadFilters();
  const filters = { ...urlFilters, pipelineId };
  const board = useLeadBoard(filters);
  const { data: currentMember } = useActiveMember();
  const access = useMyAccess();
  const money = useMoneyFormatter();

  const canRead = usePermission({ lead: ["read"] });
  const canCreate = usePermission({ lead: ["create"] });
  const canUpdate = usePermission({ lead: ["update"] });
  const canManage = usePermission({ pipeline: ["manage"] });

  const [form, setForm] = useState<{ defaults: Partial<LeadFormValues> }>();

  const boardKey = queryKeys.leadBoard(filters);
  const move = useMutation({
    mutationFn: async (input: AppKanbanMove) => {
      const result = await moveLead({
        id: input.itemId,
        stageId: input.toColumnId,
        index: input.index,
      });

      if (!result.ok) throw new Error(result.error);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: boardKey });
      const previous = queryClient.getQueryData<LeadBoard>(boardKey);

      if (previous) {
        queryClient.setQueryData(boardKey, applyMove(previous, input));
      }

      return { previous };
    },
    onSuccess: (_, input) => {
      const target = board.data?.stages.find(
        (stage) => stage.id === input.toColumnId,
      );

      if (input.fromColumnId !== input.toColumnId && target?.kind === "WON") {
        notify.success(
          "¡Lead ganado! Puedes convertirlo en cliente desde su ficha.",
        );
      }
    },
    onError: (error, _, context) => {
      if (context?.previous)
        queryClient.setQueryData(boardKey, context.previous);
      notify.error(error.message);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.leads }),
  });

  const data = board.data;
  const pipeline = data?.pipeline;
  const openStages =
    data?.stages.filter((stage) => stage.kind === "OPEN") ?? [];
  const openCount = openStages.reduce((sum, stage) => sum + stage.count, 0);
  const openValue = openStages.reduce(
    (sum, stage) => sum + stage.totalValue,
    0,
  );
  const weightedValue = openStages.reduce(
    (sum, stage) => sum + (stage.totalValue * (stage.probability ?? 0)) / 100,
    0,
  );

  const openForm = (defaults: Partial<LeadFormValues> = {}) =>
    setForm({
      defaults: {
        pipelineId: pipeline?.id ?? "",
        ownerId: currentMember?.userId ?? "",
        ...defaults,
      },
    });

  if (access.data && !canRead) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Tablero" />
        <AppEmptyState
          description="Pide a un administrador que te dé acceso al módulo de leads."
          icon={<TargetIcon size={20} />}
          title="No tienes acceso a los leads"
        />
      </div>
    );
  }

  return (
    // Fills the viewport minus the app shell (mobile header and main padding),
    // so the board takes all the remaining height.
    <div className="flex h-[calc(100dvh-6.5rem)] min-w-0 flex-col gap-5 sm:h-[calc(100dvh-8.5rem)] lg:h-[calc(100dvh-5rem)]">
      <PageHeader
        actions={
          <>
            {canManage && pipeline ? (
              <NextLink
                className="inline-flex h-10 items-center gap-2 rounded-full bg-default px-4 text-sm font-medium transition-colors hover:bg-default/70 focus-visible:outline-2 focus-visible:outline-accent"
                href={`/leads/pipelines?edit=${pipeline.id}`}
              >
                <SettingsIcon size={16} />
                Editar pasos
              </NextLink>
            ) : null}
            {canCreate && pipeline ? (
              <AppButton onPress={() => openForm()}>
                <PlusIcon size={16} />
                Nuevo lead
              </AppButton>
            ) : null}
          </>
        }
        description={
          pipeline?.description ??
          "Arrastra las oportunidades entre los pasos del embudo."
        }
        title={pipeline ? pipeline.name : "Tablero"}
      />

      {board.error ? (
        <AppEmptyState
          action={
            <div className="flex gap-2">
              <AppButton variant="secondary" onPress={() => board.refetch()}>
                Reintentar
              </AppButton>
              <AppButton onPress={() => router.push("/leads")}>
                Ir al tablero
              </AppButton>
            </div>
          }
          description={board.error.message}
          icon={<TargetIcon size={20} />}
          title="No se pudo abrir el tablero"
        />
      ) : !data ? (
        <BoardSkeleton />
      ) : !pipeline ? (
        <AppEmptyState
          action={
            canManage ? (
              <AppButton onPress={() => router.push("/leads/pipelines")}>
                Crear un embudo
              </AppButton>
            ) : null
          }
          description="Un embudo define los pasos por los que pasan tus oportunidades."
          icon={<TargetIcon size={20} />}
          title="Aún no hay embudos"
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {data.pipelineCount > 1 ? (
                <AppFilterAutocomplete
                  label="Embudo"
                  source={optionSources.pipelines}
                  value={pipeline.id}
                  onChange={(id) => id && router.push(kanbanHref(id))}
                />
              ) : null}
              <AppSearchInput
                className="sm:w-72"
                debounceMs={300}
                label="Buscar leads"
                placeholder="Buscar por título, contacto, empresa…"
                value={filters.q}
                onChange={(q) => setFilters({ q })}
              />
              <AppFilterAutocomplete
                label="Responsable"
                options={[
                  { value: "", label: "Cualquier responsable" },
                  ...OWNER_OPTIONS,
                ]}
                source={optionSources.members}
                value={filters.ownerId}
                onChange={(ownerId) => setFilters({ ownerId })}
              />
              <AppClearFiltersButton
                filters={[
                  {
                    type: "options",
                    label: "Responsable",
                    options: OWNER_OPTIONS,
                    source: optionSources.members,
                    value: filters.ownerId ? [filters.ownerId] : [],
                    onChange: (value) =>
                      setFilters({ ownerId: value[0] ?? "" }),
                  },
                ]}
                search={filters.q}
                onPress={() => setFilters({ q: "", ownerId: "" })}
              />
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-muted">Abiertos</dt>
                <dd className="font-semibold tabular-nums">{openCount}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted">En juego</dt>
                <dd className="font-semibold tabular-nums">
                  {money.format(openValue)}
                </dd>
              </div>
              <div
                className="flex gap-1.5"
                title="Valor abierto multiplicado por la probabilidad de cada paso"
              >
                <dt className="text-muted">Previsión</dt>
                <dd className="font-semibold tabular-nums">
                  {money.format(weightedValue)}
                </dd>
              </div>
            </dl>
          </div>

          <div
            className={
              board.isPlaceholderData
                ? "flex min-h-80 flex-1 flex-col opacity-60 transition-opacity"
                : "flex min-h-80 flex-1 flex-col"
            }
          >
            <AppKanban
              columns={data.stages.map((stage) => ({
                id: stage.id,
                title: stage.name,
                color: stage.color,
                meta: (
                  <span title={money.format(stage.totalValue)}>
                    {stage.count}
                    {stage.totalValue > 0
                      ? ` · ${money.compact(stage.totalValue)}`
                      : ""}
                  </span>
                ),
                items: stage.leads,
                emptyLabel: canUpdate ? "Arrastra leads aquí" : "Sin leads",
                footer: (
                  <div className="flex flex-col gap-1">
                    {stage.count > stage.leads.length ? (
                      <p className="px-1 text-xs text-muted">
                        Mostrando {stage.leads.length} de {stage.count}. Usa la
                        búsqueda para encontrar el resto.
                      </p>
                    ) : null}
                    {canCreate ? (
                      <AppButton
                        fullWidth
                        className="justify-start text-muted"
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          openForm({
                            pipelineId: pipeline.id,
                            stageId: stage.id,
                          })
                        }
                      >
                        <PlusIcon size={14} />
                        Añadir lead
                      </AppButton>
                    ) : null}
                  </div>
                ),
              }))}
              getItemId={(lead) => lead.id}
              getItemLabel={(lead) => lead.title}
              isDragDisabled={!canUpdate}
              label={`Tablero ${pipeline.name}`}
              renderCard={(lead) => (
                <LeadCard
                  formatMoney={money.format}
                  isOpen={
                    data.stages.find((stage) => stage.id === lead.stageId)
                      ?.kind === "OPEN"
                  }
                  lead={lead}
                />
              )}
              onCardAction={(id) => router.push(`/leads/${id}`)}
              onMove={(input) => move.mutate(input)}
            />
          </div>
        </>
      )}

      <LeadFormDrawer
        defaults={form?.defaults}
        isOpen={Boolean(form)}
        onOpenChange={(isOpen) => !isOpen && setForm(undefined)}
      />
    </div>
  );
}
