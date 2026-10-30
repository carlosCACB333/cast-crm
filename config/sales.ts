import { COLORS } from "@/config/colors";

/**
 * Product configuration of the sales module: the documents of the flow
 * (quote → order → delivery note → invoice), their statuses and the moves
 * between them. Values each organization changes (number prefixes, validity,
 * due days, terms…) live on the organization and are edited from the sales
 * settings; these are the definitions, defaults and limits.
 */

export const SALES_DOCUMENT_TYPES = [
  "QUOTE",
  "ORDER",
  "DELIVERY_NOTE",
  "INVOICE",
] as const;

export type SalesDocumentType = (typeof SALES_DOCUMENT_TYPES)[number];

export const SALES_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "CONFIRMED",
  "DELIVERED",
  "ISSUED",
  "PAID",
  "CANCELLED",
] as const;

export type SalesStatus = (typeof SALES_STATUSES)[number];

export interface SalesTransition {
  to: SalesStatus;
  /** Button label, e.g. "Marcar como enviado". */
  label: string;
  /** Destructive moves ask for confirmation. */
  isDanger?: boolean;
}

export interface SalesTypeDefinition {
  type: SalesDocumentType;
  /** URL segment of its pages, e.g. `/sales/quotes`. */
  slug: string;
  label: string;
  plural: string;
  /** Short label of the flow stepper and chips. */
  short: string;
  description: string;
  newLabel: string;
  createdMessage: string;
  deletedMessage: string;
  emptyTitle: string;
  emptyDescription: string;
  /** Label of `dueDate` for this type; null when the type has none. */
  dueDateLabel: string | null;
  /** Whether it says how the goods are delivered (shipping address or pickup). */
  hasDelivery: boolean;
  /** Statuses it uses, in their natural order, with their labels and colors. */
  statuses: { status: SalesStatus; label: string; color: string }[];
  /** Manual moves from each status. */
  transitions: Partial<Record<SalesStatus, SalesTransition[]>>;
  /** Statuses in which lines and data can still be edited. */
  editableStatuses: SalesStatus[];
  /** Statuses in which the document can be deleted. */
  deletableStatuses: SalesStatus[];
  /** Types it can be turned into (always later steps of the flow). */
  convertsTo: SalesDocumentType[];
}

const STATUS_COLORS = {
  draft: COLORS.gray,
  sent: "#3b82f6",
  accepted: "#22c55e",
  rejected: "#ef4444",
  confirmed: "#6366f1",
  delivered: "#14b8a6",
  issued: "#f59e0b",
  paid: "#22c55e",
  cancelled: "#a1a1aa",
};

const cancel = (label = "Cancelar"): SalesTransition => ({
  to: "CANCELLED",
  label,
  isDanger: true,
});
const toDraft: SalesTransition = { to: "DRAFT", label: "Volver a borrador" };

