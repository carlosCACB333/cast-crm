"use server";

import { APIError } from "better-auth/api";

import { requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { PRODUCT_LIMITS, presentationLabel } from "@/config/products";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  assertBarcodesAvailable,
  assertProductInOrganization,
  buildProductWhere,
  getProductSummary,
  productImageFolder,
  productDetailSelect,
  productListSelect,
  productOrderBy,
  serializeProduct,
  toPresentationData,
  toProductData,
  withProductConstraints,
} from "@/lib/products";
import { copyImage, deleteImage } from "@/lib/cloudinary";
import { pageWindow } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/validations/fields";
import {
  type ProductListFilters,
  barcodeLookupSchema,
  createProductSchema,
  productIdSchema,
  productListSchema,
  setProductActiveSchema,
  type StockMovementListParams,
  stockMovementListSchema,
  stockMovementSchema,
  updateProductSchema,
} from "@/lib/validations/products";

// Every action derives the organization from the session and checks the
// `product:*` permission of the caller's role before touching data.

async function findProductList(
  organizationId: string,
  filters: ProductListFilters,
) {
  const where = buildProductWhere(organizationId, filters);
  const pageSize = PRODUCT_LIMITS.pageSize;

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: productOrderBy(filters),
      skip: (filters.page - 1) * pageSize,
      take: pageSize,
      select: productListSelect,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items.map(serializeProduct),
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    summary: await getProductSummary(organizationId),
  };
}

export type ProductList = Awaited<ReturnType<typeof findProductList>>;
export type ProductListItem = ProductList["items"][number];
export type ProductSummary = ProductList["summary"];

export async function listProducts(
  input: unknown,
): Promise<ActionResult<ProductList>> {
  return runAction(productListSchema, input, async (filters) => {
    const { organizationId } = await requirePermission({ product: ["read"] });

    return findProductList(organizationId, filters);
  });
}

async function findProduct(organizationId: string, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, organizationId },
    select: productDetailSelect,
  });

  if (!product) throw new APIError("NOT_FOUND", { code: "PRODUCT_NOT_FOUND" });

  return serializeProduct(product);
}

export type ProductDetail = Awaited<ReturnType<typeof findProduct>>;

export async function getProduct(
  id: unknown,
): Promise<ActionResult<ProductDetail>> {
  return runAction(productIdSchema, id, async (productId) => {
    const { organizationId } = await requirePermission({ product: ["read"] });

    return findProduct(organizationId, productId);
  });
}

/**
 * Copies the photos of a suggested product into the new one. The product is
 * already saved, so a photo that fails to copy is counted instead of undoing
 * it.
 */
async function copySourceImages(
  organizationId: string,
  productId: string,
  urls: string[],
) {
  let failed = 0;

  for (const [position, url] of urls.entries()) {
    try {
      const image = await copyImage(
        url,
        productImageFolder(organizationId, productId),
      );

      await prisma.productImage.create({
        data: {
          organizationId,
          productId,
          publicId: image.public_id,
          url: image.secure_url,
          width: image.width,
          height: image.height,
          bytes: image.bytes,
          position: position - failed,
        },
      });
    } catch (error) {
      // eslint-disable-next-line no-console -- server log; the UI gets the count
      console.error("No se pudo copiar la foto sugerida", error);
      failed += 1;
    }
  }

  return failed;
}

