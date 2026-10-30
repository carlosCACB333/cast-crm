"use server";

import { APIError } from "better-auth/api";

import { requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { SERVICE_LIMITS } from "@/config/services";
import { prisma } from "@/lib/prisma";
import {
  assertServiceInOrganization,
  buildServiceWhere,
  getServiceSummary,
  serializeService,
  serviceDetailSelect,
  serviceListSelect,
  serviceOrderBy,
  toServiceData,
  withCodeConstraint,
} from "@/lib/services";
import {
  type ServiceListFilters,
  serviceFormSchema,
  serviceIdSchema,
  serviceListSchema,
  setServiceActiveSchema,
  updateServiceSchema,
} from "@/lib/validations/services";

// Every action derives the organization from the session and checks the
// `service:*` permission of the caller's role before touching data.

async function findServiceList(
  organizationId: string,
  filters: ServiceListFilters,
) {
  const where = buildServiceWhere(organizationId, filters);
  const pageSize = SERVICE_LIMITS.pageSize;

  const [items, total] = await prisma.$transaction([
    prisma.service.findMany({
      where,
      orderBy: serviceOrderBy(filters),
      skip: (filters.page - 1) * pageSize,
      take: pageSize,
      select: serviceListSelect,
    }),
    prisma.service.count({ where }),
  ]);

  return {
    items: items.map(serializeService),
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    summary: await getServiceSummary(organizationId),
  };
}

export type ServiceList = Awaited<ReturnType<typeof findServiceList>>;
export type ServiceListItem = ServiceList["items"][number];

export async function listServices(
  input: unknown,
): Promise<ActionResult<ServiceList>> {
  return runAction(serviceListSchema, input, async (filters) => {
    const { organizationId } = await requirePermission({ service: ["read"] });

    return findServiceList(organizationId, filters);
  });
}

async function findService(organizationId: string, id: string) {
  const service = await prisma.service.findFirst({
    where: { id, organizationId },
    select: serviceDetailSelect,
  });

  if (!service) throw new APIError("NOT_FOUND", { code: "SERVICE_NOT_FOUND" });

  return serializeService(service);
}

export type ServiceDetail = Awaited<ReturnType<typeof findService>>;

export async function getService(
  id: unknown,
): Promise<ActionResult<ServiceDetail>> {
  return runAction(serviceIdSchema, id, async (serviceId) => {
    const { organizationId } = await requirePermission({ service: ["read"] });

    return findService(organizationId, serviceId);
  });
}

export async function createService(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(serviceFormSchema, input, async (values) => {
    const { organizationId, session } = await requirePermission({
      service: ["create"],
    });
    const data = await toServiceData(organizationId, values);

    return withCodeConstraint(() =>
      prisma.service.create({
        data: { ...data, organizationId, createdById: session.user.id },
        select: { id: true },
      }),
    );
  });
}

export async function updateService(input: unknown): Promise<ActionResult> {
  return runAction(updateServiceSchema, input, async ({ id, values }) => {
    const { organizationId } = await requirePermission({
      service: ["update"],
    });

    await assertServiceInOrganization(organizationId, id);
    const data = await toServiceData(organizationId, values);

    await withCodeConstraint(() =>
      prisma.service.update({ where: { id }, data, select: { id: true } }),
    );

    return undefined;
  });
}

/** Quick activation from the list or the detail page. */
export async function setServiceActive(input: unknown): Promise<ActionResult> {
  return runAction(setServiceActiveSchema, input, async ({ id, isActive }) => {
    const { organizationId } = await requirePermission({
      service: ["update"],
    });
    const { count } = await prisma.service.updateMany({
      where: { id, organizationId },
      data: { isActive },
    });

    if (count === 0) {
      throw new APIError("NOT_FOUND", { code: "SERVICE_NOT_FOUND" });
    }

    return undefined;
  });
}

/** Copies a service without its unique code. */
export async function duplicateService(
  id: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(serviceIdSchema, id, async (serviceId) => {
    const { organizationId, session } = await requirePermission({
      service: ["create"],
    });
    const source = await prisma.service.findFirst({
      where: { id: serviceId, organizationId },
      select: {
        name: true,
        description: true,
        categoryId: true,
        unit: true,
        price: true,
        cost: true,
        taxRate: true,
        durationMinutes: true,
        tags: true,
      },
    });

    if (!source) {
      throw new APIError("NOT_FOUND", { code: "SERVICE_NOT_FOUND" });
    }

    return prisma.service.create({
      data: {
        ...source,
        name: `${source.name} (copia)`.slice(0, 150),
        organizationId,
        createdById: session.user.id,
      },
      select: { id: true },
    });
  });
}

export async function deleteService(id: unknown): Promise<ActionResult> {
  return runAction(serviceIdSchema, id, async (serviceId) => {
    const { organizationId } = await requirePermission({
      service: ["delete"],
    });
    const { count } = await prisma.service.deleteMany({
      where: { id: serviceId, organizationId },
    });

    if (count === 0) {
      throw new APIError("NOT_FOUND", { code: "SERVICE_NOT_FOUND" });
    }

    return undefined;
  });
}

export interface ServiceExportRow {
  name: string;
  code: string | null;
  category: string | null;
  description: string | null;
  unit: string;
  price: number;
  taxRate: number | null;
  cost: number | null;
  durationMinutes: number | null;
  isActive: boolean;
  tags: string[];
  createdAt: string;
}

/** Services matching the list filters, for a CSV built in the browser. */
export async function exportServices(
  input: unknown,
): Promise<ActionResult<{ rows: ServiceExportRow[]; isTruncated: boolean }>> {
  return runAction(serviceListSchema, input, async (filters) => {
    const { organizationId } = await requirePermission({ service: ["read"] });
    const limit = SERVICE_LIMITS.exportRows;
    const services = await prisma.service.findMany({
      where: buildServiceWhere(organizationId, filters),
      orderBy: serviceOrderBy(filters),
      take: limit + 1,
      select: {
        name: true,
        code: true,
        description: true,
        unit: true,
        price: true,
        taxRate: true,
        cost: true,
        durationMinutes: true,
        isActive: true,
        tags: true,
        createdAt: true,
        category: { select: { name: true } },
      },
    });

    return {
      isTruncated: services.length > limit,
      rows: services.slice(0, limit).map(({ category, ...item }) => ({
        ...item,
        category: category?.name ?? null,
        price: item.price.toNumber(),
        taxRate: item.taxRate?.toNumber() ?? null,
        cost: item.cost?.toNumber() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  });
}
