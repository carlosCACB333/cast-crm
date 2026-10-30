"use client";

import type { ProductFormValues } from "@/lib/validations/products";

import { type Control, useFieldArray, useWatch } from "react-hook-form";

import { BarcodeIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { formatPercent } from "@/components/products/product-format";
import {
  AppAutocomplete,
  AppButton,
  AppInput,
  AppTooltip,
} from "@/components/ui";
import {
  PRODUCT_LIMITS,
  PRODUCT_UNITS,
  presentationLabel,
  unitInfo,
} from "@/config/products";
import { useMoneyFormatter } from "@/hooks/use-preferences";

const unitOptions = PRODUCT_UNITS.map((unit) => ({
  value: unit.code,
  label: unit.label,
}));

/** Number typed in a decimal field, or null while it is empty or invalid. */
function parseTyped(value: string | undefined) {
  if (!value) return null;

  const number = Number(value.replace(",", "."));

  return Number.isFinite(number) ? number : null;
}

/** Price per base unit and saving against buying the units one by one. */
function PresentationHint({
  control,
  index,
}: {
  control: Control<ProductFormValues>;
  index: number;
}) {
  const money = useMoneyFormatter();
  const [baseUnit, basePrice, row] = useWatch({
    control,
    name: ["unit", "price", `presentations.${index}`],
  });
  const factor = parseTyped(row?.factor);
  const price = parseTyped(row?.price);

  if (!factor || factor <= 0 || price === null) return null;

  const perUnit = price / factor;
  const base = parseTyped(basePrice);
  const saving = base ? (1 - perUnit / base) * 100 : null;
  const short = unitInfo(baseUnit).short;

  return (
    <p className="text-xs text-muted">
      {presentationLabel(row.unit, factor, baseUnit)} · sale a{" "}
      <span className="font-medium text-foreground tabular-nums">
        {money.format(perUnit)} / {short}
      </span>
      {saving !== null && Math.abs(saving) >= 0.01 ? (
        <span className={saving > 0 ? "text-success" : "text-warning"}>
          {" "}
          ·{" "}
          {saving > 0
            ? `${formatPercent(saving)} más barato que por ${short}`
            : `${formatPercent(-saving)} más caro que por ${short}`}
        </span>
      ) : null}
    </p>
  );
}

/**
 * Extra ways of selling a product (a pack, a box…), each with how many base
 * units it contains and its own price. Stock stays in base units.
 */
export function ProductPresentationsField({
  control,
}: {
  control: Control<ProductFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "presentations",
  });
  const baseUnit = useWatch({ control, name: "unit" });
  const short = unitInfo(baseUnit).short;
  const isFull = fields.length >= PRODUCT_LIMITS.maxPresentations;

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? (
        <p className="text-sm text-muted">
          ¿Lo vendes también por paquete o por caja? Añade cada formato con
          cuántas unidades trae y su precio. El stock se seguirá contando por{" "}
          {unitInfo(baseUnit).label.toLowerCase()}.
        </p>
      ) : null}

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="flex flex-col gap-3 rounded-2xl border border-separator p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              Presentación {index + 1}
            </span>
            <AppTooltip content="Quitar presentación">
              <AppButton
                isIconOnly
                aria-label={`Quitar presentación ${index + 1}`}
                size="sm"
                variant="ghost"
                onPress={() => remove(index)}
              >
                <TrashIcon size={14} />
              </AppButton>
            </AppTooltip>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <AppAutocomplete
              isRequired
              control={control}
              label="Formato"
              name={`presentations.${index}.unit`}
              options={unitOptions}
            />
            <AppInput
              isRequired
              control={control}
              inputMode="decimal"
              label={`Contiene (${short})`}
              name={`presentations.${index}.factor`}
              placeholder="12"
            />
            <AppInput
              isRequired
              control={control}
              description="Precio del formato completo, sin impuestos."
              inputMode="decimal"
              label="Precio"
              name={`presentations.${index}.price`}
              placeholder="0,00"
            />
            <AppInput
              control={control}
              icon={<BarcodeIcon size={16} />}
              label="Código de barras"
              name={`presentations.${index}.barcode`}
            />
          </div>
          <PresentationHint control={control} index={index} />
        </div>
      ))}

      <AppButton
        className="self-start"
        isDisabled={isFull}
        size="sm"
        variant="secondary"
        onPress={() =>
          append({ unit: "pack", factor: "", price: "", barcode: "" })
        }
      >
        <PlusIcon size={14} />
        Añadir presentación
      </AppButton>
    </div>
  );
}