export const SALES_TYPES: Record<SalesDocumentType, SalesTypeDefinition> = {
  QUOTE: {
    type: "QUOTE",
    slug: "quotes",
    label: "Presupuesto",
    plural: "Presupuestos",
    short: "Presupuesto",
    description: "Ofertas a tus clientes antes de cerrar la venta.",
    newLabel: "Nuevo presupuesto",
    createdMessage: "Presupuesto creado",
    deletedMessage: "Presupuesto eliminado",
    emptyTitle: "Aún no tienes presupuestos",
    emptyDescription:
      "Prepara una oferta con tus productos y servicios y conviértela en pedido, albarán o factura cuando el cliente la acepte.",
    dueDateLabel: "Válido hasta",
    hasDelivery: true,
    statuses: [
      { status: "DRAFT", label: "Borrador", color: STATUS_COLORS.draft },
      { status: "SENT", label: "Enviado", color: STATUS_COLORS.sent },
      { status: "ACCEPTED", label: "Aceptado", color: STATUS_COLORS.accepted },
      { status: "REJECTED", label: "Rechazado", color: STATUS_COLORS.rejected },
      {
        status: "CANCELLED",
        label: "Cancelado",
        color: STATUS_COLORS.cancelled,
      },
    ],
    transitions: {
      DRAFT: [
        { to: "SENT", label: "Marcar como enviado" },
        { to: "ACCEPTED", label: "Marcar como aceptado" },
        { to: "REJECTED", label: "Marcar como rechazado", isDanger: true },
        cancel(),
      ],
      SENT: [
        { to: "ACCEPTED", label: "Marcar como aceptado" },
        { to: "REJECTED", label: "Marcar como rechazado", isDanger: true },
        toDraft,
        cancel(),
      ],
      ACCEPTED: [{ to: "SENT", label: "Reabrir" }],
      REJECTED: [{ to: "SENT", label: "Reabrir" }],
      CANCELLED: [toDraft],
    },
    editableStatuses: ["DRAFT", "SENT"],
    deletableStatuses: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CANCELLED"],
    convertsTo: ["ORDER", "DELIVERY_NOTE", "INVOICE"],
  },
  ORDER: {
    type: "ORDER",
    slug: "orders",
    label: "Pedido",
    plural: "Pedidos",
    short: "Pedido",
    description: "Ventas confirmadas pendientes de entregar o facturar.",
    newLabel: "Nuevo pedido",
    createdMessage: "Pedido creado",
    deletedMessage: "Pedido eliminado",
    emptyTitle: "Aún no tienes pedidos",
    emptyDescription:
      "Registra los pedidos de tus clientes o créalos desde un presupuesto aceptado.",
    dueDateLabel: "Entrega prevista",
    hasDelivery: true,
    statuses: [
      { status: "DRAFT", label: "Borrador", color: STATUS_COLORS.draft },
      {
        status: "CONFIRMED",
        label: "Confirmado",
        color: STATUS_COLORS.confirmed,
      },
      {
        status: "DELIVERED",
        label: "Entregado",
        color: STATUS_COLORS.delivered,
      },
      {
        status: "CANCELLED",
        label: "Cancelado",
        color: STATUS_COLORS.cancelled,
      },
    ],
    transitions: {
      DRAFT: [{ to: "CONFIRMED", label: "Confirmar pedido" }, cancel()],
      CONFIRMED: [
        { to: "DELIVERED", label: "Marcar como entregado" },
        toDraft,
        cancel(),
      ],
      DELIVERED: [{ to: "CONFIRMED", label: "Reabrir" }],
      CANCELLED: [toDraft],
    },
    editableStatuses: ["DRAFT", "CONFIRMED"],
    deletableStatuses: ["DRAFT", "CONFIRMED", "CANCELLED"],
    convertsTo: ["DELIVERY_NOTE", "INVOICE"],
  },
  DELIVERY_NOTE: {
    type: "DELIVERY_NOTE",
    slug: "delivery-notes",
    label: "Albarán",
    plural: "Albaranes",
    short: "Albarán",
    description: "Lo que entregas a tus clientes, listo para facturar.",
    newLabel: "Nuevo albarán",
    createdMessage: "Albarán creado",
    deletedMessage: "Albarán eliminado",
    emptyTitle: "Aún no tienes albaranes",
    emptyDescription:
      "Documenta cada entrega, directamente o a partir de un pedido o presupuesto.",
    dueDateLabel: null,
    hasDelivery: true,
    statuses: [
      { status: "DRAFT", label: "Borrador", color: STATUS_COLORS.draft },
      {
        status: "DELIVERED",
        label: "Entregado",
        color: STATUS_COLORS.delivered,
      },
      {
        status: "CANCELLED",
        label: "Cancelado",
        color: STATUS_COLORS.cancelled,
      },
    ],
    transitions: {
      DRAFT: [{ to: "DELIVERED", label: "Marcar como entregado" }, cancel()],
      DELIVERED: [cancel("Cancelar entrega")],
      CANCELLED: [toDraft],
    },
    editableStatuses: ["DRAFT"],
    deletableStatuses: ["DRAFT", "CANCELLED"],
    convertsTo: ["INVOICE"],
  },
  INVOICE: {
    type: "INVOICE",
    slug: "invoices",
    label: "Factura",
    plural: "Facturas",
    short: "Factura",
    description: "Facturas emitidas, vencimientos y cobros.",
    newLabel: "Nueva factura",
    createdMessage: "Factura creada",
    deletedMessage: "Factura eliminada",
    emptyTitle: "Aún no tienes facturas",
    emptyDescription:
      "Factura directamente o a partir de un albarán, pedido o presupuesto, y registra sus cobros.",
    dueDateLabel: "Vencimiento",
    hasDelivery: false,
    statuses: [
      { status: "DRAFT", label: "Borrador", color: STATUS_COLORS.draft },
      { status: "ISSUED", label: "Emitida", color: STATUS_COLORS.issued },
      { status: "PAID", label: "Cobrada", color: STATUS_COLORS.paid },
      { status: "CANCELLED", label: "Anulada", color: STATUS_COLORS.cancelled },
    ],
    transitions: {
      // Paid is reached by registering payments, never by hand.
      DRAFT: [{ to: "ISSUED", label: "Emitir factura" }],
      ISSUED: [cancel("Anular factura")],
    },
    editableStatuses: ["DRAFT"],
    deletableStatuses: ["DRAFT"],
    convertsTo: [],
  },
};

