"use client";

import type { ProductListItem } from "@/lib/actions/products";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import {
  AlertTriangleIcon,
  ArrowsUpDownIcon,
  CopyIcon,
  DownloadIcon,
  MoreIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  TrashIcon,
  WalletIcon,
} from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  CatalogActiveChip,
  CategoryChip,
  ProductThumb,
  StockBadge,
  formatRelative,
  priceWithTax,
} from "@/components/products/product-format";
import { StockMovementModal } from "@/components/products/stock-movement-modal";
import {
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppDataTable,
  AppDropdown,
  AppEmptyState,
  AppStatCard,
  notify,
} from "@/components/ui";
import { CATALOG_STATUS_FILTERS } from "@/config/catalog";
import { APP_LOCALE } from "@/config/organization";
import {
  PRODUCT_STOCK_FILTERS,
  type ProductSortField,
  unitInfo,
} from "@/config/products";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useMyAccess, usePermission } from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { useProducts } from "@/hooks/use-products";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  deleteProduct,
  duplicateProduct,
  exportProducts,
  setProductActive,
} from "@/lib/actions/products";
import { downloadFile, toCsv } from "@/lib/csv";
import { optionSources } from "@/lib/option-sources";
import { queryKeys } from "@/lib/query-keys";
import {
  type ProductListFilters,
  productListSchema,
} from "@/lib/validations/products";

type Column =
  "name" | "category" | "price" | "stock" | "status" | "updatedAt" | "actions";

const SORTABLE: Partial<Record<Column, ProductSortField>> = {
  name: "name",
  price: "price",
  stock: "stock",
  updatedAt: "updatedAt",
};

const numberFormatter = new Intl.NumberFormat(APP_LOCALE);
const decimalText = (value: number | null) =>
  value === null ? null : String(value).replace(".", ",");

/** URL filters hold a single value; "" means no filter. */
const toValues = (value: string) => (value ? [value] : []);

