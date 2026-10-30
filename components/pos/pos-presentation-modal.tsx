"use client";

import type { PosItem } from "@/lib/actions/pos";

import { PresentationPickerModal } from "@/components/catalog/presentation-picker-modal";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { lineAmounts } from "@/lib/sales-math";
import { SALES_BASE_PRESENTATION } from "@/lib/validations/sales";

/** Presentation of a catalog item to add to the ticket, priced with tax. */
export function PosPresentationModal({
  item,
  taxRate,
  onOpenChange,
  onPick,
}: {
  item: PosItem;
  /** Tax of the lines, to show prices as they will be charged. */
  taxRate: number;
  onOpenChange: (isOpen: boolean) => void;
  onPick: (presentationId: string) => void;
}) {
  const money = useMoneyFormatter();
  const withTax = (price: number) =>
    money.format(
      lineAmounts({ quantity: 1, unitPrice: price, discount: 0, taxRate })
        .total,
    );

  return (
    <PresentationPickerModal
      options={[
        {
          id: SALES_BASE_PRESENTATION,
          label: `Por unidad (${item.unit})`,
          detail: item.barcode,
          price: withTax(item.unitPrice),
        },
        ...item.presentations.map((presentation) => ({
          id: presentation.id,
          label: presentation.label,
          detail: presentation.barcode,
          price: withTax(presentation.price),
        })),
      ]}
      title={item.name}
      onOpenChange={onOpenChange}
      onPick={onPick}
    />
  );
}