export const SALES_TYPE_LIST = SALES_DOCUMENT_TYPES.map(
  (type) => SALES_TYPES[type],
);

export const salesTypeBySlug = (slug: string) =>
  SALES_TYPE_LIST.find((definition) => definition.slug === slug);

export const salesDocumentHref = (type: SalesDocumentType, id: string) =>
  `/sales/${SALES_TYPES[type].slug}/${id}`;

/** Detail page of the product or service a line points to ("product:id"). */
export function salesItemHref(itemRef: string | null | undefined) {
  const [kind, id] = itemRef ? itemRef.split(":") : [];

  if (!id) return null;
  if (kind === "product") return `/products/${id}`;
  if (kind === "service") return `/services/${id}`;

  return null;
}

export function salesStatusInfo(type: SalesDocumentType, status: SalesStatus) {
  return (
    SALES_TYPES[type].statuses.find((item) => item.status === status) ?? {
      status,
      label: status,
      color: COLORS.gray,
    }
  );
}

/** Statuses that can no longer move forward in the flow. */
export const CLOSED_SALES_STATUSES: SalesStatus[] = ["REJECTED", "CANCELLED"];

/** Whether a document in `status` can be turned into `target`. */
export const canConvertSales = (
  type: SalesDocumentType,
  status: SalesStatus,
  target: SalesDocumentType,
) =>
  SALES_TYPES[type].convertsTo.includes(target) &&
  !CLOSED_SALES_STATUSES.includes(status);

/** How the goods reach the customer. The code is stored; the labels are shown. */
export const SALES_DELIVERY_METHODS = [
  { code: "shipping", label: "Envío a una dirección" },
  { code: "pickup", label: "Recogida en tienda" },
] as const;

export type SalesDeliveryMethod =
  (typeof SALES_DELIVERY_METHODS)[number]["code"];

export const SALES_DELIVERY_METHOD_CODES = SALES_DELIVERY_METHODS.map(
  (method) => method.code,
) as unknown as readonly [SalesDeliveryMethod, ...SalesDeliveryMethod[]];

export const DEFAULT_SALES_DELIVERY_METHOD: SalesDeliveryMethod = "shipping";

export const salesDeliveryMethodLabel = (code: string) =>
  SALES_DELIVERY_METHODS.find((method) => method.code === code)?.label ?? code;

/** Defaults of the sales settings of a new organization (see the schema). */
export const DEFAULT_SALES_SETTINGS = {
  prefixes: {
    QUOTE: "PRE-",
    ORDER: "PED-",
    DELIVERY_NOTE: "ALB-",
    INVOICE: "FAC-",
  } satisfies Record<SalesDocumentType, string>,
  quoteValidityDays: 30,
  invoiceDueDays: 30,
  defaultTaxRate: null as number | null,
  defaultTerms: null as string | null,
  stockOnDelivery: true,
};

export const SALES_LIMITS = {
  pageSize: 25,
  maxLines: 200,
  maxLineDescriptionLength: 500,
  maxTermsLength: 2000,
  maxNotesLength: 2000,
  maxReferenceLength: 60,
  maxAddressLength: 500,
  maxPrefixLength: 10,
  maxDays: 365,
  maxPayments: 100,
  maxPaymentNoteLength: 200,
  /** Digits of the sequence in the number, e.g. FAC-2026-0007. */
  numberDigits: 4,
  /** Maximum rows in a single CSV export. */
  exportRows: 5000,
  /** Documents listed in the overview and in a customer's sales. */
  recentRows: 8,
};

export const SALES_SORT_FIELDS = [
  "number",
  "issueDate",
  "customerName",
  "total",
  "updatedAt",
] as const;
export type SalesSortField = (typeof SALES_SORT_FIELDS)[number];