async function runExport(filters: ProductListFilters) {
  const result = await exportProducts(filters);

  if (!result.ok) throw new Error(result.error);

  const { rows, isTruncated } = result.data;
  const csv = toCsv(
    [
      "Nombre",
      "Referencia (SKU)",
      "Código de barras",
      "Categoría",
      "Descripción",
      "Unidad",
      "Precio",
      "Impuesto (%)",
      "Coste",
      "Controla stock",
      "Stock",
      "Stock mínimo",
      "Estado",
      "Etiquetas",
      "Formas de venta",
      "Creado",
    ],
    rows.map((row) => [
      row.name,
      row.sku,
      row.barcode,
      row.category,
      row.description,
      unitInfo(row.unit).label,
      decimalText(row.price),
      decimalText(row.taxRate),
      decimalText(row.cost),
      row.trackStock ? "Sí" : "No",
      row.trackStock ? decimalText(row.stock) : null,
      decimalText(row.minStock),
      row.isActive ? "Activo" : "Inactivo",
      row.tags.join(", "),
      row.presentations
        .map(
          (presentation) =>
            `${presentation.label} (${decimalText(presentation.price)})`,
        )
        .join("; "),
      row.createdAt.slice(0, 10),
    ]),
  );

  downloadFile(
    `productos-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    "text/csv;charset=utf-8",
  );

  return { count: rows.length, isTruncated };
}

export function ProductsView() {
  const router = useRouter();
  const money = useMoneyFormatter();
  const { filters, setFilters, hasActiveFilters, clearFilters } =
    useUrlFilters(productListSchema);
  const products = useProducts(filters);
  const access = useMyAccess();

  const canRead = usePermission({ product: ["read"] });
  const canCreate = usePermission({ product: ["create"] });
  const canUpdate = usePermission({ product: ["update"] });
  const canDelete = usePermission({ product: ["delete"] });

  const [toDelete, setToDelete] = useState<ProductListItem>();
  const [toAdjust, setToAdjust] = useState<ProductListItem>();

  const invalidate = [queryKeys.products];
  const remove = useActionMutation(deleteProduct, {
    successMessage: "Producto eliminado",
    invalidate,
  });
  const toggleActive = useActionMutation(setProductActive, { invalidate });
  const duplicate = useActionMutation(duplicateProduct, {
    successMessage: "Producto duplicado",
    invalidate,
  });
  const exportCsv = useMutation({
    mutationFn: runExport,
    onSuccess: ({ count, isTruncated }) =>
      isTruncated
        ? notify.warning(
            `Se exportaron los primeros ${numberFormatter.format(count)} productos. Usa filtros para exportar el resto.`,
          )
        : notify.success(
            `${numberFormatter.format(count)} productos exportados`,
          ),
    onError: (error) => notify.error(error.message),
  });

  const data = products.data;
  const summary = data?.summary;
  const openDetail = (id: string) => router.push(`/products/${id}`);

  const rowActions = (product: ProductListItem) => [
    { id: "open", label: "Ver ficha", icon: <PackageIcon size={16} /> },
    ...(canUpdate
      ? [
          { id: "edit", label: "Editar", icon: <PencilIcon size={16} /> },
          ...(product.trackStock
            ? [
                {
                  id: "stock",
                  label: "Ajustar stock",
                  icon: <ArrowsUpDownIcon size={16} />,
                },
              ]
            : []),
          {
            id: "toggle",
            label: product.isActive ? "Desactivar" : "Activar",
            icon: <PowerIcon size={16} />,
          },
        ]
      : []),
    ...(canCreate
      ? [{ id: "duplicate", label: "Duplicar", icon: <CopyIcon size={16} /> }]
      : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Eliminar",
            icon: <TrashIcon size={16} />,
            isDanger: true,
          },
        ]
      : []),
  ];

  const handleRowAction = (product: ProductListItem, id: string) => {
    if (id === "open" || id === "edit") {
      router.push(`/products/${product.id}${id === "edit" ? "/edit" : ""}`);
    } else if (id === "stock") {
      setToAdjust(product);
    } else if (id === "toggle") {
      toggleActive.mutate(
        { id: product.id, isActive: !product.isActive },
        {
          onSuccess: () =>
            notify.success(
              product.isActive ? "Producto desactivado" : "Producto activado",
            ),
        },
      );
    } else if (id === "duplicate") {
      duplicate.mutate(product.id, { onSuccess: ({ id }) => openDetail(id) });
    } else if (id === "delete") {
      setToDelete(product);
    }
  };

  const isFirstRun = summary?.total === 0 && !hasActiveFilters;

  if (access.data && !canRead) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Productos" />
        <AppEmptyState
          description="Pide a un administrador que te dé acceso al catálogo de productos."
          icon={<PackageIcon size={20} />}
          title="No tienes acceso a los productos"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <>
            <AppButton
              isDisabled={!data?.total}
              isPending={exportCsv.isPending}
              variant="secondary"
              onPress={() => exportCsv.mutate(filters)}
            >
              {exportCsv.isPending ? null : <DownloadIcon size={16} />}
              Exportar
            </AppButton>
            {canCreate ? (
              <AppButton onPress={() => router.push("/products/new")}>
                <PlusIcon size={16} />
                Nuevo producto
              </AppButton>
            ) : null}
          </>
        }
        description="Lo que vendes: precios, stock y disponibilidad en un solo lugar."
        title="Productos"
      />

      {products.error ? (
        <QueryError error={products.error} onRetry={() => products.refetch()} />
      ) : isFirstRun ? (
        <AppEmptyState
          action={
            canCreate ? (
              <AppButton onPress={() => router.push("/products/new")}>
                <PlusIcon size={16} />
                Añadir el primer producto
              </AppButton>
            ) : null
          }
          description="Crea tu catálogo de productos y servicios con su precio, impuestos y stock para tenerlo siempre a mano."
          icon={<PackageIcon size={20} />}
          title="Tu catálogo está vacío"
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AppStatCard
              hint={
                summary
                  ? `${numberFormatter.format(summary.total)} en total`
                  : undefined
              }
              icon={<PackageIcon size={20} />}
              isLoading={!summary}
              label="Productos activos"
              value={numberFormatter.format(summary?.active ?? 0)}
            />
            <AppStatCard
              hint="En su stock mínimo o por debajo"
              icon={<AlertTriangleIcon size={20} />}
              isLoading={!summary}
              label="Stock bajo"
              tone={summary?.lowStock ? "warning" : "success"}
              value={numberFormatter.format(summary?.lowStock ?? 0)}
            />
            <AppStatCard
              hint="Sin unidades disponibles"
              icon={<AlertTriangleIcon size={20} />}
              isLoading={!summary}
              label="Agotados"
              tone={summary?.outOfStock ? "danger" : "success"}
              value={numberFormatter.format(summary?.outOfStock ?? 0)}
            />
            <AppStatCard
              hint="Stock activo valorado a coste"
              icon={<WalletIcon size={20} />}
              isLoading={!summary}
              label="Valor del inventario"
              value={money.compact(summary?.inventoryValue ?? 0)}
            />
          </div>

          <AppCard>
            <AppDataTable<ProductListItem, Column>
              columns={[
                {
                  key: "name",
                  label: "Producto",
                  isRowHeader: true,
                  defaultWidth: "2fr",
                  allowsSorting: true,
                },
                {
                  key: "category",
                  label: "Categoría",
                  filter: {
                    type: "options",
                    label: "Categoría",
                    options: [{ value: "none", label: "Sin categoría" }],
                    source: optionSources.productCategories,
                    value: toValues(filters.categoryId),
                    onChange: (value) =>
                      setFilters({ categoryId: value[0] ?? "" }),
                  },
                },
                { key: "price", label: "Precio", allowsSorting: true },
                { key: "stock", label: "Stock", allowsSorting: true },
                {
                  key: "status",
                  label: "Estado",
                  filter: {
                    type: "options",
                    label: "Estado",
                    options: [...CATALOG_STATUS_FILTERS],
                    value: toValues(filters.status),
                    onChange: (value) =>
                      setFilters({
                        status: (value[0] ??
                          "") as ProductListFilters["status"],
                      }),
                  },
                },
                {
                  key: "updatedAt",
                  label: "Actividad",
                  allowsSorting: true,
                },
                {
                  key: "actions",
                  label: "Acciones",
                  className: "text-right",
                  width: 96,
                },
              ]}
              emptyContent="No hay productos"
              filters={[
                {
                  type: "options",
                  label: "Stock",
                  allLabel: "Cualquier stock",
                  options: [...PRODUCT_STOCK_FILTERS],
                  value: toValues(filters.stock),
                  onChange: (value) =>
                    setFilters({
                      stock: (value[0] ?? "") as ProductListFilters["stock"],
                    }),
                },
                {
                  type: "options",
                  label: "Etiqueta",
                  allLabel: "Todas las etiquetas",
                  source: optionSources.productTags,
                  value: toValues(filters.tag),
                  onChange: (value) => setFilters({ tag: value[0] ?? "" }),
                },
              ]}
              getRowKey={(product) => product.id}
              label="Productos"
              pagination={
                data
                  ? {
                      page: data.page,
                      pageSize: data.pageSize,
                      total: data.total,
                      onChange: (page) => setFilters({ page }),
                    }
                  : undefined
              }
              query={products}
              renderCell={(product, column) => {
                switch (column) {
                  case "name":
                    return (
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductThumb
                          color={product.category?.color}
                          imageUrl={product.images[0]?.url}
                          name={product.name}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span
                            className={
                              product.isActive
                                ? "truncate font-medium"
                                : "truncate font-medium text-muted"
                            }
                          >
                            {product.name}
                          </span>
                          <span className="truncate text-xs text-muted">
                            {product.sku ?? unitInfo(product.unit).label}
                          </span>
                        </div>
                      </div>
                    );
                  case "category":
                    return <CategoryChip category={product.category} />;
                  case "price":
                    return (
                      <div className="flex flex-col text-sm">
                        <span className="font-medium whitespace-nowrap tabular-nums">
                          {money.format(product.price)}
                          <span className="ms-1 text-xs font-normal text-muted">
                            / {unitInfo(product.unit).short}
                          </span>
                        </span>
                        {product.taxRate ? (
                          <span className="text-xs whitespace-nowrap text-muted tabular-nums">
                            {money.format(
                              priceWithTax(product.price, product.taxRate),
                            )}{" "}
                            con imp.
                          </span>
                        ) : null}
                        {product.presentations.length ? (
                          <span className="text-xs whitespace-nowrap text-accent">
                            +
                            {product.presentations.length === 1
                              ? "1 formato"
                              : `${product.presentations.length} formatos`}
                          </span>
                        ) : null}
                      </div>
                    );
                  case "stock":
                    return <StockBadge product={product} />;
                  case "status":
                    return (
                      <div className="flex flex-wrap gap-1">
                        <CatalogActiveChip isActive={product.isActive} />
                        {product.tags.slice(0, 1).map((tag) => (
                          <AppChip key={tag}>{tag}</AppChip>
                        ))}
                      </div>
                    );
                  case "updatedAt":
                    return (
                      <span
                        className="text-sm whitespace-nowrap text-muted"
                        title={new Date(product.updatedAt).toLocaleString(
                          APP_LOCALE,
                        )}
                      >
                        {formatRelative(product.updatedAt)}
                      </span>
                    );
                  case "actions":
                    return (
                      <div className="flex justify-end">
                        <AppDropdown
                          items={rowActions(product)}
                          label={`Acciones para ${product.name}`}
                          trigger={
                            <AppButton
                              isIconOnly
                              aria-label={`Acciones para ${product.name}`}
                              size="sm"
                              variant="ghost"
                            >
                              <MoreIcon size={16} />
                            </AppButton>
                          }
                          onAction={(id) => handleRowAction(product, id)}
                        />
                      </div>
                    );
                }
              }}
              rows={data?.items ?? []}
              search={{
                value: filters.q,
                placeholder: "Buscar por nombre, referencia o código…",
                onChange: (q) => setFilters({ q }),
              }}
              sort={{
                column:
                  (Object.entries(SORTABLE).find(
                    ([, field]) => field === filters.sort,
                  )?.[0] as Column | undefined) ?? "updatedAt",
                direction:
                  filters.direction === "asc" ? "ascending" : "descending",
              }}
              onClearFilters={clearFilters}
              onRowAction={openDetail}
              onSortChange={({ column, direction }) => {
                const sort = SORTABLE[column];

                if (sort) {
                  setFilters({
                    sort,
                    direction: direction === "ascending" ? "asc" : "desc",
                  });
                }
              }}
            />
          </AppCard>
        </>
      )}

      {toAdjust ? (
        <StockMovementModal
          isOpen
          product={toAdjust}
          onOpenChange={(isOpen) => !isOpen && setToAdjust(undefined)}
        />
      ) : null}

      <AppConfirm
        confirmLabel="Eliminar"
        description={`Se eliminará ${toDelete?.name ?? ""} junto con su historial de stock. Si solo quieres dejar de venderlo, desactívalo. Esta acción no se puede deshacer.`}
        isOpen={Boolean(toDelete)}
        isPending={remove.isPending}
        title="Eliminar producto"
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => setToDelete(undefined),
          })
        }
        onOpenChange={(isOpen) => !isOpen && setToDelete(undefined)}
      />
    </div>
  );
}
