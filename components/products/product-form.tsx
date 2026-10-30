"use client";

import type { BarcodeSuggestion, ProductDetail } from "@/lib/actions/products";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { BarcodeIcon, PackageIcon, TagIcon } from "@/components/icons";
import {
  CatalogBackLink,
  CatalogFormSkeleton,
  CatalogNoAccess,
} from "@/components/catalog/catalog-page";
import { PricePreview } from "@/components/catalog/price-preview";
import { PageHeader } from "@/components/page-header";
import { BarcodeSuggestions } from "@/components/products/barcode-suggestions";
import {
  ProductThumb,
  formatQuantity,
  priceWithTax,
} from "@/components/products/product-format";
import { ProductPresentationsField } from "@/components/products/product-presentations-field";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppCard,
  AppEmptyState,
  AppInput,
  AppSwitch,
  AppTagInput,
  AppTextarea,
  notify,
} from "@/components/ui";
import {
  PRODUCT_LIMITS,
  PRODUCT_UNIT_CODES,
  PRODUCT_UNITS,
  unitInfo,
} from "@/config/products";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useMyAccess, usePermission } from "@/hooks/use-organization";
import {
  useMoneyFormatter,
  useOrganizationTaxes,
} from "@/hooks/use-preferences";
import { useProduct } from "@/hooks/use-products";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { createProduct, updateProduct } from "@/lib/actions/products";
import { optionSources } from "@/lib/option-sources";
import { decimalToText, parseTypedDecimal } from "@/lib/pricing";
import { queryKeys } from "@/lib/query-keys";
import {
  EMPTY_PRODUCT_FORM,
  type ProductFormValues,
  productFormSchema,
} from "@/lib/validations/products";

const FORM_ID = "product-form";

/** Wait after the last keystroke before looking up a typed barcode. */
const BARCODE_LOOKUP_DELAY_MS = 400;

const toUnit = (code: string, fallback: ProductFormValues["unit"]) =>
  PRODUCT_UNIT_CODES.find((unit) => unit === code) ?? fallback;

function toFormValues(product: ProductDetail): ProductFormValues {
  return {
    name: product.name,
    description: product.description ?? "",
    categoryId: product.category?.id ?? "",
    tags: product.tags,
    price: decimalToText(product.price),
    taxRate: decimalToText(product.taxRate),
    cost: decimalToText(product.cost),
    unit: product.unit as ProductFormValues["unit"],
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    trackStock: product.trackStock,
    initialStock: "",
    minStock: decimalToText(product.minStock),
    isActive: product.isActive,
    presentations: product.presentations.map((presentation) => ({
      unit: presentation.unit as ProductFormValues["unit"],
      factor: decimalToText(presentation.factor),
      price: decimalToText(presentation.price),
      barcode: presentation.barcode ?? "",
    })),
  };
}

