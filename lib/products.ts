import "server-only";

import type {
  ProductFormValues,
  ProductListFilters,
} from "@/lib/validations/products";

import { APIError } from "better-auth/api";

import { assetFolder } from "@/lib/cloudinary";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  emptyToNull,
  normalizeTags,
  toDecimal,
} from "@/lib/validations/fields";

// Every query here is scoped by an organization id that the caller derives
// from the session; none of these functions accept it from the client.

export const categorySelect = {
  id: true,
  name: true,
  color: true,
} satisfies Prisma.ProductCategorySelect;

export const presentationSelect = {
  id: true,
  unit: true,
  factor: true,
  price: true,
  barcode: true,
} satisfies Prisma.ProductPresentationSelect;

export const productListSelect = {
  id: true,
  name: true,
  sku: true,
  unit: true,
  price: true,
  cost: true,
  taxRate: true,
  trackStock: true,
  stock: true,
  minStock: true,
  isActive: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  category: { select: categorySelect },
  presentations: { select: presentationSelect, orderBy: { position: "asc" } },
  /** Main photo for thumbnails. */
  images: {
    select: { id: true, url: true },
    orderBy: { position: "asc" },
    take: 1,
  },
} satisfies Prisma.ProductSelect;

export const productDetailSelect = {
  ...productListSelect,
  images: {
    select: { id: true, url: true, width: true, height: true, bytes: true },
    orderBy: { position: "asc" },
  },
  description: true,
  barcode: true,
  createdBy: { select: { id: true, name: true, image: true } },
  _count: { select: { movements: true } },
} satisfies Prisma.ProductSelect;

type DecimalLike = { toNumber(): number };

type ProductRow = {
  presentations: {
    id: string;
    unit: string;
    factor: DecimalLike;
    price: DecimalLike;
    barcode: string | null;
  }[];
  price: DecimalLike;
  cost: DecimalLike | null;
  taxRate: DecimalLike | null;
  stock: DecimalLike;
  minStock: DecimalLike | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Makes Prisma values serializable for the client (Decimal, Date). */
export function serializeProduct<T extends ProductRow>({
  presentations,
  price,
  cost,
  taxRate,
  stock,
  minStock,
  createdAt,
  updatedAt,
  ...rest
}: T) {
  return {
    ...rest,
    price: price.toNumber(),
    cost: cost?.toNumber() ?? null,
    taxRate: taxRate?.toNumber() ?? null,
    stock: stock.toNumber(),
    minStock: minStock?.toNumber() ?? null,
    presentations: presentations.map((presentation) => ({
      id: presentation.id,
      unit: presentation.unit,
      factor: presentation.factor.toNumber(),
      price: presentation.price.toNumber(),
      barcode: presentation.barcode,
    })),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export function buildProductWhere(
  organizationId: string,
  filters: ProductListFilters,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { organizationId };
  const and: Prisma.ProductWhereInput[] = [];
  const { q, categoryId, status, stock, tag } = filters;

  if (q) {
    const contains = { contains: q, mode: "insensitive" } as const;

    and.push({
      OR: [
        { name: contains },
        { sku: contains },
        { barcode: contains },
        { description: contains },
        { presentations: { some: { barcode: contains } } },
      ],
    });
  }
  if (categoryId) {
    where.categoryId = categoryId === "none" ? null : categoryId;
  }
  if (status) where.isActive = status === "active";
  if (stock === "out") {
    and.push({ trackStock: true, stock: { lte: 0 } });
  } else if (stock === "low") {
    and.push({
      trackStock: true,
      minStock: { not: null },
      stock: { gt: 0, lte: prisma.product.fields.minStock },
    });
  }
  if (tag) where.tags = { has: tag };
  if (and.length) where.AND = and;

  return where;
}

export function productOrderBy(
  filters: ProductListFilters,
): Prisma.ProductOrderByWithRelationInput[] {
  // The id makes the order stable across pages when values are equal.
  return [{ [filters.sort]: filters.direction }, { id: "asc" }];
}

/** Catalog totals of the organization, independent of the list filters. */
export async function getProductSummary(organizationId: string) {
  const [total, active, outOfStock, lowStock, value] =
    await prisma.$transaction([
      prisma.product.count({ where: { organizationId } }),
      prisma.product.count({ where: { organizationId, isActive: true } }),
      prisma.product.count({
        where: { organizationId, trackStock: true, stock: { lte: 0 } },
      }),
      prisma.product.count({
        where: {
          organizationId,
          trackStock: true,
          minStock: { not: null },
          stock: { gt: 0, lte: prisma.product.fields.minStock },
        },
      }),
      // Stock valued at cost, or at the sale price when the cost is unknown.
      prisma.$queryRaw<{ value: Prisma.Decimal | null }[]>`
        SELECT SUM("stock" * COALESCE("cost", "price")) AS value
        FROM "product"
        WHERE "organizationId" = ${organizationId}
          AND "trackStock" = true
          AND "isActive" = true
          AND "stock" > 0
      `,
    ]);

  return {
    total,
    active,
    outOfStock,
    lowStock,
    inventoryValue: value[0]?.value ? Number(value[0].value) : 0,
  };
}

/**
 * Turns validated form values into database data, checking that the
 * category belongs to the organization. Stock is never set here: it only
 * changes through movements.
 */
export async function toProductData(
  organizationId: string,
  values: ProductFormValues,
) {
  const categoryId =
    values.categoryId === "none" ? null : emptyToNull(values.categoryId);

  if (categoryId) {
    const category = await prisma.productCategory.findFirst({
      where: { id: categoryId, organizationId },
      select: { id: true },
    });

    if (!category) {
      throw new APIError("BAD_REQUEST", { code: "INVALID_PRODUCT_CATEGORY" });
    }
  }

  const { trackStock } = values;

  return {
    name: values.name,
    description: emptyToNull(values.description),
    categoryId,
    tags: normalizeTags(values.tags),
    price: toDecimal(values.price) ?? "0",
    taxRate: toDecimal(values.taxRate),
    cost: toDecimal(values.cost),
    unit: values.unit,
    sku: emptyToNull(values.sku),
    barcode: emptyToNull(values.barcode),
    trackStock,
    minStock: trackStock ? toDecimal(values.minStock) : null,
    isActive: values.isActive,
  };
}

/** Rows for the product's presentations, in the order of the form. */
export function toPresentationData(
  organizationId: string,
  values: ProductFormValues,
) {
  return values.presentations.map((presentation, position) => ({
    organizationId,
    unit: presentation.unit,
    factor: toDecimal(presentation.factor) ?? "1",
    price: toDecimal(presentation.price) ?? "0",
    barcode: emptyToNull(presentation.barcode),
    position,
  }));
}

/** Translates the unique SKU and barcode constraints into readable errors. */
export async function withProductConstraints<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // The violated fields are reported in `meta`, whose shape depends on
      // the driver adapter.
      const code = JSON.stringify(error.meta ?? {}).includes("barcode")
        ? "PRODUCT_BARCODE_TAKEN"
        : "PRODUCT_SKU_TAKEN";

      throw new APIError("BAD_REQUEST", { code });
    }
    throw error;
  }
}

