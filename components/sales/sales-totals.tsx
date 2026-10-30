import type { DocumentTotals } from "@/lib/sales-math";

import clsx from "clsx";

import { formatPercent } from "@/lib/pricing";

/** Taxable base, discounts, taxes by rate and total of a document. */
export function SalesTotals({
  totals,
  format,
  paid,
  totalTaxName,
}: {
  totals: Pick<
    DocumentTotals,
    | "discountTotal"
    | "subtotal"
    | "taxTotal"
    | "totalTaxRate"
    | "totalTaxAmount"
    | "total"
    | "taxes"
  >;
  /** Name of the organization's tax on the total, when it applies. */
  totalTaxName?: string | null;
  format: (value: number) => string;
  /** Collected so far (invoices); shows what is still pending. */
  paid?: number;
}) {
  const rows: { label: string; value: number; isMuted?: boolean }[] = [
    ...(totals.discountTotal > 0
      ? [
          {
            label: "Descuentos",
            value: -totals.discountTotal,
            isMuted: true,
          },
        ]
      : []),
    { label: "Base imponible", value: totals.subtotal },
    ...totals.taxes
      .filter((tax) => tax.rate > 0)
      .map((tax) => ({
        label: `Impuesto ${formatPercent(tax.rate)} sobre ${format(tax.base)}`,
        value: tax.amount,
        isMuted: true,
      })),
    ...(totals.totalTaxRate > 0
      ? [
          {
            label: `${totalTaxName || "Impuesto sobre el total"} ${formatPercent(totals.totalTaxRate)} sobre ${format(totals.subtotal)}`,
            value: totals.totalTaxAmount,
            isMuted: true,
          },
        ]
      : []),
  ];

  return (
    <dl className="flex flex-col gap-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4">
          <dt className={clsx(row.isMuted && "text-muted")}>{row.label}</dt>
          <dd className="tabular-nums">{format(row.value)}</dd>
        </div>
      ))}
      <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-separator pt-3">
        <dt className="font-semibold">Total</dt>
        <dd className="text-xl font-bold tracking-tight tabular-nums">
          {format(totals.total)}
        </dd>
      </div>
      {paid !== undefined && paid > 0 ? (
        <>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Cobrado</dt>
            <dd className="tabular-nums">{format(-paid)}</dd>
          </div>
          <div className="flex justify-between gap-4 font-semibold">
            <dt>Pendiente</dt>
            <dd className="tabular-nums">{format(totals.total - paid)}</dd>
          </div>
        </>
      ) : null}
    </dl>
  );
}
