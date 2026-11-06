import "server-only";

import type {
  SalesDocumentType,
  SalesStatus,
  SalesTypeDefinition,
} from "@/config/sales";
import type {
  SalesDocumentFormValues,
  SalesListFilters,
} from "@/lib/validations/sales";

import { APIError } from "better-auth/api";

import {
  InsufficientStockError,
  type StockShortage,
} from "@/lib/actions/result";
import { presentationLabel } from "@/config/products";
import { SALES_LIMITS, SALES_TYPES } from "@/config/sales";
import { Prisma } from "@/lib/generated/prisma/client";
import { hasMembership } from "@/lib/organization";
import { prisma } from "@/lib/prisma";
import {
  type TotalTax,
  documentTotals,
  lineAmounts,
  roundMoney,
} from "@/lib/sales-math";
import {
  emptyToNull,
  fromDbDate,
  toDbDate,
  toDecimal,
} from "@/lib/validations/fields";
import { SALES_BASE_PRESENTATION } from "@/lib/validations/sales";

// Every query here is scoped by an organization id that the caller derives
// from the session; none of these functions accept it from the client.

type Tx = Prisma.TransactionClient;
type DecimalLike = { toNumber(): number };

const userSelect = { id: true, name: true, image: true } as const;

export const salesListSelect = {
  id: true,
  type: true,
  status: true,
  channel: true,
  number: true,
  issueDate: true,
  dueDate: true,
  customerId: true,
  customerName: true,
  reference: true,
  currency: true,
  total: true,
  paidTotal: true,
  updatedAt: true,
  owner: { select: userSelect },
} satisfies Prisma.SalesDocumentSelect;

const relatedSelect = {
  id: true,
  type: true,
  status: true,
  number: true,
  issueDate: true,
  total: true,
  sourceId: true,
} satisfies Prisma.SalesDocumentSelect;

export const salesDetailSelect = {
  ...salesListSelect,
  customerTaxId: true,
  customerEmail: true,
  customerAddress: true,
  deliveryMethod: true,
  shippingAddress: true,
  terms: true,
  internalNotes: true,
  subtotal: true,
  discountTotal: true,
  taxTotal: true,
  totalTaxName: true,
  totalTaxRate: true,
  totalTaxAmount: true,
  stockApplied: true,
  sourceId: true,
  cashSession: {
    select: {
      id: true,
      status: true,
      openedById: true,
      register: { select: { name: true } },
    },
  },
  statusChangedAt: true,
  createdAt: true,
  createdBy: { select: userSelect },
  lines: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      productId: true,
      serviceId: true,
      presentationId: true,
      presentationLabel: true,
      description: true,
      unit: true,
      quantity: true,
      unitPrice: true,
      discount: true,
      taxRate: true,
      subtotal: true,
      taxAmount: true,
      total: true,
    },
  },
  payments: {
    orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      amount: true,
      paidOn: true,
      paymentMethod: { select: { id: true, name: true, kind: true } },
      tendered: true,
      cashSessionId: true,
      cashSession: { select: { status: true } },
      note: true,
      createdAt: true,
      author: { select: userSelect },
    },
  },
} satisfies Prisma.SalesDocumentSelect;

/** Today as "YYYY-MM-DD" (UTC, like the stored dates). */
export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(day: string, days: number) {
  const date = toDbDate(day);

  date.setUTCDate(date.getUTCDate() + days);

  return fromDbDate(date);
}

/** Makes a list row serializable for the client (Decimal, Date). */
export function serializeSalesRow<
  T extends {
    issueDate: Date;
    dueDate: Date | null;
    total: DecimalLike;
    paidTotal: DecimalLike;
    updatedAt: Date;
  },
>({ issueDate, dueDate, total, paidTotal, updatedAt, ...rest }: T) {
  return {
    ...rest,
    issueDate: fromDbDate(issueDate),
    dueDate: dueDate ? fromDbDate(dueDate) : null,
    total: total.toNumber(),
    paidTotal: paidTotal.toNumber(),
    updatedAt: updatedAt.toISOString(),
  };
}

type DetailRow = Prisma.SalesDocumentGetPayload<{
  select: typeof salesDetailSelect;
}>;

