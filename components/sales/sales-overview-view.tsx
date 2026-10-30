"use client";

import type { SalesListItem } from "@/lib/actions/sales";

import NextLink from "next/link";
import { useRouter } from "next/navigation";

import {
  AlertTriangleIcon,
  CartIcon,
  ChevronRightIcon,
  PlusIcon,
  WalletIcon,
} from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  SALES_TYPE_ICONS,
  SalesStatusChip,
  SalesTypeBadge,
  formatRelative,
} from "@/components/sales/sales-format";
import {
  AppButton,
  AppCard,
  AppDropdown,
  AppEmptyState,
  AppStatCard,
  AppTable,
  AppTrendChart,
} from "@/components/ui";
import {
  SALES_TYPES,
  SALES_TYPE_LIST,
  salesDocumentHref,
} from "@/config/sales";
import { useMyAccess, usePermission } from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { useSalesOverview } from "@/hooks/use-sales";
import { formatMonth } from "@/lib/format";

type Column = "document" | "customer" | "status" | "total" | "updatedAt";

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

/** Where the sales stand: what is open in each step and what is pending to collect. */
export function SalesOverviewView() {
  const router = useRouter();
  const money = useMoneyFormatter();
  const access = useMyAccess();
  const canRead = usePermission({ sale: ["read"] });
  const canCreate = usePermission({ sale: ["create"] });
  const overview = useSalesOverview();
  const data = overview.data;
  const isLoading = !data;

  if (access.data && !canRead) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Ventas" />
        <AppEmptyState
          description="Pide a un administrador que te dé acceso al módulo de ventas."
          icon={<CartIcon size={20} />}
          title="No tienes acceso a las ventas"
        />
      </div>
    );
  }

  // How much is waiting in each step of the flow, to open its list.
  const steps = [
    {
      type: "QUOTE" as const,
      figure: data?.openQuotes,
      caption: (count: number) => pluralize(count, "abierto", "abiertos"),
    },
    {
      type: "ORDER" as const,
      figure: data?.pendingOrders,
      caption: (count: number) =>
        pluralize(count, "por entregar", "por entregar"),
    },
    {
      type: "DELIVERY_NOTE" as const,
      figure: data?.pendingInvoice,
      caption: (count: number) =>
        pluralize(count, "por facturar", "por facturar"),
    },
    {
      type: "INVOICE" as const,
      figure: data?.outstanding,
      caption: (count: number) => pluralize(count, "por cobrar", "por cobrar"),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          canCreate ? (
            <AppDropdown
              items={SALES_TYPE_LIST.map((definition) => {
                const Icon = SALES_TYPE_ICONS[definition.type];

                return {
                  id: definition.slug,
                  label: definition.newLabel,
                  icon: <Icon size={16} />,
                };
              })}
              label="Crear documento"
              trigger={
                <AppButton>
                  <PlusIcon size={16} />
                  Nuevo documento
                </AppButton>
              }
              onAction={(slug) => router.push(`/sales/${slug}/new`)}
            />
          ) : null
        }
        description="Presupuestos, pedidos, albaranes y facturas de un vistazo."
        title="Ventas"
      />

      {overview.error ? (
        <QueryError error={overview.error} onRetry={() => overview.refetch()} />
      ) : (
        <>
          <nav aria-label="Pasos de la venta">
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {steps.map(({ type, figure, caption }) => {
                const definition = SALES_TYPES[type];

                return (
                  <li key={type}>
                    <NextLink
                      className="group flex h-full items-center gap-3 rounded-3xl bg-surface p-4 shadow-surface transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent"
                      href={`/sales/${definition.slug}`}
                    >
                      <SalesTypeBadge type={type} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">
                          {definition.plural}
                        </span>
                        <span className="truncate text-lg font-semibold tabular-nums">
                          {isLoading ? "…" : money.format(figure?.amount ?? 0)}
                        </span>
                        <span className="text-xs text-muted">
                          {isLoading ? " " : caption(figure?.count ?? 0)}
                        </span>
                      </div>
                      <ChevronRightIcon
                        className="text-muted transition-transform group-hover:translate-x-0.5"
                        size={16}
                      />
                    </NextLink>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="grid gap-4 sm:grid-cols-3">
            <AppStatCard
              change={
                data
                  ? {
                      current: data.invoicedThisMonth,
                      previous: data.invoicedLastMonth,
                    }
                  : undefined
              }
              hint="Facturas emitidas este mes, sin impuestos"
              icon={<CartIcon size={20} />}
              isLoading={isLoading}
              label="Facturado este mes"
              trend={data?.trend.map((month) => month.amount)}
              value={money.format(data?.invoicedThisMonth ?? 0)}
            />
            <AppStatCard
              hint="Cobros registrados este mes"
              icon={<WalletIcon size={20} />}
              isLoading={isLoading}
              label="Cobrado este mes"
              tone="success"
              value={money.format(data?.collectedThisMonth ?? 0)}
            />
            <AppStatCard
              hint={
                data
                  ? pluralize(
                      data.overdue.count,
                      "factura vencida",
                      "facturas vencidas",
                    )
                  : undefined
              }
              icon={<AlertTriangleIcon size={20} />}
              isLoading={isLoading}
              label="Vencido sin cobrar"
              tone={data?.overdue.count ? "danger" : "warning"}
              value={money.format(data?.overdue.amount ?? 0)}
            />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-5">
            <AppCard
              className="lg:col-span-2"
              description="Base imponible de las facturas emitidas en los últimos seis meses."
              title="Facturación"
            >
              <AppTrendChart
                data={data?.trend ?? []}
                formatValue={money.compact}
                formatX={formatMonth}
                isLoading={isLoading}
                label="Facturación mensual"
                series={[{ key: "amount", label: "Facturado" }]}
                xKey="month"
              />
            </AppCard>

            <AppCard className="lg:col-span-3" title="Actividad reciente">
              {data && !data.recent.length ? (
                <AppEmptyState
                  action={
                    canCreate ? (
                      <AppButton
                        onPress={() => router.push("/sales/quotes/new")}
                      >
                        <PlusIcon size={16} />
                        Crear el primer presupuesto
                      </AppButton>
                    ) : null
                  }
                  description="Empieza por un presupuesto o crea directamente un pedido, un albarán o una factura."
                  icon={<CartIcon size={20} />}
                  title="Aún no hay documentos de venta"
                />
              ) : (
                <AppTable<SalesListItem, Column>
                  columns={[
                    {
                      key: "document",
                      label: "Documento",
                      isRowHeader: true,
                      defaultWidth: "1.4fr",
                    },
                    {
                      key: "customer",
                      label: "Cliente",
                      defaultWidth: "1.6fr",
                    },
                    { key: "status", label: "Estado" },
                    { key: "total", label: "Total", className: "text-right" },
                    { key: "updatedAt", label: "Actividad" },
                  ]}
                  getRowKey={(row) => row.id}
                  isLoading={isLoading}
                  isResizable={false}
                  label="Documentos de venta recientes"
                  renderCell={(row, column) => {
                    switch (column) {
                      case "document":
                        return (
                          <span className="flex min-w-0 items-center gap-2">
                            <SalesTypeBadge type={row.type} />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate font-medium tabular-nums">
                                {row.number ?? "Borrador"}
                              </span>
                              <span className="truncate text-xs text-muted">
                                {SALES_TYPES[row.type].label}
                              </span>
                            </span>
                          </span>
                        );
                      case "customer":
                        return (
                          <span className="truncate">{row.customerName}</span>
                        );
                      case "status":
                        return (
                          <SalesStatusChip
                            status={row.status}
                            type={row.type}
                          />
                        );
                      case "total":
                        return (
                          <span className="block text-right font-medium whitespace-nowrap tabular-nums">
                            {money.format(row.total)}
                          </span>
                        );
                      case "updatedAt":
                        return (
                          <span className="text-sm whitespace-nowrap text-muted">
                            {formatRelative(row.updatedAt)}
                          </span>
                        );
                    }
                  }}
                  rows={data?.recent ?? []}
                  onRowAction={(key) => {
                    const row = data?.recent.find((item) => item.id === key);

                    if (row) router.push(salesDocumentHref(row.type, row.id));
                  }}
                />
              )}
            </AppCard>
          </div>
        </>
      )}
    </div>
  );
}
