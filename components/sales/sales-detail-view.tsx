"use client";

import type { SalesDocumentDetail } from "@/lib/actions/sales";
import type { SalesDocumentType } from "@/config/sales";

import { useEffect } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";

import { CatalogBackLink } from "@/components/catalog/catalog-page";
import { CatalogDetail } from "@/components/catalog/pricing-card";
import {
  ArrowRightIcon,
  MoreIcon,
  PackageIcon,
  PencilIcon,
  PrinterIcon,
  TruckIcon,
} from "@/components/icons";
import { PosTicketCard } from "@/components/pos/pos-ticket-card";
import { SalesFlow } from "@/components/sales/sales-flow";
import {
  SALES_TYPE_ICONS,
  SalesStatusChip,
  SalesTypeBadge,
  formatDay,
  formatRelative,
  isSalesOverdue,
} from "@/components/sales/sales-format";
import { SalesPaymentsCard } from "@/components/sales/sales-payments-card";
import { SalesTotals } from "@/components/sales/sales-totals";
import { useSalesActions } from "@/components/sales/use-sales-actions";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppChip,
  AppDropdown,
  AppEmptyState,
  AppSkeleton,
} from "@/components/ui";
import { APP_LOCALE } from "@/config/organization";
import {
  SALES_TYPES,
  salesDeliveryMethodLabel,
  salesDocumentHref,
} from "@/config/sales";
import { usePermission } from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { useSalesDocument } from "@/hooks/use-sales";
import { formatPercent } from "@/lib/pricing";
import { documentTotals } from "@/lib/sales-math";

const empty = <span className="text-muted">—</span>;
const quantityFormatter = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 3,
});

