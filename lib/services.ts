import "server-only";

import type {
  ServiceFormValues,
  ServiceListFilters,
} from "@/lib/validations/services";

import { APIError } from "better-auth/api";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  emptyToNull,
  normalizeTags,
  toDecimal,
} from "@/lib/validations/fields";

// Every query here is scoped by an organization id that the caller derives
// from the session; none of these functions accept it from the client.

export const serviceListSelect = {
  id: true,
  name: true,
  code: true,
  unit: true,
  price: true,
  cost: true,
  taxRate: true,
  durationMinutes: true,
  isActive: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, color: true } },
} satisfies Prisma.ServiceSelect;

export const serviceDetailSelect = {
  ...serviceListSelect,
  description: true,
  createdBy: { select: { id: true, name: true, image: true } },
} satisfies Prisma.ServiceSelect;

type DecimalLike = { toNumber(): number };

/** Makes Prisma values serializable for the client (Decimal, Date). */
export function serializeService<
  T extends {
    price: DecimalLike;
    cost: DecimalLike | null;
    taxRate: DecimalLike | null;
    createdAt: Date;
    updatedAt: Date;
  },
>({ price, cost, taxRate, createdAt, updatedAt, ...rest }: T) {
  return {
    ...rest,
    price: price.toNumber(),
    cost: cost?.toNumber() ?? null,
    taxRate: taxRate?.toNumber() ?? null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export function buildServiceWhere(
  organizationId: string,
  filters: ServiceListFilters,
): Prisma.ServiceWhereInput {
  const where: Prisma.ServiceWhereInput = { organizationId };
  const { q, categoryId, status, tag } = filters;

  if (q) {
    const contains = { contains: q, mode: "insensitive" } as const;

    where.OR = [
      { name: contains },
      { code: contains },
      { description: contains },
    ];
  }
  if (categoryId) {
    where.categoryId = categoryId === "none" ? null : categoryId;
  }
  if (status) where.isActive = status === "active";
  if (tag) where.tags = { has: tag };

  return where;
}

export function serviceOrderBy(
  filters: ServiceListFilters,
): Prisma.ServiceOrderByWithRelationInput[] {
  // The id makes the order stable across pages when values are equal.
  return [{ [filters.sort]: filters.direction }, { id: "asc" }];
}

/** Catalog totals of the organization, independent of the list filters. */
export async function getServiceSummary(organizationId: string) {
  const [total, active, prices] = await prisma.$transaction([
    prisma.service.count({ where: { organizationId } }),
    prisma.service.count({ where: { organizationId, isActive: true } }),
    prisma.service.aggregate({
      where: { organizationId, isActive: true },
      _avg: { price: true },
    }),
  ]);

  return {
    total,
    active,
    averagePrice: prices._avg.price?.toNumber() ?? 0,
  };
}

/**
 * Turns validated form values into database data, checking that the
 * category belongs to the organization.
 */
export async function toServiceData(
  organizationId: string,
  values: ServiceFormValues,
) {
  const categoryId =
    values.categoryId === "none" ? null : emptyToNull(values.categoryId);

  if (categoryId) {
    const category = await prisma.serviceCategory.findFirst({
      where: { id: categoryId, organizationId },
      select: { id: true },
    });

    if (!category) {
      throw new APIError("BAD_REQUEST", { code: "INVALID_SERVICE_CATEGORY" });
    }
  }

  const duration =
    Number(values.durationHours || 0) * 60 +
    Number(values.durationMinutes || 0);

  return {
    name: values.name,
    code: emptyToNull(values.code),
    description: emptyToNull(values.description),
    categoryId,
    tags: normalizeTags(values.tags),
    price: toDecimal(values.price) ?? "0",
    unit: values.unit,
    taxRate: toDecimal(values.taxRate),
    cost: toDecimal(values.cost),
    durationMinutes: duration > 0 ? duration : null,
    isActive: values.isActive,
  };
}

/** Translates the unique code constraint into a readable error. */
export async function withCodeConstraint<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new APIError("BAD_REQUEST", { code: "SERVICE_CODE_TAKEN" });
    }
    throw error;
  }
}

/** Throws NOT_FOUND unless the service exists in the organization. */
export async function assertServiceInOrganization(
  organizationId: string,
  serviceId: string,
) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, organizationId },
    select: { id: true },
  });

  if (!service) throw new APIError("NOT_FOUND", { code: "SERVICE_NOT_FOUND" });
}
