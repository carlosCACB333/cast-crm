"use client";

import { useMoneyFormatter } from "@/hooks/use-preferences";
import { formatPercent, priceMargin, priceWithTax } from "@/lib/pricing";

/** Final price and profit of the amounts being typed in a catalog form. */
export function PricePreview({
  price,
  taxRate,
  cost,
}: {
  price: number | null;
  taxRate: number | null;
  cost: number | null;
}) {
  const money = useMoneyFormatter();

  if (price === null) return null;

  const margin = priceMargin(price, cost);

  return (
    <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-default/60 p-4 text-sm">
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs text-muted">Precio final para el cliente</dt>
        <dd className="text-base font-semibold tabular-nums">
          {money.format(priceWithTax(price, taxRate))}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs text-muted">Ganancia por unidad</dt>
        <dd
          className={
            margin && margin.amount < 0
              ? "font-semibold text-danger tabular-nums"
              : "font-semibold tabular-nums"
          }
        >
          {margin ? (
            <>
              {money.format(margin.amount)}
              {margin.percent !== null ? (
                <span className="ms-1 text-xs font-normal text-muted">
                  ({formatPercent(margin.percent)})
                </span>
              ) : null}
            </>
          ) : (
            <span className="font-normal text-muted">Indica el coste</span>
          )}
        </dd>
      </div>
    </dl>
  );
}
