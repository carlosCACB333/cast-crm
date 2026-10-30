"use client";

import type { ProductDetail } from "@/lib/actions/products";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  BarcodeIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
} from "@/components/icons";
import { formatPercent } from "@/components/products/product-format";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppDropdown,
  AppInput,
  AppModal,
} from "@/components/ui";
import {
  PRODUCT_LIMITS,
  PRODUCT_UNITS,
  presentationLabel,
  unitInfo,
} from "@/config/products";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import {
  createPresentation,
  deletePresentation,
  updatePresentation,
} from "@/lib/actions/product-presentations";
import { decimalToText, parseTypedDecimal } from "@/lib/pricing";
import { queryKeys } from "@/lib/query-keys";
import {
  type PresentationFormValues,
  presentationFormSchema,
} from "@/lib/validations/products";

type Presentation = ProductDetail["presentations"][number];

const FORM_ID = "presentation-form";
const invalidate = [queryKeys.products];

const EMPTY: PresentationFormValues = {
  unit: "pack",
  factor: "",
  price: "",
  barcode: "",
};

/** Price per base unit and saving against buying the units one by one. */
function savingOf(price: number, factor: number, basePrice: number) {
  const perUnit = price / factor;

  return {
    perUnit,
    saving: basePrice > 0 ? (1 - perUnit / basePrice) * 100 : null,
  };
}

function SavingText({
  saving,
  short,
}: {
  saving: number | null;
  short: string;
}) {
  if (saving === null || Math.abs(saving) < 0.01) return null;

  return (
    <span className={saving > 0 ? "text-success" : "text-warning"}>
      {saving > 0
        ? `${formatPercent(saving)} más barato que por ${short}`
        : `${formatPercent(-saving)} más caro que por ${short}`}
    </span>
  );
}