export async function createProduct(
  input: unknown,
): Promise<ActionResult<{ id: string; failedImages: number }>> {
  return runAction(createProductSchema, input, async ({ values, sourceId }) => {
    const { organizationId, session } = await requirePermission({
      product: ["create"],
    });
    const data = await toProductData(organizationId, values);
    const initialStock = data.trackStock
      ? toDecimal(values.initialStock)
      : null;
    const hasStock = initialStock !== null && Number(initialStock) > 0;
    const presentations = toPresentationData(organizationId, values);

    await assertBarcodesAvailable(prisma, organizationId, [
      data.barcode,
      ...presentations.map((presentation) => presentation.barcode),
    ]);

    // A suggestion must be a product of another organization with the same
    // barcode, so the counter cannot be raised for arbitrary products.
    const source = sourceId
      ? await prisma.product.findFirst({
          where: {
            id: sourceId,
            organizationId: { not: organizationId },
            barcode: data.barcode ?? undefined,
            isActive: true,
          },
          select: {
            images: {
              select: { url: true },
              orderBy: { position: "asc" },
              take: PRODUCT_LIMITS.maxImages,
            },
          },
        })
      : null;

    if (sourceId && (!source || !data.barcode)) {
      throw new APIError("BAD_REQUEST", { code: "INVALID_PRODUCT_SOURCE" });
    }

    const product = await withProductConstraints(() =>
      prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            ...data,
            organizationId,
            createdById: session.user.id,
            stock: hasStock ? initialStock : "0",
            presentations: { create: presentations },
            // The opening stock is the first entry of the history.
            movements: hasStock
              ? {
                  create: {
                    organizationId,
                    type: "IN",
                    quantity: initialStock,
                    stockAfter: initialStock,
                    reason: "Stock inicial",
                    authorId: session.user.id,
                  },
                }
              : undefined,
          },
          select: { id: true },
        });

        if (sourceId) {
          await tx.product.update({
            where: { id: sourceId },
            data: { copiedCount: { increment: 1 } },
            select: { id: true },
          });
        }

        return created;
      }),
    );

    const failedImages = source?.images.length
      ? await copySourceImages(
          organizationId,
          product.id,
          source.images.map((image) => image.url),
        )
      : 0;

    return { id: product.id, failedImages };
  });
}

/**
 * Looks up a barcode when starting a new product: the product of the
 * organization that already has it, or else products of other organizations
 * to copy from. Suggestions never reveal whose they are, nor their cost,
 * stock or internal codes.
 */
export async function lookupProductBarcode(code: unknown) {
  return runAction(barcodeLookupSchema, code, async (barcode) => {
    const { organizationId } = await requirePermission({
      product: ["create"],
    });

    const existing = await prisma.product.findFirst({
      where: {
        organizationId,
        OR: [{ barcode }, { presentations: { some: { barcode } } }],
      },
      select: { id: true, name: true },
    });

    if (existing) return { existing, suggestions: [] };

    const rows = await prisma.product.findMany({
      where: {
        barcode,
        organizationId: { not: organizationId },
        isActive: true,
      },
      orderBy: [{ copiedCount: "desc" }, { updatedAt: "desc" }],
      take: PRODUCT_LIMITS.maxBarcodeSuggestions,
      select: {
        id: true,
        name: true,
        description: true,
        unit: true,
        price: true,
        taxRate: true,
        trackStock: true,
        tags: true,
        copiedCount: true,
        category: { select: { name: true } },
        presentations: {
          select: { unit: true, factor: true, price: true, barcode: true },
          orderBy: { position: "asc" },
        },
        images: {
          select: { url: true },
          orderBy: { position: "asc" },
          take: PRODUCT_LIMITS.maxImages,
        },
      },
    });

    // Categories are per organization: a suggestion only brings one along
    // when this organization has a category with the same name.
    const names = [
      ...new Set(
        rows.flatMap((row) => (row.category ? [row.category.name] : [])),
      ),
    ];
    const categories = names.length
      ? await prisma.productCategory.findMany({
          where: {
            organizationId,
            OR: names.map((name) => ({
              name: { equals: name, mode: "insensitive" as const },
            })),
          },
          select: { id: true, name: true },
        })
      : [];
    const categoryId = (name?: string) =>
      categories.find(
        (category) => category.name.toLowerCase() === name?.toLowerCase(),
      )?.id ?? null;

    return {
      existing: null,
      suggestions: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        unit: row.unit,
        price: row.price.toNumber(),
        taxRate: row.taxRate?.toNumber() ?? null,
        trackStock: row.trackStock,
        tags: row.tags,
        copiedCount: row.copiedCount,
        categoryId: categoryId(row.category?.name),
        presentations: row.presentations.map((presentation) => ({
          unit: presentation.unit,
          factor: presentation.factor.toNumber(),
          price: presentation.price.toNumber(),
          barcode: presentation.barcode,
        })),
        imageUrls: row.images.map((image) => image.url),
      })),
    };
  });
}

