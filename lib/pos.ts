import "server-only";

import type { Permissions } from "@/lib/permissions";

import { APIError } from "better-auth/api";

import { Prisma } from "@/lib/generated/prisma/client";
import { includesPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/sales-math";

// Every query here is scoped by an organization id that the caller derives
// from the session; none of these functions accept it from the client.

type Db = Prisma.TransactionClient | typeof prisma;

/** Point of sale settings of the organization. */
export async function getPosSettings(organizationId: string, db: Db = prisma) {
  const organization = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { posTicketPrefix: true, posWalkInCustomerName: true },
  });

  return {
    ticketPrefix: organization.posTicketPrefix,
    walkInCustomerName: organization.posWalkInCustomerName,
  };
}

/** The session the user has open in the organization, if any. */
export function findOpenCashSession(
  db: Db,
  organizationId: string,
  userId: string,
) {
  return db.cashSession.findFirst({
    where: { organizationId, openedById: userId, status: "OPEN" },
    select: {
      id: true,
      registerId: true,
      openingAmount: true,
      openedAt: true,
      register: { select: { name: true } },
    },
  });
}

/**
 * The user's open session, locked until the transaction ends so it cannot be
 * closed while a sale or payment goes into it.
 */
export async function lockOpenCashSession(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
) {
  // FOR UPDATE re-checks the status after waiting for a concurrent closing.
  await tx.$queryRaw`
    SELECT id FROM "cash_session"
    WHERE "organizationId" = ${organizationId} AND "openedById" = ${userId}
      AND "status" = 'OPEN'
    FOR UPDATE
  `;

  return findOpenCashSession(tx, organizationId, userId);
}

/**
 * Loads a session of the organization that is still open and that the actor
 * may operate: the person who opened it, or someone with `pos:manage`. The
 * row stays locked until the transaction ends, so movements, voids and the
 * closing of one session run one after another.
 */
export async function findOperableSession(
  db: Prisma.TransactionClient,
  {
    organizationId,
    sessionId,
    userId,
    permissions,
  }: {
    organizationId: string;
    sessionId: string;
    userId: string;
    permissions: Permissions;
  },
) {
  await db.$queryRaw`
    SELECT id FROM "cash_session"
    WHERE id = ${sessionId} AND "organizationId" = ${organizationId}
    FOR UPDATE
  `;

  const session = await db.cashSession.findFirst({
    where: { id: sessionId, organizationId },
    select: { id: true, status: true, openedById: true, openingAmount: true },
  });

  if (!session) {
    throw new APIError("NOT_FOUND", { code: "CASH_SESSION_NOT_FOUND" });
  }
  if (session.status !== "OPEN") {
    throw new APIError("BAD_REQUEST", { code: "CASH_SESSION_CLOSED" });
  }
  if (
    session.openedById !== userId &&
    !includesPermissions(permissions, { pos: ["manage"] })
  ) {
    throw new APIError("FORBIDDEN", { code: "CASH_SESSION_NOT_YOURS" });
  }

  return session;
}

/**
 * What a session has taken by payment method, its manual cash movements and
 * the cash that should be in the drawer: opening + cash payments (refunds are
 * negative) + entries − withdrawals.
 */
export async function getCashSessionSummary(
  db: Db,
  organizationId: string,
  session: { id: string; openingAmount: Prisma.Decimal },
) {
  const where = { organizationId, cashSessionId: session.id };
  // One after another: `db` may be an interactive transaction, which runs a
  // single query at a time.
  const byMethod = await db.salesPayment.groupBy({
    by: ["paymentMethodId"],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });
  const movements = await db.cashMovement.groupBy({
    by: ["type"],
    where: { organizationId, sessionId: session.id },
    _sum: { amount: true },
  });
  const tickets = await db.salesDocument.groupBy({
    by: ["status"],
    where,
    _sum: { total: true },
    _count: { _all: true },
  });
  const methods = await db.paymentMethod.findMany({
    where: {
      organizationId,
      id: { in: byMethod.map((row) => row.paymentMethodId) },
    },
    orderBy: { position: "asc" },
    select: { id: true, name: true, kind: true },
  });
  const amountOf = (id: string) =>
    byMethod
      .find((row) => row.paymentMethodId === id)
      ?._sum.amount?.toNumber() ?? 0;
  const payments = methods.map((method) => ({
    ...method,
    amount: amountOf(method.id),
  }));
  const cashPayments = roundMoney(
    payments
      .filter((method) => method.kind === "CASH")
      .reduce((sum, method) => sum + method.amount, 0),
  );
  const movementOf = (type: "IN" | "OUT") =>
    movements.find((row) => row.type === type)?._sum.amount?.toNumber() ?? 0;
  const cashIn = movementOf("IN");
  const cashOut = movementOf("OUT");
  const sold = tickets.filter((row) => row.status !== "CANCELLED");
  const voided = tickets.find((row) => row.status === "CANCELLED");
  const openingAmount = session.openingAmount.toNumber();

  return {
    openingAmount,
    payments,
    totalCollected: roundMoney(
      payments.reduce((sum, method) => sum + method.amount, 0),
    ),
    cashPayments,
    cashIn,
    cashOut,
    expectedCash: roundMoney(openingAmount + cashPayments + cashIn - cashOut),
    ticketCount: sold.reduce((sum, row) => sum + row._count._all, 0),
    ticketTotal: roundMoney(
      sold.reduce((sum, row) => sum + (row._sum.total?.toNumber() ?? 0), 0),
    ),
    voidedCount: voided?._count._all ?? 0,
  };
}

export type CashSessionSummary = Awaited<
  ReturnType<typeof getCashSessionSummary>
>;