function PresentationFormModal({
  isOpen,
  onOpenChange,
  product,
  presentation,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  product: ProductDetail;
  presentation?: Presentation;
}) {
  const money = useMoneyFormatter();
  const create = useActionMutation(createPresentation, {
    successMessage: "Forma de venta añadida",
    invalidate,
  });
  const update = useActionMutation(updatePresentation, {
    successMessage: "Forma de venta actualizada",
    invalidate,
  });
  const mutation = presentation ? update : create;
  const { control, handleSubmit, reset } = useForm<PresentationFormValues>({
    resolver: zodResolver(presentationFormSchema),
    defaultValues: EMPTY,
  });
  const [unit, factorText, priceText] = useWatch({
    control,
    name: ["unit", "factor", "price"],
  });

  useEffect(() => {
    if (!isOpen) return;
    create.reset();
    update.reset();
    reset(
      presentation
        ? {
            unit: presentation.unit as PresentationFormValues["unit"],
            factor: decimalToText(presentation.factor),
            price: decimalToText(presentation.price),
            barcode: presentation.barcode ?? "",
          }
        : EMPTY,
    );
  }, [isOpen, presentation]);

  const base = unitInfo(product.unit);
  const factor = parseTypedDecimal(factorText);
  const price = parseTypedDecimal(priceText);
  const preview =
    factor && factor > 0 && price !== null
      ? savingOf(price, factor, product.price)
      : null;

  const onSubmit = handleSubmit((values) => {
    const close = { onSuccess: () => onOpenChange(false) };

    if (presentation) update.mutate({ id: presentation.id, values }, close);
    else create.mutate({ productId: product.id, values }, close);
  });

  return (
    <AppModal
      description="Un formato con su propio precio, como un paquete o una caja. Al venderlo se descuentan del stock las unidades que contiene."
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton
            form={FORM_ID}
            isPending={mutation.isPending}
            type="submit"
          >
            {presentation ? "Guardar" : "Añadir"}
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title={presentation ? "Editar forma de venta" : "Nueva forma de venta"}
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id={FORM_ID}
        onSubmit={onSubmit}
      >
        {mutation.error ? (
          <AppAlert
            description={mutation.error.message}
            status="danger"
            title="No se pudo guardar"
          />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <AppAutocomplete
            isRequired
            control={control}
            label="Formato"
            name="unit"
            options={PRODUCT_UNITS.map((item) => ({
              value: item.code,
              label: item.label,
            }))}
          />
          <AppInput
            isRequired
            control={control}
            inputMode="decimal"
            label={`Contiene (${base.short})`}
            name="factor"
            placeholder="12"
          />
        </div>
        <AppInput
          isRequired
          control={control}
          description={`Precio del formato completo, en ${money.currency} y sin impuestos.`}
          inputMode="decimal"
          label="Precio"
          name="price"
          placeholder="0,00"
        />
        <AppInput
          control={control}
          icon={<BarcodeIcon size={16} />}
          label="Código de barras"
          name="barcode"
        />
        {preview && factor ? (
          <div className="flex flex-col gap-0.5 rounded-2xl bg-default/60 px-4 py-3 text-sm">
            <span className="font-medium">
              {presentationLabel(unit, factor, product.unit)}
            </span>
            <span className="text-xs text-muted">
              Sale a{" "}
              <span className="font-medium text-foreground tabular-nums">
                {money.format(preview.perUnit)} / {base.short}
              </span>
              {preview.saving !== null && Math.abs(preview.saving) >= 0.01
                ? " · "
                : null}
              <SavingText saving={preview.saving} short={base.short} />
            </span>
          </div>
        ) : null}
      </form>
    </AppModal>
  );
}

/** Base unit plus the extra ways of selling the product, editable in place. */
export function ProductPresentationsCard({
  product,
  canEdit,
}: {
  product: ProductDetail;
  canEdit: boolean;
}) {
  const money = useMoneyFormatter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Presentation>();
  const [toDelete, setToDelete] = useState<Presentation>();

  const remove = useActionMutation(deletePresentation, {
    successMessage: "Forma de venta eliminada",
    invalidate,
  });

  const base = unitInfo(product.unit);
  const isFull =
    product.presentations.length >= PRODUCT_LIMITS.maxPresentations;
  const openForm = (presentation?: Presentation) => {
    setEditing(presentation);
    setIsFormOpen(true);
  };
  const available = (factor: number) =>
    product.trackStock ? Math.floor(product.stock / factor) : null;

  const availableText = (factor: number) => {
    const count = available(factor);

    if (count === null) return null;

    return (
      <span className="text-xs text-muted tabular-nums">
        {count === 1 ? "1 disponible" : `${count} disponibles`}
      </span>
    );
  };

  return (
    <AppCard
      description={`El stock se cuenta por ${base.label.toLowerCase()}; cada formato descuenta las unidades que contiene.`}
      title="Formas de venta"
    >
      <ul className="flex flex-col divide-y divide-separator">
        <li className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              {base.label}
              <AppChip>Unidad base</AppChip>
            </span>
            <span className="truncate text-xs text-muted">
              Su precio se cambia al editar el producto
              {product.barcode ? ` · ${product.barcode}` : ""}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold tabular-nums">
                {money.format(product.price)}
              </span>
              {availableText(1)}
            </div>
            {/* Keeps the prices aligned with the rows that have actions. */}
            {canEdit ? <span aria-hidden className="w-8" /> : null}
          </div>
        </li>

        {product.presentations.map((presentation) => {
          const label = presentationLabel(
            presentation.unit,
            presentation.factor,
            product.unit,
          );
          const { perUnit, saving } = savingOf(
            presentation.price,
            presentation.factor,
            product.price,
          );

          return (
            <li
              key={presentation.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{label}</span>
                <span className="truncate text-xs text-muted">
                  {money.format(perUnit)} / {base.short}
                  {saving !== null && Math.abs(saving) >= 0.01 ? " · " : ""}
                  <SavingText saving={saving} short={base.short} />
                  {presentation.barcode ? ` · ${presentation.barcode}` : ""}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold tabular-nums">
                    {money.format(presentation.price)}
                  </span>
                  {availableText(presentation.factor)}
                </div>
                {canEdit ? (
                  <AppDropdown
                    items={[
                      {
                        id: "edit",
                        label: "Editar",
                        icon: <PencilIcon size={16} />,
                      },
                      {
                        id: "delete",
                        label: "Eliminar",
                        icon: <TrashIcon size={16} />,
                        isDanger: true,
                      },
                    ]}
                    label={`Acciones de ${label}`}
                    trigger={
                      <AppButton
                        isIconOnly
                        aria-label={`Acciones de ${label}`}
                        size="sm"
                        variant="ghost"
                      >
                        <MoreIcon size={16} />
                      </AppButton>
                    }
                    onAction={(action) =>
                      action === "edit"
                        ? openForm(presentation)
                        : setToDelete(presentation)
                    }
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {product.presentations.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <TagIcon size={16} />
          ¿Lo vendes también por paquete o por caja? Añade el formato con su
          precio.
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            Hasta {PRODUCT_LIMITS.maxPresentations} formas de venta por
            producto.
          </p>
          <AppButton
            isDisabled={isFull}
            size="sm"
            variant="secondary"
            onPress={() => openForm()}
          >
            <PlusIcon size={14} />
            Añadir forma de venta
          </AppButton>
        </div>
      ) : null}

      <PresentationFormModal
        isOpen={isFormOpen}
        presentation={editing}
        product={product}
        onOpenChange={setIsFormOpen}
      />
      <AppConfirm
        confirmLabel="Eliminar"
        description={`«${toDelete ? presentationLabel(toDelete.unit, toDelete.factor, product.unit) : ""}» dejará de ofrecerse. El historial de stock no cambia.`}
        isOpen={Boolean(toDelete)}
        isPending={remove.isPending}
        title="Eliminar forma de venta"
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