export type BarcodeLookup = Extract<
  Awaited<ReturnType<typeof lookupProductBarcode>>,
  { ok: true }
>["data"];
export type BarcodeSuggestion = BarcodeLookup["suggestions"][number];

export async function updateProduct(input: unknown): Promise<ActionResult> {
  return runAction(updateProductSchema, input, async ({ id, values }) => {
    const { organizationId } = await requirePermission({
      product: ["update"],
    });

    await assertProductInOrganization(organizationId, id);
    const data = await toProductData(organizationId, values);

    const presentations = toPresentationData(organizationId, values);

    // Presentations are matched by format (unit and factor, unique per
    // product) and updated in place, so sales lines and open carts keep
    // pointing to them; the others are removed or created.
    await withProductConstraints(() =>
      prisma.$transaction(async (tx) => {
        await assertBarcodesAvailable(
          tx,
          organizationId,
          [
            data.barcode,
            ...presentations.map((presentation) => presentation.barcode),
          ],
          { productId: id },
        );

        const existing = await tx.productPresentation.findMany({
          where: { productId: id, organizationId },
          select: { id: true, unit: true, factor: true },
        });
        const formatKey = (unit: string, factor: string | Prisma.Decimal) =>
          `${unit}:${new Prisma.Decimal(factor).toString()}`;
        const byFormat = new Map(
          existing.map((item) => [formatKey(item.unit, item.factor), item.id]),
        );
        const matches = presentations.map((presentation) =>
          byFormat.get(formatKey(presentation.unit, presentation.factor)),
        );
        const kept = matches.filter((match) => match !== undefined);

        await tx.product.update({ where: { id }, data, select: { id: true } });
        await tx.productPresentation.deleteMany({
          where: { productId: id, organizationId, id: { notIn: kept } },
        });
        // Barcodes may move between the kept presentations; clearing them
        // first keeps the unique index from failing halfway.
        await tx.productPresentation.updateMany({
          where: { id: { in: kept } },
          data: { barcode: null },
        });

        for (const [index, presentation] of presentations.entries()) {
          const keptId = matches[index];

          if (keptId) {
            await tx.productPresentation.update({
              where: { id: keptId },
              data: {
                price: presentation.price,
                barcode: presentation.barcode,
                position: presentation.position,
              },
            });
          } else {
            await tx.productPresentation.create({
              data: { ...presentation, productId: id },
            });
          }
        }
      }),
    );

    return undefined;
  });
}

/** Quick activation from the list or the detail page. */
export async function setProductActive(input: unknown): Promise<ActionResult> {
  return runAction(setProductActiveSchema, input, async ({ id, isActive }) => {
    const { organizationId } = await requirePermission({
      product: ["update"],
    });
    const { count } = await prisma.product.updateMany({
      where: { id, organizationId },
      data: { isActive },
    });

    if (count === 0) {
      throw new APIError("NOT_FOUND", { code: "PRODUCT_NOT_FOUND" });
    }

    return undefined;
  });
}

/** Copies a product without its stock, history or unique codes. */
export async function duplicateProduct(
  id: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(productIdSchema, id, async (productId) => {
    const { organizationId, session } = await requirePermission({
      product: ["create"],
    });
    const source = await prisma.product.findFirst({
      where: { id: productId, organizationId },
      select: {
        name: true,
        description: true,
        categoryId: true,
        unit: true,
        price: true,
        cost: true,
        taxRate: true,
        trackStock: true,
        minStock: true,
        tags: true,
        presentations: {
          orderBy: { position: "asc" },
          select: { unit: true, factor: true, price: true, position: true },
        },
      },
    });

    if (!source) {
      throw new APIError("NOT_FOUND", { code: "PRODUCT_NOT_FOUND" });
    }

    const { presentations, ...fields } = source;

    // Barcodes are left out of the copy, like the product's own codes.
    return prisma.product.create({
      data: {
        ...fields,
        presentations: {
          create: presentations.map((presentation) => ({
            ...presentation,
            organizationId,
          })),
        },
        name: `${source.name} (copia)`.slice(0, 150),
        organizationId,
        createdById: session.user.id,
      },
      select: { id: true },
    });
  });
}

