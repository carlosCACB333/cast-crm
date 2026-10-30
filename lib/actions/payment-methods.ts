"use server";

import { APIError } from "better-auth/api";
import { z } from "zod";

import { getActorContext, requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { PAYMENT_METHOD_LIMITS } from "@/config/payment-methods";
import { prisma } from "@/lib/prisma";
import { idField } from "@/lib/validations/fields";
import {
  movePaymentMethodSchema,
  paymentMethodFormSchema,
  updatePaymentMethodSchema,
} from "@/lib/validations/payment-methods";

// Payment methods are organization configuration shared by invoices and the
// point of sale: any member can read them, and changing them requires
// `organization:update`.

async function findPaymentMethods(organizationId: string) {
  const methods = await prisma.paymentMethod.findMany({
    where: { organizationId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      kind: true,
      isActive: true,
      _count: { select: { payments: true } },
    },
  });

  return methods.map(({ _count, ...method }) => ({
    ...method,
    paymentCount: _count.payments,
  }));
}

export type PaymentMethodItem = Awaited<
  ReturnType<typeof findPaymentMethods>
>[number];

export async function listPaymentMethods(): Promise<
  ActionResult<PaymentMethodItem[]>
> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await getActorContext();

    return findPaymentMethods(organizationId);
  });
}

export async function createPaymentMethod(
  input: unknown,
): Promise<ActionResult> {
  return runAction(paymentMethodFormSchema, input, async (values) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });
    const [count, last] = await prisma.$transaction([
      prisma.paymentMethod.count({ where: { organizationId } }),
      prisma.paymentMethod.findFirst({
        where: { organizationId },
        orderBy: { position: "desc" },
        select: { position: true },
      }),
    ]);

    if (count >= PAYMENT_METHOD_LIMITS.maxMethods) {
      throw new APIError("BAD_REQUEST", { code: "TOO_MANY_PAYMENT_METHODS" });
    }

    await prisma.paymentMethod.create({
      data: {
        ...values,
        organizationId,
        position: (last?.position ?? -1) + 1,
      },
    });

    return undefined;
  });
}

export async function updatePaymentMethod(
  input: unknown,
): Promise<ActionResult> {
  return runAction(updatePaymentMethodSchema, input, async ({ id, values }) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });
    const { count } = await prisma.paymentMethod.updateMany({
      where: { id, organizationId },
      data: values,
    });

    if (count === 0) {
      throw new APIError("NOT_FOUND", { code: "INVALID_PAYMENT_METHOD" });
    }

    return undefined;
  });
}

/** Swaps the method with its neighbour to change the order of the list. */
export async function movePaymentMethod(input: unknown): Promise<ActionResult> {
  return runAction(
    movePaymentMethodSchema,
    input,
    async ({ id, direction }) => {
      const { organizationId } = await requirePermission({
        organization: ["update"],
      });
      const methods = await prisma.paymentMethod.findMany({
        where: { organizationId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      const index = methods.findIndex((method) => method.id === id);

      if (index === -1) {
        throw new APIError("NOT_FOUND", { code: "INVALID_PAYMENT_METHOD" });
      }

      const target = direction === "up" ? index - 1 : index + 1;

      if (target < 0 || target >= methods.length) return undefined;

      [methods[index], methods[target]] = [methods[target], methods[index]];

      await prisma.$transaction(
        methods.map((method, position) =>
          prisma.paymentMethod.update({
            where: { id: method.id },
            data: { position },
          }),
        ),
      );

      return undefined;
    },
  );
}

/** Only methods without payments can be deleted; the others are deactivated. */
export async function deletePaymentMethod(id: unknown): Promise<ActionResult> {
  return runAction(idField, id, async (methodId) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });

    await prisma.$transaction(async (tx) => {
      const method = await tx.paymentMethod.findFirst({
        where: { id: methodId, organizationId },
        select: { _count: { select: { payments: true } } },
      });

      if (!method) {
        throw new APIError("NOT_FOUND", { code: "INVALID_PAYMENT_METHOD" });
      }
      if (method._count.payments > 0) {
        throw new APIError("BAD_REQUEST", { code: "PAYMENT_METHOD_IN_USE" });
      }

      await tx.paymentMethod.delete({ where: { id: methodId } });
    });

    return undefined;
  });
}
