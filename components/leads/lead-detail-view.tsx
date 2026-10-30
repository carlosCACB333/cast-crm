"use client";

import { useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { NotesPanel } from "@/components/notes/notes-panel";
import {
  ArrowLeftIcon,
  ContactsIcon,
  MailIcon,
  MoreIcon,
  PencilIcon,
  PhoneIcon,
  TargetIcon,
  TrashIcon,
} from "@/components/icons";
import { STAGE_KIND_LABELS, LEAD_LIMITS } from "@/config/leads";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppDropdown,
  AppEmptyState,
  AppSkeleton,
  AppStatusChip,
  notify,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useLead, useLeadNotes, usePipeline } from "@/hooks/use-leads";
import { usePermission } from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import {
  addLeadNote,
  convertLeadToCustomer,
  deleteLead,
  deleteLeadNote,
  moveLead,
} from "@/lib/actions/leads";
import {
  dateTimeFormatter,
  formatDay,
  formatRelative,
  isPastDay,
} from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

const linkButton =
  "inline-flex h-10 items-center gap-2 rounded-full bg-default px-4 text-sm font-medium transition-colors hover:bg-default/70 focus-visible:outline-2 focus-visible:outline-accent";

const empty = <span className="text-muted">—</span>;

function Detail({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

/** Back to the lead's kanban, or to the default board while it loads. */
function BackLink({ pipeline }: { pipeline?: { id: string; name: string } }) {
  return (
    <NextLink
      className="inline-flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      href={pipeline ? `/leads/pipelines/${pipeline.id}/kanban` : "/leads"}
    >
      <ArrowLeftIcon size={16} />
      {pipeline ? pipeline.name : "Tablero"}
    </NextLink>
  );
}

export function LeadDetailView({ id }: { id: string }) {
  const router = useRouter();
  const lead = useLead(id);
  // Its stages fill the "move to stage" menu.
  const pipeline = usePipeline(lead.data?.pipelineId ?? "", {
    enabled: Boolean(lead.data),
  });
  const notes = useLeadNotes(id);
  const money = useMoneyFormatter();
  const canUpdate = usePermission({ lead: ["update"] });
  const canDelete = usePermission({ lead: ["delete"] });
  const canConvert = usePermission({ lead: ["update"], customer: ["create"] });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const invalidate = [queryKeys.leads];
  const changeStage = useActionMutation(moveLead, {
    successMessage: "Paso actualizado",
    invalidate,
  });
  const remove = useActionMutation(deleteLead, {
    successMessage: "Lead eliminado",
    invalidate,
  });
  const convert = useActionMutation(convertLeadToCustomer, {
    invalidate: [queryKeys.leads, queryKeys.customers],
  });
  const addNote = useActionMutation(
    (body: string) => addLeadNote({ leadId: id, body }),
    { successMessage: "Nota añadida", invalidate },
  );
  const removeNote = useActionMutation(deleteLeadNote, {
    successMessage: "Nota eliminada",
    invalidate,
  });

  const data = lead.data;

  if (lead.error) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <AppEmptyState
          action={
            <div className="flex gap-2">
              <AppButton variant="secondary" onPress={() => lead.refetch()}>
                Reintentar
              </AppButton>
              <AppButton onPress={() => router.push("/leads")}>
                Ir al tablero
              </AppButton>
            </div>
          }
          description={lead.error.message}
          icon={<TargetIcon size={20} />}
          title="No se pudo abrir el lead"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <AppSkeleton className="h-8 w-80 rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-3">
          <AppSkeleton className="h-64 rounded-3xl lg:col-span-2" />
          <AppSkeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  const stages = pipeline.data?.stages ?? [];
  const isOpen = data.stage.kind === "OPEN";
  const isOverdue =
    isOpen &&
    data.expectedCloseDate !== null &&
    isPastDay(data.expectedCloseDate);

  const handleConvert = () =>
    convert.mutate(data.id, {
      onSuccess: ({ customerId, isNew }) => {
        notify.success(
          isNew
            ? "Cliente creado y vinculado al lead"
            : "Lead vinculado a un cliente existente con el mismo correo",
        );
        router.push(`/customers/${customerId}`);
      },
    });

  return (
    <div className="flex flex-col gap-6">
      <BackLink pipeline={data.pipeline} />

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {data.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <AppChip>{data.pipeline.name}</AppChip>
            {canUpdate && stages.length ? (
              <AppDropdown
                items={stages.map((stage) => ({
                  id: stage.id,
                  label: stage.name,
                  description: STAGE_KIND_LABELS[stage.kind].label,
                  isSelected: stage.id === data.stage.id,
                }))}
                label="Cambiar paso"
                placement="bottom start"
                trigger={
                  <AppButton
                    aria-label="Cambiar paso"
                    className="h-auto min-w-0 px-1 py-0.5"
                    size="sm"
                    variant="ghost"
                  >
                    <AppStatusChip
                      color={data.stage.color}
                      label={data.stage.name}
                    />
                  </AppButton>
                }
                onAction={(stageId) =>
                  stageId !== data.stage.id &&
                  changeStage.mutate({ id: data.id, stageId, index: 0 })
                }
              />
            ) : (
              <AppStatusChip color={data.stage.color} label={data.stage.name} />
            )}
            {data.value !== null ? (
              <span className="text-base font-semibold text-foreground tabular-nums">
                {money.format(data.value)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.email ? (
            <a className={linkButton} href={`mailto:${data.email}`}>
              <MailIcon size={16} />
              Correo
            </a>
          ) : null}
          {data.phone ? (
            <a
              className={linkButton}
              href={`tel:${data.phone.replace(/\s/g, "")}`}
            >
              <PhoneIcon size={16} />
              Llamar
            </a>
          ) : null}
          {data.customer ? (
            <NextLink
              className={linkButton}
              href={`/customers/${data.customer.id}`}
            >
              <ContactsIcon size={16} />
              Ver cliente
            </NextLink>
          ) : canConvert ? (
            <AppButton
              isPending={convert.isPending}
              variant={data.stage.kind === "WON" ? "primary" : "secondary"}
              onPress={handleConvert}
            >
              {convert.isPending ? null : <ContactsIcon size={16} />}
              Convertir en cliente
            </AppButton>
          ) : null}
          {/* A won lead's main action is converting it into a customer. */}
          {canUpdate ? (
            <AppButton
              variant={
                data.stage.kind === "WON" && !data.customer && canConvert
                  ? "secondary"
                  : "primary"
              }
              onPress={() => setIsEditOpen(true)}
            >
              <PencilIcon size={16} />
              Editar
            </AppButton>
          ) : null}
          {canDelete ? (
            <AppDropdown
              items={[
                {
                  id: "delete",
                  label: "Eliminar lead",
                  icon: <TrashIcon size={16} />,
                  isDanger: true,
                },
              ]}
              label="Más acciones"
              trigger={
                <AppButton
                  isIconOnly
                  aria-label="Más acciones"
                  variant="secondary"
                >
                  <MoreIcon size={16} />
                </AppButton>
              }
              onAction={() => setIsDeleteOpen(true)}
            />
          ) : null}
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <NotesPanel
            add={addNote}
            canWrite={canUpdate}
            maxLength={LEAD_LIMITS.maxNoteLength}
            notes={notes}
            remove={removeNote}
          />
        </div>

        <div className="flex flex-col gap-6">
          <AppCard title="Oportunidad">
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Valor">
                {data.value !== null ? money.format(data.value) : empty}
              </Detail>
              <Detail label="Probabilidad">
                {data.stage.probability !== null
                  ? `${data.stage.probability} %`
                  : empty}
              </Detail>
              <Detail label="Cierre previsto">
                {data.expectedCloseDate ? (
                  <span
                    className={clsx(isOverdue && "font-medium text-danger")}
                  >
                    {formatDay(data.expectedCloseDate)}
                    {isOverdue ? " · vencido" : ""}
                  </span>
                ) : (
                  empty
                )}
              </Detail>
              <Detail label="Origen">{data.source ?? empty}</Detail>
              {data.closedAt ? (
                <Detail
                  label={data.stage.kind === "WON" ? "Ganado" : "Perdido"}
                >
                  {dateTimeFormatter.format(new Date(data.closedAt))}
                </Detail>
              ) : null}
              {data.stage.kind === "LOST" ? (
                <Detail className="col-span-2" label="Motivo de pérdida">
                  {data.lostReason ?? empty}
                </Detail>
              ) : null}
            </dl>
          </AppCard>

          <AppCard title="Contacto">
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Persona">{data.contactName ?? empty}</Detail>
              <Detail label="Empresa">{data.companyName ?? empty}</Detail>
              <Detail className="col-span-2" label="Correo">
                {data.email ? (
                  <a
                    className="hover:text-accent hover:underline"
                    href={`mailto:${data.email}`}
                  >
                    {data.email}
                  </a>
                ) : (
                  empty
                )}
              </Detail>
              <Detail label="Teléfono">{data.phone ?? empty}</Detail>
              <Detail label="Cliente">
                {data.customer ? (
                  <NextLink
                    className="text-accent hover:underline"
                    href={`/customers/${data.customer.id}`}
                  >
                    {data.customer.name}
                  </NextLink>
                ) : (
                  <span className="text-muted">Sin vincular</span>
                )}
              </Detail>
            </dl>
          </AppCard>

          <AppCard title="Detalles">
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Responsable">
                {data.owner ? (
                  <span className="flex items-center gap-2">
                    <AppAvatar
                      name={data.owner.name}
                      size="sm"
                      src={data.owner.image}
                    />
                    <span className="truncate">{data.owner.name}</span>
                  </span>
                ) : (
                  <span className="text-muted">Sin asignar</span>
                )}
              </Detail>
              <Detail label="Última actividad">
                <span
                  title={dateTimeFormatter.format(new Date(data.updatedAt))}
                >
                  {formatRelative(data.updatedAt)}
                </span>
              </Detail>
              <Detail className="col-span-2" label="Etiquetas">
                {data.tags.length ? (
                  <span className="flex flex-wrap gap-1">
                    {data.tags.map((tag) => (
                      <AppChip key={tag}>{tag}</AppChip>
                    ))}
                  </span>
                ) : (
                  empty
                )}
              </Detail>
              <Detail className="col-span-2" label="Creado">
                <span
                  title={dateTimeFormatter.format(new Date(data.createdAt))}
                >
                  {formatRelative(data.createdAt)}
                  {data.createdBy ? ` por ${data.createdBy.name}` : ""}
                </span>
              </Detail>
            </dl>
          </AppCard>
        </div>
      </div>

      <LeadFormDrawer
        isOpen={isEditOpen}
        lead={data}
        onOpenChange={setIsEditOpen}
      />

      <AppConfirm
        confirmLabel="Eliminar"
        description={`Se eliminará «${data.title}» junto con sus notas. Esta acción no se puede deshacer.`}
        isOpen={isDeleteOpen}
        isPending={remove.isPending}
        title="Eliminar lead"
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () =>
              router.replace(`/leads/pipelines/${data.pipelineId}/kanban`),
          })
        }
        onOpenChange={setIsDeleteOpen}
      />
    </div>
  );
}
