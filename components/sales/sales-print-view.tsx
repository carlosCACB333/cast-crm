"use client";

import { useRouter } from "next/navigation";

import { ArrowLeftIcon, PrinterIcon } from "@/components/icons";
import { formatDay } from "@/components/sales/sales-format";
import { SalesTotals } from "@/components/sales/sales-totals";
import { AppAlert, AppButton, AppSkeleton } from "@/components/ui";
import { APP_LOCALE } from "@/config/organization";
import {
  SALES_TYPES,
  salesDeliveryMethodLabel,
  salesDocumentHref,
  salesStatusInfo,
} from "@/config/sales";
import { useActiveOrganization } from "@/hooks/use-organization";
import { useSalesDocument } from "@/hooks/use-sales";
import { formatPercent } from "@/lib/pricing";
import { documentTotals } from "@/lib/sales-math";

const quantityFormatter = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 3,
});

/**
 * A sales document laid out as a sheet, ready to print or save as PDF from
 * the browser. Internal notes are never shown here.
 */
export function SalesPrintView({ id }: { id: string }) {
  const router = useRouter();
  const document = useSalesDocument(id);
  const organization = useActiveOrganization();
  const data = document.data;

  if (document.error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <AppAlert
          description={document.error.message}
          status="danger"
          title="No se pudo abrir el documento"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <AppSkeleton className="h-10 w-48 rounded-lg" />
        <AppSkeleton className="h-[32rem] rounded-2xl" />
      </div>
    );
  }

  const definition = SALES_TYPES[data.type];
  // The document currency, not the current one, so old documents print as issued.
  const money = new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency: data.currency,
  });
  const totals = documentTotals(data.lines, data.totalTaxRate ?? 0);
  const hasDiscounts = data.lines.some((line) => line.discount > 0);
  const status = salesStatusInfo(data.type, data.status);

  return (
    <div className="min-h-dvh bg-default/40 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-2 px-4 print:hidden">
        <AppButton
          variant="tertiary"
          onPress={() => router.push(salesDocumentHref(data.type, data.id))}
        >
          <ArrowLeftIcon size={16} />
          Volver al documento
        </AppButton>
        <AppButton onPress={() => window.print()}>
          <PrinterIcon size={16} />
          Imprimir o guardar PDF
        </AppButton>
      </div>

      <article className="mx-auto flex max-w-3xl flex-col gap-8 bg-white p-8 text-sm text-zinc-900 shadow-sm sm:p-12 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-col justify-between gap-6 sm:flex-row">
          <span className="text-lg font-semibold">
            {organization.data?.name ?? ""}
          </span>
          <div className="flex flex-col sm:items-end">
            <span className="text-2xl font-bold tracking-tight uppercase">
              {data.channel === "POS"
                ? "Factura simplificada"
                : definition.label}
            </span>
            <span className="text-base font-medium tabular-nums">
              {data.number ?? "Borrador"}
            </span>
            {data.status === "DRAFT" || data.status === "CANCELLED" ? (
              <span className="mt-1 rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600">
                {status.label}
              </span>
            ) : null}
          </div>
        </header>

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
              Cliente
            </span>
            <span className="font-semibold">{data.customerName}</span>
            {data.customerTaxId ? (
              <span>NIF/CIF: {data.customerTaxId}</span>
            ) : null}
            {data.customerAddress ? (
              <span className="whitespace-pre-line">
                {data.customerAddress}
              </span>
            ) : null}
            {data.customerEmail ? <span>{data.customerEmail}</span> : null}
            {data.deliveryMethod ? (
              <div className="mt-3 flex flex-col gap-1">
                <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  {data.deliveryMethod === "pickup"
                    ? "Entrega"
                    : "Dirección de envío"}
                </span>
                {data.deliveryMethod === "pickup" ? (
                  <span>{salesDeliveryMethodLabel(data.deliveryMethod)}</span>
                ) : (
                  <span className="whitespace-pre-line">
                    {data.shippingAddress}
                  </span>
                )}
              </div>
            ) : null}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:justify-self-end">
            <dt className="text-zinc-500">Fecha</dt>
            <dd className="tabular-nums">{formatDay(data.issueDate)}</dd>
            {definition.dueDateLabel && data.dueDate ? (
              <>
                <dt className="text-zinc-500">{definition.dueDateLabel}</dt>
                <dd className="tabular-nums">{formatDay(data.dueDate)}</dd>
              </>
            ) : null}
            {data.reference ? (
              <>
                <dt className="text-zinc-500">Su referencia</dt>
                <dd>{data.reference}</dd>
              </>
            ) : null}
          </dl>
        </section>

        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-zinc-900 text-left text-xs tracking-wide uppercase">
              <th className="py-2 pr-2 font-semibold" scope="col">
                Concepto
              </th>
              <th className="px-2 py-2 text-right font-semibold" scope="col">
                Cant.
              </th>
              <th className="px-2 py-2 text-right font-semibold" scope="col">
                Precio
              </th>
              {hasDiscounts ? (
                <th className="px-2 py-2 text-right font-semibold" scope="col">
                  Dto.
                </th>
              ) : null}
              <th className="px-2 py-2 text-right font-semibold" scope="col">
                Imp.
              </th>
              <th className="py-2 pl-2 text-right font-semibold" scope="col">
                Importe
              </th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr
                key={line.id}
                className="border-b border-zinc-200 align-top break-inside-avoid"
              >
                <td className="py-2 pr-2">{line.description}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                  {quantityFormatter.format(line.quantity)}
                  {line.unit ? ` ${line.unit}` : ""}
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                  {money.format(line.unitPrice)}
                </td>
                {hasDiscounts ? (
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                    {line.discount ? formatPercent(line.discount) : ""}
                  </td>
                ) : null}
                <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                  {formatPercent(line.taxRate)}
                </td>
                <td className="py-2 pl-2 text-right whitespace-nowrap tabular-nums">
                  {money.format(line.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end break-inside-avoid">
          <div className="w-full sm:max-w-xs [&_.text-muted]:text-zinc-500 [&_.border-separator]:border-zinc-900">
            <SalesTotals
              format={money.format}
              paid={data.type === "INVOICE" ? data.paidTotal : undefined}
              totalTaxName={data.totalTaxName}
              totals={{
                ...totals,
                totalTaxAmount: data.totalTaxAmount,
                total: data.total,
              }}
            />
          </div>
        </div>

        {data.channel === "POS" && data.payments.length ? (
          <section className="flex justify-end break-inside-avoid">
            <dl className="flex w-full flex-col gap-1 text-sm sm:max-w-xs">
              {data.payments
                .filter((payment) => payment.amount > 0)
                .map((payment) => (
                  <div key={payment.id} className="flex flex-col gap-1">
                    <div className="flex justify-between gap-4">
                      <dt>{payment.paymentMethod.name}</dt>
                      <dd className="tabular-nums">
                        {money.format(payment.amount)}
                      </dd>
                    </div>
                    {payment.tendered !== null ? (
                      <>
                        <div className="flex justify-between gap-4 text-zinc-500">
                          <dt>Entregado</dt>
                          <dd className="tabular-nums">
                            {money.format(payment.tendered)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 text-zinc-500">
                          <dt>Cambio</dt>
                          <dd className="tabular-nums">
                            {money.format(payment.tendered - payment.amount)}
                          </dd>
                        </div>
                      </>
                    ) : null}
                  </div>
                ))}
            </dl>
          </section>
        ) : null}

        {data.terms ? (
          <section className="flex flex-col gap-1 border-t border-zinc-200 pt-4 break-inside-avoid">
            <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
              Condiciones
            </span>
            <p className="whitespace-pre-line">{data.terms}</p>
          </section>
        ) : null}
      </article>
    </div>
  );
}
