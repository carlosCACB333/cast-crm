// Amounts of sales documents. Shared by the form preview and the server, so
// the totals the user sees are the ones that get stored.

export interface SalesLineInput {
  quantity: number;
  unitPrice: number;
  /** Percentage, 0-100. */
  discount: number;
  /** Percentage, 0-100. */
  taxRate: number;
}

/** Rounds to cents, avoiding binary errors such as 1.005 → 1. */
export const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function lineAmounts({
  quantity,
  unitPrice,
  discount,
  taxRate,
}: SalesLineInput) {
  const gross = roundMoney(quantity * unitPrice);
  const subtotal = roundMoney(gross * (1 - discount / 100));
  const taxAmount = roundMoney((subtotal * taxRate) / 100);

  return {
    gross,
    discountAmount: roundMoney(gross - subtotal),
    subtotal,
    taxAmount,
    total: roundMoney(subtotal + taxAmount),
  };
}

export interface TaxBreakdown {
  rate: number;
  base: number;
  amount: number;
}

/**
 * Totals of a document plus its taxes grouped by rate. `totalTaxRate` is the
 * organization's tax on the total: a percentage of the whole taxable base,
 * added on top of the line taxes (which are not part of its base).
 */
export function documentTotals(lines: SalesLineInput[], totalTaxRate = 0) {
  let gross = 0;
  let discountTotal = 0;
  let subtotal = 0;
  let taxTotal = 0;
  const taxes = new Map<number, TaxBreakdown>();

  for (const line of lines) {
    const amounts = lineAmounts(line);

    gross += amounts.gross;
    discountTotal += amounts.discountAmount;
    subtotal += amounts.subtotal;
    taxTotal += amounts.taxAmount;

    const tax = taxes.get(line.taxRate) ?? {
      rate: line.taxRate,
      base: 0,
      amount: 0,
    };

    tax.base = roundMoney(tax.base + amounts.subtotal);
    tax.amount = roundMoney(tax.amount + amounts.taxAmount);
    taxes.set(line.taxRate, tax);
  }

  const totalTaxAmount = roundMoney(
    (roundMoney(subtotal) * totalTaxRate) / 100,
  );

  return {
    gross: roundMoney(gross),
    discountTotal: roundMoney(discountTotal),
    subtotal: roundMoney(subtotal),
    taxTotal: roundMoney(taxTotal),
    totalTaxRate,
    totalTaxAmount,
    total: roundMoney(subtotal + taxTotal + totalTaxAmount),
    taxes: [...taxes.values()].sort((a, b) => b.rate - a.rate),
  };
}

export type DocumentTotals = ReturnType<typeof documentTotals>;

/** The organization's tax on the total while it is active. */
export interface TotalTax {
  name: string;
  rate: number;
}

/** Number typed in a form field ("12,5"), or 0 while empty or invalid. */
export function typedNumber(value: string | undefined) {
  const number = Number((value ?? "").replace(",", "."));

  return value && Number.isFinite(number) ? number : 0;
}
