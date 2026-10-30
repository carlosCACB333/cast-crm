import "server-only";

import type {
  CustomerFormValues,
  CustomerListFilters,
} from "@/lib/validations/customers";

import { APIError } from "better-auth/api";

import { Prisma } from "@/lib/generated/prisma/client";
import { hasMembership } from "@/lib/organization";
import { prisma } from "@/lib/prisma";
import { emptyToNull, normalizeTags } from "@/lib/validations/fields";

// Every query here is scoped by an organization id that the caller derives
// from the session; none of these functions accept it from the client.

export const statusSelect = {
  id: true,
  label: true,
  color: true,
} satisfies Prisma.CustomerStatusSelect;

const userSelect = {
  id: true,
  name: true,
  image: true,
} satisfies Prisma.UserSelect;

export const customerListSelect = {
  id: true,
  type: true,
  name: true,
  companyName: true,
  jobTitle: true,
  email: true,
  phone: true,
  city: true,
  country: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  status: { select: statusSelect },
  owner: { select: userSelect },
} satisfies Prisma.CustomerSelect;

export const customerDetailSelect = {
  ...customerListSelect,
  website: true,
  taxId: true,
  address: true,
  region: true,
  postalCode: true,
  createdBy: { select: userSelect },
  _count: { select: { notes: true } },
} satisfies Prisma.CustomerSelect;

export function buildCustomerWhere(
  organizationId: string,
  userId: string,
  filters: CustomerListFilters,
  { ignoreStatus = false } = {},
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { organizationId };
  const { q, statusId, type, ownerId, tag } = filters;

  if (q) {
    const contains = { contains: q, mode: "insensitive" } as const;

    where.OR = [
      { name: contains },
      { email: contains },
      { phone: contains },
      { companyName: contains },
      { taxId: contains },
      { city: contains },
    ];
  }
  if (statusId && !ignoreStatus) {
    where.statusId = statusId === "none" ? null : statusId;
  }
  if (type) where.type = type;
  if (ownerId) {
    where.ownerId =
      ownerId === "me" ? userId : ownerId === "none" ? null : ownerId;
  }
  if (tag) where.tags = { has: tag };

  return where;
}

export function customerOrderBy(
  filters: CustomerListFilters,
): Prisma.CustomerOrderByWithRelationInput[] {
  // The id makes the order stable across pages when values are equal.
  return [{ [filters.sort]: filters.direction }, { id: "asc" }];
}

function normalizeWebsite(value: string) {
  if (!value) return null;

  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * Turns validated form values into database data, checking that the status
 * and owner belong to the organization.
 */
export async function toCustomerData(
  organizationId: string,
  values: CustomerFormValues,
) {
  const isPerson = values.type === "PERSON";
  let statusId = emptyToNull(values.statusId);
  // "none" is the explicit "unassigned" option of the owner select.
  const ownerId =
    values.ownerId === "none" ? null : emptyToNull(values.ownerId);

  if (statusId) {
    const status = await prisma.customerStatus.findFirst({
      where: { id: statusId, organizationId },
      select: { id: true },
    });

    if (!status) {
      throw new APIError("BAD_REQUEST", { code: "INVALID_CUSTOMER_STATUS" });
    }
  } else {
    const first = await prisma.customerStatus.findFirst({
      where: { organizationId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    statusId = first?.id ?? null;
  }

  if (ownerId && !(await hasMembership(ownerId, organizationId))) {
    throw new APIError("BAD_REQUEST", { code: "INVALID_CUSTOMER_OWNER" });
  }

  return {
    type: values.type,
    name: values.name,
    companyName: isPerson ? emptyToNull(values.companyName) : null,
    jobTitle: isPerson ? emptyToNull(values.jobTitle) : null,
    email: emptyToNull(values.email.toLowerCase()),
    phone: emptyToNull(values.phone),
    website: normalizeWebsite(values.website),
    taxId: emptyToNull(values.taxId),
    address: emptyToNull(values.address),
    city: emptyToNull(values.city),
    region: emptyToNull(values.region),
    postalCode: emptyToNull(values.postalCode),
    country: emptyToNull(values.country),
    tags: normalizeTags(values.tags),
    statusId,
    ownerId,
  };
}

/** Translates the unique email constraint into a readable error. */
export async function withEmailConstraint<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new APIError("BAD_REQUEST", { code: "CUSTOMER_EMAIL_TAKEN" });
    }
    throw error;
  }
}

/** Throws NOT_FOUND unless the customer exists in the organization. */
export async function assertCustomerInOrganization(
  organizationId: string,
  customerId: string,
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { id: true },
  });

  if (!customer)
    throw new APIError("NOT_FOUND", { code: "CUSTOMER_NOT_FOUND" });
}
