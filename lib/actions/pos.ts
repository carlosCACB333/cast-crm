"use server";

import type { SalesDocumentType, SalesStatus } from "@/config/sales";
import type {
  CashDiscrepancyReportListParams,
  CashRegisterMovementListParams,
  CashSessionListParams,
  PosCartValues,
} from "@/lib/validations/pos";

import { APIError } from "better-auth/api";
import { z } from "zod";

import { getActorContext, requirePermission } from "@/lib/actions/context";
import {
  type ActionResult,
  type StockShortage,
  runAction,
} from "@/lib/actions/result";
import {
  presentationLabel,
  unitInfo as productUnitInfo,
} from "@/config/products";
import {
  CASH_CLOSING_WITHDRAWAL_REASON,
  POS_LIMITS,
  POS_LOADABLE_STATUSES,
  POS_TICKET_SERIES,
} from "@/config/pos";
import { serviceUnitInfo } from "@/config/services";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  findOpenCashSession,
  findOperableSession,
  getCashSessionSummary,
  getPosSettings,
  lockCashRegister,
  lockOpenCashSession,
} from "@/lib/pos";
import { includesPermissions } from "@/lib/permissions";
import { type Page, pageWindow, paginateInMemory } from "@/lib/pagination";
import { decimalToText } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import {
  allocateNumber,
  applyDeliveryStock,
  buildLines,
  createInvoicePayment,
  customerSnapshot,
  findCartStockShortages,
  findSalesDocumentOrThrow,
  getSalesSettings,
  resolvePaymentMethods,
  tenderedAmount,
  today,
} from "@/lib/sales";
import { roundMoney } from "@/lib/sales-math";
import {
  emptyToNull,
  idField,
  toDbDate,
  toDecimal,
} from "@/lib/validations/fields";
import { storedLinePresentation } from "@/lib/validations/sales";
import {
  addCashMovementSchema,
  addCashRegisterMovementSchema,
  cashDiscrepancyReportListSchema,
  cashRegisterFormSchema,
  cashRegisterListSchema,
  cashRegisterMovementListSchema,
  cashSessionListSchema,
  closeCashSessionSchema,
  collectInvoiceFormSchema,
  createPosTicketSchema,
  holdPosCartSchema,
  openCashSessionSchema,
  posCartSchema,
  posItemsSchema,
  posSettingsSchema,
  posStockCheckSchema,
  reportCashDiscrepancySchema,
  updateCashRegisterSchema,
} from "@/lib/validations/pos";

// The point of sale sells through the sales module: every ticket is an
// invoice (channel "POS") issued and paid at once inside the caller's open
// cash session. Every action derives the organization from the session and
// checks the `pos:*` permission of the caller's role before touching data.

type Tx = Prisma.TransactionClient;

const userSelect = { id: true, name: true, image: true } as const;

const money = (value: Prisma.Decimal | null) => value?.toNumber() ?? null;

/** Translates the partial unique indexes of open sessions into errors. */
async function withOpenSessionConstraint<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new APIError("CONFLICT", { code: "CASH_REGISTER_IN_USE" });
    }
    throw error;
  }
}

/** The caller's open session with its figures, the settings and payment methods. */
async function findPosState(organizationId: string, userId: string) {
  const [session, pos, sales, paymentMethods, heldCartCount] =
    await Promise.all([
      findOpenCashSession(prisma, organizationId, userId),
      getPosSettings(organizationId),
      getSalesSettings(organizationId),
      prisma.paymentMethod.findMany({
        where: { organizationId, isActive: true },
        orderBy: { position: "asc" },
        select: { id: true, name: true, kind: true },
      }),
      prisma.posHeldCart.count({ where: { organizationId } }),
    ]);

  return {
    session: session
      ? {
          id: session.id,
          registerId: session.registerId,
          registerName: session.register.name,
          openedAt: session.openedAt.toISOString(),
          summary: await getCashSessionSummary(prisma, organizationId, session),
        }
      : null,
    settings: {
      ...pos,
      currency: sales.currency,
      defaultTaxRate: sales.defaultTaxRate,
      totalTax: sales.totalTax,
      stockOnSale: sales.stockOnDelivery,
      allowNegativeStock: sales.allowNegativeStock,
    },
    paymentMethods,
    heldCartCount,
    today: today(),
  };
}

export type PosState = Awaited<ReturnType<typeof findPosState>>;
export type PosPaymentMethod = PosState["paymentMethods"][number];

export async function getPosState(): Promise<ActionResult<PosState>> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId, session } = await requirePermission({
      pos: ["read"],
    });

    return findPosState(organizationId, session.user.id);
  });
}

export interface PosItem {
  ref: string;
  kind: "product" | "service";
  name: string;
  code: string | null;
  barcode: string | null;
  unit: string;
  unitPrice: number;
  taxRate: number | null;
  /** Units in stock; null when the product does not track it. */
  stock: number | null;
  color: string | null;
  imageUrl: string | null;
  /** Other ways of selling a product; one must be picked when there are any. */
  presentations: PosPresentation[];
  /** Presentation whose barcode is the search, to add it when scanned. */
  matchedPresentationId: string | null;
}

export interface PosPresentation {
  id: string;
  /** "Caja de 12 ud." */
  label: string;
  /** Short unit of the line, e.g. "caja". */
  unit: string;
  price: number;
  barcode: string | null;
}

/**
 * Active products and services of the catalog grid, searched by name, code or
 * exact barcode (also of their presentations), one page at a time.
 */