export async function deleteProduct(id: unknown): Promise<ActionResult> {
  return runAction(productIdSchema, id, async (productId) => {
    const { organizationId } = await requirePermission({
      product: ["delete"],
    });
    const images = await prisma.productImage.findMany({
      where: { productId, organizationId },
      select: { publicId: true },
    });
    const { count } = await prisma.product.deleteMany({
      where: { id: productId, organizationId },
    });

    if (count === 0) {
      throw new APIError("NOT_FOUND", { code: "PRODUCT_NOT_FOUND" });
    }

    // The product is already gone; a photo Cloudinary fails to delete only
    // leaves an orphan file there, so it does not fail the action.
    const deleted = await Promise.allSettled(
      images.map((image) => deleteImage(image.publicId)),
    );

    for (const result of deleted) {
      if (result.status === "rejected") {
        // eslint-disable-next-line no-console -- server log of the orphan file
        console.error(
          "No se pudo borrar una imagen de Cloudinary",
          result.reason,
        );
      }
    }

    return undefined;
  });
}

/**
 * Records a stock movement and updates the stock in one transaction. Exits
 * cannot leave the stock below zero; counts set the counted quantity.
 */
export async function addStockMovement(input: unknown): Promise<ActionResult> {
  return runAction(
    stockMovementSchema,
    input,
    async ({ productId, type, quantity, reason, presentationId }) => {
      const { organizationId, session } = await requirePermission({
        product: ["update"],
      });
      const entered = new Prisma.Decimal(toDecimal(quantity) ?? "0");

      await prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: productId, organizationId },
          select: { stock: true, trackStock: true, unit: true },
        });

        if (!product) {
          throw new APIError("NOT_FOUND", { code: "PRODUCT_NOT_FOUND" });
        }
        if (!product.trackStock) {
          throw new APIError("BAD_REQUEST", { code: "STOCK_NOT_TRACKED" });
        }

        // The factor comes from the database, never from the client.
        const presentation = presentationId
          ? await tx.productPresentation.findFirst({
              where: { id: presentationId, productId, organizationId },
              select: { unit: true, factor: true },
            })
          : null;

        if (presentationId && !presentation) {
          throw new APIError("BAD_REQUEST", { code: "INVALID_PRESENTATION" });
        }

        const amount = presentation
          ? entered.times(presentation.factor)
          : entered;

        const delta =
          type === "IN"
            ? amount
            : type === "OUT"
              ? amount.negated()
              : amount.minus(product.stock);
        const stockAfter = product.stock.plus(delta);

        if (stockAfter.isNegative()) {
          throw new APIError("BAD_REQUEST", { code: "INSUFFICIENT_STOCK" });
        }

        // Only applies if nobody changed the stock since it was read.
        const { count } = await tx.product.updateMany({
          where: { id: productId, organizationId, stock: product.stock },
          data: { stock: stockAfter },
        });

        if (count === 0) {
          throw new APIError("CONFLICT", { code: "STOCK_CHANGED" });
        }

        await tx.productStockMovement.create({
          data: {
            organizationId,
            productId,
            type,
            quantity: delta,
            stockAfter,
            reason: reason || null,
            presentationLabel: presentation
              ? presentationLabel(
                  presentation.unit,
                  presentation.factor.toNumber(),
                  product.unit,
                )
              : null,
            presentationQuantity: presentation ? entered : null,
            authorId: session.user.id,
          },
        });
      });

      return undefined;
    },
  );
}

