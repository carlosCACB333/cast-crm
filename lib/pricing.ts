import { APP_LOCALE } from "@/config/organization";

// Price arithmetic shared by the catalog modules (products and services).

const percentFormatter = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 2,
});

export const formatPercent = (value: number) =>
  `${percentFormatter.format(value)} %`;

export function priceWithTax(price: number, taxRate: number | null) {
  return taxRate ? Math.round(price * (100 + taxRate)) / 100 : price;
}

/** Profit per unit before taxes; null when the cost is unknown. */
export function priceMargin(price: number, cost: number | null) {
  if (cost === null) return null;

  const amount = price - cost;

  return { amount, percent: price > 0 ? (amount / price) * 100 : null };
}

/** Number typed in a decimal form field, or null while empty or invalid. */
export function parseTypedDecimal(value: string | undefined) {
  if (!value) return null;

  const number = Number(value.replace(",", "."));

  return Number.isFinite(number) ? number : null;
}

/** A stored number as a form field value ("12,5"); null becomes "". */
export const decimalToText = (value: number | null) =>
  value === null ? "" : String(value).replace(".", ",");