export async function searchPosItems(
  input: unknown,
): Promise<ActionResult<{ items: PosItem[]; hasMore: boolean }>> {
  return runAction(posItemsSchema, input, async ({ q, kind, page }) => {
    const { organizationId } = await requirePermission({ pos: ["sell"] });
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const pageSize = POS_LIMITS.itemsPageSize;
    const rows = await prisma.$queryRaw<
      {
        ref: string;
        kind: "product" | "service";
        name: string;
        code: string | null;
        barcode: string | null;
        unit: string;
        price: Prisma.Decimal;
        taxRate: Prisma.Decimal | null;
        stock: Prisma.Decimal | null;
        color: string | null;
        imageUrl: string | null;
        matchedPresentationId: string | null;
      }[]
    >`
      SELECT * FROM (
        SELECT 'product:' || p.id AS ref, 'product' AS kind, p.name, p.sku AS code,
          p.barcode, p.unit, p.price, p."taxRate",
          CASE WHEN p."trackStock" THEN p.stock END AS stock, c.color,
          (SELECT i.url FROM "product_image" i WHERE i."productId" = p.id
            ORDER BY i.position LIMIT 1) AS "imageUrl",
          (SELECT pp.id FROM "product_presentation" pp
            WHERE pp."productId" = p.id AND ${q} <> '' AND pp.barcode = ${q}
            ORDER BY pp.position LIMIT 1) AS "matchedPresentationId"
        FROM "product" p
        LEFT JOIN "product_category" c ON c.id = p."categoryId"
        WHERE p."organizationId" = ${organizationId} AND p."isActive"
          AND ${kind === "service" ? Prisma.sql`FALSE` : Prisma.sql`TRUE`}
          AND (${q} = '' OR p.name ILIKE ${pattern} OR p.sku ILIKE ${pattern}
            OR p.barcode = ${q}
            OR EXISTS (SELECT 1 FROM "product_presentation" pp
              WHERE pp."productId" = p.id AND pp.barcode = ${q}))
        UNION ALL
        SELECT 'service:' || s.id, 'service', s.name, s.code, NULL, s.unit,
          s.price, s."taxRate", NULL, c.color, NULL, NULL
        FROM "service" s
        LEFT JOIN "service_category" c ON c.id = s."categoryId"
        WHERE s."organizationId" = ${organizationId} AND s."isActive"
          AND ${kind === "product" ? Prisma.sql`FALSE` : Prisma.sql`TRUE`}
          AND (${q} = '' OR s.name ILIKE ${pattern} OR s.code ILIKE ${pattern})
      ) items
      ORDER BY name, ref
      OFFSET ${(page - 1) * pageSize} LIMIT ${pageSize + 1}
    `;

    const pageRows = rows.slice(0, pageSize);
    const productIds = pageRows.flatMap((row) =>
      row.kind === "product" ? [row.ref.slice("product:".length)] : [],
    );
    const presentations = productIds.length
      ? await prisma.productPresentation.findMany({
          where: { organizationId, productId: { in: productIds } },
          orderBy: { position: "asc" },
          select: {
            id: true,
            productId: true,
            unit: true,
            factor: true,
            price: true,
            barcode: true,
          },
        })
      : [];

    return {
      hasMore: rows.length > pageSize,
      items: pageRows.map((row) => ({
        ref: row.ref,
        kind: row.kind,
        name: row.name,
        code: row.code,
        barcode: row.barcode,
        unit:
          row.kind === "product"
            ? productUnitInfo(row.unit).short
            : serviceUnitInfo(row.unit).short,
        unitPrice: Number(row.price),
        taxRate: row.taxRate === null ? null : Number(row.taxRate),
        stock: row.stock === null ? null : Number(row.stock),
        color: row.color,
        imageUrl: row.imageUrl,
        presentations: presentations
          .filter((item) => `product:${item.productId}` === row.ref)
          .map((item) => ({
            id: item.id,
            label: presentationLabel(
              item.unit,
              item.factor.toNumber(),
              row.unit,
            ),
            unit: productUnitInfo(item.unit).short,
            price: item.price.toNumber(),
            barcode: item.barcode,
          })),
        matchedPresentationId: row.matchedPresentationId,
      })),
    };
  });
}

/** Throws unless the quote or order can still be charged at the till. */
async function findLoadableSource(
  db: Tx | typeof prisma,
  organizationId: string,
  id: string,
) {
  const source = await findSalesDocumentOrThrow(
    organizationId,
    id,
    {
      id: true,
      type: true,
      status: true,
      number: true,
      customerId: true,
      customerName: true,
      reference: true,
      _count: {
        select: { derived: { where: { status: { not: "CANCELLED" } } } },
      },
    },
    db,
  );
  const statuses: readonly string[] =
    source.type === "QUOTE" || source.type === "ORDER"
      ? POS_LOADABLE_STATUSES[source.type]
      : [];

  if (!statuses.includes(source.status) || source._count.derived > 0) {
    throw new APIError("BAD_REQUEST", { code: "INVALID_POS_SOURCE" });
  }

  return source;
}

/** The quote or order a cart was loaded from. */
export interface PosSourceSummary {
  id: string;
  type: SalesDocumentType;
  number: string | null;
}

/** Customer and lines of a quote or order, to charge it at the till. */
export async function getPosSourceDocument(id: unknown): Promise<
  ActionResult<{
    id: string;
    type: SalesDocumentType;
    number: string | null;
    customerId: string | null;
    customerName: string;
    lines: {
      itemRef: string;
      presentationId: string;
      description: string;
      unit: string;
      quantity: string;
      unitPrice: string;
      discount: string;
      taxRate: string;
    }[];
  }>
> {
  return runAction(idField, id, async (documentId) => {
    const { organizationId } = await requirePermission({ pos: ["sell"] });
    const source = await findLoadableSource(prisma, organizationId, documentId);
    const lines = await prisma.salesDocumentLine.findMany({
      where: { documentId, organizationId },
      orderBy: { position: "asc" },
      select: {
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
      },
    });

    return {
      id: source.id,
      type: source.type,
      number: source.number,
      customerId: source.customerId,
      customerName: source.customerName,
      lines: lines.map((line) => ({
        itemRef: line.productId
          ? `product:${line.productId}`
          : line.serviceId
            ? `service:${line.serviceId}`
            : "",
        presentationId: storedLinePresentation(line),
        description: line.description,
        unit: line.unit ?? "",
        quantity: decimalToText(line.quantity.toNumber()),
        unitPrice: decimalToText(line.unitPrice.toNumber()),
        discount: line.discount.isZero()
          ? ""
          : decimalToText(line.discount.toNumber()),
        taxRate: decimalToText(line.taxRate.toNumber()),
      })),
    };
  });
}

/**
 * Held carts the caller can see: shared ones plus those of the register the
 * caller has open. Point of sale managers see them all.
 */
function visibleHeldCarts(
  organizationId: string,
  registerId: string | null,
  canManage: boolean,
): Prisma.PosHeldCartWhereInput {
  if (canManage) return { organizationId };

  return {
    organizationId,
    OR: [{ isShared: true }, ...(registerId ? [{ registerId }] : [])],
  };
}

/** The caller's open register and whether they manage the point of sale. */
async function heldCartAccess(
  organizationId: string,
  userId: string,
  permissions: Parameters<typeof includesPermissions>[0],
) {
  const session = await findOpenCashSession(prisma, organizationId, userId);

  return {
    registerId: session?.registerId ?? null,
    canManage: includesPermissions(permissions, { pos: ["manage"] }),
  };
}

/** Carts parked at the till, oldest first, for any seller of the organization. */
async function findHeldCarts(
  organizationId: string,
  userId: string,
  {
    registerId: currentRegister,
    canManage,
  }: { registerId: string | null; canManage: boolean },
) {
  const carts = await prisma.posHeldCart.findMany({
    where: visibleHeldCarts(organizationId, currentRegister, canManage),
    orderBy: { createdAt: "asc" },
    take: POS_LIMITS.maxHeldCarts,
    select: {
      id: true,
      note: true,
      itemCount: true,
      total: true,
      createdAt: true,
      createdById: true,
      registerId: true,
      isShared: true,
      register: { select: { name: true } },
      createdBy: { select: { name: true } },
      customer: { select: { name: true } },
      source: { select: { type: true, number: true } },
    },
  });
  const items = carts.map(
    ({ total, createdAt, createdById, registerId, ...cart }) => ({
      ...cart,
      total: total.toNumber(),
      createdAt: createdAt.toISOString(),
      /** Saved at the register the caller has open. */
      isCurrentRegister: Boolean(registerId && registerId === currentRegister),
      canDelete: canManage || createdById === userId,
    }),
  );

  // The caller's register first, each group oldest first.
  return [
    ...items.filter((item) => item.isCurrentRegister),
    ...items.filter((item) => !item.isCurrentRegister),
  ];
}

