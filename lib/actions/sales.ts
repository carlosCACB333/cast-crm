"use server";

import type { SalesDocumentType, SalesStatus } from "@/config/sales";

import { APIError } from "better-auth/api";
import { z } from "zod";

import { getActorContext, requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { SALES_LIMITS, SALES_TYPES, canConvertSales } from "@/config/sales";
import {
  presentationLabel,
  unitInfo as productUnitInfo,
} from "@/config/products";
import { serviceUnitInfo } from "@/config/services";
import { Prisma } from "@/lib/generated/prisma/client";
import { findOpenCashSession, getPosSettings } from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import {
  allocateNumber,
  applyDeliveryStock,
  assertTransition,
  buildLines,
  buildSalesWhere,
  customerSnapshot,
  createInvoicePayment,
  defaultDueDate,
  deliveryData,
  formatCustomerAddress,
  findSalesChain,
  findSalesDocumentOrThrow,
  getSalesSettings,
  getSalesTypeSummary,
  refreshInvoicePayments,
  resolveOwner,
  salesDetailSelect,
  salesListSelect,
  salesOrderBy,
  serializeSalesDetail,
  serializeSalesRow,
  today,
} from "@/lib/sales";
import { roundMoney } from "@/lib/sales-math";
import {
  emptyToNull,
  fromDbDate,
  idField,
  toDbDate,
  toDecimal,
} from "@/lib/validations/fields";
import {
  type SalesListFilters,
  addSalesPaymentSchema,
  convertSalesDocumentSchema,
  createSalesDocumentSchema,
  customerSalesSchema,
  salesDocumentIdSchema,
  salesItemRefField,
  salesListSchema,
  salesSettingsSchema,
  setSalesStatusSchema,
  updateSalesDocumentSchema,
} from "@/lib/validations/sales";

// Every action derives the organization from the session and checks the
// `sale:*` permission of the caller's role before touching data.

async function findSalesList(
  organizationId: string,
  filters: SalesListFilters,
) {
  const where = buildSalesWhere(organizationId, filters);
  const pageSize = SALES_LIMITS.pageSize;

  const [items, total] = await prisma.$transaction([
    prisma.salesDocument.findMany({
      where,
      orderBy: salesOrderBy(filters),
      skip: (filters.page - 1) * pageSize,
      take: pageSize,
      select: salesListSelect,
    }),
    prisma.salesDocument.count({ where }),
  ]);

  return {
    items: items.map(serializeSalesRow),
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    summary: await getSalesTypeSummary(organizationId, filters.type),
  };
}

export type SalesList = Awaited<ReturnType<typeof findSalesList>>;
export type SalesListItem = SalesList["items"][number];
export type SalesTypeSummary = SalesList["summary"];

export async function listSalesDocuments(
  input: unknown,
): Promise<ActionResult<SalesList>> {
  return runAction(salesListSchema, input, async (filters) => {
    const { organizationId } = await requirePermission({ sale: ["read"] });

    return findSalesList(organizationId, filters);
  });
}

async function findSalesDocument(organizationId: string, id: string) {
  const document = await findSalesDocumentOrThrow(
    organizationId,
    id,
    salesDetailSelect,
  );

  return {
    ...serializeSalesDetail(document),
    chain: await findSalesChain(organizationId, document),
  };
}

export type SalesDocumentDetail = Awaited<ReturnType<typeof findSalesDocument>>;
export type SalesChainItem = SalesDocumentDetail["chain"][number];

export async function getSalesDocument(
  id: unknown,
): Promise<ActionResult<SalesDocumentDetail>> {
  return runAction(salesDocumentIdSchema, id, async (documentId) => {
    const { organizationId } = await requirePermission({ sale: ["read"] });

    return findSalesDocument(organizationId, documentId);
  });
}

export async function createSalesDocument(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(
    createSalesDocumentSchema,
    input,
    async ({ type, values }) => {
      const { organizationId, session } = await requirePermission({
        sale: ["create"],
      });
      const settings = await getSalesSettings(organizationId);
      const [customer, ownerId, lines] = await Promise.all([
        customerSnapshot(organizationId, values.customerId),
        resolveOwner(organizationId, values.ownerId),
        buildLines(organizationId, values.lines, settings.totalTax),
      ]);
      const issueDate = toDbDate(values.issueDate);

      return prisma.$transaction(async (tx) => {
        // Invoices are numbered when issued, so drafts leave no gaps.
        const number =
          type === "INVOICE"
            ? null
            : await allocateNumber(
                tx,
                organizationId,
                type,
                issueDate,
                settings.prefixes[type],
              );

        return tx.salesDocument.create({
          data: {
            organizationId,
            type,
            number,
            issueDate,
            dueDate: values.dueDate ? toDbDate(values.dueDate) : null,
            ...customer,
            reference: emptyToNull(values.reference),
            ...deliveryData(type, values),
            terms: emptyToNull(values.terms),
            internalNotes: emptyToNull(values.internalNotes),
            currency: settings.currency,
            ...lines.totals,
            ownerId,
            createdById: session.user.id,
            lines: { createMany: { data: lines.rows } },
          },
          select: { id: true },
        });
      });
    },
  );
}

/** Documents created from this one that were not cancelled. */
const countActiveDerived = (
  tx: Prisma.TransactionClient,
  organizationId: string,
  sourceId: string,
) =>
  tx.salesDocument.count({
    where: { organizationId, sourceId, status: { not: "CANCELLED" } },
  });

export async function updateSalesDocument(
  input: unknown,
): Promise<ActionResult> {
  return runAction(updateSalesDocumentSchema, input, async ({ id, values }) => {
    const { organizationId } = await requirePermission({ sale: ["update"] });
    const document = await findSalesDocumentOrThrow(organizationId, id, {
      type: true,
      status: true,
      customerId: true,
    });

    if (
      !SALES_TYPES[document.type].editableStatuses.includes(document.status)
    ) {
      throw new APIError("BAD_REQUEST", { code: "SALES_DOCUMENT_LOCKED" });
    }

    // The customer is kept as it was (with its copied data) unless it changes.
    const changesCustomer = values.customerId !== document.customerId;
    const { totalTax } = await getSalesSettings(organizationId);
    const [customer, ownerId, lines] = await Promise.all([
      changesCustomer
        ? customerSnapshot(organizationId, values.customerId)
        : undefined,
      resolveOwner(organizationId, values.ownerId),
      buildLines(organizationId, values.lines, totalTax),
    ]);

    await prisma.$transaction(async (tx) => {
      // Documents created from this one were made for its customer, so it
      // can only change while none of them is still in use.
      if (
        changesCustomer &&
        (await countActiveDerived(tx, organizationId, id)) > 0
      ) {
        throw new APIError("BAD_REQUEST", { code: "SALES_CUSTOMER_LOCKED" });
      }

      // Only applies if nobody changed the status since it was read.
      const { count } = await tx.salesDocument.updateMany({
        where: { id, organizationId, status: document.status },
        data: {
          issueDate: toDbDate(values.issueDate),
          dueDate: values.dueDate ? toDbDate(values.dueDate) : null,
          ...customer,
          reference: emptyToNull(values.reference),
          ...deliveryData(document.type, values),
          terms: emptyToNull(values.terms),
          internalNotes: emptyToNull(values.internalNotes),
          ...lines.totals,
          ownerId,
        },
      });

      if (count === 0) {
        throw new APIError("CONFLICT", { code: "SALES_DOCUMENT_CHANGED" });
      }

      await tx.salesDocumentLine.deleteMany({
        where: { documentId: id, organizationId },
      });
      await tx.salesDocumentLine.createMany({
        data: lines.rows.map((row) => ({ ...row, documentId: id })),
      });
    });

    return undefined;
  });
}

/**
 * Moves a document to another status of its flow, with the side effects of
 * the move: invoices get their number when issued and delivered delivery
 * notes take their units out of the stock.
 */
export async function setSalesDocumentStatus(
  input: unknown,
): Promise<ActionResult> {
  return runAction(setSalesStatusSchema, input, async ({ id, status }) => {
    const { organizationId, session } = await requirePermission({
      sale: ["update"],
    });
    const settings = await getSalesSettings(organizationId);

    await prisma.$transaction(async (tx) => {
      const document = await findSalesDocumentOrThrow(
        organizationId,
        id,
        {
          type: true,
          status: true,
          number: true,
          issueDate: true,
          total: true,
          paidTotal: true,
          stockApplied: true,
          channel: true,
          source: { select: { id: true, type: true, status: true } },
        },
        tx,
      );
      const definition = SALES_TYPES[document.type];

      // Tickets are voided from the till, which refunds their payments.
      if (document.channel === "POS") {
        throw new APIError("BAD_REQUEST", { code: "POS_TICKET_LOCKED" });
      }

      assertTransition(definition, document.status, status);

      let number = document.number;
      let nextStatus: SalesStatus = status;
      let stockApplied = document.stockApplied;

      if (document.type === "INVOICE" && status === "ISSUED") {
        number ??= await allocateNumber(
          tx,
          organizationId,
          "INVOICE",
          document.issueDate,
          settings.prefixes.INVOICE,
        );
        // Nothing to collect: it is paid as soon as it is issued.
        if (document.total.lte(document.paidTotal)) nextStatus = "PAID";
      }
      if (
        document.type === "INVOICE" &&
        status === "CANCELLED" &&
        document.paidTotal.gt(0)
      ) {
        throw new APIError("BAD_REQUEST", { code: "INVOICE_HAS_PAYMENTS" });
      }

      if (document.type === "DELIVERY_NOTE") {
        const stock = {
          organizationId,
          documentId: id,
          number,
          authorId: session.user.id,
        };

        if (status === "DELIVERED" && settings.stockOnDelivery) {
          await applyDeliveryStock(tx, { ...stock, direction: "out" });
          stockApplied = true;
        } else if (status !== "DELIVERED" && stockApplied) {
          await applyDeliveryStock(tx, { ...stock, direction: "in" });
          stockApplied = false;
        }
      }

      const { count } = await tx.salesDocument.updateMany({
        where: { id, organizationId, status: document.status },
        data: {
          status: nextStatus,
          number,
          stockApplied,
          statusChangedAt: new Date(),
        },
      });

      if (count === 0) {
        throw new APIError("CONFLICT", { code: "SALES_DOCUMENT_CHANGED" });
      }

      // Delivering everything of an order completes it.
      if (
        document.type === "DELIVERY_NOTE" &&
        status === "DELIVERED" &&
        document.source?.type === "ORDER" &&
        document.source.status === "CONFIRMED"
      ) {
        await tx.salesDocument.updateMany({
          where: {
            id: document.source.id,
            organizationId,
            status: "CONFIRMED",
          },
          data: { status: "DELIVERED", statusChangedAt: new Date() },
        });
      }
    });

    return undefined;
  });
}

/** Data a new document copies from the one it comes from. */
const COPY_SELECT = {
  customerId: true,
  customerName: true,
  customerTaxId: true,
  customerEmail: true,
  customerAddress: true,
  reference: true,
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
  total: true,
  ownerId: true,
  lines: {
    orderBy: { position: "asc" },
    select: {
      position: true,
      productId: true,
      serviceId: true,
      presentationId: true,
      presentationLabel: true,
      unitFactor: true,
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
} satisfies Prisma.SalesDocumentSelect;

function copiedData(
  organizationId: string,
  source: Prisma.SalesDocumentGetPayload<{ select: typeof COPY_SELECT }>,
) {
  const { lines, ...data } = source;

  return {
    ...data,
    organizationId,
    lines: {
      createMany: {
        data: lines.map((line) => ({ ...line, organizationId })),
      },
    },
  };
}

/** What a document becomes when it moves forward from `source`. */
const SOURCE_STATUS_ON_CONVERT: Partial<
  Record<SalesDocumentType, { from: SalesStatus[]; to: SalesStatus }>
> = {
  QUOTE: { from: ["DRAFT", "SENT"], to: "ACCEPTED" },
  ORDER: { from: ["DRAFT"], to: "CONFIRMED" },
};

/**
 * Creates the next document of the flow (order, delivery note or invoice)
 * with the customer and lines of this one, linked to it.
 */
export async function convertSalesDocument(
  input: unknown,
): Promise<ActionResult<{ id: string; type: SalesDocumentType }>> {
  return runAction(
    convertSalesDocumentSchema,
    input,
    async ({ id, target }) => {
      const { organizationId, session } = await requirePermission({
        sale: ["create"],
      });
      const settings = await getSalesSettings(organizationId);

      return prisma.$transaction(async (tx) => {
        const source = await findSalesDocumentOrThrow(
          organizationId,
          id,
          {
            ...COPY_SELECT,
            type: true,
            status: true,
          },
          tx,
        );

        if (!canConvertSales(source.type, source.status, target)) {
          throw new APIError("BAD_REQUEST", {
            code: "INVALID_SALES_CONVERSION",
          });
        }

        const issueDay = today();
        const issueDate = toDbDate(issueDay);
        const dueDay = defaultDueDate(target, issueDay, settings);
        const { type: sourceType, status: sourceStatus, ...copy } = source;
        const created = await tx.salesDocument.create({
          data: {
            ...copiedData(organizationId, copy),
            // Invoices and other types without delivery do not keep it.
            ...(SALES_TYPES[target].hasDelivery
              ? {}
              : { deliveryMethod: null, shippingAddress: null }),
            type: target,
            number:
              target === "INVOICE"
                ? null
                : await allocateNumber(
                    tx,
                    organizationId,
                    target,
                    issueDate,
                    settings.prefixes[target],
                  ),
            issueDate,
            dueDate: dueDay ? toDbDate(dueDay) : null,
            currency: settings.currency,
            sourceId: id,
            createdById: session.user.id,
          },
          select: { id: true, type: true },
        });
        const sourceMove = SOURCE_STATUS_ON_CONVERT[sourceType];

        if (sourceMove?.from.includes(sourceStatus)) {
          await tx.salesDocument.updateMany({
            where: { id, organizationId, status: sourceStatus },
            data: { status: sourceMove.to, statusChangedAt: new Date() },
          });
        }

        return created;
      });
    },
  );
}

/** Copies a document as a new draft of the same type, dated today. */
export async function duplicateSalesDocument(
  id: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(salesDocumentIdSchema, id, async (documentId) => {
    const { organizationId, session } = await requirePermission({
      sale: ["create"],
    });
    const settings = await getSalesSettings(organizationId);

    return prisma.$transaction(async (tx) => {
      const source = await findSalesDocumentOrThrow(
        organizationId,
        documentId,
        {
          ...COPY_SELECT,
          type: true,
        },
        tx,
      );
      const issueDay = today();
      const issueDate = toDbDate(issueDay);
      const dueDay = defaultDueDate(source.type, issueDay, settings);
      const { type, ...copy } = source;

      return tx.salesDocument.create({
        data: {
          ...copiedData(organizationId, copy),
          type,
          number:
            source.type === "INVOICE"
              ? null
              : await allocateNumber(
                  tx,
                  organizationId,
                  source.type,
                  issueDate,
                  settings.prefixes[source.type],
                ),
          issueDate,
          dueDate: dueDay ? toDbDate(dueDay) : null,
          currency: settings.currency,
          createdById: session.user.id,
        },
        select: { id: true },
      });
    });
  });
}

export async function deleteSalesDocument(id: unknown): Promise<ActionResult> {
  return runAction(salesDocumentIdSchema, id, async (documentId) => {
    const { organizationId } = await requirePermission({ sale: ["delete"] });
    const document = await findSalesDocumentOrThrow(
      organizationId,
      documentId,
      {
        type: true,
        status: true,
        stockApplied: true,
      },
    );

    if (
      !SALES_TYPES[document.type].deletableStatuses.includes(document.status) ||
      document.stockApplied
    ) {
      throw new APIError("BAD_REQUEST", {
        code: "SALES_DOCUMENT_NOT_DELETABLE",
      });
    }

    const { count } = await prisma.salesDocument.deleteMany({
      where: { id: documentId, organizationId, status: document.status },
    });

    if (count === 0) {
      throw new APIError("CONFLICT", { code: "SALES_DOCUMENT_CHANGED" });
    }

    return undefined;
  });
}

/**
 * Registers money received for an issued invoice; it is paid once covered.
 * With `toCashSession` it goes into the caller's open cash session, so it
 * counts in that till's cash count.
 */
export async function addSalesPayment(input: unknown): Promise<ActionResult> {
  return runAction(
    addSalesPaymentSchema,
    input,
    async ({ documentId, values }) => {
      const { organizationId, session } = await requirePermission({
        sale: ["update"],
      });

      await prisma.$transaction(async (tx) => {
        const cashSession = values.toCashSession
          ? await findOpenCashSession(tx, organizationId, session.user.id)
          : null;

        if (values.toCashSession && !cashSession) {
          throw new APIError("BAD_REQUEST", { code: "NO_OPEN_CASH_SESSION" });
        }

        await createInvoicePayment(tx, {
          organizationId,
          documentId,
          amount: Number(toDecimal(values.amount)),
          paidOn: toDbDate(values.paidOn),
          paymentMethodId: values.paymentMethodId,
          note: emptyToNull(values.note),
          cashSessionId: cashSession?.id ?? null,
          authorId: session.user.id,
        });
      });

      return undefined;
    },
  );
}

export async function deleteSalesPayment(id: unknown): Promise<ActionResult> {
  return runAction(idField, id, async (paymentId) => {
    const { organizationId } = await requirePermission({ sale: ["update"] });

    await prisma.$transaction(async (tx) => {
      const payment = await tx.salesPayment.findFirst({
        where: { id: paymentId, organizationId },
        select: {
          documentId: true,
          amount: true,
          document: { select: { status: true, channel: true } },
          cashSession: { select: { status: true } },
        },
      });

      if (!payment) {
        throw new APIError("NOT_FOUND", { code: "PAYMENT_NOT_FOUND" });
      }
      if (payment.document.status === "CANCELLED") {
        throw new APIError("BAD_REQUEST", { code: "PAYMENT_NOT_ALLOWED" });
      }
      // Tickets are voided from the till, and a closed cash count must not
      // change afterwards.
      if (
        payment.document.channel === "POS" ||
        payment.amount.isNegative() ||
        payment.cashSession?.status === "CLOSED"
      ) {
        throw new APIError("BAD_REQUEST", { code: "PAYMENT_LOCKED" });
      }

      await tx.salesPayment.delete({ where: { id: paymentId } });
      await refreshInvoicePayments(tx, organizationId, payment.documentId);
    });

    return undefined;
  });
}

/** Presentation of a product offered when filling a line. */
export interface SalesCatalogPresentation {
  id: string;
  /** "Caja de 12 ud." */
  label: string;
  /** Short unit of the line, e.g. "caja". */
  unit: string;
  unitPrice: number;
}

/**
 * Name, unit, prices and presentations of a catalog item, to fill a
 * document line.
 */
export async function getSalesCatalogItem(input: unknown): Promise<
  ActionResult<{
    description: string;
    unit: string;
    unitPrice: number;
    taxRate: number | null;
    presentations: SalesCatalogPresentation[];
  }>
> {
  return runAction(salesItemRefField, input, async (ref) => {
    const { organizationId } = await requirePermission({ sale: ["read"] });
    const [kind, id] = ref.split(":");

    if (kind === "product") {
      const product = await prisma.product.findFirst({
        where: { id, organizationId },
        select: {
          name: true,
          unit: true,
          price: true,
          taxRate: true,
          presentations: {
            orderBy: { position: "asc" },
            select: { id: true, unit: true, factor: true, price: true },
          },
        },
      });

      if (!product) {
        throw new APIError("NOT_FOUND", { code: "INVALID_SALES_ITEM" });
      }

      return {
        description: product.name,
        unit: productUnitInfo(product.unit).short,
        unitPrice: product.price.toNumber(),
        taxRate: product.taxRate?.toNumber() ?? null,
        presentations: product.presentations.map((presentation) => ({
          id: presentation.id,
          label: presentationLabel(
            presentation.unit,
            presentation.factor.toNumber(),
            product.unit,
          ),
          unit: productUnitInfo(presentation.unit).short,
          unitPrice: presentation.price.toNumber(),
        })),
      };
    }

    const service = await prisma.service.findFirst({
      where: { id, organizationId },
      select: { name: true, unit: true, price: true, taxRate: true },
    });

    if (!service) {
      throw new APIError("NOT_FOUND", { code: "INVALID_SALES_ITEM" });
    }

    return {
      description: service.name,
      unit: serviceUnitInfo(service.unit).short,
      unitPrice: service.price.toNumber(),
      taxRate: service.taxRate?.toNumber() ?? null,
      presentations: [],
    };
  });
}

/** Sales settings of the active organization, readable by any member. */
export async function getSalesSettingsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof getSalesSettings>> & { today: string }>
> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await getActorContext();

    return { ...(await getSalesSettings(organizationId)), today: today() };
  });
}