export function serializeSalesDetail(document: DetailRow) {
  const {
    subtotal,
    discountTotal,
    taxTotal,
    totalTaxRate,
    totalTaxAmount,
    statusChangedAt,
    createdAt,
    lines,
    payments,
    ...rest
  } = document;

  return {
    ...serializeSalesRow(rest),
    subtotal: subtotal.toNumber(),
    discountTotal: discountTotal.toNumber(),
    taxTotal: taxTotal.toNumber(),
    totalTaxRate: totalTaxRate?.toNumber() ?? null,
    totalTaxAmount: totalTaxAmount.toNumber(),
    statusChangedAt: statusChangedAt.toISOString(),
    createdAt: createdAt.toISOString(),
    lines: lines.map((line) => ({
      ...line,
      quantity: line.quantity.toNumber(),
      unitPrice: line.unitPrice.toNumber(),
      discount: line.discount.toNumber(),
      taxRate: line.taxRate.toNumber(),
      subtotal: line.subtotal.toNumber(),
      taxAmount: line.taxAmount.toNumber(),
      total: line.total.toNumber(),
    })),
    payments: payments.map((payment) => ({
      ...payment,
      amount: payment.amount.toNumber(),
      tendered: payment.tendered?.toNumber() ?? null,
      paidOn: fromDbDate(payment.paidOn),
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

export function buildSalesWhere(
  organizationId: string,
  filters: SalesListFilters,
): Prisma.SalesDocumentWhereInput {
  const where: Prisma.SalesDocumentWhereInput = {
    organizationId,
    type: filters.type,
  };
  const { q, status, customerId, ownerId, overdue, channel } = filters;

  if (q) {
    const contains = { contains: q, mode: "insensitive" } as const;

    where.OR = [
      { number: contains },
      { customerName: contains },
      { reference: contains },
      { customerTaxId: contains },
    ];
  }
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (channel) where.channel = channel;
  if (ownerId) where.ownerId = ownerId === "none" ? null : ownerId;
  if (overdue) {
    where.status = "ISSUED";
    where.dueDate = { lt: toDbDate(today()) };
  }

  return where;
}

export function salesOrderBy(
  filters: SalesListFilters,
): Prisma.SalesDocumentOrderByWithRelationInput[] {
  // Draft invoices have no number yet; they go last when sorting by it.
  const first: Prisma.SalesDocumentOrderByWithRelationInput =
    filters.sort === "number"
      ? { number: { sort: filters.direction, nulls: "last" } }
      : { [filters.sort]: filters.direction };

  // The creation date and id keep the order stable across pages.
  return [first, { createdAt: filters.direction }, { id: "asc" }];
}

/** Totals by status of one document type, independent of the list filters. */
export async function getSalesTypeSummary(
  organizationId: string,
  type: SalesDocumentType,
) {
  const [byStatus, overdue, pendingInvoice] = await prisma.$transaction([
    prisma.salesDocument.groupBy({
      by: ["status"],
      where: { organizationId, type },
      orderBy: { status: "asc" },
      _count: { _all: true },
      _sum: { total: true, paidTotal: true },
    }),
    prisma.salesDocument.aggregate({
      where: {
        organizationId,
        type: "INVOICE",
        status: "ISSUED",
        dueDate: { lt: toDbDate(today()) },
      },
      _count: { _all: true },
      _sum: { total: true, paidTotal: true },
    }),
    // Delivered delivery notes not invoiced yet.
    prisma.salesDocument.aggregate({
      where: {
        organizationId,
        type: "DELIVERY_NOTE",
        status: "DELIVERED",
        derived: { none: { type: "INVOICE", status: { not: "CANCELLED" } } },
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
  ]);

  const statuses = byStatus.map((row) => ({
    status: row.status as SalesStatus,
    count: (row._count as { _all: number })._all,
    amount: row._sum?.total?.toNumber() ?? 0,
    paid: row._sum?.paidTotal?.toNumber() ?? 0,
  }));

  return {
    total: statuses.reduce((sum, row) => sum + row.count, 0),
    statuses,
    overdue: {
      count: overdue._count._all,
      amount:
        (overdue._sum.total?.toNumber() ?? 0) -
        (overdue._sum.paidTotal?.toNumber() ?? 0),
    },
    pendingInvoice: {
      count: pendingInvoice._count._all,
      amount: pendingInvoice._sum.total?.toNumber() ?? 0,
    },
  };
}

/** The tax on the total while the organization has it active, else null. */
export function organizationTotalTax(organization: {
  totalTaxEnabled: boolean;
  totalTaxName: string;
  totalTaxRate: Prisma.Decimal | null;
}): TotalTax | null {
  const rate = organization.totalTaxRate?.toNumber() ?? 0;

  return organization.totalTaxEnabled && rate > 0
    ? { name: organization.totalTaxName, rate }
    : null;
}

/** Sales settings of the organization with their stored types turned into plain values. */
export async function getSalesSettings(organizationId: string) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      currency: true,
      salesQuotePrefix: true,
      salesOrderPrefix: true,
      salesDeliveryNotePrefix: true,
      salesInvoicePrefix: true,
      salesQuoteValidityDays: true,
      salesInvoiceDueDays: true,
      defaultTaxRate: true,
      totalTaxEnabled: true,
      totalTaxName: true,
      totalTaxRate: true,
      salesDefaultTerms: true,
      salesStockOnDelivery: true,
      salesAllowNegativeStock: true,
    },
  });

  return {
    currency: organization.currency,
    prefixes: {
      QUOTE: organization.salesQuotePrefix,
      ORDER: organization.salesOrderPrefix,
      DELIVERY_NOTE: organization.salesDeliveryNotePrefix,
      INVOICE: organization.salesInvoicePrefix,
    } satisfies Record<SalesDocumentType, string>,
    quoteValidityDays: organization.salesQuoteValidityDays,
    invoiceDueDays: organization.salesInvoiceDueDays,
    defaultTaxRate: organization.defaultTaxRate?.toNumber() ?? null,
    totalTax: organizationTotalTax(organization),
    defaultTerms: organization.salesDefaultTerms,
    stockOnDelivery: organization.salesStockOnDelivery,
    allowNegativeStock: organization.salesAllowNegativeStock,
  };
}

export type SalesSettings = Awaited<ReturnType<typeof getSalesSettings>>;

/** Due date a new document of `type` gets from the settings; null if none. */
export function defaultDueDate(
  type: SalesDocumentType,
  issueDate: string,
  settings: SalesSettings,
) {
  if (type === "QUOTE") {
    return addDays(issueDate, settings.quoteValidityDays);
  }
  if (type === "INVOICE") return addDays(issueDate, settings.invoiceDueDays);

  return null;
}

/**
 * Next number of a type (and series) in the year of the document, e.g.
 * "FAC-2026-0007". The counter row is locked by the update, so concurrent
 * documents never share a number. Tickets use their own series.
 */
export async function allocateNumber(
  tx: Tx,
  organizationId: string,
  type: SalesDocumentType,
  issueDate: Date,
  prefix: string,
  series = "",
) {
  const year = issueDate.getUTCFullYear();
  const counter = await tx.salesCounter.upsert({
    where: {
      organizationId_type_series_year: { organizationId, type, series, year },
    },
    create: { organizationId, type, series, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });

  return `${prefix}${year}-${String(counter.lastNumber).padStart(SALES_LIMITS.numberDigits, "0")}`;
}

/** Postal address of a customer in lines, or "" when it has none. */
export function formatCustomerAddress(customer: {
  address: string | null;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
}) {
  const place = [customer.postalCode, customer.city].filter(Boolean).join(" ");

  return [customer.address, place, customer.region, customer.country]
    .filter(Boolean)
    .join("\n");
}

/**
 * How a document is delivered. Types without delivery store nothing; pickups
 * keep no address.
 */
export function deliveryData(
  type: SalesDocumentType,
  values: Pick<SalesDocumentFormValues, "deliveryMethod" | "shippingAddress">,
) {
  if (!SALES_TYPES[type].hasDelivery || !values.deliveryMethod) {
    return { deliveryMethod: null, shippingAddress: null };
  }

  return {
    deliveryMethod: values.deliveryMethod,
    shippingAddress:
      values.deliveryMethod === "shipping"
        ? emptyToNull(values.shippingAddress)
        : null,
  };
}

/** Customer data copied into the document, so it stays as it was issued. */
export async function customerSnapshot(
  organizationId: string,
  customerId: string,
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: {
      id: true,
      name: true,
      companyName: true,
      type: true,
      taxId: true,
      email: true,
      address: true,
      postalCode: true,
      city: true,
      region: true,
      country: true,
    },
  });

  if (!customer) {
    throw new APIError("BAD_REQUEST", { code: "INVALID_SALES_CUSTOMER" });
  }

  const address = formatCustomerAddress(customer);

  return {
    customerId: customer.id,
    customerName:
      customer.type === "PERSON" && customer.companyName
        ? `${customer.name} (${customer.companyName})`
        : customer.name,
    customerTaxId: customer.taxId,
    customerEmail: customer.email,
    customerAddress: address || null,
  };
}

/**
 * Turns validated lines into database rows, checking that every product and
 * service belongs to the organization, and computes the document totals.
 */
export async function buildLines(
  organizationId: string,
  lines: SalesDocumentFormValues["lines"],
  totalTax: TotalTax | null,
) {
  const refs = lines.map((line) => {
    const [kind, id] = line.itemRef ? line.itemRef.split(":") : [];

    return { kind, id };
  });
  const productIds = refs.flatMap((ref) =>
    ref.kind === "product" ? [ref.id] : [],
  );
  const serviceIds = refs.flatMap((ref) =>
    ref.kind === "service" ? [ref.id] : [],
  );
  const presentationIds = lines.flatMap((line, index) =>
    refs[index].kind === "product" &&
    line.presentationId &&
    line.presentationId !== SALES_BASE_PRESENTATION
      ? [line.presentationId]
      : [],
  );
  const [products, services, presentations] = await prisma.$transaction([
    prisma.product.findMany({
      where: { organizationId, id: { in: productIds } },
      select: {
        id: true,
        unit: true,
        _count: { select: { presentations: true } },
      },
    }),
    prisma.service.findMany({
      where: { organizationId, id: { in: serviceIds } },
      select: { id: true },
    }),
    prisma.productPresentation.findMany({
      where: { organizationId, id: { in: presentationIds } },
      select: { id: true, productId: true, unit: true, factor: true },
    }),
  ]);
  const known = new Set([
    ...products.map((item) => `product:${item.id}`),
    ...services.map((item) => `service:${item.id}`),
  ]);

  if (lines.some((line) => line.itemRef && !known.has(line.itemRef))) {
    throw new APIError("BAD_REQUEST", { code: "INVALID_SALES_ITEM" });
  }

  const productById = new Map(products.map((item) => [item.id, item]));
  const presentationById = new Map(
    presentations.map((item) => [item.id, item]),
  );
  // What each line sells: a presentation of its product or the base unit.
  const sold = lines.map((line, index) => {
    const ref = refs[index];
    const product = ref.kind === "product" ? productById.get(ref.id) : null;

    if (!product) return null;
    if (!line.presentationId) {
      // A product sold in several ways must say which one.
      if (product._count.presentations > 0) {
        throw new APIError("BAD_REQUEST", {
          code: "SALES_PRESENTATION_REQUIRED",
        });
      }

      return null;
    }
    if (line.presentationId === SALES_BASE_PRESENTATION) return null;

    const presentation = presentationById.get(line.presentationId);

    if (!presentation || presentation.productId !== product.id) {
      throw new APIError("BAD_REQUEST", { code: "INVALID_PRESENTATION" });
    }

    return {
      presentationId: presentation.id,
      presentationLabel: presentationLabel(
        presentation.unit,
        presentation.factor.toNumber(),
        product.unit,
      ),
      unitFactor: presentation.factor,
    };
  });

  const numbers = lines.map((line) => ({
    quantity: Number(toDecimal(line.quantity)),
    unitPrice: Number(toDecimal(line.unitPrice)),
    discount: Number(toDecimal(line.discount) ?? 0),
    taxRate: Number(toDecimal(line.taxRate) ?? 0),
  }));
  const totals = documentTotals(numbers, totalTax?.rate);

  return {
    totals: {
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      totalTaxName: totalTax?.name ?? null,
      totalTaxRate: totalTax?.rate ?? null,
      totalTaxAmount: totals.totalTaxAmount,
      total: totals.total,
    },
    rows: lines.map((line, position) => {
      const amounts = lineAmounts(numbers[position]);
      const ref = refs[position];

      return {
        organizationId,
        position,
        productId: ref.kind === "product" ? ref.id : null,
        serviceId: ref.kind === "service" ? ref.id : null,
        description: line.description,
        unit: emptyToNull(line.unit),
        presentationId: sold[position]?.presentationId ?? null,
        presentationLabel: sold[position]?.presentationLabel ?? null,
        unitFactor: sold[position]?.unitFactor ?? 1,
        ...numbers[position],
        subtotal: amounts.subtotal,
        taxAmount: amounts.taxAmount,
        total: amounts.total,
      };
    }),
  };
}

/** Throws unless the owner is a member of the organization; "" is no owner. */
export async function resolveOwner(organizationId: string, ownerId: string) {
  if (!ownerId) return null;
  if (!(await hasMembership(ownerId, organizationId))) {
    throw new APIError("BAD_REQUEST", { code: "INVALID_SALES_OWNER" });
  }

  return ownerId;
}

/** Adds up the base units of each product: a pack of 12 counts 12 per pack. */
function baseQuantities(
  lines: {
    productId: string | null;
    quantity: Prisma.Decimal;
    unitFactor: Prisma.Decimal | number;
  }[],
) {
  const quantities = new Map<string, Prisma.Decimal>();

  for (const line of lines) {
    if (!line.productId) continue;
    quantities.set(
      line.productId,
      (quantities.get(line.productId) ?? new Prisma.Decimal(0)).plus(
        line.quantity.times(line.unitFactor),
      ),
    );
  }

  return quantities;
}

/** Products whose stock does not cover the base units taken out of them. */
function stockShortages(
  products: {
    id: string;
    name: string;
    unit: string;
    stock: Prisma.Decimal;
  }[],
  quantities: Map<string, Prisma.Decimal>,
): StockShortage[] {
  return products.flatMap((product) => {
    const requested = quantities.get(product.id);

    return requested && product.stock.lt(requested)
      ? [
          {
            productId: product.id,
            name: product.name,
            unit: product.unit,
            requested: requested.toNumber(),
            available: product.stock.toNumber(),
          },
        ]
      : [];
  });
}

/**
 * Products of a cart (sales lines not saved yet) whose tracked stock does not
 * cover it, to warn before charging. The sale validates it again.
 */
export async function findCartStockShortages(
  organizationId: string,
  lines: { itemRef: string; presentationId: string; quantity: string }[],
) {
  const sold = lines.flatMap((line) => {
    const [kind, productId] = line.itemRef.split(":");
    const quantity = toDecimal(line.quantity);

    return kind === "product" && productId && quantity
      ? [
          {
            productId,
            presentationId:
              line.presentationId &&
              line.presentationId !== SALES_BASE_PRESENTATION
                ? line.presentationId
                : null,
            quantity: new Prisma.Decimal(quantity),
          },
        ]
      : [];
  });
  const presentationIds = sold.flatMap((line) =>
    line.presentationId ? [line.presentationId] : [],
  );
  const [products, presentations] = await prisma.$transaction([
    prisma.product.findMany({
      where: {
        organizationId,
        id: { in: sold.map((line) => line.productId) },
        trackStock: true,
      },
      select: { id: true, name: true, unit: true, stock: true },
    }),
    prisma.productPresentation.findMany({
      where: { organizationId, id: { in: presentationIds } },
      select: { id: true, productId: true, factor: true },
    }),
  ]);
  const presentationById = new Map(
    presentations.map((item) => [item.id, item]),
  );
  const quantities = baseQuantities(
    sold.map((line) => {
      const presentation = line.presentationId
        ? presentationById.get(line.presentationId)
        : undefined;

      return {
        productId: line.productId,
        quantity: line.quantity,
        // A presentation of another product is ignored; the sale rejects it.
        unitFactor:
          presentation?.productId === line.productId ? presentation.factor : 1,
      };
    }),
  );

  return stockShortages(products, quantities);
}

/**
 * Takes the units of a delivery note (or ticket) out of the stock of its
 * tracked products (`direction: "out"`), or puts them back when the delivery
 * is cancelled. Unless the organization allows negative stock, a delivery
 * that leaves any product below zero fails listing every product short.
 */
export async function applyDeliveryStock(
  tx: Tx,
  {
    organizationId,
    documentId,
    number,
    authorId,
    direction,
    allowNegativeStock = false,
    reason: customReason,
  }: {
    organizationId: string;
    documentId: string;
    number: string | null;
    authorId: string;
    direction: "out" | "in";
    /** The organization lets stock go below zero (sales settings). */
    allowNegativeStock?: boolean;
    /** Overrides the default movement reason ("Albarán …"). */
    reason?: string;
  },
) {
  const lines = await tx.salesDocumentLine.findMany({
    where: { documentId, organizationId, productId: { not: null } },
    select: { productId: true, quantity: true, unitFactor: true },
  });
  // Stock is kept in base units: a pack of 12 takes out 12 per pack sold.
  const quantities = baseQuantities(lines);
  const products = await tx.product.findMany({
    where: {
      organizationId,
      id: { in: [...quantities.keys()] },
      trackStock: true,
    },
    select: { id: true, name: true, unit: true, stock: true },
  });

  if (direction === "out" && !allowNegativeStock) {
    const shortages = stockShortages(products, quantities);

    if (shortages.length) throw new InsufficientStockError(shortages);
  }

  const reason =
    customReason ??
    (direction === "out"
      ? `Albarán ${number ?? ""}`.trim()
      : `Entrega cancelada ${number ?? ""}`.trim());

  for (const product of products) {
    const amount = quantities.get(product.id) as Prisma.Decimal;
    const delta = direction === "out" ? amount.negated() : amount;
    const stockAfter = product.stock.plus(delta);

    // Only applies if nobody changed the stock since it was read.
    const { count } = await tx.product.updateMany({
      where: { id: product.id, organizationId, stock: product.stock },
      data: { stock: stockAfter },
    });

    if (count === 0) throw new APIError("CONFLICT", { code: "STOCK_CHANGED" });

    await tx.productStockMovement.create({
      data: {
        organizationId,
        productId: product.id,
        type: direction === "out" ? "OUT" : "IN",
        quantity: delta,
        stockAfter,
        reason,
        authorId,
      },
    });
  }
}

/**
 * Every document of the same sale: the first one it comes from and all the
 * documents created from it, at most one level per step of the flow.
 */
export async function findSalesChain(
  organizationId: string,
  document: { id: string; sourceId: string | null },
) {
  let rootId = document.id;
  let sourceId = document.sourceId;

  for (let level = 0; sourceId && level < 4; level++) {
    const source = await prisma.salesDocument.findFirst({
      where: { id: sourceId, organizationId },
      select: { id: true, sourceId: true },
    });

    if (!source) break;
    rootId = source.id;
    sourceId = source.sourceId;
  }

  const chain = await prisma.salesDocument.findMany({
    where: { id: rootId, organizationId },
    select: relatedSelect,
  });
  let parents = [rootId];

  for (let level = 0; parents.length && level < 4; level++) {
    const children = await prisma.salesDocument.findMany({
      where: { organizationId, sourceId: { in: parents } },
      orderBy: { createdAt: "asc" },
      select: relatedSelect,
    });

    chain.push(...children);
    parents = children.map((child) => child.id);
  }

  return chain.map(({ issueDate, total, ...item }) => ({
    ...item,
    issueDate: fromDbDate(issueDate),
    total: total.toNumber(),
  }));
}

export function assertTransition(
  definition: SalesTypeDefinition,
  from: SalesStatus,
  to: SalesStatus,
) {
  const allowed = definition.transitions[from]?.some((item) => item.to === to);

  if (!allowed) {
    throw new APIError("BAD_REQUEST", { code: "INVALID_SALES_TRANSITION" });
  }
}

export const salesType = (type: SalesDocumentType) => SALES_TYPES[type];

/** Throws NOT_FOUND unless the document exists in the organization. */
export async function findSalesDocumentOrThrow<
  S extends Prisma.SalesDocumentSelect,
>(organizationId: string, id: string, select: S, tx: Tx = prisma) {
  const document = await tx.salesDocument.findFirst({
    where: { id, organizationId },
    select,
  });

  if (!document) {
    throw new APIError("NOT_FOUND", { code: "SALES_DOCUMENT_NOT_FOUND" });
  }

  return document as Prisma.SalesDocumentGetPayload<{ select: S }>;
}

/** Recomputes what an invoice has collected and whether it is paid. */
export async function refreshInvoicePayments(
  tx: Tx,
  organizationId: string,
  documentId: string,
) {
  const document = await tx.salesDocument.findFirstOrThrow({
    where: { id: documentId, organizationId },
    select: { status: true, total: true },
  });
  const payments = await tx.salesPayment.aggregate({
    where: { documentId, organizationId },
    _sum: { amount: true },
  });
  const paidTotal = payments._sum.amount ?? 0;
  const isPaid = document.total.lte(paidTotal);
  const status: SalesStatus = isPaid ? "PAID" : "ISSUED";

  await tx.salesDocument.update({
    where: { id: documentId },
    data: {
      paidTotal,
      ...(status !== document.status
        ? { status, statusChangedAt: new Date() }
        : {}),
    },
  });
}

/**
 * Active payment methods of the organization among `ids`, by id. Throws when
 * one does not exist, belongs to another organization or is inactive.
 */
export async function resolvePaymentMethods(
  tx: Tx,
  organizationId: string,
  ids: string[],
) {
  const unique = [...new Set(ids)];
  const methods = await tx.paymentMethod.findMany({
    where: { organizationId, id: { in: unique }, isActive: true },
    select: { id: true, name: true, kind: true },
  });

  if (methods.length !== unique.length) {
    throw new APIError("BAD_REQUEST", { code: "INVALID_PAYMENT_METHOD" });
  }

  return new Map(methods.map((method) => [method.id, method]));
}

/**
 * Cash handed over for a cash payment: at least the amount; null for other
 * methods or when it was not typed.
 */
export function tenderedAmount(kind: string, amount: number, tendered: string) {
  const value = toDecimal(tendered);

  if (kind !== "CASH" || value === null) return null;
  if (Number(value) < amount) {
    throw new APIError("BAD_REQUEST", { code: "TENDERED_TOO_LOW" });
  }

  return Number(value);
}

/**
 * Registers money received for an issued invoice; it is paid once covered.
 * Payments into a cash session count in its cash count.
 */
export async function createInvoicePayment(
  tx: Tx,
  {
    organizationId,
    documentId,
    amount,
    paidOn,
    paymentMethodId,
    tendered = "",
    note,
    cashSessionId,
    authorId,
  }: {
    organizationId: string;
    documentId: string;
    amount: number;
    paidOn: Date;
    paymentMethodId: string;
    tendered?: string;
    note: string | null;
    cashSessionId: string | null;
    authorId: string;
  },
) {
  const document = await findSalesDocumentOrThrow(
    organizationId,
    documentId,
    {
      type: true,
      status: true,
      total: true,
      paidTotal: true,
      _count: { select: { payments: true } },
    },
    tx,
  );

  if (document.type !== "INVOICE" || document.status !== "ISSUED") {
    throw new APIError("BAD_REQUEST", { code: "PAYMENT_NOT_ALLOWED" });
  }
  if (document._count.payments >= SALES_LIMITS.maxPayments) {
    throw new APIError("BAD_REQUEST", { code: "TOO_MANY_PAYMENTS" });
  }

  const balance = roundMoney(
    document.total.toNumber() - document.paidTotal.toNumber(),
  );

  if (amount > balance) {
    throw new APIError("BAD_REQUEST", { code: "PAYMENT_EXCEEDS_BALANCE" });
  }

  const method = (
    await resolvePaymentMethods(tx, organizationId, [paymentMethodId])
  ).get(paymentMethodId)!;

  await tx.salesPayment.create({
    data: {
      organizationId,
      documentId,
      amount,
      paidOn,
      paymentMethodId,
      tendered: tenderedAmount(method.kind, amount, tendered),
      cashSessionId,
      note,
      authorId,
    },
  });
  await refreshInvoicePayments(tx, organizationId, documentId);
}