export type HeldCart = Awaited<ReturnType<typeof findHeldCarts>>[number];

export async function listHeldCarts(): Promise<ActionResult<HeldCart[]>> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId, session, access } = await requirePermission({
      pos: ["sell"],
    });

    return findHeldCarts(
      organizationId,
      session.user.id,
      await heldCartAccess(organizationId, session.user.id, access.permissions),
    );
  });
}

/**
 * Parks the cart to charge it later. The lines are checked like a sale
 * (items of the organization, valid amounts) and stored as typed.
 */
export async function holdPosCart(input: unknown): Promise<ActionResult> {
  return runAction(holdPosCartSchema, input, async (values) => {
    const { organizationId, session } = await requirePermission({
      pos: ["sell"],
    });
    const { totalTax } = await getSalesSettings(organizationId);
    const [lines] = await Promise.all([
      buildLines(organizationId, values.lines, totalTax),
      values.customerId
        ? customerSnapshot(organizationId, values.customerId)
        : null,
      values.sourceId
        ? findLoadableSource(prisma, organizationId, values.sourceId)
        : null,
    ]);

    await prisma.$transaction(async (tx) => {
      const [count, cashSession] = [
        await tx.posHeldCart.count({ where: { organizationId } }),
        await findOpenCashSession(tx, organizationId, session.user.id),
      ];

      if (count >= POS_LIMITS.maxHeldCarts) {
        throw new APIError("BAD_REQUEST", { code: "TOO_MANY_HELD_CARTS" });
      }
      // A cart kept for one register needs that register open.
      if (!values.isShared && !cashSession) {
        throw new APIError("BAD_REQUEST", { code: "NO_OPEN_CASH_SESSION" });
      }

      await tx.posHeldCart.create({
        data: {
          organizationId,
          note: emptyToNull(values.note),
          customerId: values.customerId || null,
          sourceId: values.sourceId || null,
          registerId: cashSession?.registerId ?? null,
          isShared: values.isShared,
          lines: values.lines,
          itemCount: values.lines.length,
          total: lines.totals.total,
          createdById: session.user.id,
        },
      });
    });

    return undefined;
  });
}

/**
 * Takes a parked cart back to the till and removes it, so two tills cannot
 * charge it twice. A source document that can no longer be charged is left
 * out; its lines stay.
 */
export async function recoverHeldCart(id: unknown): Promise<
  ActionResult<{
    customerId: string;
    lines: PosCartValues["lines"];
    source: PosSourceSummary | null;
  }>
> {
  return runAction(idField, id, async (cartId) => {
    const { organizationId, session, access } = await requirePermission({
      pos: ["sell"],
    });
    const { registerId, canManage } = await heldCartAccess(
      organizationId,
      session.user.id,
      access.permissions,
    );
    const where = {
      ...visibleHeldCarts(organizationId, registerId, canManage),
      id: cartId,
    };
    const cart = await prisma.$transaction(async (tx) => {
      const found = await tx.posHeldCart.findFirst({
        where,
        select: { customerId: true, sourceId: true, lines: true },
      });
      const { count } = await tx.posHeldCart.deleteMany({ where });

      if (!found || count === 0) {
        throw new APIError("NOT_FOUND", { code: "HELD_CART_NOT_FOUND" });
      }

      return found;
    });
    const lines = posCartSchema.shape.lines.safeParse(cart.lines);
    const source = cart.sourceId
      ? await findLoadableSource(prisma, organizationId, cart.sourceId).catch(
          () => null,
        )
      : null;

    return {
      customerId: cart.customerId ?? "",
      lines: lines.success ? lines.data : [],
      source: source
        ? { id: source.id, type: source.type, number: source.number }
        : null,
    };
  });
}

export async function deleteHeldCart(id: unknown): Promise<ActionResult> {
  return runAction(idField, id, async (cartId) => {
    const { organizationId, session, access } = await requirePermission({
      pos: ["sell"],
    });
    const cart = await prisma.posHeldCart.findFirst({
      where: { id: cartId, organizationId },
      select: { createdById: true },
    });

    if (!cart) {
      throw new APIError("NOT_FOUND", { code: "HELD_CART_NOT_FOUND" });
    }
    if (
      cart.createdById !== session.user.id &&
      !includesPermissions(access.permissions, { pos: ["manage"] })
    ) {
      throw new APIError("FORBIDDEN", { code: "HELD_CART_NOT_YOURS" });
    }

    await prisma.posHeldCart.deleteMany({
      where: { id: cartId, organizationId },
    });

    return undefined;
  });
}

/**
 * Products of the cart whose stock does not cover it, to warn before
 * charging. Only a hint: the sale checks the stock again when it is made.
 */
export async function checkPosStock(
  input: unknown,
): Promise<ActionResult<StockShortage[]>> {
  return runAction(posStockCheckSchema, input, async ({ lines }) => {
    const { organizationId } = await requirePermission({ pos: ["sell"] });

    return findCartStockShortages(organizationId, lines);
  });
}

/** What a quote or order becomes once it is charged at the till. */
const SOURCE_STATUS_ON_SALE: Partial<
  Record<SalesDocumentType, { from: readonly SalesStatus[]; to: SalesStatus }>
> = {
  QUOTE: { from: ["DRAFT", "SENT"], to: "ACCEPTED" },
  // The customer takes the goods at the counter.
  ORDER: { from: ["DRAFT", "CONFIRMED"], to: "DELIVERED" },
};

/**
 * Sells the cart: creates the ticket (an invoice of the POS series, issued
 * and paid), its payments in the caller's open session and, when the sales
 * settings say so, takes the units out of the stock.
 */
