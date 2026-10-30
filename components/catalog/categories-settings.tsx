"use client";

import type { ActionResult } from "@/lib/actions/result";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CategoryChip } from "@/components/catalog/category-chip";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import {
  AppButton,
  AppCard,
  AppColorPicker,
  AppConfirm,
  AppInput,
  AppModal,
} from "@/components/ui";
import { DEFAULT_COLOR } from "@/config/colors";
import { useActionMutation } from "@/hooks/use-action-mutation";
import {
  type CategoryFormValues,
  categoryFormSchema,
} from "@/lib/validations/catalog";

export interface CatalogCategory {
  id: string;
  name: string;
  color: string;
  /** Items of the module in the category. */
  itemCount: number;
}

/** Server Actions and texts of one catalog module's categories. */
export interface CategoriesConfig {
  title: string;
  description: string;
  /** Plural noun of the module items, e.g. "productos". */
  itemsLabel: { one: string; many: string };
  placeholder: string;
  maxCategories: number;
  invalidate: readonly (readonly string[])[];
  actions: {
    create: (input: CategoryFormValues) => Promise<ActionResult>;
    update: (input: {
      id: string;
      values: CategoryFormValues;
    }) => Promise<ActionResult>;
    move: (input: {
      id: string;
      direction: "up" | "down";
    }) => Promise<ActionResult>;
    remove: (id: string) => Promise<ActionResult>;
  };
}

export interface CategoriesQuery {
  data?: CatalogCategory[];
  error: Error | null;
  isPending: boolean;
  refetch: () => unknown;
}

function CategoryFormModal({
  isOpen,
  onOpenChange,
  category,
  config,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  category?: CatalogCategory;
  config: CategoriesConfig;
}) {
  const { invalidate } = config;
  const create = useActionMutation(config.actions.create, {
    successMessage: "Categoría creada",
    invalidate,
  });
  const update = useActionMutation(config.actions.update, {
    successMessage: "Categoría actualizada",
    invalidate,
  });
  const mutation = category ? update : create;
  const { control, handleSubmit, reset } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: "", color: DEFAULT_COLOR },
  });
  const [name, color] = useWatch({ control, name: ["name", "color"] });

  useEffect(() => {
    if (isOpen) {
      reset(
        category
          ? { name: category.name, color: category.color }
          : { name: "", color: DEFAULT_COLOR },
      );
    }
  }, [isOpen, category, reset]);

  const onSubmit = handleSubmit((values) => {
    const close = { onSuccess: () => onOpenChange(false) };

    if (category) update.mutate({ id: category.id, values }, close);
    else create.mutate(values, close);
  });

  return (
    <AppModal
      description="Las categorías agrupan tu catálogo y le dan color."
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton
            form="catalog-category-form"
            isPending={mutation.isPending}
            type="submit"
          >
            {category ? "Guardar" : "Crear categoría"}
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title={category ? "Editar categoría" : "Nueva categoría"}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id="catalog-category-form"
        onSubmit={onSubmit}
      >
        <AppInput
          isRequired
          control={control}
          label="Nombre"
          name="name"
          placeholder={config.placeholder}
        />
        <AppColorPicker control={control} label="Color" name="color" />
        <div className="flex items-center gap-2 text-sm text-muted">
          Vista previa:
          <CategoryChip
            category={{
              name: name?.trim() || "Categoría",
              color: color || DEFAULT_COLOR,
            }}
          />
        </div>
      </form>
    </AppModal>
  );
}

const countLabel = (count: number, label: CategoriesConfig["itemsLabel"]) =>
  `${count} ${count === 1 ? label.one : label.many}`;

/** Ordered, colored categories of a catalog module, edited from its settings. */
export function CategoriesSettings({
  canEdit,
  categories,
  config,
}: {
  canEdit: boolean;
  categories: CategoriesQuery;
  config: CategoriesConfig;
}) {
  const { invalidate } = config;
  const [editing, setEditing] = useState<CatalogCategory>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CatalogCategory>();

  const move = useActionMutation(config.actions.move, { invalidate });
  const remove = useActionMutation(config.actions.remove, {
    successMessage: "Categoría eliminada",
    invalidate,
  });

  const openForm = (category?: CatalogCategory) => {
    setEditing(category);
    setIsFormOpen(true);
  };

  const items = categories.data ?? [];
  const isFull = items.length >= config.maxCategories;

  return (
    <AppCard description={config.description} title={config.title}>
      {categories.error ? (
        <QueryError
          error={categories.error}
          onRetry={() => categories.refetch()}
        />
      ) : categories.isPending ? (
        <ListSkeleton rows={3} />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-separator">
            {items.map((category, index) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-5 text-right text-xs tabular-nums text-muted">
                    {index + 1}
                  </span>
                  <CategoryChip category={category} />
                  <span className="text-xs text-muted">
                    {countLabel(category.itemCount, config.itemsLabel)}
                  </span>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <AppButton
                      isIconOnly
                      aria-label={`Subir ${category.name}`}
                      isDisabled={index === 0 || move.isPending}
                      size="sm"
                      variant="ghost"
                      onPress={() =>
                        move.mutate({ id: category.id, direction: "up" })
                      }
                    >
                      <ArrowUpIcon size={14} />
                    </AppButton>
                    <AppButton
                      isIconOnly
                      aria-label={`Bajar ${category.name}`}
                      isDisabled={index === items.length - 1 || move.isPending}
                      size="sm"
                      variant="ghost"
                      onPress={() =>
                        move.mutate({ id: category.id, direction: "down" })
                      }
                    >
                      <ArrowDownIcon size={14} />
                    </AppButton>
                    <AppButton
                      isIconOnly
                      aria-label={`Editar ${category.name}`}
                      size="sm"
                      variant="ghost"
                      onPress={() => openForm(category)}
                    >
                      <PencilIcon size={14} />
                    </AppButton>
                    <AppButton
                      isIconOnly
                      aria-label={`Eliminar ${category.name}`}
                      size="sm"
                      variant="ghost"
                      onPress={() => setToDelete(category)}
                    >
                      <TrashIcon size={14} />
                    </AppButton>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">
                Al eliminar una categoría, sus {config.itemsLabel.many} quedan
                sin categoría.
              </p>
              <AppButton
                isDisabled={isFull}
                size="sm"
                variant="secondary"
                onPress={() => openForm()}
              >
                <PlusIcon size={14} />
                Añadir categoría
              </AppButton>
            </div>
          ) : null}
        </>
      )}

      <CategoryFormModal
        category={editing}
        config={config}
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
      />
      <AppConfirm
        confirmLabel="Eliminar"
        description={`La categoría «${toDelete?.name ?? ""}» dejará de estar disponible.${toDelete?.itemCount ? ` ${countLabel(toDelete.itemCount, config.itemsLabel)} ${toDelete.itemCount === 1 ? "quedará" : "quedarán"} sin categoría.` : ""}`}
        isOpen={Boolean(toDelete)}
        isPending={remove.isPending}
        title="Eliminar categoría"
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