async function findMovements(
  organizationId: string,
  {
    productId,
    q,
    types,
    authorId,
    sort,
    direction,
    page,
  }: StockMovementListParams,
) {
  const where: Prisma.ProductStockMovementWhereInput = {
    productId,
    organizationId,
  };

  if (types.length) where.type = { in: types };
  if (authorId) where.authorId = authorId;
  if (q) {
    const contains = { contains: q, mode: "insensitive" } as const;

    where.OR = [
      { reason: contains },
      { presentationLabel: contains },
      { author: { name: contains } },
    ];
  }

  const total = await prisma.productStockMovement.count({ where });
  const window = pageWindow(page, PRODUCT_LIMITS.historyPageSize, total);
  const movements = await prisma.productStockMovement.findMany({
    where,
    // The id keeps the order stable when values are equal.
    orderBy: [{ [sort]: direction }, { id: "desc" }],
    skip: window.skip,
    take: window.take,
    select: {
      id: true,
      type: true,
      quantity: true,
      stockAfter: true,
      reason: true,
      presentationLabel: true,
      presentationQuantity: true,
      createdAt: true,
      author: { select: { id: true, name: true, image: true } },
    },
  });

  return {
    items: movements.map((movement) => ({
      ...movement,
      quantity: movement.quantity.toNumber(),
      stockAfter: movement.stockAfter.toNumber(),
      presentationQuantity: movement.presentationQuantity?.toNumber() ?? null,
      createdAt: movement.createdAt.toISOString(),
    })),
    total,
    page: window.page,
    pageSize: window.pageSize,
    pageCount: window.pageCount,
  };
}

export type StockMovementPage = Awaited<ReturnType<typeof findMovements>>;
export type StockMovementItem = StockMovementPage["items"][number];

/** One page of the stock history of a product. */
export async function listStockMovements(
  input: unknown,
): Promise<ActionResult<StockMovementPage>> {
  return runAction(stockMovementListSchema, input, async (params) => {
    const { organizationId } = await requirePermission({ product: ["read"] });

    await assertProductInOrganization(organizationId, params.productId);

    return findMovements(organizationId, params);
  });
}

export interface ProductExportRow {
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  description: string | null;
  unit: string;
  price: number;
  taxRate: number | null;
  cost: number | null;
  trackStock: boolean;
  stock: number;
  minStock: number | null;
  isActive: boolean;
  tags: string[];
  /** "Paquete de 12 ud. (15,00)", one per presentation. */
  presentations: { label: string; price: number }[];
  createdAt: string;
}

/** Products matching the list filters, for a CSV built in the browser. */
export async function exportProducts(
  input: unknown,
): Promise<ActionResult<{ rows: ProductExportRow[]; isTruncated: boolean }>> {
  return runAction(productListSchema, input, async (filters) => {
    const { organizationId } = await requirePermission({ product: ["read"] });
    const limit = PRODUCT_LIMITS.exportRows;
    const products = await prisma.product.findMany({
      where: buildProductWhere(organizationId, filters),
      orderBy: productOrderBy(filters),
      take: limit + 1,
      select: {
        name: true,
        sku: true,
        barcode: true,
        description: true,
        unit: true,
        price: true,
        taxRate: true,
        cost: true,
        trackStock: true,
        stock: true,
        minStock: true,
        isActive: true,
        tags: true,
        createdAt: true,
        category: { select: { name: true } },
        presentations: {
          orderBy: { position: "asc" },
          select: { unit: true, factor: true, price: true },
        },
      },
    });

    return {
      isTruncated: products.length > limit,
      rows: products.slice(0, limit).map(({ category, ...item }) => ({
        ...item,
        category: category?.name ?? null,
        presentations: item.presentations.map((presentation) => ({
          label: presentationLabel(
            presentation.unit,
            presentation.factor.toNumber(),
            item.unit,
          ),
          price: presentation.price.toNumber(),
        })),
        price: item.price.toNumber(),
        taxRate: item.taxRate?.toNumber() ?? null,
        cost: item.cost?.toNumber() ?? null,
        stock: item.stock.toNumber(),
        minStock: item.minStock?.toNumber() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  });
}