function LinesTable({ document }: { document: SalesDocumentDetail }) {
  const money = useMoneyFormatter();
  const hasDiscounts = document.lines.some((line) => line.discount > 0);

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-separator text-left text-xs text-muted">
            <th className="px-1 pb-2 font-medium" scope="col">
              Concepto
            </th>
            <th className="px-1 pb-2 text-right font-medium" scope="col">
              Cantidad
            </th>
            <th className="px-1 pb-2 text-right font-medium" scope="col">
              Precio
            </th>
            {hasDiscounts ? (
              <th className="px-1 pb-2 text-right font-medium" scope="col">
                Dto.
              </th>
            ) : null}
            <th className="px-1 pb-2 text-right font-medium" scope="col">
              Imp.
            </th>
            <th className="px-1 pb-2 text-right font-medium" scope="col">
              Importe
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {document.lines.map((line) => (
            <tr key={line.id} className="align-top">
              <td className="px-1 py-2.5">
                {line.productId ? (
                  <NextLink
                    className="font-medium hover:underline"
                    href={`/products/${line.productId}`}
                  >
                    {line.description}
                  </NextLink>
                ) : line.serviceId ? (
                  <NextLink
                    className="font-medium hover:underline"
                    href={`/services/${line.serviceId}`}
                  >
                    {line.description}
                  </NextLink>
                ) : (
                  <span className="font-medium">{line.description}</span>
                )}
              </td>
              <td className="px-1 py-2.5 text-right whitespace-nowrap tabular-nums">
                {quantityFormatter.format(line.quantity)}
                {line.unit ? (
                  <span className="ms-1 text-xs text-muted">{line.unit}</span>
                ) : null}
              </td>
              <td className="px-1 py-2.5 text-right whitespace-nowrap tabular-nums">
                {money.format(line.unitPrice)}
              </td>
              {hasDiscounts ? (
                <td className="px-1 py-2.5 text-right whitespace-nowrap tabular-nums">
                  {line.discount ? formatPercent(line.discount) : "—"}
                </td>
              ) : null}
              <td className="px-1 py-2.5 text-right whitespace-nowrap text-muted tabular-nums">
                {formatPercent(line.taxRate)}
              </td>
              <td className="px-1 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">
                {money.format(line.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailSkeleton({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CatalogBackLink href={backHref} label={backLabel} />
      <div className="flex items-center gap-4">
        <AppSkeleton className="size-14 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <AppSkeleton className="h-6 w-64 rounded-lg" />
          <AppSkeleton className="h-4 w-40 rounded-lg" />
        </div>
      </div>
      <AppSkeleton className="h-28 rounded-3xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <AppSkeleton className="h-72 rounded-3xl lg:col-span-2" />
        <AppSkeleton className="h-72 rounded-3xl" />
      </div>
    </div>
  );
}

export function SalesDetailView({
  type,
  id,
}: {
  type: SalesDocumentType;
  id: string;
}) {
  const router = useRouter();
  const money = useMoneyFormatter();
  const document = useSalesDocument(id);
  const canReadCustomers = usePermission({ customer: ["read"] });
  const definition = SALES_TYPES[type];
  const listHref = `/sales/${definition.slug}`;
  const actions = useSalesActions({
    onDeleted: (deleted) =>
      router.replace(`/sales/${SALES_TYPES[deleted.type].slug}`),
  });
  const data = document.data;

  // A link with the wrong type (e.g. an old bookmark) goes to the right page.
  useEffect(() => {
    if (data && data.type !== type) {
      router.replace(salesDocumentHref(data.type, data.id));
    }
  }, [data, type, router]);

  if (document.error) {
    const Icon = SALES_TYPE_ICONS[type];

    return (
      <div className="flex flex-col gap-6">
        <CatalogBackLink href={listHref} label={definition.plural} />
        <AppEmptyState
          action={
            <div className="flex gap-2">
              <AppButton variant="secondary" onPress={() => document.refetch()}>
                Reintentar
              </AppButton>
              <AppButton onPress={() => router.push(listHref)}>
                Ir a {definition.plural.toLowerCase()}
              </AppButton>
            </div>
          }
          description={document.error.message}
          icon={<Icon size={20} />}
          title="No se pudo abrir el documento"
        />
      </div>
    );
  }

  if (!data || data.type !== type) {
    return <DetailSkeleton backHref={listHref} backLabel={definition.plural} />;
  }

  const transitions = actions.transitions(data);
  const conversions = actions.conversions(data);
  // The main next step is a button; everything else goes to the menu.
  const primaryTransition = transitions.find((item) => !item.isDanger);
  const primaryConversion = conversions[0];
  const exclude = [
    "edit",
    "print",
    ...(primaryTransition ? [`status:${primaryTransition.to}`] : []),
    ...(primaryConversion ? [`convert:${primaryConversion}`] : []),
  ];
  const moreItems = actions.items(data, { exclude });
  const isOverdue = isSalesOverdue(data);
  const totals = documentTotals(
    data.lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      taxRate: line.taxRate,
    })),
    data.totalTaxRate ?? 0,
  );

  return (
    <div className="flex flex-col gap-6">
      <CatalogBackLink href={listHref} label={definition.plural} />

      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <SalesTypeBadge size="lg" type={data.type} />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {definition.label}{" "}
              <span className="tabular-nums">
                {data.number ?? "(borrador)"}
              </span>
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <SalesStatusChip status={data.status} type={data.type} />
              {isOverdue ? <AppChip color="danger">Vencida</AppChip> : null}
              <span className="truncate">{data.customerName}</span>
              <span aria-hidden>·</span>
              <span className="font-medium text-foreground tabular-nums">
                {money.format(data.total)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {primaryTransition ? (
            <AppButton
              isDisabled={actions.isBusy}
              onPress={() => actions.changeStatus(data, primaryTransition)}
            >
              {primaryTransition.label}
            </AppButton>
          ) : null}
          {primaryConversion ? (
            <AppButton
              isDisabled={actions.isBusy}
              variant={primaryTransition ? "secondary" : "primary"}
              onPress={() => actions.convertTo(data, primaryConversion)}
            >
              <ArrowRightIcon size={16} />
              Crear {SALES_TYPES[primaryConversion].label.toLowerCase()}
            </AppButton>
          ) : null}
          {actions.isEditable(data) ? (
            <AppButton
              variant="secondary"
              onPress={() => actions.run(data, "edit")}
            >
              <PencilIcon size={16} />
              Editar
            </AppButton>
          ) : null}
          <AppButton
            variant="secondary"
            onPress={() => actions.run(data, "print")}
          >
            <PrinterIcon size={16} />
            Imprimir
          </AppButton>
          {moreItems.length ? (
            <AppDropdown
              items={moreItems}
              label="Más acciones"
              trigger={
                <AppButton
                  isIconOnly
                  aria-label="Más acciones"
                  variant="secondary"
                >
                  <MoreIcon size={16} />
                </AppButton>
              }
              onAction={(action) => actions.run(data, action)}
            />
          ) : null}
        </div>
      </header>

      <AppCard
        description="Cada venta puede empezar en cualquier paso y saltarse los que no necesite."
        title="Flujo de la venta"
      >
        <SalesFlow
          chain={data.chain}
          conversions={conversions}
          currentId={data.id}
          isConverting={actions.isBusy}
          onConvert={(target) => actions.convertTo(data, target)}
        />
      </AppCard>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <AppCard title="Líneas">
            <LinesTable document={data} />
            <div className="flex justify-end">
              <div className="w-full sm:max-w-sm">
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
          </AppCard>

          {data.terms || data.internalNotes ? (
            <AppCard title="Condiciones y notas">
              {data.terms ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Condiciones</span>
                  <p className="text-sm whitespace-pre-line">{data.terms}</p>
                </div>
              ) : null}
              {data.internalNotes ? (
                <div className="flex flex-col gap-1 rounded-2xl bg-default/60 p-3">
                  <span className="text-xs text-muted">
                    Notas internas · no se imprimen
                  </span>
                  <p className="text-sm whitespace-pre-line">
                    {data.internalNotes}
                  </p>
                </div>
              ) : null}
            </AppCard>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          {data.type === "INVOICE" ? (
            <SalesPaymentsCard document={data} />
          ) : null}

          {data.channel === "POS" ? <PosTicketCard document={data} /> : null}

          <AppCard title="Cliente">
            <div className="flex flex-col gap-1 text-sm">
              {data.customerId && canReadCustomers ? (
                <NextLink
                  className="font-medium hover:underline"
                  href={`/customers/${data.customerId}`}
                >
                  {data.customerName}
                </NextLink>
              ) : (
                <span className="font-medium">{data.customerName}</span>
              )}
              {data.customerTaxId ? (
                <span className="text-muted">NIF/CIF {data.customerTaxId}</span>
              ) : null}
              {data.customerEmail ? (
                <span className="text-muted">{data.customerEmail}</span>
              ) : null}
              {data.customerAddress ? (
                <span className="whitespace-pre-line text-muted">
                  {data.customerAddress}
                </span>
              ) : null}
            </div>
          </AppCard>

          {data.deliveryMethod ? (
            <AppCard title="Entrega">
              <div className="flex flex-col gap-1 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  {data.deliveryMethod === "pickup" ? (
                    <PackageIcon size={16} />
                  ) : (
                    <TruckIcon size={16} />
                  )}
                  {salesDeliveryMethodLabel(data.deliveryMethod)}
                </span>
                {data.shippingAddress ? (
                  <span className="whitespace-pre-line text-muted">
                    {data.shippingAddress}
                  </span>
                ) : null}
              </div>
            </AppCard>
          ) : null}

          <AppCard title="Detalles">
            <dl className="grid grid-cols-2 gap-4">
              <CatalogDetail label="Fecha">
                {formatDay(data.issueDate)}
              </CatalogDetail>
              {definition.dueDateLabel ? (
                <CatalogDetail label={definition.dueDateLabel}>
                  {data.dueDate ? (
                    <span
                      className={
                        isOverdue ? "font-medium text-danger" : undefined
                      }
                    >
                      {formatDay(data.dueDate)}
                    </span>
                  ) : (
                    empty
                  )}
                </CatalogDetail>
              ) : null}
              <CatalogDetail isWide label="Referencia del cliente">
                {data.reference ?? empty}
              </CatalogDetail>
              <CatalogDetail isWide label="Responsable">
                {data.owner ? (
                  <span className="flex items-center gap-2">
                    <AppAvatar
                      name={data.owner.name}
                      size="sm"
                      src={data.owner.image}
                    />
                    <span className="truncate">{data.owner.name}</span>
                  </span>
                ) : (
                  empty
                )}
              </CatalogDetail>
              <CatalogDetail label="Creado">
                <span
                  title={new Date(data.createdAt).toLocaleString(APP_LOCALE)}
                >
                  {formatRelative(data.createdAt)}
                </span>
              </CatalogDetail>
              <CatalogDetail label="Último cambio de estado">
                <span
                  title={new Date(data.statusChangedAt).toLocaleString(
                    APP_LOCALE,
                  )}
                >
                  {formatRelative(data.statusChangedAt)}
                </span>
              </CatalogDetail>
              {data.createdBy ? (
                <CatalogDetail isWide label="Creado por">
                  <span className="truncate">{data.createdBy.name}</span>
                </CatalogDetail>
              ) : null}
              {data.type === "DELIVERY_NOTE" && data.stockApplied ? (
                <CatalogDetail isWide label="Inventario">
                  Las unidades salieron del stock
                </CatalogDetail>
              ) : null}
            </dl>
          </AppCard>
        </div>
      </div>

      {actions.dialog}
    </div>
  );
}
