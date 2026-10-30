"use client";

import type { PosItem } from "@/lib/actions/pos";

import { useState } from "react";
import clsx from "clsx";

import { CatalogThumb } from "@/components/catalog/catalog-thumb";
import { PosPresentationModal } from "@/components/pos/pos-presentation-modal";
import { BriefcaseIcon, PackageIcon, SearchIcon } from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import {
  AppButton,
  AppEmptyState,
  AppSearchInput,
  AppSkeleton,
} from "@/components/ui";
import { usePosItems } from "@/hooks/use-pos";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { lineAmounts } from "@/lib/sales-math";
import { SALES_BASE_PRESENTATION } from "@/lib/validations/sales";

type Kind = "" | "product" | "service";

const KINDS: { kind: Kind; label: string }[] = [
  { kind: "", label: "Todo" },
  { kind: "product", label: "Productos" },
  { kind: "service", label: "Servicios" },
];

/**
 * Catalog grid of the till: tap an item to add it to the ticket; products sold
 * in several presentations ask which one. A barcode scanner types the code
 * and Enter; an exact match (of a product or one of its presentations) is
 * added right away.
 */
export function PosCatalog({
  defaultTaxRate,
  onAdd,
}: {
  defaultTaxRate: number | null;
  /** `presentationId`: "" without presentations, "base" or the presentation. */
  onAdd: (item: PosItem, presentationId: string) => void;
}) {
  const money = useMoneyFormatter();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("");
  const [page, setPage] = useState(1);
  const [picking, setPicking] = useState<PosItem>();
  const items = usePosItems({ q, kind, page });
  const data = items.data;

  const search = (value: string) => {
    setQ(value);
    setPage(1);
  };

  /** Adds the item, asking for the presentation when it has several. */
  const pick = (item: PosItem) => {
    if (item.presentations.length) setPicking(item);
    else onAdd(item, "");
  };

  // Scanners end with Enter: add the item whose barcode or code matches.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" || !data) return;
    const typed = (event.target as HTMLInputElement).value.trim();
    const presentationMatch = data.items.find(
      (item) => item.matchedPresentationId,
    );
    const match = data.items.find(
      (item) => item.barcode === typed || item.code === typed,
    );

    if (presentationMatch?.matchedPresentationId && typed === q) {
      onAdd(presentationMatch, presentationMatch.matchedPresentationId);
      search("");
    } else if (match) {
      // The product's own barcode is its base unit.
      onAdd(match, match.presentations.length ? SALES_BASE_PRESENTATION : "");
      search("");
    } else if (data.items.length === 1 && typed === q) {
      pick(data.items[0]);
      search("");
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Captures Enter from the search box (barcode scanners). */}
        <div className="min-w-0 flex-1" onKeyDown={onKeyDown}>
          <AppSearchInput
            debounceMs={250}
            label="Buscar en el catálogo"
            placeholder="Nombre, referencia o código de barras"
            value={q}
            onChange={search}
          />
        </div>
        <div
          aria-label="Tipo de artículo"
          className="flex shrink-0 gap-1 rounded-xl bg-default p-1"
          role="group"
        >
          {KINDS.map((option) => (
            <AppButton
              key={option.kind}
              size="sm"
              variant={kind === option.kind ? "secondary" : "ghost"}
              onPress={() => {
                setKind(option.kind);
                setPage(1);
              }}
            >
              {option.label}
            </AppButton>
          ))}
        </div>
      </div>

      {items.error ? (
        <QueryError error={items.error} onRetry={() => items.refetch()} />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <AppSkeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <AppEmptyState
          description={
            q
              ? "Prueba con otro nombre o código."
              : "Crea productos o servicios activos para venderlos aquí."
          }
          icon={<SearchIcon size={20} />}
          title={q ? "Sin resultados" : "El catálogo está vacío"}
        />
      ) : (
        <>
          <ul
            className={clsx(
              "grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 xl:grid-cols-4",
              items.isPlaceholderData && "opacity-60",
            )}
          >
            {data.items.map((item) => {
              const price = lineAmounts({
                quantity: 1,
                unitPrice: item.unitPrice,
                discount: 0,
                taxRate: item.taxRate ?? defaultTaxRate ?? 0,
              }).total;
              const isOut = item.stock !== null && item.stock <= 0;

              return (
                <li key={item.ref}>
                  <button
                    className="flex h-full w-full flex-col gap-2 rounded-2xl border border-separator bg-surface p-3 text-left transition hover:border-accent hover:shadow-sm focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98]"
                    type="button"
                    onClick={() => pick(item)}
                  >
                    <CatalogThumb
                      color={item.color}
                      icon={
                        item.kind === "product" ? PackageIcon : BriefcaseIcon
                      }
                      imageUrl={item.imageUrl}
                      name={item.name}
                    />
                    <span className="line-clamp-2 text-sm font-medium leading-snug">
                      {item.name}
                    </span>
                    {item.presentations.length ? (
                      <span className="text-xs text-accent">
                        {item.presentations.length === 1
                          ? "+1 presentación"
                          : `+${item.presentations.length} presentaciones`}
                      </span>
                    ) : null}
                    <span className="mt-auto flex items-end justify-between gap-2">
                      <span className="font-semibold tabular-nums">
                        {money.format(price)}
                      </span>
                      {item.stock !== null ? (
                        <span
                          className={clsx(
                            "text-xs tabular-nums",
                            isOut ? "text-danger" : "text-muted",
                          )}
                        >
                          {isOut ? "Sin stock" : `${item.stock} ${item.unit}`}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {page > 1 || data.hasMore ? (
            <div className="flex justify-center gap-2">
              <AppButton
                isDisabled={page === 1}
                size="sm"
                variant="tertiary"
                onPress={() => setPage(page - 1)}
              >
                Anteriores
              </AppButton>
              <AppButton
                isDisabled={!data.hasMore}
                size="sm"
                variant="secondary"
                onPress={() => setPage(page + 1)}
              >
                Ver más
              </AppButton>
            </div>
          ) : null}
        </>
      )}
      {picking ? (
        <PosPresentationModal
          item={picking}
          taxRate={picking.taxRate ?? defaultTaxRate ?? 0}
          onOpenChange={(isOpen) => !isOpen && setPicking(undefined)}
          onPick={(presentationId) => onAdd(picking, presentationId)}
        />
      ) : null}
    </div>
  );
}
