"use client";

import type { ProductDetail } from "@/lib/actions/products";

import { createContext, useContext, useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import { CatalogBackLink } from "@/components/catalog/catalog-page";
import { CatalogDetail, PricingCard } from "@/components/catalog/pricing-card";
import {
  ArrowsUpDownIcon,
  ImageIcon,
  CopyIcon,
  MoreIcon,
  PackageIcon,
  PencilIcon,
  PowerIcon,
  TagIcon,
  TrashIcon,
} from "@/components/icons";
import {
  CatalogActiveChip,
  CategoryChip,
  ProductThumb,
  type StockLevel,
  StockLevelChip,
  dateTimeFormatter,
  formatQuantity,
  formatRelative,
  stockLevel,
} from "@/components/products/product-format";
import { ProductImages } from "@/components/products/product-images";
import { ProductPresentationsCard } from "@/components/products/product-presentations-card";
import { StockMovementModal } from "@/components/products/stock-movement-modal";
import { StockMovementsTable } from "@/components/products/stock-movements-table";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppDropdown,
  AppEmptyState,
  AppImage,
  type AppTabItem,
  AppTabs,
  AppSkeleton,
  notify,
} from "@/components/ui";
import { presentationLabel, unitInfo } from "@/config/products";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { usePermission } from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { useProduct } from "@/hooks/use-products";
import {
  deleteProduct,
  duplicateProduct,
  setProductActive,
} from "@/lib/actions/products";
import { queryKeys } from "@/lib/query-keys";

function copy(value: string, label: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => notify.success(`${label} copiado`))
    .catch(() => notify.error("No se pudo copiar"));
}

const empty = <span className="text-muted">—</span>;

/** Bar of the stock against twice its minimum, so the minimum sits halfway. */
function StockMeter({
  product,
  level,
}: {
  product: ProductDetail;
  level: Exclude<StockLevel, "untracked">;
}) {
  if (!product.minStock) return null;

  const fill = Math.min(100, (product.stock / (product.minStock * 2)) * 100);

  return (
    <div
      aria-label="Nivel de stock"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(fill)}
      className="h-2 overflow-hidden rounded-full bg-default"
      role="meter"
    >
      <div
        className={clsx(
          "h-full rounded-full transition-[width]",
          level === "ok"
            ? "bg-success"
            : level === "low"
              ? "bg-warning"
              : "bg-danger",
        )}
        style={{ width: `${Math.max(fill, level === "out" ? 0 : 4)}%` }}
      />
    </div>
  );
}

const untrackedText =
  "Este producto no controla stock. Actívalo al editarlo para llevar la cuenta de sus unidades.";

function StockCard({
  product,
  canUpdate,
  onAdjust,
}: {
  product: ProductDetail;
  canUpdate: boolean;
  onAdjust: () => void;
}) {
  const level = stockLevel(product);

  if (level === "untracked") {
    return (
      <AppCard title="Inventario">
        <p className="text-sm text-muted">{untrackedText}</p>
      </AppCard>
    );
  }

  return (
    <AppCard title="Inventario">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Disponible</span>
          <span className="text-3xl font-semibold tabular-nums">
            {formatQuantity(product.stock, product.unit)}
          </span>
        </div>
        <StockLevelChip level={level} />
      </div>
      {product.minStock ? (
        <div className="flex flex-col gap-1.5">
          <StockMeter level={level} product={product} />
          <span className="text-xs text-muted">
            Mínimo: {formatQuantity(product.minStock ?? 0, product.unit)}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Define un stock mínimo para recibir avisos cuando quede poco.
        </p>
      )}
      {canUpdate ? (
        <AppButton fullWidth variant="secondary" onPress={onAdjust}>
          <ArrowsUpDownIcon size={16} />
          Ajustar stock
        </AppButton>
      ) : null}
    </AppCard>
  );
}