export async function updateSalesSettings(
  input: unknown,
): Promise<ActionResult> {
  return runAction(salesSettingsSchema, input, async (values) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });
    const { ticketPrefix } = await getPosSettings(organizationId);

    // Tickets are invoices too; their numbers must not collide.
    if (values.invoicePrefix === ticketPrefix) {
      throw new APIError("BAD_REQUEST", { code: "SALES_PREFIX_IN_USE" });
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        salesQuotePrefix: values.quotePrefix,
        salesOrderPrefix: values.orderPrefix,
        salesDeliveryNotePrefix: values.deliveryNotePrefix,
        salesInvoicePrefix: values.invoicePrefix,
        salesQuoteValidityDays: Number(values.quoteValidityDays),
        salesInvoiceDueDays: Number(values.invoiceDueDays),
        salesDefaultTerms: emptyToNull(values.defaultTerms),
        salesStockOnDelivery: values.stockOnDelivery,
      },
    });

    return undefined;
  });
}

async function findSalesOverview(organizationId: string) {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const trendStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
  );
  const todayDate = toDbDate(today());
  const sum = (value: { toNumber(): number } | null | undefined) =>
    value?.toNumber() ?? 0;

  const [quotes, orders, invoices, overdue, invoiced, collected, recent] =
    await prisma.$transaction([
      prisma.salesDocument.aggregate({
        where: {
          organizationId,
          type: "QUOTE",
          status: { in: ["DRAFT", "SENT"] },
        },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.salesDocument.aggregate({
        where: { organizationId, type: "ORDER", status: "CONFIRMED" },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.salesDocument.aggregate({
        where: { organizationId, type: "INVOICE", status: "ISSUED" },
        _count: { _all: true },
        _sum: { total: true, paidTotal: true },
      }),
      prisma.salesDocument.aggregate({
        where: {
          organizationId,
          type: "INVOICE",
          status: "ISSUED",
          dueDate: { lt: todayDate },
        },
        _count: { _all: true },
        _sum: { total: true, paidTotal: true },
      }),
      prisma.salesDocument.findMany({
        where: {
          organizationId,
          type: "INVOICE",
          status: { in: ["ISSUED", "PAID"] },
          issueDate: { gte: trendStart },
        },
        select: { issueDate: true, subtotal: true },
      }),
      prisma.salesPayment.aggregate({
        where: { organizationId, paidOn: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.salesDocument.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: SALES_LIMITS.recentRows,
        select: salesListSelect,
      }),
    ]);

  // Invoiced amount (before taxes) of each of the last six months.
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1),
    );

    return fromDbDate(date).slice(0, 7);
  });
  const byMonth = new Map(months.map((month) => [month, 0]));

  for (const invoice of invoiced) {
    const month = fromDbDate(invoice.issueDate).slice(0, 7);

    byMonth.set(
      month,
      roundMoney((byMonth.get(month) ?? 0) + sum(invoice.subtotal)),
    );
  }

  const trend = months.map((month) => ({
    month,
    amount: byMonth.get(month) ?? 0,
  }));

  return {
    openQuotes: { count: quotes._count._all, amount: sum(quotes._sum.total) },
    pendingOrders: {
      count: orders._count._all,
      amount: sum(orders._sum.total),
    },
    outstanding: {
      count: invoices._count._all,
      amount: roundMoney(
        sum(invoices._sum.total) - sum(invoices._sum.paidTotal),
      ),
    },
    overdue: {
      count: overdue._count._all,
      amount: roundMoney(sum(overdue._sum.total) - sum(overdue._sum.paidTotal)),
    },
    collectedThisMonth: sum(collected._sum.amount),
    invoicedThisMonth: trend[5].amount,
    invoicedLastMonth: trend[4].amount,
    trend,
    pendingInvoice: (await getSalesTypeSummary(organizationId, "DELIVERY_NOTE"))
      .pendingInvoice,
    recent: recent.map(serializeSalesRow),
  };
}

