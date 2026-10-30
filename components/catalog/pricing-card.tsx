"use client";

import clsx from "clsx";

import { AppCard } from "@/components/ui";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { formatPercent, priceMargin, priceWithTax } from "@/lib/pricing";

function Figure({
  label,
  value,
  hint,
  isNegative,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  isNegative?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-default/60 p-4">
      <span className="text-xs text-muted">{label}</span>
      <span
        className={clsx(
          "text-xl font-semibold tabular-nums",
          isNegative && "text-danger",
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

const empty = <span className="text-muted">—</span>;

/** Sale price, final price, cost and profit of a catalog item. */
export function PricingCard({
  price,
  cost,
  taxRate,
  unitLabel,
}: {
  price: number;
  cost: number | null;
  taxRate: number | null;
  /** Unit the amounts refer to, e.g. "unidad" or "hora". */
  unitLabel: string;
}) {
  const money = useMoneyFormatter();
  const margin = priceMargin(price, cost);

  return (
    <AppCard
      description={`Importes por ${unitLabel.toLowerCase()}.`}
      title="Precio"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          hint="Sin impuestos"
          label="Precio de venta"
          value={money.format(price)}
        />
        <Figure
          hint={
            taxRate ? `Impuesto del ${formatPercent(taxRate)}` : "Sin impuesto"
          }
          label="Precio final"
          value={money.format(priceWithTax(price, taxRate))}
        />
        <Figure
          label="Coste"
          value={cost === null ? empty : money.format(cost)}
        />
        <Figure
          hint={
            margin?.percent != null
              ? `${formatPercent(margin.percent)} del precio`
              : "Indica el coste para calcularla"
          }
          isNegative={Boolean(margin && margin.amount < 0)}
          label="Ganancia"
          value={margin ? money.format(margin.amount) : empty}
        />
      </div>
    </AppCard>
  );
}

/** Label and value of a details list (`<dl>`). */
export function CatalogDetail({
  label,
  children,
  isWide,
}: {
  label: string;
  children: React.ReactNode;
  /** Takes the whole row of a two-column list. */
  isWide?: boolean;
}) {
  return (
    <div className={clsx("flex flex-col gap-1", isWide && "col-span-2")}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}
