"use server";

import { APIError } from "better-auth/api";
import { z } from "zod";

import { getActorContext, requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { CUSTOMER_LIMITS } from "@/config/customers";
import { prisma } from "@/lib/prisma";
import {
  customerIdSchema,
  customerStatusFormSchema,
  moveCustomerStatusSchema,
  updateCustomerStatusDefinitionSchema,
} from "@/lib/validations/customers";

// Statuses are organization configuration: any member can read them, and
// changing them requires `organization:update`.

async function findStatuses(organizationId: string) {
  const statuses = await prisma.customerStatus.findMany({
    where: { organizationId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      label: true,
      color: true,
      _count: { select: { customers: true } },
    },
  });

  return statuses.map(({ _count, ...status }) => ({
    ...status,
    customerCount: _count.customers,
  }));
}

export type CustomerStatusItem = Awaited<
  ReturnType<typeof findStatuses>
>[number];

export async function listCustomerStatuses(): Promise<
  ActionResult<CustomerStatusItem[]>
> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await getActorContext();

    return findStatuses(organizationId);
  });
}

export async function createCustomerStatus(
  input: unknown,
): Promise<ActionResult> {
  return runAction(customerStatusFormSchema, input, async (values) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });
    const [count, last] = await Promise.all([
      prisma.customerStatus.count({ where: { organizationId } }),
      prisma.customerStatus.findFirst({
        where: { organizationId },
        orderBy: { position: "desc" },
        select: { position: true },
      }),
    ]);

    if (count >= CUSTOMER_LIMITS.maxStatuses) {
      throw new APIError("BAD_REQUEST", { code: "TOO_MANY_CUSTOMER_STATUSES" });
    }

    await prisma.customerStatus.create({
      data: {
        ...values,
        organizationId,
        position: (last?.position ?? -1) + 1,
      },
    });

    return undefined;
  });
}

export async function updateCustomerStatusDefinition(
  input: unknown,
): Promise<ActionResult> {
  return runAction(
    updateCustomerStatusDefinitionSchema,
    input,
    async ({ id, values }) => {
      const { organizationId } = await requirePermission({
        organization: ["update"],
      });
      const { count } = await prisma.customerStatus.updateMany({
        where: { id, organizationId },
        data: values,
      });

      if (count === 0) {
        throw new APIError("NOT_FOUND", { code: "INVALID_CUSTOMER_STATUS" });
      }

      return undefined;
    },
  );
}

/** Swaps the status with its neighbour to change the order of the pipeline. */
export async function moveCustomerStatus(
  input: unknown,
): Promise<ActionResult> {
  return runAction(
    moveCustomerStatusSchema,
    input,
    async ({ id, direction }) => {
      const { organizationId } = await requirePermission({
        organization: ["update"],
      });
      const statuses = await prisma.customerStatus.findMany({
        where: { organizationId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      const index = statuses.findIndex((status) => status.id === id);

      if (index === -1) {
        throw new APIError("NOT_FOUND", { code: "INVALID_CUSTOMER_STATUS" });
      }

      const target = direction === "up" ? index - 1 : index + 1;

      if (target < 0 || target >= statuses.length) return undefined;

      [statuses[index], statuses[target]] = [statuses[target], statuses[index]];

      // Rewrites every position so gaps or duplicates from older data disappear.
      await prisma.$transaction(
        statuses.map((status, position) =>
          prisma.customerStatus.update({
            where: { id: status.id },
            data: { position },
          }),
        ),
      );

      return undefined;
    },
  );
}

export async function deleteCustomerStatus(id: unknown): Promise<ActionResult> {
  return runAction(customerIdSchema, id, async (statusId) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });
    const status = await prisma.customerStatus.findFirst({
      where: { id: statusId, organizationId },
      select: { _count: { select: { customers: true } } },
    });

    if (!status) {
      throw new APIError("NOT_FOUND", { code: "INVALID_CUSTOMER_STATUS" });
    }
    if (status._count.customers > 0) {
      throw new APIError("BAD_REQUEST", { code: "CUSTOMER_STATUS_IN_USE" });
    }

    await prisma.customerStatus.delete({ where: { id: statusId } });

    return undefined;
  });
}
