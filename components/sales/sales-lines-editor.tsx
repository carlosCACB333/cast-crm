"use client";

import type {
  SalesDocumentFormValues,
  SalesLineValues,
} from "@/lib/validations/sales";

import { useState } from "react";
import {
  type Control,
  type FieldErrors,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  FileTextIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppDropdown,
  AppEmptyState,
  AppInput,
  AppModal,
  notify,
} from "@/components/ui";
import { SALES_LIMITS } from "@/config/sales";
import { unwrapAction } from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { getSalesCatalogItem } from "@/lib/actions/sales";
import { optionSources } from "@/lib/option-sources";
import { decimalToText, formatPercent } from "@/lib/pricing";
import { queryKeys } from "@/lib/query-keys";
import { lineAmounts, typedNumber } from "@/lib/sales-math";
import {
  EMPTY_SALES_LINE,
  SALES_BASE_PRESENTATION,
  salesLineSchema,
} from "@/lib/validations/sales";

const LINE_FORM = "sales-line-form";

const catalogItemQuery = (ref: string) => ({
  queryKey: queryKeys.salesCatalogItem(ref),
  queryFn: () => unwrapAction(getSalesCatalogItem(ref)),
  staleTime: 60_000,
});

/** Catalog data of a line's product, shared by every line with the same one. */
function useCatalogItem(ref: string) {
  return useQuery({
    ...catalogItemQuery(ref),
    enabled: ref.startsWith("product:"),
  });
}

const amountsOf = (line: SalesLineValues) =>
  lineAmounts({
    quantity: typedNumber(line.quantity),
    unitPrice: typedNumber(line.unitPrice),
    discount: typedNumber(line.discount),
    taxRate: typedNumber(line.taxRate),
  });

/**
 * Form of one line: the catalog item (and its presentation when it has
 * several), description, quantity and prices, with the resulting amounts.
 */
