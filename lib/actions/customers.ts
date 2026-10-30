"use server";

import { APIError } from "better-auth/api";

import { requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { CUSTOMER_LIMITS } from "@/config/customers";
import {
  assertCustomerInOrganization,
  buildCustomerWhere,
  customerDetailSelect,
  customerListSelect,
  customerOrderBy,
  toCustomerData,
  withEmailConstraint,
} from "@/lib/customers";
import { includesPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  type CustomerListFilters,
  customerFormSchema,
  customerIdSchema,
  customerListSchema,
  customerNoteSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
} from "@/lib/validations/customers";

// Every action derives the organization from the session and checks the
// `customer:*` permission of the caller's role before touching data.

function serializeDates<T extends { createdAt: Date; updatedAt: Date }>(
  item: T,
): Omit<T, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
} {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function findCustomerList(
  organizationId: string,
  userId: string,
  filters: CustomerListFilters,
) {
  const where = buildCustomerWhere(organizationId, userId, filters);
  const pageSize = CUSTOMER_LIMITS.pageSize;

  const [items, total, byStatus] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      orderBy: customerOrderBy(filters),
      skip: (filters.page - 1) * pageSize,
      take: pageSize,
      select: customerListSelect,
    }),
    prisma.customer.count({ where }),
    prisma.customer.groupBy({
      by: ["statusId"],
      where: buildCustomerWhere(organizationId, userId, filters, {
        ignoreStatus: true,
      }),
      orderBy: { statusId: "asc" },
      _count: { _all: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  let allCount = 0;

  for (const row of byStatus) {
    const count = typeof row._count === "object" ? (row._count._all ?? 0) : 0;

    statusCounts[row.statusId ?? "none"] = count;
    allCount += count;
  }

  return {
    items: items.map(serializeDates),
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    statusCounts,
    allCount,
  };
}

export type CustomerList = Awaited<ReturnType<typeof findCustomerList>>;
export type CustomerListItem = CustomerList["items"][number];

export async function listCustomers(
  input: unknown,
): Promise<ActionResult<CustomerList>> {
  return runAction(customerListSchema, input, async (filters) => {
    const { organizationId, session } = await requirePermission({
      customer: ["read"],
    });

    return findCustomerList(organizationId, session.user.id, filters);
  });
}

async function findCustomer(organizationId: string, id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, organizationId },
    select: customerDetailSelect,
  });

  if (!customer)
    throw new APIError("NOT_FOUND", { code: "CUSTOMER_NOT_FOUND" });

  return serializeDates(customer);
}

export type CustomerDetail = Awaited<ReturnType<typeof findCustomer>>;

export async function getCustomer(
  id: unknown,
): Promise<ActionResult<CustomerDetail>> {
  return runAction(customerIdSchema, id, async (customerId) => {
    const { organizationId } = await requirePermission({ customer: ["read"] });

    return findCustomer(organizationId, customerId);
  });
}

export async function createCustomer(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(customerFormSchema, input, async (values) => {
    const { organizationId, session } = await requirePermission({
      customer: ["create"],
    });
    const data = await toCustomerData(organizationId, values);

    return withEmailConstraint(() =>
      prisma.customer.create({
        data: { ...data, organizationId, createdById: session.user.id },
        select: { id: true },
      }),
    );
  });
}

export async function updateCustomer(input: unknown): Promise<ActionResult> {
  return runAction(updateCustomerSchema, input, async ({ id, values }) => {
    const { organizationId } = await requirePermission({
      customer: ["update"],
    });

    await assertCustomerInOrganization(organizationId, id);
    const data = await toCustomerData(organizationId, values);

    await withEmailConstraint(() =>
      prisma.customer.update({ where: { id }, data, select: { id: true } }),
    );

    return undefined;
  });
}

/** Quick status change from the list or the detail page. */
export async function updateCustomerStatus(
  input: unknown,
): Promise<ActionResult> {
  return runAction(
    updateCustomerStatusSchema,
    input,
    async ({ id, statusId }) => {
      const { organizationId } = await requirePermission({
        customer: ["update"],
      });
      const status = await prisma.customerStatus.findFirst({
        where: { id: statusId, organizationId },
        select: { id: true },
      });

      if (!status) {
        throw new APIError("BAD_REQUEST", { code: "INVALID_CUSTOMER_STATUS" });
      }

      const { count } = await prisma.customer.updateMany({
        where: { id, organizationId },
        data: { statusId },
      });

      if (count === 0) {
        throw new APIError("NOT_FOUND", { code: "CUSTOMER_NOT_FOUND" });
      }

      return undefined;
    },
  );
}