export async function createPosTicket(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string; change: number }>> {
  return runAction(createPosTicketSchema, input, async (values) => {
    const { organizationId, session } = await requirePermission({
      pos: ["sell"],
    });
    const userId = session.user.id;
    const settings = await getSalesSettings(organizationId);
    const [pos, customer, lines] = await Promise.all([
      getPosSettings(organizationId),
      values.customerId
        ? customerSnapshot(organizationId, values.customerId)
        : null,
      buildLines(organizationId, values.lines, settings.totalTax),
    ]);
    const amounts = values.payments.map((payment) =>
      Number(toDecimal(payment.amount)),
    );
    const total = lines.totals.total;

    // The till charges the whole ticket; partial payments are invoices.
    if (
      roundMoney(amounts.reduce((sum, amount) => sum + amount, 0)) !== total
    ) {
      throw new APIError("BAD_REQUEST", { code: "POS_PAYMENTS_MISMATCH" });
    }

    return prisma.$transaction(async (tx) => {
      const cashSession = await lockOpenCashSession(tx, organizationId, userId);

      if (!cashSession) {
        throw new APIError("BAD_REQUEST", { code: "NO_OPEN_CASH_SESSION" });
      }

      const methods = await resolvePaymentMethods(
        tx,
        organizationId,
        values.payments.map((payment) => payment.paymentMethodId),
      );
      const source = values.sourceId
        ? await findLoadableSource(tx, organizationId, values.sourceId)
        : null;
      const issueDate = toDbDate(today());
      const number = await allocateNumber(
        tx,
        organizationId,
        "INVOICE",
        issueDate,
        pos.ticketPrefix,
        POS_TICKET_SERIES,
      );
      const payments = values.payments.map((payment, index) => {
        const kind = methods.get(payment.paymentMethodId)!.kind;
        const tendered = tenderedAmount(kind, amounts[index], payment.tendered);

        return {
          organizationId,
          amount: amounts[index],
          paidOn: issueDate,
          paymentMethodId: payment.paymentMethodId,
          tendered,
          cashSessionId: cashSession.id,
          authorId: userId,
        };
      });
      const ticket = await tx.salesDocument.create({
        data: {
          organizationId,
          type: "INVOICE",
          status: "PAID",
          channel: "POS",
          cashSessionId: cashSession.id,
          number,
          issueDate,
          dueDate: issueDate,
          ...(customer ?? {
            customerId: null,
            customerName: pos.walkInCustomerName,
            customerTaxId: null,
            customerEmail: null,
            customerAddress: null,
          }),
          reference: source?.reference ?? null,
          currency: settings.currency,
          ...lines.totals,
          paidTotal: total,
          sourceId: source?.id ?? null,
          ownerId: userId,
          createdById: userId,
          lines: { createMany: { data: lines.rows } },
          payments: { createMany: { data: payments } },
        },
        select: { id: true },
      });

      if (settings.stockOnDelivery) {
        await applyDeliveryStock(tx, {
          organizationId,
          documentId: ticket.id,
          number,
          authorId: userId,
          direction: "out",
          allowNegativeStock: settings.allowNegativeStock,
          reason: `Ticket ${number}`,
        });
        await tx.salesDocument.update({
          where: { id: ticket.id },
          data: { stockApplied: true },
        });
      }

      const sourceMove = source ? SOURCE_STATUS_ON_SALE[source.type] : null;

      if (source && sourceMove?.from.includes(source.status)) {
        await tx.salesDocument.updateMany({
          where: { id: source.id, organizationId, status: source.status },
          data: { status: sourceMove.to, statusChangedAt: new Date() },
        });
      }

      return {
        id: ticket.id,
        number,
        change: roundMoney(
          payments.reduce(
            (sum, payment) =>
              sum + (payment.tendered ? payment.tendered - payment.amount : 0),
            0,
          ),
        ),
      };
    });
  });
}

/**
 * Voids a ticket of a session that is still open: its payments are refunded
 * from the same till (negative payments by method) and the units go back to
 * the stock.
 */
export async function voidPosTicket(id: unknown): Promise<ActionResult> {
  return runAction(idField, id, async (documentId) => {
    const { organizationId, session, access } = await requirePermission({
      pos: ["sell"],
    });
    const userId = session.user.id;

    await prisma.$transaction(async (tx) => {
      const ticket = await findSalesDocumentOrThrow(
        organizationId,
        documentId,
        {
          channel: true,
          status: true,
          number: true,
          stockApplied: true,
          cashSessionId: true,
          payments: { select: { amount: true, paymentMethodId: true } },
        },
        tx,
      );

      if (
        ticket.channel !== "POS" ||
        ticket.status === "CANCELLED" ||
        !ticket.cashSessionId
      ) {
        throw new APIError("BAD_REQUEST", { code: "INVALID_POS_TICKET" });
      }

      await findOperableSession(tx, {
        organizationId,
        sessionId: ticket.cashSessionId,
        userId,
        permissions: access.permissions,
      });

      const byMethod = new Map<string, Prisma.Decimal>();

      for (const payment of ticket.payments) {
        byMethod.set(
          payment.paymentMethodId,
          (byMethod.get(payment.paymentMethodId) ?? new Prisma.Decimal(0)).plus(
            payment.amount,
          ),
        );
      }

      const paidOn = toDbDate(today());
      const refunds = [...byMethod]
        .filter(([, amount]) => amount.gt(0))
        .map(([paymentMethodId, amount]) => ({
          organizationId,
          documentId,
          amount: amount.negated(),
          paidOn,
          paymentMethodId,
          cashSessionId: ticket.cashSessionId,
          note: `Anulación ${ticket.number ?? ""}`.trim(),
          authorId: userId,
        }));

      if (refunds.length) await tx.salesPayment.createMany({ data: refunds });

      if (ticket.stockApplied) {
        await applyDeliveryStock(tx, {
          organizationId,
          documentId,
          number: ticket.number,
          authorId: userId,
          direction: "in",
          reason: `Ticket anulado ${ticket.number ?? ""}`.trim(),
        });
      }

      const { count } = await tx.salesDocument.updateMany({
        where: { id: documentId, organizationId, status: ticket.status },
        data: {
          status: "CANCELLED",
          paidTotal: 0,
          stockApplied: false,
          statusChangedAt: new Date(),
        },
      });

      if (count === 0) {
        throw new APIError("CONFLICT", { code: "SALES_DOCUMENT_CHANGED" });
      }
    });

    return undefined;
  });
}

/**
 * Collects (part of) an issued invoice at the till: the payment goes into the
 * caller's open session and counts in its cash count.
 */
export async function collectInvoiceAtPos(
  input: unknown,
): Promise<ActionResult<{ change: number }>> {
  return runAction(
    collectInvoiceFormSchema,
    input,
    async ({ documentId, payment }) => {
      const { organizationId, session } = await requirePermission({
        pos: ["sell"],
      });
      const amount = Number(toDecimal(payment.amount));

      return prisma.$transaction(async (tx) => {
        const cashSession = await lockOpenCashSession(
          tx,
          organizationId,
          session.user.id,
        );

        if (!cashSession) {
          throw new APIError("BAD_REQUEST", { code: "NO_OPEN_CASH_SESSION" });
        }

        await createInvoicePayment(tx, {
          organizationId,
          documentId,
          amount,
          paidOn: toDbDate(today()),
          paymentMethodId: payment.paymentMethodId,
          tendered: payment.tendered,
          note: `Cobrado en ${cashSession.register.name}`,
          cashSessionId: cashSession.id,
          authorId: session.user.id,
        });

        const tendered = Number(toDecimal(payment.tendered) ?? 0);

        return {
          change: tendered > amount ? roundMoney(tendered - amount) : 0,
        };
      });
    },
  );
}

