"use server";

import type { PresentationFormValues } from "@/lib/validations/products";

import { APIError } from "better-auth/api";

import { requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { PRODUCT_LIMITS } from "@/config/products";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  assertBarcodesAvailable,
  withProductConstraints,
} from "@/lib/products";
import { prisma } from "@/lib/prisma";
import { emptyToNull, toDecimal } from "@/lib/validations/fields";
import {
  createPresentationSchema,
  productIdSchema,
  updatePresentationSchema,
} from "@/lib/validations/products";

// Ways of selling a product, managed one by one from its detail page. The
// product form replaces them all at once (see `updateProduct`).

function toPresentationRow(values: PresentationFormValues) {
  return {
    unit: values.unit,
    factor: new Prisma.Decimal(toDecimal(values.factor) ?? "1"),
    price: toDecimal(values.price) ?? "0",
    barcode: emptyToNull(values.barcode),
  };
}

/** Throws if another presentation of the product has the same format. */
async function assertUnique(
  productId: string,
  { unit, factor }: { unit: string; factor: Prisma.Decimal },
  exceptId?: string,
) {
  const duplicate = await prisma.productPresentation.findFirst({
    where: {
      productId,
      unit,
      factor,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new APIError("BAD_REQUEST", { code: "DUPLICATE_PRESENTATION" });
  }
}

/** Marks the product as recently changed. */
const touchProduct = (productId: string) =>
  prisma.product.update({
    where: { id: productId },
    data: { updatedAt: new Date() },
    select: { id: true },
  });

export async function createPresentation(
  input: unknown,
): Promise<ActionResult> {
  return runAction(
    createPresentationSchema,
    input,
    async ({ productId, values }) => {
      const { organizationId } = await requirePermission({
        product: ["update"],
      });
      const product = await prisma.product.findFirst({
        where: { id: productId, organizationId },
        select: { _count: { select: { presentations: true } } },
      });

      if (!product) {
        throw new APIError("NOT_FOUND", { code: "PRODUCT_NOT_FOUND" });
      }
      if (product._count.presentations >= PRODUCT_LIMITS.maxPresentations) {
        throw new APIError("BAD_REQUEST", { code: "TOO_MANY_PRESENTATIONS" });
      }

      const row = toPresentationRow(values);

      await assertUnique(productId, row);
      await assertBarcodesAvailable(prisma, organizationId, [row.barcode]);
      const last = await prisma.productPresentation.findFirst({
        where: { productId },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      await withProductConstraints(() =>
        prisma.$transaction([
          prisma.productPresentation.create({
            data: {
              ...row,
              organizationId,
              productId,
              position: (last?.position ?? -1) + 1,
            },
          }),
          touchProduct(productId),
        ]),
      );

      return undefined;
    },
  );
}

export async function updatePresentation(
  input: unknown,
): Promise<ActionResult> {
  return runAction(updatePresentationSchema, input, async ({ id, values }) => {
    const { organizationId } = await requirePermission({
      product: ["update"],
    });
    const presentation = await prisma.productPresentation.findFirst({
      where: { id, organizationId },
      select: { productId: true },
    });

    if (!presentation) {
      throw new APIError("NOT_FOUND", { code: "PRESENTATION_NOT_FOUND" });
    }

    const row = toPresentationRow(values);

    await assertUnique(presentation.productId, row, id);
    await assertBarcodesAvailable(prisma, organizationId, [row.barcode], {
      presentationId: id,
    });
    await withProductConstraints(() =>
      prisma.$transaction([
        prisma.productPresentation.update({ where: { id }, data: row }),
        touchProduct(presentation.productId),
      ]),
    );

    return undefined;
  });
}

/** Past stock movements keep their own label, so history is not affected. */
export async function deletePresentation(id: unknown): Promise<ActionResult> {
  return runAction(productIdSchema, id, async (presentationId) => {
    const { organizationId } = await requirePermission({
      product: ["update"],
    });
    const presentation = await prisma.productPresentation.findFirst({
      where: { id: presentationId, organizationId },
      select: { productId: true },
    });

    if (!presentation) {
      throw new APIError("NOT_FOUND", { code: "PRESENTATION_NOT_FOUND" });
    }

    await prisma.$transaction([
      prisma.productPresentation.delete({ where: { id: presentationId } }),
      touchProduct(presentation.productId),
    ]);

    return undefined;
  });
}
