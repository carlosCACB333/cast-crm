"use client";

import type { SalesListItem, SalesTypeSummary } from "@/lib/actions/sales";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import {
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  WalletIcon,
} from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  SALES_TYPE_ICONS,
  SalesStatusChip,
  formatDay,
  isSalesOverdue,
  salesNumber,
} from "@/components/sales/sales-format";
import { useSalesActions } from "@/components/sales/use-sales-actions";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppChip,
  AppDataTable,
  AppDropdown,
  AppEmptyState,
  AppStatCard,
  notify,
} from "@/components/ui";
import { APP_LOCALE } from "@/config/organization";
import {
  SALES_TYPES,
  type SalesDocumentType,
  type SalesSortField,
  type SalesStatus,
  salesStatusInfo,
} from "@/config/sales";
import { useMyAccess, usePermission } from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { useSalesDocuments } from "@/hooks/use-sales";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { exportSalesDocuments } from "@/lib/actions/sales";
import { downloadFile, toCsv } from "@/lib/csv";
import { optionSources } from "@/lib/option-sources";
import {
  type SalesListFilters,
  salesListSchema,
} from "@/lib/validations/sales";

type Column =
  | "number"
  | "customerName"
  | "issueDate"
  | "dueDate"
  | "status"
  | "owner"
  | "total"
  | "actions";

const SORTABLE: Partial<Record<Column, SalesSortField>> = {
  number: "number",
  customerName: "customerName",
  issueDate: "issueDate",
  total: "total",
};

const numberFormatter = new Intl.NumberFormat(APP_LOCALE);
const percentFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "percent",
  maximumFractionDigits: 0,
});
const decimalText = (value: number) => String(value).replace(".", ",");

/** URL filters hold a single value; "" means no filter. */
const toValues = (value: string) => (value ? [value] : []);