/** Live card in the sidebar: how the product will look once saved. */
function ProductSummary({
  values,
}: {
  values: Pick<
    ProductFormValues,
    | "name"
    | "price"
    | "taxRate"
    | "unit"
    | "trackStock"
    | "initialStock"
    | "presentations"
  >;
}) {
  const money = useMoneyFormatter();
  const price = parseTypedDecimal(values.price);
  const stock = parseTypedDecimal(values.initialStock);
  const name = values.name.trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <ProductThumb name={name || "?"} />
        <div className="flex min-w-0 flex-col">
          <span
            className={
              name ? "truncate font-medium" : "truncate font-medium text-muted"
            }
          >
            {name || "Sin nombre"}
          </span>
          <span className="truncate text-xs text-muted">
            Por {unitInfo(values.unit).label.toLowerCase()}
          </span>
        </div>
      </div>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Precio final</dt>
          <dd className="font-semibold tabular-nums">
            {price === null
              ? "—"
              : `${money.format(priceWithTax(price, parseTypedDecimal(values.taxRate)))} / ${unitInfo(values.unit).short}`}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Formas de venta</dt>
          <dd className="tabular-nums">{values.presentations.length + 1}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Stock</dt>
          <dd className="tabular-nums">
            {!values.trackStock
              ? "Sin control"
              : stock !== null
                ? formatQuantity(stock, values.unit)
                : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ProductForm({ product }: { product?: ProductDetail }) {
  const router = useRouter();
  const money = useMoneyFormatter();
  const isEdit = Boolean(product);
  const invalidate = [queryKeys.products];

  const create = useActionMutation(createProduct, {
    successMessage: "Producto creado",
    invalidate,
  });
  const update = useActionMutation(updateProduct, {
    successMessage: "Cambios guardados",
    invalidate,
  });
  const mutation = isEdit ? update : create;

  const {
    control,
    handleSubmit,
    getFieldState,
    getValues,
    resetField,
    setValue,
    formState: { isDirty, isSubmitSuccessful },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product ? toFormValues(product) : EMPTY_PRODUCT_FORM,
  });
  const values = useWatch({ control }) as ProductFormValues;
  const { trackStock, price, taxRate, cost } = values;
  const hasUnsavedChanges = isDirty && !isSubmitSuccessful;
  const defaultTaxRate = useOrganizationTaxes().data?.defaultTaxRate;

  // New items start with the organization's tax once it loads, unless the
  // user already typed one.
  useEffect(() => {
    if (!product && defaultTaxRate && !getFieldState("taxRate").isDirty) {
      resetField("taxRate", { defaultValue: defaultTaxRate });
    }
  }, [product, defaultTaxRate, getFieldState, resetField]);

  useUnsavedChangesWarning(hasUnsavedChanges);

  // New products start from the barcode: a scanner types it and presses
  // Enter, which looks it up at once; typed codes are looked up after a pause.
  const barcode = (values.barcode ?? "").trim();
  const [lookupCode, setLookupCode] = useState("");
  const [source, setSource] = useState<{
    id: string;
    barcode: string;
  } | null>(null);

  useEffect(() => {
    if (product) return;
    const timeout = setTimeout(
      () => setLookupCode(barcode),
      BARCODE_LOOKUP_DELAY_MS,
    );

    return () => clearTimeout(timeout);
  }, [product, barcode]);

  // The suggestion only counts while the code it was found with is kept.
  const sourceId = source && source.barcode === barcode ? source.id : null;

  /** Fills the form from a suggestion, except stock and internal codes. */
  const applySuggestion = (suggestion: BarcodeSuggestion) => {
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
    setSource({ id: suggestion.id, barcode });
  };

  const backHref = product ? `/products/${product.id}` : "/products";

  const onSubmit = handleSubmit((formValues) => {
    if (product) {
      update.mutate(
        { id: product.id, values: formValues },
        { onSuccess: () => router.push(`/products/${product.id}`) },
      );
    } else {
      create.mutate(
        { values: formValues, sourceId: sourceId ?? undefined },
        {
          onSuccess: ({ id, failedImages }) => {
            if (failedImages > 0) {
              notify.warning(
                `No se pudieron copiar ${failedImages === 1 ? "1 foto" : `${failedImages} fotos`}. Puedes subirlas desde la ficha.`,
              );
            }
            router.replace(`/products/${id}`);
          },
        },
      );
    }
  });

  const submitLabel = isEdit ? "Guardar cambios" : "Crear producto";

  return (
    <div className="flex flex-col gap-6">
      <CatalogBackLink
        href={backHref}
        label={product ? product.name : "Productos"}
      />

      <PageHeader
        actions={
          <>
            <AppButton variant="tertiary" onPress={() => router.push(backHref)}>
              Cancelar
            </AppButton>
            <AppButton
              form={FORM_ID}
              isDisabled={isEdit && !isDirty}
              isPending={mutation.isPending}
              type="submit"
            >
              {submitLabel}
            </AppButton>
          </>
        }
        description={
          isEdit
            ? "Actualiza la información, el precio o las formas de venta."
            : "Solo necesitas el nombre y el precio; el resto puedes completarlo después."
        }
        title={isEdit ? "Editar producto" : "Nuevo producto"}
      />

      <form
        noValidate
        className="grid items-start gap-6 lg:grid-cols-3"
        id={FORM_ID}
        onSubmit={onSubmit}
      >
        <div className="flex flex-col gap-6 lg:col-span-2">
          {mutation.error ? (
            <AppAlert
              description={mutation.error.message}
              status="danger"
              title="No se pudo guardar el producto"
            />
          ) : null}

          <AppCard
            description={
              isEdit
                ? undefined
                : "Escanéalo o escríbelo: si otro negocio ya tiene el producto, podrás rellenar sus datos con un clic."
            }
            title="Códigos"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <AppInput
                autoFocus={!isEdit}
                control={control}
                icon={<BarcodeIcon size={16} />}
                label="Código de barras"
                name="barcode"
                onEnter={isEdit ? undefined : () => setLookupCode(barcode)}
              />
              <AppInput
                control={control}
                description="Tu referencia interna. No se puede repetir."
                icon={<TagIcon size={16} />}
                label="Referencia (SKU)"
                name="sku"
              />
            </div>
            {isEdit ? null : (
              <BarcodeSuggestions
                barcode={lookupCode === barcode ? lookupCode : ""}
                selectedId={sourceId}
                onClear={() => setSource(null)}
                onSelect={applySuggestion}
              />
            )}
          </AppCard>

          <AppCard title="Información básica">
            <AppInput
              isRequired
              control={control}
              label="Nombre"
              name="name"
              placeholder="Por ejemplo, Galletas de avena"
            />
            <AppTextarea
              control={control}
              description="Lo que verá tu equipo al elegirlo: características, tallas, condiciones…"
              label="Descripción"
              name="description"
              rows={4}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <AppAutocomplete
                control={control}
                label="Categoría"
                name="categoryId"
                options={[{ value: "none", label: "Sin categoría" }]}
                placeholder="Sin categoría"
                source={optionSources.productCategories}
              />
              <AppTagInput
                control={control}
                label="Etiquetas"
                maxLength={PRODUCT_LIMITS.maxTagLength}
                maxTags={PRODUCT_LIMITS.maxTags}
                name="tags"
                source={optionSources.productTags}
              />
            </div>
          </AppCard>

          <AppCard
            description={`Importes en ${money.currency}, sin impuestos.`}
            title="Precio"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <AppInput
                isRequired
                control={control}
                inputMode="decimal"
                label="Precio de venta"
                name="price"
                placeholder="0,00"
              />
              <AppAutocomplete
                isRequired
                control={control}
                label="Unidad base"
                name="unit"
                options={PRODUCT_UNITS.map((unit) => ({
                  value: unit.code,
                  label: unit.label,
                }))}
              />
              <AppInput
                control={control}
                description="IVA u otro impuesto, en %."
                inputMode="decimal"
                label="Impuesto"
                name="taxRate"
                placeholder="21"
              />
              <AppInput
                control={control}
                description="Lo que te cuesta a ti. Solo lo ve tu equipo."
                inputMode="decimal"
                label="Coste"
                name="cost"
                placeholder="0,00"
              />
            </div>
            <PricePreview
              cost={parseTypedDecimal(cost)}
              price={parseTypedDecimal(price)}
              taxRate={parseTypedDecimal(taxRate)}
            />
          </AppCard>

          <AppCard
            description="Formatos con varias unidades y su propio precio, como un paquete o una caja."
            title="Formas de venta"
          >
            <ProductPresentationsField control={control} />
          </AppCard>

          <AppCard title="Inventario">
            <AppSwitch
              control={control}
              description="Lleva la cuenta de las unidades disponibles y recibe avisos de stock bajo."
              label="Controlar stock"
              name="trackStock"
            />
            {trackStock ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {isEdit ? null : (
                  <AppInput
                    control={control}
                    description="Unidades que tienes ahora."
                    inputMode="decimal"
                    label="Stock inicial"
                    name="initialStock"
                    placeholder="0"
                  />
                )}
                <AppInput
                  control={control}
                  description="Te avisaremos al llegar a esta cantidad."
                  inputMode="decimal"
                  label="Stock mínimo"
                  name="minStock"
                  placeholder="Opcional"
                />
              </div>
            ) : null}
            {isEdit && trackStock ? (
              <p className="text-xs text-muted">
                Para cambiar las unidades disponibles usa «Ajustar stock» en la
                ficha del producto; así queda registrado en el historial.
              </p>
            ) : null}
          </AppCard>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <AppCard title="Resumen">
            <ProductSummary values={values} />
          </AppCard>
          <AppCard title="Disponibilidad">
            <AppSwitch
              control={control}
              description="Los productos inactivos se conservan, pero dejan de ofrecerse."
              label="Producto activo"
              name="isActive"
            />
          </AppCard>
          <div className="flex flex-col gap-2">
            <AppButton
              fullWidth
              form={FORM_ID}
              isDisabled={isEdit && !isDirty}
              isPending={mutation.isPending}
              type="submit"
            >
              {submitLabel}
            </AppButton>
            {hasUnsavedChanges ? (
              <p className="text-center text-xs text-muted">
                Tienes cambios sin guardar.
              </p>
            ) : null}
          </div>
        </aside>
      </form>
    </div>
  );
}