/** What is left to collect of an issued invoice, to charge it at the till. */
export async function getPosInvoiceBalance(
  id: unknown,
): Promise<
  ActionResult<{ number: string | null; customerName: string; balance: number }>
> {
  return runAction(idField, id, async (documentId) => {
    const { organizationId } = await requirePermission({ pos: ["sell"] });
    const invoice = await findSalesDocumentOrThrow(organizationId, documentId, {
      type: true,
      status: true,
      number: true,
      customerName: true,
      total: true,
      paidTotal: true,
    });

    if (invoice.type !== "INVOICE" || invoice.status !== "ISSUED") {
      throw new APIError("BAD_REQUEST", { code: "PAYMENT_NOT_ALLOWED" });
    }

    return {
      number: invoice.number,
      customerName: invoice.customerName,
      balance: roundMoney(
        invoice.total.toNumber() - invoice.paidTotal.toNumber(),
      ),
    };
  });
}

/** Opens a register for the caller, with the cash in the drawer. */
export type OpenCashSessionResult =
  | { opened: true; id: string }
  /** The cash counted is not the register's balance; nothing was opened. */
  | { opened: false; expected: number; counted: number };

/**
 * Opens a register with the cash counted in its drawer, which must match the
 * balance it was left with. Otherwise the cashier reports the difference and
 * someone with `pos:adjust` corrects the balance.
 */
export async function openCashSession(
  input: unknown,
): Promise<ActionResult<OpenCashSessionResult>> {
  return runAction(
    openCashSessionSchema,
    input,
    async ({ registerId, countedCash }) => {
      const { organizationId, session } = await requirePermission({
        pos: ["sell"],
      });

      return withOpenSessionConstraint(() =>
        prisma.$transaction(async (tx): Promise<OpenCashSessionResult> => {
          await lockCashRegister(tx, organizationId, registerId);

          const register = await tx.cashRegister.findFirst({
            where: { id: registerId, organizationId, isActive: true },
            select: {
              id: true,
              cashBalance: true,
              _count: { select: { sessions: { where: { status: "OPEN" } } } },
            },
          });
          const mine = await findOpenCashSession(
            tx,
            organizationId,
            session.user.id,
          );

          if (!register) {
            throw new APIError("BAD_REQUEST", {
              code: "INVALID_CASH_REGISTER",
            });
          }
          if (mine) {
            throw new APIError("BAD_REQUEST", {
              code: "CASH_SESSION_ALREADY_OPEN",
            });
          }
          if (register._count.sessions > 0) {
            throw new APIError("CONFLICT", { code: "CASH_REGISTER_IN_USE" });
          }

          const expected = register.cashBalance.toNumber();
          const counted = Number(toDecimal(countedCash));

          if (counted !== expected) return { opened: false, expected, counted };

          const created = await tx.cashSession.create({
            data: {
              organizationId,
              registerId,
              openedById: session.user.id,
              openingAmount: register.cashBalance,
            },
            select: { id: true },
          });

          // The drawer matches again: earlier reports no longer apply.
          await tx.cashDiscrepancyReport.updateMany({
            where: { organizationId, registerId, resolvedAt: null },
            data: { resolvedAt: new Date() },
          });

          return { opened: true, id: created.id };
        }),
      );
    },
  );
}

/**
 * Records that the cashier found another amount than the register's balance,
 * so someone with `pos:adjust` can review it and register a movement.
 */
export async function reportCashDiscrepancy(
  input: unknown,
): Promise<ActionResult> {
  return runAction(
    reportCashDiscrepancySchema,
    input,
    async ({ registerId, countedCash, reason }) => {
      const { organizationId, session } = await requirePermission({
        pos: ["sell"],
      });

      await prisma.$transaction(async (tx) => {
        await lockCashRegister(tx, organizationId, registerId);

        const register = await tx.cashRegister.findFirst({
          where: { id: registerId, organizationId, isActive: true },
          select: {
            cashBalance: true,
            _count: { select: { sessions: { where: { status: "OPEN" } } } },
          },
        });

        if (!register) {
          throw new APIError("BAD_REQUEST", { code: "INVALID_CASH_REGISTER" });
        }
        if (register._count.sessions > 0) {
          throw new APIError("CONFLICT", { code: "CASH_REGISTER_IN_USE" });
        }

        const counted = Number(toDecimal(countedCash));

        if (counted === register.cashBalance.toNumber()) {
          throw new APIError("BAD_REQUEST", { code: "CASH_OPENING_MATCHES" });
        }

        await tx.cashDiscrepancyReport.create({
          data: {
            organizationId,
            registerId,
            expectedAmount: register.cashBalance,
            countedAmount: counted,
            reason,
            authorId: session.user.id,
          },
        });
      });

      return undefined;
    },
  );
}

/**
 * Puts cash in, takes it out or adjusts the balance of a closed register
 * (an open one moves its cash in the session). Requires `pos:adjust` and
 * resolves the register's pending reported differences.
 */
export async function addCashRegisterMovement(
  input: unknown,
): Promise<ActionResult> {
  return runAction(
    addCashRegisterMovementSchema,
    input,
    async ({ registerId, values }) => {
      const { organizationId, session } = await requirePermission({
        pos: ["adjust"],
      });

      await prisma.$transaction(async (tx) => {
        await lockCashRegister(tx, organizationId, registerId);

        const register = await tx.cashRegister.findFirst({
          where: { id: registerId, organizationId },
          select: {
            cashBalance: true,
            _count: {
              select: {
                sessions: { where: { status: "OPEN" } },
                discrepancyReports: { where: { resolvedAt: null } },
              },
            },
          },
        });

        if (!register) {
          throw new APIError("NOT_FOUND", { code: "INVALID_CASH_REGISTER" });
        }
        if (register._count.sessions > 0) {
          throw new APIError("BAD_REQUEST", {
            code: "CASH_REGISTER_OPEN_ADJUST",
          });
        }

        const balance = register.cashBalance.toNumber();
        const typed = Number(toDecimal(values.amount));
        const balanceAfter =
          values.type === "ADJUSTMENT"
            ? typed
            : roundMoney(balance + (values.type === "IN" ? typed : -typed));

        if (balanceAfter < 0) {
          throw new APIError("BAD_REQUEST", { code: "CASH_NOT_ENOUGH" });
        }
        if (
          values.type === "ADJUSTMENT" &&
          balanceAfter === balance &&
          register._count.discrepancyReports === 0
        ) {
          throw new APIError("BAD_REQUEST", { code: "CASH_BALANCE_UNCHANGED" });
        }

        const now = new Date();

        await tx.cashRegister.update({
          where: { id: registerId },
          data: { cashBalance: balanceAfter },
        });
        await tx.cashRegisterMovement.create({
          data: {
            organizationId,
            registerId,
            type: values.type,
            amount: roundMoney(balanceAfter - balance),
            balanceAfter,
            reason: values.reason,
            authorId: session.user.id,
            createdAt: now,
          },
        });
        await tx.cashDiscrepancyReport.updateMany({
          where: { organizationId, registerId, resolvedAt: null },
          data: { resolvedAt: now },
        });
      });

      return undefined;
    },
  );
}