async function runExport(filters: SalesListFilters) {
  const result = await exportSalesDocuments(filters);

  if (!result.ok) throw new Error(result.error);

  const { rows, isTruncated } = result.data;
  const definition = SALES_TYPES[filters.type];
  const csv = toCsv(
    [
      "Número",
      "Estado",
      "Fecha",
      definition.dueDateLabel ?? "Vencimiento",
      "Cliente",
      "NIF/CIF",
      "Referencia",
      "Base imponible",
      "Impuestos",
      "Impuesto sobre el total",
      "Total",
      "Cobrado",
      "Responsable",
    ],
    rows.map((row) => [
      row.number,
      salesStatusInfo(filters.type, row.status).label,
      row.issueDate,
      row.dueDate,
      row.customerName,
      row.customerTaxId,
      row.reference,
      decimalText(row.subtotal),
      decimalText(row.taxTotal),
      decimalText(row.totalTaxAmount),
      decimalText(row.total),
      decimalText(row.paidTotal),
      row.owner,
    ]),
  );

  downloadFile(
    `${definition.slug}-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    "text/csv;charset=utf-8",
  );

  return { count: rows.length, isTruncated };
}

const statusTotals = (summary: SalesTypeSummary, statuses: SalesStatus[]) =>
  summary.statuses
    .filter((row) => statuses.includes(row.status))
    .reduce(
      (sum, row) => ({
        count: sum.count + row.count,
        amount: sum.amount + row.amount,
        paid: sum.paid + row.paid,
      }),
      { count: 0, amount: 0, paid: 0 },
    );

/** Key figures of each type, read from its totals by status. */
function SalesStats({
  type,
  summary,
}: {
  type: SalesDocumentType;
  summary?: SalesTypeSummary;
}) {
  const money = useMoneyFormatter();
  const isLoading = !summary;
  const totals = (statuses: SalesStatus[]) =>
    summary
      ? statusTotals(summary, statuses)
      : { count: 0, amount: 0, paid: 0 };
  const count = (value: number, singular: string, plural: string) =>
    `${numberFormatter.format(value)} ${value === 1 ? singular : plural}`;
  const Icon = SALES_TYPE_ICONS[type];

  let cards: React.ComponentProps<typeof AppStatCard>[];

  if (type === "QUOTE") {
    const open = totals(["DRAFT", "SENT"]);
    const accepted = totals(["ACCEPTED"]);
    const rejected = totals(["REJECTED"]);
    const decided = accepted.count + rejected.count;

    cards = [
      {
        label: "Abiertos",
        value: money.format(open.amount),
        hint: count(
          open.count,
          "presupuesto en curso",
          "presupuestos en curso",
        ),
        icon: <Icon size={20} />,
      },
      {
        label: "Aceptados",
        value: money.format(accepted.amount),
        hint: count(accepted.count, "presupuesto", "presupuestos"),
        icon: <CheckIcon size={20} />,
        tone: "success",
      },
      {
        label: "Tasa de aceptación",
        value: decided
          ? percentFormatter.format(accepted.count / decided)
          : "—",
        hint: decided
          ? `${numberFormatter.format(rejected.count)} rechazados`
          : "Aún no hay respuestas",
        icon: <WalletIcon size={20} />,
        tone: "warning",
      },
    ];
  } else if (type === "ORDER") {
    const pending = totals(["CONFIRMED"]);
    const delivered = totals(["DELIVERED"]);
    const drafts = totals(["DRAFT"]);

    cards = [
      {
        label: "Por entregar",
        value: money.format(pending.amount),
        hint: count(pending.count, "pedido confirmado", "pedidos confirmados"),
        icon: <Icon size={20} />,
      },
      {
        label: "Entregados",
        value: money.format(delivered.amount),
        hint: count(delivered.count, "pedido", "pedidos"),
        icon: <CheckIcon size={20} />,
        tone: "success",
      },
      {
        label: "Borradores",
        value: numberFormatter.format(drafts.count),
        hint: "Pendientes de confirmar",
        icon: <PencilIcon size={20} />,
        tone: "warning",
      },
    ];
  } else if (type === "DELIVERY_NOTE") {
    const delivered = totals(["DELIVERED"]);
    const drafts = totals(["DRAFT"]);
    const pendingInvoice = summary?.pendingInvoice ?? { count: 0, amount: 0 };

    cards = [
      {
        label: "Pendiente de facturar",
        value: money.format(pendingInvoice.amount),
        hint: count(
          pendingInvoice.count,
          "albarán entregado",
          "albaranes entregados",
        ),
        icon: <WalletIcon size={20} />,
        tone: "warning",
      },
      {
        label: "Entregados",
        value: numberFormatter.format(delivered.count),
        hint: money.format(delivered.amount),
        icon: <Icon size={20} />,
        tone: "success",
      },
      {
        label: "Borradores",
        value: numberFormatter.format(drafts.count),
        hint: "Pendientes de entregar",
        icon: <PencilIcon size={20} />,
      },
    ];
  } else {
    const issued = totals(["ISSUED"]);
    const paid = totals(["PAID"]);
    const overdue = summary?.overdue ?? { count: 0, amount: 0 };

    cards = [
      {
        label: "Pendiente de cobro",
        value: money.format(issued.amount - issued.paid),
        hint: count(issued.count, "factura emitida", "facturas emitidas"),
        icon: <ClockIcon size={20} />,
        tone: "warning",
      },
      {
        label: "Vencido",
        value: money.format(overdue.amount),
        hint: count(overdue.count, "factura vencida", "facturas vencidas"),
        icon: <AlertTriangleIcon size={20} />,
        tone: overdue.count ? "danger" : "accent",
      },
      {
        label: "Cobrado",
        value: money.format(paid.amount + issued.paid),
        hint: count(paid.count, "factura cobrada", "facturas cobradas"),
        icon: <CheckIcon size={20} />,
        tone: "success",
      },
    ];
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <AppStatCard key={card.label} {...card} isLoading={isLoading} />
      ))}
    </div>
  );
}

export function SalesListView({ type }: { type: SalesDocumentType }) {
  const router = useRouter();
  const money = useMoneyFormatter();
  const definition = SALES_TYPES[type];
  const {
    filters: urlFilters,
    setFilters,
    hasActiveFilters,
    clearFilters,
  } = useUrlFilters(salesListSchema);
  // The type comes from the page, never from the URL.
  const filters = { ...urlFilters, type };
  const documents = useSalesDocuments(filters);
  const access = useMyAccess();
  const actions = useSalesActions();

  const canRead = usePermission({ sale: ["read"] });
  const canCreate = usePermission({ sale: ["create"] });
  const canReadCustomers = usePermission({ customer: ["read"] });

  const exportCsv = useMutation({
    mutationFn: runExport,
    onSuccess: ({ count, isTruncated }) =>
      isTruncated
        ? notify.warning(
            `Se exportaron los primeros ${numberFormatter.format(count)} documentos. Usa filtros para exportar el resto.`,
          )
        : notify.success(
            `${numberFormatter.format(count)} documentos exportados`,
          ),
    onError: (error) => notify.error(error.message),
  });

  const data = documents.data;
  const basePath = `/sales/${definition.slug}`;
  const openCreate = () => router.push(`${basePath}/new`);
  const isFirstRun = data?.summary.total === 0 && !hasActiveFilters;
  const Icon = SALES_TYPE_ICONS[type];

  if (access.data && !canRead) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={definition.plural} />
        <AppEmptyState
          description="Pide a un administrador que te dé acceso al módulo de ventas."
          icon={<Icon size={20} />}
          title="No tienes acceso a las ventas"
        />
      </div>
    );
  }

  const columns: React.ComponentProps<
    typeof AppDataTable<SalesListItem, Column>
  >["columns"] = [
    {
      key: "number",
      label: "Número",
      isRowHeader: true,
      allowsSorting: true,
      defaultWidth: "1.2fr",
    },
    {
      key: "customerName",
      label: "Cliente",
      allowsSorting: true,
      defaultWidth: "2fr",
      ...(canReadCustomers
        ? {
            filter: {
              type: "options" as const,
              label: "Cliente",
              source: optionSources.customers,
              value: toValues(filters.customerId),
              onChange: (value: string[]) =>
                setFilters({ customerId: value[0] ?? "" }),
            },
          }
        : {}),
    },
    { key: "issueDate", label: "Fecha", allowsSorting: true },
    ...(definition.dueDateLabel
      ? [{ key: "dueDate" as const, label: definition.dueDateLabel }]
      : []),
    {
      key: "status",
      label: "Estado",
      filter: {
        type: "options",
        label: "Estado",
        options: definition.statuses.map((item) => ({
          value: item.status,
          label: item.label,
        })),
        value: toValues(filters.status),
        onChange: (value) =>
          setFilters({
            status: (value[0] ?? "") as SalesListFilters["status"],
          }),
      },
    },
    {
      key: "owner",
      label: "Responsable",
      filter: {
        type: "options",
        label: "Responsable",
        options: [{ value: "none", label: "Sin asignar" }],
        source: optionSources.members,
        value: toValues(filters.ownerId),
        onChange: (value) => setFilters({ ownerId: value[0] ?? "" }),
      },
    },
    {
      key: "total",
      label: "Total",
      allowsSorting: true,
      className: "text-right",
    },
    { key: "actions", label: "Acciones", className: "text-right", width: 96 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <>
            <AppButton
              isDisabled={!data?.total}
              isPending={exportCsv.isPending}
              variant="secondary"
              onPress={() => exportCsv.mutate(filters)}
            >
              {exportCsv.isPending ? null : <DownloadIcon size={16} />}
              Exportar
            </AppButton>
            {canCreate ? (
              <AppButton onPress={openCreate}>
                <PlusIcon size={16} />
                {definition.newLabel}
              </AppButton>
            ) : null}
          </>
        }
        description={definition.description}
        title={definition.plural}
      />

      {documents.error ? (
        <QueryError
          error={documents.error}
          onRetry={() => documents.refetch()}
        />
      ) : isFirstRun ? (
        <AppEmptyState
          action={
            canCreate ? (
              <AppButton onPress={openCreate}>
                <PlusIcon size={16} />
                {definition.newLabel}
              </AppButton>
            ) : null
          }
          description={definition.emptyDescription}
          icon={<Icon size={20} />}
          title={definition.emptyTitle}
        />
      ) : (
        <>
          <SalesStats summary={data?.summary} type={type} />

          <AppCard>
            <AppDataTable<SalesListItem, Column>
              columns={columns}
              emptyContent={`No hay ${definition.plural.toLowerCase()} con estos filtros`}
              filters={
                type === "INVOICE"
                  ? [
                      {
                        type: "options",
                        label: "Vencimiento",
                        allLabel: "Todas",
                        options: [{ value: "true", label: "Solo vencidas" }],
                        value: filters.overdue ? ["true"] : [],
                        onChange: (value) =>
                          setFilters({ overdue: value[0] === "true" }),
                      },
                      {
                        type: "options",
                        label: "Origen",
                        allLabel: "Todas",
                        options: [
                          { value: "BACKOFFICE", label: "Facturas" },
                          { value: "POS", label: "Tickets del punto de venta" },
                        ],
                        value: toValues(filters.channel),
                        onChange: (value) =>
                          setFilters({
                            channel: (value[0] ??
                              "") as SalesListFilters["channel"],
                          }),
                      },
                    ]
                  : []
              }
              getRowKey={(document) => document.id}
              label={definition.plural}
              pagination={
                data
                  ? {
                      page: data.page,
                      pageSize: data.pageSize,
                      total: data.total,
                      onChange: (page) => setFilters({ page }),
                    }
                  : undefined
              }
              query={documents}
              renderCell={(document, column) => {
                switch (column) {
                  case "number":
                    return (
                      <div className="flex min-w-0 flex-col">
                        <span
                          className={
                            document.number
                              ? "truncate font-medium tabular-nums"
                              : "truncate font-medium text-muted"
                          }
                        >
                          {document.number ?? "Borrador"}
                        </span>
                        {document.channel === "POS" ? (
                          <span className="truncate text-xs text-muted">
                            Ticket del punto de venta
                          </span>
                        ) : null}
                        {document.reference ? (
                          <span className="truncate text-xs text-muted">
                            Ref. {document.reference}
                          </span>
                        ) : null}
                      </div>
                    );
                  case "customerName":
                    return (
                      <span className="truncate">{document.customerName}</span>
                    );
                  case "issueDate":
                    return (
                      <span className="text-sm whitespace-nowrap">
                        {formatDay(document.issueDate)}
                      </span>
                    );
                  case "dueDate":
                    return document.dueDate ? (
                      <span
                        className={
                          isSalesOverdue(document)
                            ? "text-sm font-medium whitespace-nowrap text-danger"
                            : "text-sm whitespace-nowrap"
                        }
                      >
                        {formatDay(document.dueDate)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    );
                  case "status":
                    return (
                      <div className="flex flex-wrap items-center gap-1">
                        <SalesStatusChip
                          status={document.status}
                          type={document.type}
                        />
                        {isSalesOverdue(document) ? (
                          <AppChip color="danger">Vencida</AppChip>
                        ) : null}
                      </div>
                    );
                  case "owner":
                    return document.owner ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <AppAvatar
                          name={document.owner.name}
                          size="sm"
                          src={document.owner.image}
                        />
                        <span className="truncate text-sm">
                          {document.owner.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted">Sin asignar</span>
                    );
                  case "total":
                    return (
                      <div className="flex flex-col items-end text-sm">
                        <span className="font-medium whitespace-nowrap tabular-nums">
                          {money.format(document.total)}
                        </span>
                        {type === "INVOICE" &&
                        document.status === "ISSUED" &&
                        document.paidTotal > 0 ? (
                          <span className="text-xs whitespace-nowrap text-muted tabular-nums">
                            Pendiente{" "}
                            {money.format(document.total - document.paidTotal)}
                          </span>
                        ) : null}
                      </div>
                    );
                  case "actions":
                    return (
                      <div className="flex justify-end">
                        <AppDropdown
                          items={actions.items(document, { withOpen: true })}
                          label={`Acciones para ${salesNumber(document)}`}
                          trigger={
                            <AppButton
                              isIconOnly
                              aria-label={`Acciones para ${salesNumber(document)}`}
                              size="sm"
                              variant="ghost"
                            >
                              <MoreIcon size={16} />
                            </AppButton>
                          }
                          onAction={(id) => actions.run(document, id)}
                        />
                      </div>
                    );
                }
              }}
              rows={data?.items ?? []}
              search={{
                value: filters.q,
                placeholder: "Buscar por número, cliente, NIF o referencia…",
                onChange: (q) => setFilters({ q }),
              }}
              sort={{
                column:
                  (Object.entries(SORTABLE).find(
                    ([, field]) => field === filters.sort,
                  )?.[0] as Column | undefined) ?? "issueDate",
                direction:
                  filters.direction === "asc" ? "ascending" : "descending",
              }}
              onClearFilters={clearFilters}
              onRowAction={(id) => router.push(`${basePath}/${id}`)}
              onSortChange={({ column, direction }) => {
                const sort = SORTABLE[column];

                if (sort) {
                  setFilters({
                    sort,
                    direction: direction === "ascending" ? "asc" : "desc",
                  });
                }
              }}
            />
          </AppCard>
        </>
      )}

      {actions.dialog}
    </div>
  );
}
