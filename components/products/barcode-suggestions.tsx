"use client";

import type { BarcodeSuggestion } from "@/lib/actions/products";
import type { ProductFormValues } from "@/lib/validations/products";
import type { UseFormReturn } from "react-hook-form";

import clsx from "clsx";

import {
  ProductThumb,
  priceWithTax,
} from "@/components/products/product-format";
import { AppAlert, AppButton, AppLink, AppSkeleton } from "@/components/ui";
import {
  PRODUCT_LIMITS,
  PRODUCT_UNIT_CODES,
  unitInfo,
} from "@/config/products";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { useBarcodeLookup } from "@/hooks/use-products";
import { decimalToText } from "@/lib/pricing";

const toUnit = (code: string, fallback: ProductFormValues["unit"]) =>
  PRODUCT_UNIT_CODES.find((unit) => unit === code) ?? fallback;

/** Fills a product form from a suggestion, except stock and internal codes. */
export function applyBarcodeSuggestion(
  {
    getValues,
    setValue,
  }: Pick<UseFormReturn<ProductFormValues>, "getValues" | "setValue">,
  suggestion: BarcodeSuggestion,
) {
  const options = { shouldDirty: true, shouldValidate: true };
  const unit = toUnit(suggestion.unit, getValues("unit"));

  setValue("name", suggestion.name, options);
  setValue("description", suggestion.description ?? "", options);
  setValue("unit", unit, options);
  setValue("price", decimalToText(suggestion.price), options);
  if (suggestion.taxRate !== null) {
    setValue("taxRate", decimalToText(suggestion.taxRate), options);
  }
  if (suggestion.categoryId) {
    setValue("categoryId", suggestion.categoryId, options);
  }
  setValue("tags", suggestion.tags.slice(0, PRODUCT_LIMITS.maxTags), options);
  setValue("trackStock", suggestion.trackStock, options);
  setValue(
    "presentations",
    suggestion.presentations.map((presentation) => ({
      unit: toUnit(presentation.unit, unit),
      factor: decimalToText(presentation.factor),
      price: decimalToText(presentation.price),
      barcode: presentation.barcode ?? "",
    })),
    options,
  );
}

/**
 * Result of looking up the barcode of a new product: the product the
 * organization already has with it, or products of other organizations to
 * fill the form from.
 */
export function BarcodeSuggestions({
  barcode,
  selectedId,
  onSelect,
  onClear,
}: {
  /** Code to look up; nothing is shown while it is empty. */
  barcode: string;
  selectedId: string | null;
  onSelect: (suggestion: BarcodeSuggestion) => void;
  onClear: () => void;
}) {
  const money = useMoneyFormatter();
  const lookup = useBarcodeLookup(barcode);

  if (!barcode) return null;

  if (lookup.isPending) {
    return (
      <div aria-busy className="flex flex-col gap-2">
        <span className="text-xs text-muted">Buscando el código…</span>
        <AppSkeleton className="h-14 rounded-xl" />
      </div>
    );
  }

  if (lookup.error) {
    return (
      <AppAlert
        description={lookup.error.message}
        status="danger"
        title="No se pudo buscar el código"
      />
    );
  }

  const { existing, suggestions } = lookup.data;

  if (existing) {
    return (
      <AppAlert
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>«{existing.name}» ya tiene este código de barras.</span>
            <AppLink href={`/products/${existing.id}`}>Abrir ficha</AppLink>
            <AppLink href={`/products/${existing.id}/edit`}>Editar</AppLink>
          </span>
        }
        status="accent"
        title="Ya tienes este producto"
      />
    );
  }

  if (suggestions.length === 0) {
    return (
      <p className="text-xs text-muted">
        No hay sugerencias para este código. Completa los datos a mano.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted">
        {suggestions.length === 1
          ? "Encontramos 1 producto con este código. Elígelo para rellenar los datos; el stock lo indicas tú."
          : `Encontramos ${suggestions.length} productos con este código. Elige uno para rellenar los datos; el stock lo indicas tú.`}
      </span>
      <ul className="flex flex-col gap-2">
        {suggestions.map((suggestion) => {
          const isSelected = suggestion.id === selectedId;
          const photos = suggestion.imageUrls.length;
          const details = [
            `Por ${unitInfo(suggestion.unit).label.toLowerCase()}`,
            suggestion.presentations.length
              ? `${suggestion.presentations.length + 1} formas de venta`
              : null,
            photos ? `${photos} ${photos === 1 ? "foto" : "fotos"}` : null,
            suggestion.copiedCount
              ? `Usado ${suggestion.copiedCount} ${suggestion.copiedCount === 1 ? "vez" : "veces"}`
              : null,
          ].filter(Boolean);

          return (
            <li
              key={suggestion.id}
              className={clsx(
                "flex items-center gap-3 rounded-xl border p-3",
                isSelected ? "border-accent bg-accent/5" : "border-border",
              )}
            >
              <ProductThumb
                imageUrl={suggestion.imageUrls[0]}
                name={suggestion.name}
                size="lg"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{suggestion.name}</span>
                <span className="text-sm font-semibold tabular-nums">
                  {money.format(
                    priceWithTax(suggestion.price, suggestion.taxRate),
                  )}
                </span>
                <span className="truncate text-xs text-muted">
                  {details.join(" · ")}
                </span>
              </div>
              {isSelected ? (
                <AppButton size="sm" variant="tertiary" onPress={onClear}>
                  Quitar
                </AppButton>
              ) : (
                <AppButton
                  size="sm"
                  variant="secondary"
                  onPress={() => onSelect(suggestion)}
                >
                  Usar
                </AppButton>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