/** Puts cash in or takes it out of an open session's drawer. */
export async function addCashMovement(input: unknown): Promise<ActionResult> {
  return runAction(
    addCashMovementSchema,
    input,
    async ({ sessionId, values }) => {
      const { organizationId, session, access } = await requirePermission({
        pos: ["sell"],
      });

      await prisma.$transaction(async (tx) => {
        const cashSession = await findOperableSession(tx, {
          organizationId,
          sessionId,
          userId: session.user.id,
          permissions: access.permissions,
        });
        const amount = Number(toDecimal(values.amount));

        if (values.type === "OUT") {
          const { expectedCash } = await getCashSessionSummary(
            tx,
            organizationId,
            cashSession,
          );

          if (amount > expectedCash) {
            throw new APIError("BAD_REQUEST", { code: "CASH_NOT_ENOUGH" });
          }
        }

        await tx.cashMovement.create({
          data: {
            organizationId,
            sessionId,
            type: values.type,
            amount,
            reason: values.reason,
            authorId: session.user.id,
          },
        });
      });

      return undefined;
    },
  );
}

/**
 * Closes a session with the cash counted: an optional withdrawal leaves the
 * drawer as a cash movement of the session, then it stores what should have
 * remained, what remained and the difference. The register keeps what
 * remained. Its tickets and payments are locked after.
 */
export async function closeCashSession(input: unknown): Promise<ActionResult> {
  return runAction(
    closeCashSessionSchema,
    input,
    async ({ sessionId, values }) => {
      const { organizationId, session, access } = await requirePermission({
        pos: ["sell"],
      });

      await prisma.$transaction(async (tx) => {
        const cashSession = await findOperableSession(tx, {
          organizationId,
          sessionId,
          userId: session.user.id,
          permissions: access.permissions,
        });
        const { expectedCash } = await getCashSessionSummary(
          tx,
          organizationId,
          cashSession,
        );
        const countedCash = Number(toDecimal(values.countedCash));
        const withdrawn = values.withdraw
          ? Number(toDecimal(values.withdrawAmount))
          : 0;

        if (withdrawn > countedCash) {
          throw new APIError("BAD_REQUEST", {
            code: "CASH_WITHDRAWAL_TOO_HIGH",
          });
        }

        const expectedLeft = roundMoney(expectedCash - withdrawn);
        const left = roundMoney(countedCash - withdrawn);
        const { count } = await tx.cashSession.updateMany({
          where: { id: sessionId, organizationId, status: "OPEN" },
          data: {
            status: "CLOSED",
            closedById: session.user.id,
            closedAt: new Date(),
            expectedCash: expectedLeft,
            countedCash: left,
            difference: roundMoney(left - expectedLeft),
            closingNotes: emptyToNull(values.notes),
          },
        });

        if (count === 0) {
          throw new APIError("CONFLICT", { code: "CASH_SESSION_CLOSED" });
        }
        if (withdrawn > 0) {
          await tx.cashMovement.create({
            data: {
              organizationId,
              sessionId,
              type: "OUT",
              amount: withdrawn,
              reason: CASH_CLOSING_WITHDRAWAL_REASON,
              authorId: session.user.id,
            },
          });
        }

        await lockCashRegister(tx, organizationId, cashSession.registerId);
        await tx.cashRegister.update({
          where: { id: cashSession.registerId },
          data: { cashBalance: left },
        });
      });

      return undefined;
    },
  );
}

const sessionRowSelect = {
  id: true,
  status: true,
  openedAt: true,
  closedAt: true,
  openingAmount: true,
  expectedCash: true,
  countedCash: true,
  difference: true,
  register: { select: { id: true, name: true } },
  openedBy: { select: userSelect },
  closedBy: { select: userSelect },
  _count: {
    select: { documents: { where: { status: { not: "CANCELLED" } } } },
  },
} satisfies Prisma.CashSessionSelect;

function serializeSessionRow({
  openedAt,
  closedAt,
  openingAmount,
  expectedCash,
  countedCash,
  difference,
  _count,
  ...rest
}: Prisma.CashSessionGetPayload<{ select: typeof sessionRowSelect }>) {
  return {
    ...rest,
    openedAt: openedAt.toISOString(),
    closedAt: closedAt?.toISOString() ?? null,
    openingAmount: openingAmount.toNumber(),
    expectedCash: money(expectedCash),
    countedCash: money(countedCash),
    difference: money(difference),
    ticketCount: _count.documents,
  };
}

async function findCashSessions(
  organizationId: string,
  { q, registerId, status, sort, direction, page }: CashSessionListParams,
) {
  const where: Prisma.CashSessionWhereInput = { organizationId };

  if (registerId) where.registerId = registerId;
  if (status) where.status = status;
  if (q) {
    const contains = { contains: q, mode: "insensitive" } as const;

    where.OR = [
      { register: { name: contains } },
      { openedBy: { name: contains } },
      { closedBy: { name: contains } },
      { closingNotes: contains },
    ];
  }

  const total = await prisma.cashSession.count({ where });
  const window = pageWindow(page, POS_LIMITS.sessionsPageSize, total);
  const items = await prisma.cashSession.findMany({
    where,
    // Open sessions have no closing date; they go last either way. `nulls`
    // is only accepted on optional fields.
    orderBy: [
      sort === "closedAt"
        ? { closedAt: { sort: direction, nulls: "last" } }
        : { openedAt: direction },
      { id: "desc" },
    ],
    skip: window.skip,
    take: window.take,
    select: sessionRowSelect,
  });

  return {
    items: items.map(serializeSessionRow),
    total,
    page: window.page,
    pageSize: window.pageSize,
    pageCount: window.pageCount,
  };
}

export type CashSessionList = Awaited<ReturnType<typeof findCashSessions>>;
export type CashSessionRow = CashSessionList["items"][number];

export async function listCashSessions(
  input: unknown,
): Promise<ActionResult<CashSessionList>> {
  return runAction(cashSessionListSchema, input, async (filters) => {
    const { organizationId } = await requirePermission({ pos: ["read"] });

    return findCashSessions(organizationId, filters);
  });
}

