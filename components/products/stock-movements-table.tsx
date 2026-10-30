"use client";

import type { ProductDetail, StockMovementItem } from "@/lib/actions/products";

import clsx from "clsx";

import { ArrowsUpDownIcon } from "@/components/icons";
import {
  dateTimeFormatter,
  formatQuantity,
  formatRelative,
} from "@/components/products/product-format";
import {
  AppAvatar,
  AppCard,
  AppDataTable,
  AppEmptyState,
} from "@/components/ui";
import { APP_LOCALE } from "@/config/organization";
import {
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
  type StockMovementType,
} from "@/config/products";
import { useListParams } from "@/hooks/use-list-params";
import { useStockMovements } from "@/hooks/use-products";
import { optionSources } from "@/lib/option-sources";
import {
  type StockMovementListParams,
  stockMovementListSchema,
} from "@/lib/validations/products";

type Column =
  "createdAt" | "type" | "quantity" | "stockAfter" | "detail" | "author";

const quantityText = (value: number) =>
  new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 3 }).format(value);

const TYPE_COLORS: Record<StockMovementType, string> = {
  IN: "bg-success/10 text-success",
  OUT: "bg-danger/10 text-danger",
  COUNT: "bg-accent/10 text-accent",
};

/** Stock history of a product: searchable, filterable, sorted and paged on the server. */
export function StockMovementsTable({ product }: { product: ProductDetail }) {
  const list = useListParams<StockMovementListParams>(
    stockMovementListSchema.parse({ productId: product.id }),
  );
  const movements = useStockMovements(list.params);
  const data = movements.data;

  const isEmpty =
    data?.total === 0 &&
    !list.params.q &&
    !list.params.types.length &&
    !list.params.authorId;

  return (
    <AppCard
      description="Entradas, salidas y recuentos registrados para este producto."
      title={`Historial de stock${data && !isEmpty ? ` (${data.total})` : ""}`}
    >
      {isEmpty ? (
        <AppEmptyState
          description="Cuando registres entradas o salidas aparecerán aquí."
          icon={<ArrowsUpDownIcon size={20} />}
          title="Sin movimientos todavía"
        />
      ) : (
        <AppDataTable<StockMovementItem, Column>
          columns={[
            {
              key: "createdAt",
              label: "Fecha",
              isRowHeader: true,
              allowsSorting: true,
              defaultWidth: 160,
            },
            {
              key: "type",
              label: "Tipo",
              defaultWidth: 130,
              filter: {
                type: "options",
                label: "Tipo",
                multiple: true,
                options: STOCK_MOVEMENT_TYPES.map((value) => ({
                  value,
                  label: STOCK_MOVEMENT_LABELS[value].label,
                })),
                value: list.params.types,
                onChange: (types) =>
                  list.setParams({ types: types as StockMovementType[] }),
              },
            },
            {
              key: "quantity",
              label: "Cambio",
              allowsSorting: true,
              className: "text-right",
              defaultWidth: 130,
            },
            {
              key: "stockAfter",
              label: "Stock después",
              className: "text-right",
              defaultWidth: 130,
            },
            { key: "detail", label: "Motivo", defaultWidth: "2fr" },
            {
              key: "author",
              label: "Registrado por",
              filter: {
                type: "options",
                label: "Registrado por",
                source: optionSources.members,
                value: list.params.authorId ? [list.params.authorId] : [],
                onChange: (value) =>
                  list.setParams({ authorId: value[0] ?? "" }),
              },
            },
          ]}
          emptyContent="No hay movimientos"
          getRowKey={(movement) => movement.id}
          label="Movimientos de stock"
          pagination={list.pagination(data)}
          query={movements}
          renderCell={(movement, column) => {
            switch (column) {
              case "createdAt":
                return (
                  <span
                    className="flex flex-col text-sm"
                    title={dateTimeFormatter.format(
                      new Date(movement.createdAt),
                    )}
                  >
                    <span className="whitespace-nowrap">
                      {dateTimeFormatter.format(new Date(movement.createdAt))}
                    </span>
                    <span className="text-xs text-muted">
                      {formatRelative(movement.createdAt)}
                    </span>
                  </span>
                );
              case "type":
                return (
                  <span
                    className={clsx(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      TYPE_COLORS[movement.type],
                    )}
                  >
                    {STOCK_MOVEMENT_LABELS[movement.type].label}
                  </span>
                );
              case "quantity": {
                const isIncrease = movement.quantity >= 0;

                return (
                  <span
                    className={clsx(
                      "block text-right text-sm font-semibold whitespace-nowrap tabular-nums",
                      isIncrease ? "text-success" : "text-danger",
                    )}
                  >
                    {isIncrease ? "+" : "−"}
                    {formatQuantity(Math.abs(movement.quantity), product.unit)}
                  </span>
                );
              }
              case "stockAfter":
                return (
                  <span className="block text-right text-sm whitespace-nowrap tabular-nums">
                    {formatQuantity(movement.stockAfter, product.unit)}
                  </span>
                );
              case "detail":
                return (
                  <span className="flex min-w-0 flex-col text-sm">
                    <span className="truncate">
                      {movement.reason ?? (
                        <span className="text-muted">Sin motivo</span>
                      )}
                    </span>
                    {movement.presentationLabel &&
                    movement.presentationQuantity !== null ? (
                      <span className="truncate text-xs text-muted">
                        {quantityText(movement.presentationQuantity)} ×{" "}
                        {movement.presentationLabel}
                      </span>
                    ) : null}
                  </span>
                );
              case "author":
                return movement.author ? (
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <AppAvatar
                      name={movement.author.name}
                      size="sm"
                      src={movement.author.image}
                    />
                    <span className="truncate">{movement.author.name}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted">—</span>
                );
            }
          }}
          rows={data?.items ?? []}
          search={{
            ...list.search,
            placeholder: "Buscar por motivo, formato o persona…",
          }}
          sort={list.sort}
          onClearFilters={list.onClearFilters}
          onSortChange={list.onSortChange}
        />
      )}
    </AppCard>
  );
}