function SalesLineModal({
  line,
  isNew,
  onOpenChange,
  onSave,
}: {
  line: SalesLineValues;
  isNew: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (line: SalesLineValues) => void;
}) {
  const money = useMoneyFormatter();
  const queryClient = useQueryClient();
  const { control, handleSubmit, setValue, setError } =
    useForm<SalesLineValues>({
      resolver: zodResolver(salesLineSchema),
      defaultValues: line,
    });
  const values = useWatch({ control }) as SalesLineValues;
  const item = useCatalogItem(values.itemRef ?? "").data;
  const presentations = item?.presentations ?? [];
  const amounts = amountsOf(values);
  const options = { shouldDirty: true, shouldValidate: true };

  const fill = useMutation({
    mutationFn: (ref: string) => queryClient.fetchQuery(catalogItemQuery(ref)),
    onSuccess: (catalog) => {
      // Products with presentations wait until one is picked.
      setValue("presentationId", "", options);
      setValue("description", catalog.description, options);
      setValue("unit", catalog.unit, options);
      setValue("unitPrice", decimalToText(catalog.unitPrice), options);
      if (catalog.taxRate !== null) {
        setValue("taxRate", decimalToText(catalog.taxRate), options);
      }
    },
    onError: (error) => notify.error(error.message),
  });

  /** Fills the line with the picked presentation (or the base unit). */
  const pickPresentation = (presentationId: string) => {
    if (!item) return;
    const presentation = item.presentations.find(
      (option) => option.id === presentationId,
    );

    setValue(
      "description",
      presentation
        ? `${item.description} (${presentation.label})`
        : item.description,
      options,
    );
    setValue("unit", presentation?.unit ?? item.unit, options);
    setValue(
      "unitPrice",
      decimalToText(presentation?.unitPrice ?? item.unitPrice),
      options,
    );
  };

  const save = handleSubmit((submitted) => {
    if (presentations.length && !submitted.presentationId) {
      setError("presentationId", { message: "Elige cómo se vende" });

      return;
    }
    onSave(submitted);
    onOpenChange(false);
  });

  return (
    <AppModal
      isOpen
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton form={LINE_FORM} isDisabled={fill.isPending} type="submit">
            {isNew ? "Añadir línea" : "Guardar línea"}
          </AppButton>
        </>
      }
      size="lg"
      title={isNew ? "Nueva línea" : "Editar línea"}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id={LINE_FORM}
        // The modal is rendered inside the document form: keep its submit
        // from reaching that form.
        onSubmit={(event) => {
          event.stopPropagation();
          void save(event);
        }}
      >
        <AppAutocomplete
          control={control}
          label="Producto o servicio"
          name="itemRef"
          placeholder="Buscar por nombre, referencia o código de barras…"
          source={optionSources.salesItems}
          onValueChange={(ref) => {
            if (ref) fill.mutate(ref);
            else setValue("presentationId", "", options);
          }}
        />
        {presentations.length ? (
          <AppAutocomplete
            isRequired
            control={control}
            label="Presentación"
            name="presentationId"
            options={[
              {
                value: SALES_BASE_PRESENTATION,
                label: `Por unidad (${item?.unit})`,
                description: money.format(item?.unitPrice ?? 0),
              },
              ...presentations.map((presentation) => ({
                value: presentation.id,
                label: presentation.label,
                description: money.format(presentation.unitPrice),
              })),
            ]}
            placeholder="Elige cómo se vende"
            onValueChange={(value) => value && pickPresentation(value)}
          />
        ) : null}
        <AppInput
          isRequired
          control={control}
          description={
            values.itemRef
              ? "Se rellena con el artículo; puedes cambiarla."
              : "Sin artículo, la línea es libre: escribe el concepto."
          }
          label="Descripción"
          name="description"
        />
        <div className="grid grid-cols-2 gap-4">
          <AppInput
            isRequired
            control={control}
            inputMode="decimal"
            label="Cantidad"
            name="quantity"
            placeholder="1"
            suffix={values.unit || undefined}
          />
          <AppInput
            isRequired
            control={control}
            description="Por unidad, sin impuestos."
            inputMode="decimal"
            label="Precio"
            name="unitPrice"
            placeholder="0,00"
          />
          <AppInput
            control={control}
            inputMode="decimal"
            label="Descuento %"
            name="discount"
            placeholder="0"
          />
          <AppInput
            control={control}
            inputMode="decimal"
            label="Impuesto %"
            name="taxRate"
            placeholder="0"
          />
        </div>
        <dl className="flex flex-col gap-1 rounded-xl bg-default p-3 text-sm">
          {amounts.discountAmount > 0 ? (
            <div className="flex justify-between gap-4 text-muted">
              <dt>Descuento</dt>
              <dd className="tabular-nums">
                {money.format(-amounts.discountAmount)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt>Importe sin impuestos</dt>
            <dd className="font-medium tabular-nums">
              {money.format(amounts.subtotal)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 text-muted">
            <dt>Con impuestos</dt>
            <dd className="tabular-nums">{money.format(amounts.total)}</dd>
          </div>
        </dl>
      </form>
    </AppModal>
  );
}

const GRID =
  "md:grid md:grid-cols-[minmax(0,1fr)_6rem_7rem_4.5rem_4.5rem_7rem_4.5rem] md:items-center md:gap-3";

/**
 * Lines of a sales document, listed read-only. Adding or editing a line
 * opens its form in a modal.
 */
export function SalesLinesEditor({
  control,
  errors,
  defaultTaxRate,
}: {
  control: Control<SalesDocumentFormValues>;
  errors: FieldErrors<SalesDocumentFormValues>;
  defaultTaxRate: number | null;
}) {
  const money = useMoneyFormatter();
  const { fields, append, insert, remove, move, update } = useFieldArray({
    control,
    name: "lines",
  });
  const lines = useWatch({ control, name: "lines" }) ?? [];
  /** Index of the line being edited, or "new". */
  const [editing, setEditing] = useState<number | "new">();
  const rootError = errors.lines?.root?.message ?? errors.lines?.message;
  const isFull = fields.length >= SALES_LIMITS.maxLines;

  const handleLineAction = (index: number, action: string) => {
    if (action === "up") move(index, index - 1);
    else if (action === "down") move(index, index + 1);
    else if (action === "duplicate") insert(index + 1, { ...lines[index] });
    else if (action === "delete") remove(index);
  };

  return (
    <div className="flex flex-col gap-4">
      {fields.length === 0 ? (
        <AppEmptyState
          description="Añade productos, servicios o líneas libres."
          icon={<FileTextIcon size={20} />}
          title="Sin líneas"
        />
      ) : (
        <div className="flex flex-col">
          <div
            aria-hidden
            className={`hidden px-2 pb-2 text-xs font-medium text-muted ${GRID}`}
          >
            <span>Concepto</span>
            <span className="text-right">Cantidad</span>
            <span className="text-right">Precio</span>
            <span className="text-right">Dto.</span>
            <span className="text-right">Imp.</span>
            <span className="text-right">Importe</span>
            <span />
          </div>
          <ol className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-separator md:border-y md:border-separator">
            {fields.map((field, index) => {
              const line = lines[index] ?? field;
              const amounts = amountsOf(line);
              const position = index + 1;
              const hasError = Boolean(errors.lines?.[index]);

              return (
                <li
                  key={field.id}
                  aria-label={`Línea ${position}`}
                  className={clsx(
                    "flex flex-col gap-2 rounded-2xl border p-3 text-sm md:rounded-none md:border-0 md:px-2 md:py-3",
                    hasError ? "border-danger bg-danger/5" : "border-separator",
                    GRID,
                  )}
                >
                  <button
                    className="flex min-w-0 flex-col rounded-lg text-left focus-visible:outline-2 focus-visible:outline-accent"
                    type="button"
                    onClick={() => setEditing(index)}
                  >
                    <span className="truncate font-medium hover:underline">
                      {line.description || "Sin descripción"}
                    </span>
                    <span
                      className={clsx(
                        "text-xs",
                        hasError ? "text-danger" : "text-muted",
                      )}
                    >
                      {hasError
                        ? "Revisa esta línea"
                        : line.itemRef.startsWith("service:")
                          ? "Servicio"
                          : line.itemRef
                            ? "Producto"
                            : "Línea libre"}
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted md:contents">
                    <span className="tabular-nums md:text-right md:text-foreground">
                      {line.quantity || "0"} {line.unit}
                    </span>
                    <span className="tabular-nums md:text-right">
                      <span className="md:hidden">× </span>
                      {money.format(typedNumber(line.unitPrice))}
                    </span>
                    <span className="tabular-nums md:text-right">
                      {typedNumber(line.discount) ? (
                        `-${formatPercent(typedNumber(line.discount))}`
                      ) : (
                        <span className="hidden md:inline">—</span>
                      )}
                    </span>
                    <span className="tabular-nums md:text-right">
                      <span className="md:hidden">Imp. </span>
                      {formatPercent(typedNumber(line.taxRate))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 md:contents">
                    <span className="flex flex-col md:items-end">
                      <span className="font-semibold tabular-nums">
                        {money.format(amounts.subtotal)}
                      </span>
                      {amounts.discountAmount > 0 ? (
                        <span className="text-xs text-muted tabular-nums line-through">
                          {money.format(amounts.gross)}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex justify-end gap-1">
                      <AppButton
                        isIconOnly
                        aria-label={`Editar línea ${position}`}
                        size="sm"
                        variant="ghost"
                        onPress={() => setEditing(index)}
                      >
                        <PencilIcon size={14} />
                      </AppButton>
                      <AppDropdown
                        items={[
                          {
                            id: "up",
                            label: "Subir",
                            icon: <ArrowUpIcon size={16} />,
                            isDisabled: index === 0,
                          },
                          {
                            id: "down",
                            label: "Bajar",
                            icon: <ArrowDownIcon size={16} />,
                            isDisabled: index === fields.length - 1,
                          },
                          {
                            id: "duplicate",
                            label: "Duplicar línea",
                            icon: <CopyIcon size={16} />,
                            isDisabled: isFull,
                          },
                          {
                            id: "delete",
                            label: "Eliminar línea",
                            icon: <TrashIcon size={16} />,
                            isDanger: true,
                          },
                        ]}
                        label={`Acciones de la línea ${position}`}
                        trigger={
                          <AppButton
                            isIconOnly
                            aria-label={`Acciones de la línea ${position}`}
                            size="sm"
                            variant="ghost"
                          >
                            <MoreIcon size={16} />
                          </AppButton>
                        }
                        onAction={(action) => handleLineAction(index, action)}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {rootError ? <AppAlert status="danger" title={rootError} /> : null}

      <div>
        <AppButton
          isDisabled={isFull}
          variant="secondary"
          onPress={() => setEditing("new")}
        >
          <PlusIcon size={16} />
          Añadir línea
        </AppButton>
      </div>

      {editing !== undefined ? (
        <SalesLineModal
          isNew={editing === "new"}
          line={
            editing === "new"
              ? { ...EMPTY_SALES_LINE, taxRate: decimalToText(defaultTaxRate) }
              : lines[editing]
          }
          onOpenChange={(isOpen) => !isOpen && setEditing(undefined)}
          onSave={(line) =>
            editing === "new" ? append(line) : update(editing, line)
          }
        />
      ) : null}
    </div>
  );
}
