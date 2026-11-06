"use client";

import type { StockShortage } from "@/lib/actions/result";

import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { formatQuantity } from "@/components/products/product-format";
import { StockMovementModal } from "@/components/products/stock-movement-modal";
import { AppButton, AppIconLink, AppModal } from "@/components/ui";
import { usePermission } from "@/hooks/use-organization";
import { useProduct } from "@/hooks/use-products";

/**
 * Products of the cart short of stock: what there is and what the cart needs,
 * with a link to each product and, for who can, a button to adjust its stock
 * without leaving the till.
 */
export function PosStockShortageList({
  shortages,
  onAdjust,
}: {
  shortages: StockShortage[];
  onAdjust: (productId: string) => void;
}) {
  const canAdjust = usePermission({ product: ["update"] });

  return (
    <ul className="flex flex-col divide-y divide-separator">
      {shortages.map((item) => (
        <li
          key={item.productId}
          className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
        >
          <div className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-1 text-sm font-medium text-foreground">
              <span className="truncate">{item.name}</span>
              <AppIconLink
                href={`/products/${item.productId}/inventory`}
                label={`Ver inventario de ${item.name}`}
              />
            </span>
            <span className="text-xs text-muted tabular-nums">
              Hay {formatQuantity(item.available, item.unit)} · se necesitan{" "}
              {formatQuantity(item.requested, item.unit)}
            </span>
          </div>
          {canAdjust ? (
            <AppButton
              size="sm"
              variant="secondary"
              onPress={() => onAdjust(item.productId)}
            >
              Ajustar
            </AppButton>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Adjusts the stock of a product from the till, loading it first. */
export function PosStockAdjustModal({
  productId,
  onClose,
  onSaved,
}: {
  productId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const product = useProduct(productId);
  const onOpenChange = (isOpen: boolean) => !isOpen && onClose();

  if (product.data) {
    return (
      <StockMovementModal
        isOpen
        product={product.data}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />
    );
  }

  return (
    <AppModal isOpen title="Ajustar stock" onOpenChange={onOpenChange}>
      {product.error ? (
        <QueryError error={product.error} onRetry={() => product.refetch()} />
      ) : (
        <ListSkeleton rows={3} />
      )}
    </AppModal>
  );
}