function OverviewTile({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-default/60 p-4">
      <span className="text-xs text-muted">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

/** Full-width summary of the stock for the inventory tab. */
function InventoryOverview({
  product,
  canUpdate,
  onAdjust,
}: {
  product: ProductDetail;
  canUpdate: boolean;
  onAdjust: () => void;
}) {
  const money = useMoneyFormatter();
  const level = stockLevel(product);
  const adjustButton = canUpdate ? (
    <AppButton variant="secondary" onPress={onAdjust}>
      <ArrowsUpDownIcon size={16} />
      Ajustar stock
    </AppButton>
  ) : null;

  if (level === "untracked") {
    return (
      <AppCard title="Inventario">
        <p className="text-sm text-muted">{untrackedText}</p>
      </AppCard>
    );
  }

  const unitValue = product.cost ?? product.price;

  return (
    <AppCard
      description="Unidades disponibles y su valor. Cada ajuste queda en el historial."
      title="Inventario"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewTile label="Disponible">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {formatQuantity(product.stock, product.unit)}
            </span>
            <StockLevelChip level={level} />
          </span>
        </OverviewTile>
        <OverviewTile
          hint={
            product.minStock
              ? "Avisamos al llegar a esta cantidad"
              : "Defínelo al editar para recibir avisos"
          }
          label="Stock mínimo"
        >
          <span className="text-2xl font-semibold tabular-nums">
            {product.minStock
              ? formatQuantity(product.minStock, product.unit)
              : "—"}
          </span>
          <StockMeter level={level} product={product} />
        </OverviewTile>
        <OverviewTile
          hint={product.cost === null ? "A precio de venta" : "A coste"}
          label="Valor del stock"
        >
          <span className="text-2xl font-semibold tabular-nums">
            {money.format(Math.max(product.stock, 0) * unitValue)}
          </span>
        </OverviewTile>
        <OverviewTile hint="Entradas, salidas y recuentos" label="Movimientos">
          <span className="text-2xl font-semibold tabular-nums">
            {product._count.movements}
          </span>
        </OverviewTile>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {product.presentations.length ? (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
            <span>Equivale a</span>
            {product.presentations.map((presentation) => (
              <span key={presentation.id} className="text-foreground">
                {Math.floor(product.stock / presentation.factor)} ×{" "}
                {presentationLabel(
                  presentation.unit,
                  presentation.factor,
                  product.unit,
                )}
              </span>
            ))}
          </p>
        ) : (
          <span />
        )}
        {adjustButton}
      </div>
    </AppCard>
  );
}

function DetailsCard({ product }: { product: ProductDetail }) {
  return (
    <AppCard title="Detalles">
      <dl className="grid grid-cols-2 gap-4">
        <CatalogDetail label="Referencia (SKU)">
          {product.sku ?? empty}
        </CatalogDetail>
        <CatalogDetail label="Código de barras">
          {product.barcode ?? empty}
        </CatalogDetail>
        <CatalogDetail isWide label="Unidad base">
          {unitInfo(product.unit).label}
        </CatalogDetail>
        <CatalogDetail isWide label="Etiquetas">
          {product.tags.length ? (
            <span className="flex flex-wrap gap-1">
              {product.tags.map((tag) => (
                <NextLink
                  key={tag}
                  className="rounded-full focus-visible:outline-2 focus-visible:outline-accent"
                  href={`/products?tag=${encodeURIComponent(tag)}`}
                >
                  <AppChip>{tag}</AppChip>
                </NextLink>
              ))}
            </span>
          ) : (
            empty
          )}
        </CatalogDetail>
        <CatalogDetail label="Creado">
          <span title={dateTimeFormatter.format(new Date(product.createdAt))}>
            {formatRelative(product.createdAt)}
          </span>
        </CatalogDetail>
        <CatalogDetail label="Última actividad">
          <span title={dateTimeFormatter.format(new Date(product.updatedAt))}>
            {formatRelative(product.updatedAt)}
          </span>
        </CatalogDetail>
        {product.createdBy ? (
          <CatalogDetail isWide label="Creado por">
            <span className="flex items-center gap-2">
              <AppAvatar
                name={product.createdBy.name}
                size="sm"
                src={product.createdBy.image}
              />
              <span className="truncate">{product.createdBy.name}</span>
            </span>
          </CatalogDetail>
        ) : null}
      </dl>
    </AppCard>
  );
}

/** Main photo with a shortcut to the gallery, or an invitation to add one. */
function MainImageCard({
  product,
  canUpdate,
}: {
  product: ProductDetail;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const main = product.images[0];
  const onShowImages = () => router.push(`/products/${product.id}/images`);

  if (!main) {
    return (
      <AppEmptyState
        action={
          canUpdate ? (
            <AppButton size="sm" variant="secondary" onPress={onShowImages}>
              <ImageIcon size={14} />
              Añadir fotos
            </AppButton>
          ) : null
        }
        description="Las fotos ayudan a tu equipo a reconocer el producto."
        icon={<ImageIcon size={20} />}
        title="Sin imágenes"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-default">
        <AppImage
          isPriority
          alt={`Imagen principal de ${product.name}`}
          sizes="(min-width: 1024px) 30vw, 100vw"
          src={main.url}
        />
      </div>
      <AppButton size="sm" variant="ghost" onPress={onShowImages}>
        <ImageIcon size={14} />
        {product.images.length === 1
          ? "Gestionar imágenes"
          : `Ver las ${product.images.length} imágenes`}
      </AppButton>
    </div>
  );
}

function SummaryTab({
  product,
  canUpdate,
  onAdjust,
}: {
  product: ProductDetail;
  canUpdate: boolean;
  onAdjust: () => void;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <PricingCard
          cost={product.cost}
          price={product.price}
          taxRate={product.taxRate}
          unitLabel={unitInfo(product.unit).label}
        />
        <AppCard title="Descripción">
          {product.description ? (
            <p className="text-sm whitespace-pre-line">{product.description}</p>
          ) : (
            <p className="text-sm text-muted">
              Sin descripción. Añade sus características al editarlo.
            </p>
          )}
        </AppCard>
        <DetailsCard product={product} />
      </div>
      <div className="flex flex-col gap-6">
        <MainImageCard canUpdate={canUpdate} product={product} />
        <StockCard
          canUpdate={canUpdate}
          product={product}
          onAdjust={onAdjust}
        />
      </div>
    </div>
  );
}

interface ProductDetailContextValue {
  product: ProductDetail;
  canUpdate: boolean;
  openStockAdjust: () => void;
}

const ProductDetailContext = createContext<ProductDetailContextValue | null>(
  null,
);

/** Product loaded by `ProductDetailLayout`, for the pages of its tabs. */
function useProductDetail() {
  const context = useContext(ProductDetailContext);

  if (!context) {
    throw new Error("useProductDetail must be used inside ProductDetailLayout");
  }

  return context;
}

/**
 * Header, actions and route tabs of a product. Each tab is its own page
 * (`/products/[id]`, `/images`, `/presentations`, `/inventory`).
 */
export function ProductDetailLayout({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const product = useProduct(id);
  const canCreate = usePermission({ product: ["create"] });
  const canUpdate = usePermission({ product: ["update"] });
  const canDelete = usePermission({ product: ["delete"] });
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const invalidate = [queryKeys.products];
  const toggleActive = useActionMutation(setProductActive, { invalidate });
  const duplicate = useActionMutation(duplicateProduct, {
    successMessage: "Producto duplicado",
    invalidate,
  });
  const remove = useActionMutation(deleteProduct, {
    successMessage: "Producto eliminado",
    invalidate,
  });

  const data = product.data;

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

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <CatalogBackLink href="/products" label="Productos" />
        <div className="flex items-center gap-4">
          <AppSkeleton className="size-14 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <AppSkeleton className="h-6 w-64 rounded-lg" />
            <AppSkeleton className="h-4 w-40 rounded-lg" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <AppSkeleton className="h-64 rounded-3xl lg:col-span-2" />
          <AppSkeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  const moreItems = [
    ...(data.sku
      ? [
          {
            id: "copy-sku",
            label: "Copiar referencia",
            icon: <CopyIcon size={16} />,
          },
        ]
      : []),
    ...(canCreate
      ? [{ id: "duplicate", label: "Duplicar", icon: <CopyIcon size={16} /> }]
      : []),
    ...(canUpdate
      ? [
          {
            id: "toggle",
            label: data.isActive ? "Desactivar" : "Activar",
            icon: <PowerIcon size={16} />,
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Eliminar producto",
            icon: <TrashIcon size={16} />,
            isDanger: true,
          },
        ]
      : []),
  ];

  const hasInventory = data.trackStock || data._count.movements > 0;
  const base = `/products/${data.id}`;
  const tabs: AppTabItem[] = [
    { label: "Resumen", href: base, icon: PackageIcon },
    {
      label: "Imágenes",
      href: `${base}/images`,
      icon: ImageIcon,
      count: data.images.length,
    },
    {
      label: "Formas de venta",
      href: `${base}/presentations`,
      icon: TagIcon,
      count: data.presentations.length + 1,
    },
    ...(hasInventory
      ? [
          {
            label: "Inventario",
            href: `${base}/inventory`,
            icon: ArrowsUpDownIcon,
          },
        ]
      : []),
  ];

  const handleMore = (action: string) => {
    if (action === "copy-sku" && data.sku) copy(data.sku, "Referencia");
    else if (action === "duplicate") {
      duplicate.mutate(data.id, {
        onSuccess: ({ id: copyId }) => router.push(`/products/${copyId}`),
      });
    } else if (action === "toggle") {
      toggleActive.mutate(
        { id: data.id, isActive: !data.isActive },
        {
          onSuccess: () =>
            notify.success(
              data.isActive ? "Producto desactivado" : "Producto activado",
            ),
        },
      );
    } else if (action === "delete") setIsDeleteOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogBackLink href="/products" label="Productos" />

      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ProductThumb
            color={data.category?.color}
            imageUrl={data.images[0]?.url}
            name={data.name}
            size="lg"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {data.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <CategoryChip category={data.category} />
              <CatalogActiveChip isActive={data.isActive} />
              {data.sku ? <span className="truncate">{data.sku}</span> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canUpdate && data.trackStock ? (
            <AppButton variant="secondary" onPress={() => setIsStockOpen(true)}>
              <ArrowsUpDownIcon size={16} />
              Ajustar stock
            </AppButton>
          ) : null}
          {canUpdate ? (
            <AppButton onPress={() => router.push(`/products/${data.id}/edit`)}>
              <PencilIcon size={16} />
              Editar
            </AppButton>
          ) : null}
          {moreItems.length ? (
            <AppDropdown
              items={moreItems}
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
              onAction={handleMore}
            />
          ) : null}
        </div>
      </header>

      <ProductDetailContext
        value={{
          product: data,
          canUpdate,
          openStockAdjust: () => setIsStockOpen(true),
        }}
      >
        <AppTabs aria-label="Secciones del producto" items={tabs}>
          {children}
        </AppTabs>
      </ProductDetailContext>

      {data.trackStock ? (
        <StockMovementModal
          isOpen={isStockOpen}
          product={data}
          onOpenChange={setIsStockOpen}
        />
      ) : null}

      <AppConfirm
        confirmLabel="Eliminar"
        description={`Se eliminará ${data.name} junto con su historial de stock. Si solo quieres dejar de venderlo, desactívalo. Esta acción no se puede deshacer.`}
        isOpen={isDeleteOpen}
        isPending={remove.isPending}
        title="Eliminar producto"
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => router.replace("/products"),
          })
        }
        onOpenChange={setIsDeleteOpen}
      />
    </div>
  );
}

export function ProductSummaryTab() {
  const { product, canUpdate, openStockAdjust } = useProductDetail();

  return (
    <SummaryTab
      canUpdate={canUpdate}
      product={product}
      onAdjust={openStockAdjust}
    />
  );
}

export function ProductImagesTab() {
  const { product, canUpdate } = useProductDetail();

  return <ProductImages canEdit={canUpdate} product={product} />;
}

export function ProductPresentationsTab() {
  const { product, canUpdate } = useProductDetail();

  return <ProductPresentationsCard canEdit={canUpdate} product={product} />;
}

export function ProductInventoryTab() {
  const { product, canUpdate, openStockAdjust } = useProductDetail();

  return (
    <div className="flex flex-col gap-6">
      <InventoryOverview
        canUpdate={canUpdate}
        product={product}
        onAdjust={openStockAdjust}
      />
      <StockMovementsTable product={product} />
    </div>
  );
}
