"use client";

import type { UseQueryResult } from "@tanstack/react-query";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { NoteIcon, TrashIcon } from "@/components/icons";
import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppConfirm,
  AppEmptyState,
  AppTextarea,
} from "@/components/ui";
import { dateTimeFormatter, formatRelative } from "@/lib/format";

export interface NoteItem {
  id: string;
  body: string;
  createdAt: string;
  canDelete: boolean;
  author: { id: string; name: string; image: string | null } | null;
}

interface NoteMutation<TInput> {
  mutate: (input: TInput, options?: { onSuccess?: () => void }) => void;
  isPending: boolean;
}

export interface NotesPanelProps {
  notes: UseQueryResult<NoteItem[]>;
  canWrite: boolean;
  maxLength: number;
  /** Mutation that receives the note text. */
  add: NoteMutation<string>;
  /** Mutation that receives the note id. */
  remove: NoteMutation<string>;
}

function NoteComposer({
  maxLength,
  add,
}: Pick<NotesPanelProps, "maxLength" | "add">) {
  const schema = z.object({
    body: z
      .string()
      .trim()
      .min(1, "Escribe una nota")
      .max(maxLength, `Máximo ${maxLength} caracteres`),
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { body: "" },
  });

  const submit = handleSubmit(({ body }) =>
    add.mutate(body, { onSuccess: () => reset({ body: "" }) }),
  );

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={submit}>
      <AppTextarea
        isLabelHidden
        control={control}
        label="Nueva nota"
        name="body"
        placeholder="Registra una llamada, una reunión o cualquier dato relevante…"
        rows={3}
        onSubmitShortcut={submit}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="hidden text-xs text-muted sm:inline">
          Ctrl + Enter para guardar · máx. {maxLength.toLocaleString("es")}{" "}
          caracteres
        </span>
        <AppButton
          isDisabled={!isDirty}
          isPending={add.isPending}
          size="sm"
          type="submit"
        >
          Añadir nota
        </AppButton>
      </div>
    </form>
  );
}

/** Shared timeline of notes used by customers, leads and future modules. */
export function NotesPanel({
  notes,
  canWrite,
  maxLength,
  add,
  remove,
}: NotesPanelProps) {
  const [toDelete, setToDelete] = useState<NoteItem>();

  return (
    <AppCard
      description="Historial compartido con tu equipo."
      title="Notas y actividad"
    >
      {canWrite ? <NoteComposer add={add} maxLength={maxLength} /> : null}

      {notes.error ? (
        <QueryError error={notes.error} onRetry={() => notes.refetch()} />
      ) : notes.isPending ? (
        <ListSkeleton rows={2} />
      ) : notes.data.length === 0 ? (
        <AppEmptyState
          description={
            canWrite
              ? "Añade la primera nota para que el equipo tenga contexto."
              : "Todavía nadie ha registrado actividad."
          }
          icon={<NoteIcon size={20} />}
          title="Sin notas"
        />
      ) : (
        <ol className="flex flex-col">
          {notes.data.map((note, index) => (
            <li key={note.id} className="relative flex gap-3 pb-6 last:pb-0">
              {index < notes.data.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute top-9 bottom-0 left-4 w-px bg-separator"
                />
              ) : null}
              <AppAvatar
                name={note.author?.name ?? "Usuario eliminado"}
                size="sm"
                src={note.author?.image}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">
                      {note.author?.name ?? "Usuario eliminado"}
                    </span>{" "}
                    <time
                      className="text-muted"
                      dateTime={note.createdAt}
                      title={dateTimeFormatter.format(new Date(note.createdAt))}
                    >
                      · {formatRelative(note.createdAt)}
                    </time>
                  </p>
                  {note.canDelete ? (
                    <AppButton
                      isIconOnly
                      aria-label="Eliminar nota"
                      size="sm"
                      variant="ghost"
                      onPress={() => setToDelete(note)}
                    >
                      <TrashIcon size={14} />
                    </AppButton>
                  ) : null}
                </div>
                <p className="rounded-xl bg-default/60 px-3 py-2 text-sm break-words whitespace-pre-wrap">
                  {note.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <AppConfirm
        confirmLabel="Eliminar"
        description="La nota se eliminará para todo el equipo."
        isOpen={Boolean(toDelete)}
        isPending={remove.isPending}
        title="Eliminar nota"
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => setToDelete(undefined),
          })
        }
        onOpenChange={(isOpen) => !isOpen && setToDelete(undefined)}
      />
    </AppCard>
  );
}