/**
 * Throws if another product or presentation of the organization already uses
 * one of the barcodes. The database only enforces uniqueness within each
 * table, so a scanned code could otherwise match both.
 */
export async function assertBarcodesAvailable(
  db: Pick<Prisma.TransactionClient, "product" | "productPresentation">,
  organizationId: string,
  barcodes: (string | null)[],
  /** The product being saved, whose presentations are replaced with it. */
  except: { productId?: string; presentationId?: string } = {},
) {
  const codes = barcodes.filter((code): code is string => Boolean(code));

  if (codes.length === 0) return;

  const [product, presentation] = await Promise.all([
    db.product.findFirst({
      where: {
        organizationId,
        barcode: { in: codes },
        ...(except.productId ? { id: { not: except.productId } } : {}),
      },
      select: { id: true },
    }),
    db.productPresentation.findFirst({
      where: {
        organizationId,
        barcode: { in: codes },
        ...(except.productId ? { productId: { not: except.productId } } : {}),
        ...(except.presentationId
          ? { id: { not: except.presentationId } }
          : {}),
      },
      select: { id: true },
    }),
  ]);

  if (product || presentation) {
    throw new APIError("BAD_REQUEST", { code: "PRODUCT_BARCODE_TAKEN" });
  }
}

/** Cloudinary folder of a product's photos. */
export const productImageFolder = (organizationId: string, productId: string) =>
  assetFolder(organizationId, "products", productId);

/** Throws NOT_FOUND unless the product exists in the organization. */
export async function assertProductInOrganization(
  organizationId: string,
  productId: string,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    select: { id: true },
  });

  if (!product) throw new APIError("NOT_FOUND", { code: "PRODUCT_NOT_FOUND" });
}