export type SalesOverview = Awaited<ReturnType<typeof findSalesOverview>>;

export async function getSalesOverview(): Promise<ActionResult<SalesOverview>> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await requirePermission({ sale: ["read"] });

    return findSalesOverview(organizationId);
  });
}

/** Documents of every type of one customer, most recent first. */
export async function listCustomerSales(input: unknown): Promise<
  ActionResult<{
    items: SalesListItem[];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
    invoiced: number;
    outstanding: number;
  }>
> {
  return runAction(customerSalesSchema, input, async ({ customerId, page }) => {
    const { organizationId } = await requirePermission({ sale: ["read"] });
    const where = { organizationId, customerId };
    const pageSize = SALES_LIMITS.recentRows;
    const [items, total, invoiced] = await prisma.$transaction([
      prisma.salesDocument.findMany({
        where,
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: salesListSelect,
      }),
      prisma.salesDocument.count({ where }),
      prisma.salesDocument.aggregate({
        where: {
          ...where,
          type: "INVOICE",
          status: { in: ["ISSUED", "PAID"] },
        },
        _sum: { total: true, paidTotal: true },
      }),
    ]);
    const invoicedTotal = invoiced._sum.total?.toNumber() ?? 0;

    return {
      items: items.map(serializeSalesRow),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      invoiced: invoicedTotal,
      outstanding: roundMoney(
        invoicedTotal - (invoiced._sum.paidTotal?.toNumber() ?? 0),
      ),
    };
  });
}