export async function deleteCustomer(id: unknown): Promise<ActionResult> {
  return runAction(customerIdSchema, id, async (customerId) => {
    const { organizationId } = await requirePermission({
      customer: ["delete"],
    });
    const { count } = await prisma.customer.deleteMany({
      where: { id: customerId, organizationId },
    });

    if (count === 0) {
      throw new APIError("NOT_FOUND", { code: "CUSTOMER_NOT_FOUND" });
    }

    return undefined;
  });
}

export interface CustomerExportRow {
  type: string;
  name: string;
  companyName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  status: string | null;
  owner: string | null;
  tags: string[];
  createdAt: string;
}

/** Customers matching the list filters, for a CSV built in the browser. */
export async function exportCustomers(
  input: unknown,
): Promise<ActionResult<{ rows: CustomerExportRow[]; isTruncated: boolean }>> {
  return runAction(customerListSchema, input, async (filters) => {
    const { organizationId, session } = await requirePermission({
      customer: ["read"],
    });
    const where = buildCustomerWhere(organizationId, session.user.id, filters);
    const limit = CUSTOMER_LIMITS.exportRows;
    const customers = await prisma.customer.findMany({
      where,
      orderBy: customerOrderBy(filters),
      take: limit + 1,
      select: {
        type: true,
        name: true,
        companyName: true,
        jobTitle: true,
        email: true,
        phone: true,
        website: true,
        taxId: true,
        address: true,
        city: true,
        region: true,
        postalCode: true,
        country: true,
        tags: true,
        createdAt: true,
        status: { select: { label: true } },
        owner: { select: { name: true } },
      },
    });

    return {
      isTruncated: customers.length > limit,
      rows: customers.slice(0, limit).map(({ status, owner, ...item }) => ({
        ...item,
        status: status?.label ?? null,
        owner: owner?.name ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  });
}

async function findNotes(
  organizationId: string,
  customerId: string,
  userId: string,
  canDeleteAny: boolean,
) {
  const notes = await prisma.customerNote.findMany({
    where: { customerId, organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      body: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true, image: true } },
    },
  });

  return notes.map((note) => ({
    ...serializeDates(note),
    canDelete: canDeleteAny || note.author?.id === userId,
  }));
}

export type CustomerNoteItem = Awaited<ReturnType<typeof findNotes>>[number];

export async function listCustomerNotes(
  customerId: unknown,
): Promise<ActionResult<CustomerNoteItem[]>> {
  return runAction(customerIdSchema, customerId, async (id) => {
    const { organizationId, session, access } = await requirePermission({
      customer: ["read"],
    });

    await assertCustomerInOrganization(organizationId, id);

    return findNotes(
      organizationId,
      id,
      session.user.id,
      includesPermissions(access.permissions, { customer: ["delete"] }),
    );
  });
}

export async function addCustomerNote(input: unknown): Promise<ActionResult> {
  return runAction(customerNoteSchema, input, async ({ customerId, body }) => {
    const { organizationId, session } = await requirePermission({
      customer: ["update"],
    });

    await assertCustomerInOrganization(organizationId, customerId);
    await prisma.$transaction([
      prisma.customerNote.create({
        data: { organizationId, customerId, body, authorId: session.user.id },
      }),
      // Recent activity moves the customer up in the "last updated" order.
      prisma.customer.update({
        where: { id: customerId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return undefined;
  });
}

/** Authors can delete their own notes; `customer:delete` can delete any note. */
export async function deleteCustomerNote(id: unknown): Promise<ActionResult> {
  return runAction(customerIdSchema, id, async (noteId) => {
    const { organizationId, session, access } = await requirePermission({
      customer: ["read"],
    });
    const canDeleteAny = includesPermissions(access.permissions, {
      customer: ["delete"],
    });
    const { count } = await prisma.customerNote.deleteMany({
      where: {
        id: noteId,
        organizationId,
        ...(canDeleteAny ? {} : { authorId: session.user.id }),
      },
    });

    if (count === 0)
      throw new APIError("NOT_FOUND", { code: "NOTE_NOT_FOUND" });

    return undefined;
  });
}
