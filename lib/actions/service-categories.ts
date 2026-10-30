"use server";

import { APIError } from "better-auth/api";
import { z } from "zod";

import { getActorContext, requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { SERVICE_LIMITS } from "@/config/services";
import { prisma } from "@/lib/prisma";
import {
  categoryFormSchema,
  moveCategorySchema,
  updateCategorySchema,
} from "@/lib/validations/catalog";
import { idField } from "@/lib/validations/fields";

// Categories are organization configuration: any member can read them, and
// changing them requires `organization:update`.

async function findCategories(organizationId: string) {
  const categories = await prisma.serviceCategory.findMany({
    where: { organizationId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { services: true } },
    },
  });

  return categories.map(({ _count, ...category }) => ({
    ...category,
    itemCount: _count.services,
  }));
}

export type ServiceCategoryItem = Awaited<
  ReturnType<typeof findCategories>
>[number];

export async function listServiceCategories(): Promise<
  ActionResult<ServiceCategoryItem[]>
> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await getActorContext();

    return findCategories(organizationId);
  });
}

export async function createServiceCategory(
  input: unknown,
): Promise<ActionResult> {
  return runAction(categoryFormSchema, input, async (values) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });
    const [count, last] = await prisma.$transaction([
      prisma.serviceCategory.count({ where: { organizationId } }),
      prisma.serviceCategory.findFirst({
        where: { organizationId },
        orderBy: { position: "desc" },
        select: { position: true },
      }),
    ]);

    if (count >= SERVICE_LIMITS.maxCategories) {
      throw new APIError("BAD_REQUEST", {
        code: "TOO_MANY_SERVICE_CATEGORIES",
      });
    }

    await prisma.serviceCategory.create({
      data: {
        ...values,
        organizationId,
        position: (last?.position ?? -1) + 1,
      },
    });

    return undefined;
  });
}

export async function updateServiceCategory(
  input: unknown,
): Promise<ActionResult> {
  return runAction(updateCategorySchema, input, async ({ id, values }) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });
    const { count } = await prisma.serviceCategory.updateMany({
      where: { id, organizationId },
      data: values,
    });

    if (count === 0) {
      throw new APIError("NOT_FOUND", { code: "INVALID_SERVICE_CATEGORY" });
    }

    return undefined;
  });
}

/** Swaps the category with its neighbour to change the order of the list. */
export async function moveServiceCategory(
  input: unknown,
): Promise<ActionResult> {
  return runAction(moveCategorySchema, input, async ({ id, direction }) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });
    const categories = await prisma.serviceCategory.findMany({
      where: { organizationId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    const index = categories.findIndex((category) => category.id === id);

    if (index === -1) {
      throw new APIError("NOT_FOUND", { code: "INVALID_SERVICE_CATEGORY" });
    }

    const target = direction === "up" ? index - 1 : index + 1;

    if (target < 0 || target >= categories.length) return undefined;

    [categories[index], categories[target]] = [
      categories[target],
      categories[index],
    ];

    // Rewrites every position so gaps or duplicates from older data disappear.
    await prisma.$transaction(
      categories.map((category, position) =>
        prisma.serviceCategory.update({
          where: { id: category.id },
          data: { position },
        }),
      ),
    );

    return undefined;
  });
}

/** Services of a deleted category stay in the catalog without category. */
export async function deleteServiceCategory(
  id: unknown,
): Promise<ActionResult> {
  return runAction(idField, id, async (categoryId) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });
    const { count } = await prisma.serviceCategory.deleteMany({
      where: { id: categoryId, organizationId },
    });

    if (count === 0) {
      throw new APIError("NOT_FOUND", { code: "INVALID_SERVICE_CATEGORY" });
    }

    return undefined;
  });
}