export interface SalesExportRow {
  number: string | null;
  status: SalesStatus;
  issueDate: string;
  dueDate: string | null;
  customerName: string;
  customerTaxId: string | null;
  reference: string | null;
  subtotal: number;
  taxTotal: number;
  totalTaxAmount: number;
  total: number;
  paidTotal: number;
  owner: string | null;
}

/** Documents matching the list filters, for a CSV built in the browser. */
export async function exportSalesDocuments(
  input: unknown,
): Promise<ActionResult<{ rows: SalesExportRow[]; isTruncated: boolean }>> {
  return runAction(salesListSchema, input, async (filters) => {
    const { organizationId } = await requirePermission({ sale: ["read"] });
    const limit = SALES_LIMITS.exportRows;
    const documents = await prisma.salesDocument.findMany({
      where: buildSalesWhere(organizationId, filters),
      orderBy: salesOrderBy(filters),
      take: limit + 1,
      select: {
        number: true,
        status: true,
        issueDate: true,
        dueDate: true,
        customerName: true,
        customerTaxId: true,
        reference: true,
        subtotal: true,
        taxTotal: true,
        totalTaxAmount: true,
        total: true,
        paidTotal: true,
        owner: { select: { name: true } },
      },
    });

    return {
      isTruncated: documents.length > limit,
      rows: documents.slice(0, limit).map(({ owner, ...row }) => ({
        ...row,
        status: row.status as SalesStatus,
        issueDate: fromDbDate(row.issueDate),
        dueDate: row.dueDate ? fromDbDate(row.dueDate) : null,
        subtotal: row.subtotal.toNumber(),
        taxTotal: row.taxTotal.toNumber(),
        totalTaxAmount: row.totalTaxAmount.toNumber(),
        total: row.total.toNumber(),
        paidTotal: row.paidTotal.toNumber(),
        owner: owner?.name ?? null,
      })),
    };
  });
}

/** Postal address of a customer, to start the shipping address of a document. */
export async function getSalesCustomerAddress(
  customerId: unknown,
): Promise<ActionResult<{ address: string }>> {
  return runAction(idField, customerId, async (id) => {
    const { organizationId } = await requirePermission({ sale: ["read"] });
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId },
      select: {
        address: true,
        postalCode: true,
        city: true,
        region: true,
        country: true,
      },
    });

    if (!customer) {
      throw new APIError("NOT_FOUND", { code: "INVALID_SALES_CUSTOMER" });
    }

    return { address: formatCustomerAddress(customer) };
  });
}