export function ProductCreateView() {
  const access = useMyAccess();
  const canCreate = usePermission({ product: ["create"] });

  if (!access.data) return <CatalogFormSkeleton />;
  if (!canCreate)
    return (
      <CatalogNoAccess
        backHref="/products"
        backLabel="Productos"
        icon={<PackageIcon size={20} />}
        title="No puedes crear productos"
      />
    );

  return <ProductForm />;
}

export function ProductEditView({ id }: { id: string }) {
  const router = useRouter();
  const access = useMyAccess();
  const canUpdate = usePermission({ product: ["update"] });
  const product = useProduct(id);

  if (access.data && !canUpdate) {
    return (
      <CatalogNoAccess
        backHref="/products"
        backLabel="Productos"
        icon={<PackageIcon size={20} />}
        title="No puedes editar productos"
      />
    );
  }

  if (product.error) {
    return (
      <div className="flex flex-col gap-6">
        <CatalogBackLink href="/products" label="Productos" />
        <AppEmptyState
          action={
            <div className="flex gap-2">
              <AppButton variant="secondary" onPress={() => product.refetch()}>
                Reintentar
              </AppButton>
              <AppButton onPress={() => router.push("/products")}>
                Ir a productos
              </AppButton>
            </div>
          }
          description={product.error.message}
          icon={<PackageIcon size={20} />}
          title="No se pudo abrir el producto"
        />
      </div>
    );
  }

  if (!product.data || !access.data) return <CatalogFormSkeleton />;

  // Keyed by id so another product starts with a fresh form.
  return <ProductForm key={product.data.id} product={product.data} />;
}