async function findCashSession(
  organizationId: string,
  id: string,
  actor: { userId: string; canManage: boolean },
) {
  const session = await prisma.cashSession.findFirst({
    where: { id, organizationId },
    select: { ...sessionRowSelect, openedById: true, closingNotes: true },
  });

  if (!session) {
    throw new APIError("NOT_FOUND", { code: "CASH_SESSION_NOT_FOUND" });
  }

  const [summary, movements, tickets, collected] = await Promise.all([
    getCashSessionSummary(prisma, organizationId, session),
    prisma.cashMovement.findMany({
      where: { organizationId, sessionId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        amount: true,
        reason: true,
        createdAt: true,
        author: { select: userSelect },
      },
    }),
    prisma.salesDocument.findMany({
      where: { organizationId, cashSessionId: id },
      orderBy: { createdAt: "desc" },
      take: POS_LIMITS.sessionRows,
      select: {
        id: true,
        number: true,
        status: true,
        customerName: true,
        total: true,
        createdAt: true,
        payments: {
          where: { amount: { gt: 0 } },
          select: { paymentMethod: { select: { name: true } } },
        },
      },
    }),
    // Invoices of the sales module collected at this till.
    prisma.salesPayment.findMany({
      where: {
        organizationId,
        cashSessionId: id,
        document: { channel: "BACKOFFICE" },
      },
      orderBy: { createdAt: "desc" },
      take: POS_LIMITS.sessionRows,
      select: {
        id: true,
        amount: true,
        createdAt: true,
        paymentMethod: { select: { name: true } },
        document: {
          select: { id: true, number: true, customerName: true },
        },
      },
    }),
  ]);
  const { openedById, closingNotes, ...row } = session;

  return {
    ...serializeSessionRow(row),
    closingNotes,
    canOperate:
      session.status === "OPEN" &&
      (openedById === actor.userId || actor.canManage),
    summary,
    movements: movements.map((movement) => ({
      ...movement,
      amount: movement.amount.toNumber(),
      createdAt: movement.createdAt.toISOString(),
    })),
    tickets: tickets.map(({ payments, total, createdAt, ...ticket }) => ({
      ...ticket,
      total: total.toNumber(),
      createdAt: createdAt.toISOString(),
      methods: [...new Set(payments.map((p) => p.paymentMethod.name))],
    })),
    collected: collected.map((payment) => ({
      ...payment,
      amount: payment.amount.toNumber(),
      createdAt: payment.createdAt.toISOString(),
      method: payment.paymentMethod.name,
    })),
  };
}

export type CashSessionDetail = Awaited<ReturnType<typeof findCashSession>>;

export async function getCashSession(
  id: unknown,
): Promise<ActionResult<CashSessionDetail>> {
  return runAction(idField, id, async (sessionId) => {
    const { organizationId, session, access } = await requirePermission({
      pos: ["read"],
    });

    return findCashSession(organizationId, sessionId, {
      userId: session.user.id,
      canManage: includesPermissions(access.permissions, { pos: ["manage"] }),
    });
  });
}

export type CashRegisterItem = Awaited<
  ReturnType<typeof findCashRegisters>
>[number];

async function findCashRegisters(organizationId: string, id?: string) {
  const registers = await prisma.cashRegister.findMany({
    where: { organizationId, ...(id ? { id } : {}) },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
      cashBalance: true,
      _count: {
        select: {
          sessions: true,
          movements: true,
          discrepancyReports: { where: { resolvedAt: null } },
        },
      },
      sessions: {
        where: { status: "OPEN" },
        select: { id: true, openedAt: true, openedBy: { select: userSelect } },
      },
    },
  });

  return registers.map(({ _count, sessions, cashBalance, ...register }) => ({
    ...register,
    cashBalance: cashBalance.toNumber(),
    sessionCount: _count.sessions,
    movementCount: _count.movements,
    pendingDiscrepancies: _count.discrepancyReports,
    openSession: sessions[0]
      ? { ...sessions[0], openedAt: sessions[0].openedAt.toISOString() }
      : null,
  }));
}

/**
 * One page of the registers, searched and sorted on the server. Registers
 * have a hard limit, so the page is cut in memory. Also returns how many
 * exist and the ones with pending reported differences, whatever the search.
 */
export async function listCashRegisters(input: unknown): Promise<
  ActionResult<
    Page<CashRegisterItem> & {
      registerCount: number;
      withDiscrepancies: { id: string; name: string }[];
    }
  >
> {
  return runAction(cashRegisterListSchema, input, async (params) => {
    const { organizationId } = await requirePermission({ pos: ["read"] });
    const registers = await findCashRegisters(organizationId);
    const page = paginateInMemory(registers, {
      q: params.q,
      searchText: (register) => [
        register.name,
        register.openSession?.openedBy?.name,
      ],
      sortValue: (register) => register[params.sort],
      direction: params.direction,
      page: params.page,
      pageSize: POS_LIMITS.registersPageSize,
    });

    return {
      ...page,
      registerCount: registers.length,
      withDiscrepancies: registers
        .filter((register) => register.pendingDiscrepancies > 0)
        .map(({ id, name }) => ({ id, name })),
    };
  });
}

/** A register with its balance, who has it open and its pending reports. */
export async function getCashRegister(
  id: unknown,
): Promise<ActionResult<CashRegisterItem>> {
  return runAction(idField, id, async (registerId) => {
    const { organizationId } = await requirePermission({ pos: ["read"] });
    const [register] = await findCashRegisters(organizationId, registerId);

    if (!register) {
      throw new APIError("NOT_FOUND", { code: "INVALID_CASH_REGISTER" });
    }

    return register;
  });
}

async function assertRegisterInOrganization(
  organizationId: string,
  registerId: string,
) {
  const count = await prisma.cashRegister.count({
    where: { id: registerId, organizationId },
  });

  if (count === 0) {
    throw new APIError("NOT_FOUND", { code: "INVALID_CASH_REGISTER" });
  }
}

async function findCashRegisterMovements(
  organizationId: string,
  {
    registerId,
    q,
    types,
    authorId,
    sort,
    direction,
    page,
  }: CashRegisterMovementListParams,
) {
  const where: Prisma.CashRegisterMovementWhereInput = {
    organizationId,
    registerId,
  };

  if (types.length) where.type = { in: types };
  if (authorId) where.authorId = authorId;
  if (q) {
    const contains = { contains: q, mode: "insensitive" } as const;

    where.OR = [{ reason: contains }, { author: { name: contains } }];
  }

  const total = await prisma.cashRegisterMovement.count({ where });
  const window = pageWindow(page, POS_LIMITS.registerHistoryPageSize, total);
  const movements = await prisma.cashRegisterMovement.findMany({
    where,
    // The id keeps the order stable when values are equal.
    orderBy: [{ [sort]: direction }, { id: "desc" }],
    skip: window.skip,
    take: window.take,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      reason: true,
      createdAt: true,
      author: { select: userSelect },
    },
  });

  return {
    items: movements.map((movement) => ({
      ...movement,
      amount: movement.amount.toNumber(),
      balanceAfter: movement.balanceAfter.toNumber(),
      createdAt: movement.createdAt.toISOString(),
    })),
    total,
    page: window.page,
    pageSize: window.pageSize,
    pageCount: window.pageCount,
  };
}

