"use client";

import type { ProductDetail } from "@/lib/actions/products";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { formatQuantity } from "@/components/products/product-format";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppInput,
  AppModal,
} from "@/components/ui";
import {
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
  presentationLabel,
  unitInfo,
} from "@/config/products";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { addStockMovement } from "@/lib/actions/products";
import { queryKeys } from "@/lib/query-keys";
import {
  type StockMovementValues,
  stockMovementSchema,
} from "@/lib/validations/products";

const FORM_ID = "stock-movement-form";

export function StockMovementModal({
  isOpen,
  onOpenChange,
  onSaved,
  product,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Called once the movement is saved, before the modal closes. */
  onSaved?: () => void;
  product: Pick<
    ProductDetail,
    "id" | "name" | "stock" | "unit" | "presentations"
  >;
}) {
  const add = useActionMutation(addStockMovement, {
    successMessage: "Stock actualizado",
    // The till shows the stock of its catalog too.
    invalidate: [queryKeys.products, queryKeys.pos],
  });
  const empty: StockMovementValues = {
    productId: product.id,
    type: "IN",
    quantity: "",
    reason: "",
    presentationId: "",
  };
  const { control, handleSubmit, reset } = useForm<StockMovementValues>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: empty,
  });
  const [type, quantity, presentationId] = useWatch({
    control,
    name: ["type", "quantity", "presentationId"],
  });
  const presentation = product.presentations.find(
    (item) => item.id === presentationId,
  );
  const baseUnit = unitInfo(product.unit);

  useEffect(() => {
    if (!isOpen) return;
    add.reset();
    reset(empty);
  }, [isOpen, product.id]);

  const typed =
    Number((quantity ?? "").replace(",", ".")) * (presentation?.factor ?? 1);
  const hasQuantity = quantity !== "" && Number.isFinite(typed);
  const after =
    type === "IN"
      ? product.stock + typed
      : type === "OUT"
        ? product.stock - typed
        : typed;

  const onSubmit = handleSubmit((values) =>
    add.mutate(values, {
      onSuccess: () => {
        onSaved?.();
        onOpenChange(false);
      },
    }),
  );

  return (
    <AppModal
      description={`Registra un cambio en las unidades de ${product.name}. Quedará guardado en el historial.`}
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton form={FORM_ID} isPending={add.isPending} type="submit">
            Guardar movimiento
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title="Ajustar stock"
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id={FORM_ID}
        onSubmit={onSubmit}
      >
        {add.error ? (
          <AppAlert
            description={add.error.message}
            status="danger"
            title="No se pudo ajustar el stock"
          />
        ) : null}
        <AppAutocomplete
          isRequired
          control={control}
          label="Tipo de movimiento"
          name="type"
          options={STOCK_MOVEMENT_TYPES.map((value) => ({
            value,
            ...STOCK_MOVEMENT_LABELS[value],
          }))}
        />
        {product.presentations.length ? (
          <AppAutocomplete
            control={control}
            label="Contar en"
            name="presentationId"
            options={[
              { value: "", label: baseUnit.label },
              ...product.presentations.map((item) => ({
                value: item.id,
                label: presentationLabel(item.unit, item.factor, product.unit),
              })),
            ]}
          />
        ) : null}
        <AppInput
          isRequired
          control={control}
          description={
            presentation && hasQuantity
              ? `Equivale a ${formatQuantity(typed, product.unit)}.`
              : type === "COUNT"
                ? "Unidades que has contado en total."
                : `Unidad de medida: ${(presentation ? unitInfo(presentation.unit) : baseUnit).label.toLowerCase()}.`
          }
          inputMode="decimal"
          label={type === "COUNT" ? "Stock contado" : "Cantidad"}
          name="quantity"
          placeholder="0"
        />
        <AppInput
          control={control}
          label="Motivo"
          name="reason"
          placeholder={
            type === "IN"
              ? "Por ejemplo, pedido a proveedor"
              : type === "OUT"
                ? "Por ejemplo, venta en tienda"
                : "Por ejemplo, inventario mensual"
          }
        />
        <div className="flex items-center justify-between rounded-2xl bg-default/60 px-4 py-3 text-sm">
          <span className="text-muted">
            Ahora: {formatQuantity(product.stock, product.unit)}
          </span>
          <span className="font-semibold tabular-nums">
            Quedará:{" "}
            <span className={after < 0 ? "text-danger" : undefined}>
              {hasQuantity ? formatQuantity(after, product.unit) : "—"}
            </span>
          </span>
        </div>
      </form>
    </AppModal>
  );
}