export type CashRegisterMovementPage = Awaited<
  ReturnType<typeof findCashRegisterMovements>
>;
export type CashRegisterMovementItem =
  CashRegisterMovementPage["items"][number];

/** One page of the movements of a register. */
export async function listCashRegisterMovements(
  input: unknown,
): Promise<ActionResult<CashRegisterMovementPage>> {
  return runAction(cashRegisterMovementListSchema, input, async (params) => {
    const { organizationId } = await requirePermission({ pos: ["read"] });

    await assertRegisterInOrganization(organizationId, params.registerId);

    return findCashRegisterMovements(organizationId, params);
  });
}

async function findCashDiscrepancyReports(
  organizationId: string,
  {
    registerId,
    q,
    status,
    authorId,
    sort,
    direction,
    page,
  }: CashDiscrepancyReportListParams,
) {
  const where: Prisma.CashDiscrepancyReportWhereInput = {
    organizationId,
    registerId,
  };

  if (status === "PENDING") where.resolvedAt = null;
  if (status === "RESOLVED") where.resolvedAt = { not: null };
  if (authorId) where.authorId = authorId;
  if (q) {
    const contains = { contains: q, mode: "insensitive" } as const;

    where.OR = [{ reason: contains }, { author: { name: contains } }];
  }

  const total = await prisma.cashDiscrepancyReport.count({ where });
  const window = pageWindow(page, POS_LIMITS.registerHistoryPageSize, total);
  const reports = await prisma.cashDiscrepancyReport.findMany({
    where,
    orderBy: [{ [sort]: direction }, { id: "desc" }],
    skip: window.skip,
    take: window.take,
    select: {
      id: true,
      expectedAmount: true,
      countedAmount: true,
      reason: true,
      resolvedAt: true,
      createdAt: true,
      author: { select: userSelect },
    },
  });

  return {
    items: reports.map(
      ({
        expectedAmount,
        countedAmount,
        resolvedAt,
        createdAt,
        ...report
      }) => ({
        ...report,
        expectedAmount: expectedAmount.toNumber(),
        countedAmount: countedAmount.toNumber(),
        difference: roundMoney(
          countedAmount.toNumber() - expectedAmount.toNumber(),
        ),
        resolvedAt: resolvedAt?.toISOString() ?? null,
        createdAt: createdAt.toISOString(),
      }),
    ),
    total,
    page: window.page,
    pageSize: window.pageSize,
    pageCount: window.pageCount,
  };
}

export type CashDiscrepancyReportPage = Awaited<
  ReturnType<typeof findCashDiscrepancyReports>
>;
export type CashDiscrepancyReportItem =
  CashDiscrepancyReportPage["items"][number];

/** One page of the differences reported at the opening of a register. */
export async function listCashDiscrepancyReports(
  input: unknown,
): Promise<ActionResult<CashDiscrepancyReportPage>> {
  return runAction(cashDiscrepancyReportListSchema, input, async (params) => {
    const { organizationId } = await requirePermission({ pos: ["read"] });

    await assertRegisterInOrganization(organizationId, params.registerId);

    return findCashDiscrepancyReports(organizationId, params);
  });
}

/** Translates the unique register name into a readable error. */
async function withRegisterName<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new APIError("BAD_REQUEST", { code: "CASH_REGISTER_NAME_TAKEN" });
    }
    throw error;
  }
}

export async function createCashRegister(
  input: unknown,
): Promise<ActionResult> {
  return runAction(cashRegisterFormSchema, input, async (values) => {
    const { organizationId } = await requirePermission({ pos: ["manage"] });

    if (
      (await prisma.cashRegister.count({ where: { organizationId } })) >=
      POS_LIMITS.maxRegisters
    ) {
      throw new APIError("BAD_REQUEST", { code: "TOO_MANY_CASH_REGISTERS" });
    }

    await withRegisterName(() =>
      prisma.cashRegister.create({ data: { ...values, organizationId } }),
    );

    return undefined;
  });
}

export async function updateCashRegister(
  input: unknown,
): Promise<ActionResult> {
  return runAction(updateCashRegisterSchema, input, async ({ id, values }) => {
    const { organizationId } = await requirePermission({ pos: ["manage"] });

    await withRegisterName(() =>
      prisma.$transaction(async (tx) => {
        const register = await tx.cashRegister.findFirst({
          where: { id, organizationId },
          select: {
            _count: { select: { sessions: { where: { status: "OPEN" } } } },
          },
        });

        if (!register) {
          throw new APIError("NOT_FOUND", { code: "INVALID_CASH_REGISTER" });
        }
        if (!values.isActive && register._count.sessions > 0) {
          throw new APIError("BAD_REQUEST", { code: "CASH_REGISTER_OPEN" });
        }

        await tx.cashRegister.update({ where: { id }, data: values });
      }),
    );

    return undefined;
  });
}

/**
 * Only registers never opened nor moved can be deleted; the others are
 * deactivated so their history stays.
 */
export async function deleteCashRegister(id: unknown): Promise<ActionResult> {
  return runAction(idField, id, async (registerId) => {
    const { organizationId } = await requirePermission({ pos: ["manage"] });

    await prisma.$transaction(async (tx) => {
      const register = await tx.cashRegister.findFirst({
        where: { id: registerId, organizationId },
        select: {
          _count: { select: { sessions: true, movements: true } },
        },
      });

      if (!register) {
        throw new APIError("NOT_FOUND", { code: "INVALID_CASH_REGISTER" });
      }
      if (register._count.sessions > 0) {
        throw new APIError("BAD_REQUEST", {
          code: "CASH_REGISTER_HAS_SESSIONS",
        });
      }
      if (register._count.movements > 0) {
        throw new APIError("BAD_REQUEST", {
          code: "CASH_REGISTER_HAS_MOVEMENTS",
        });
      }

      await tx.cashRegister.delete({ where: { id: registerId } });
    });

    return undefined;
  });
}

/** Point of sale settings of the active organization, readable by any member. */
export async function getPosSettingsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof getPosSettings>>>
> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await getActorContext();

    return getPosSettings(organizationId);
  });
}

export async function updatePosSettings(input: unknown): Promise<ActionResult> {
  return runAction(posSettingsSchema, input, async (values) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });
    const { prefixes } = await getSalesSettings(organizationId);

    // Tickets are invoices too; their numbers must not collide.
    if (values.ticketPrefix === prefixes.INVOICE) {
      throw new APIError("BAD_REQUEST", { code: "SALES_PREFIX_IN_USE" });
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        posTicketPrefix: values.ticketPrefix,
        posWalkInCustomerName: values.walkInCustomerName,
      },
    });

    return undefined;
  });
}
