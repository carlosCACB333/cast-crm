"use server";

import { APIError } from "better-auth/api";

import { requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { PRODUCT_IMAGE_FORMATS, PRODUCT_LIMITS } from "@/config/products";
import { deleteImage, getImage, signImageUpload } from "@/lib/cloudinary";
import { productImageFolder as productFolder } from "@/lib/products";
import { prisma } from "@/lib/prisma";
import {
  moveProductImageSchema,
  productIdSchema,
  productImageSchema,
} from "@/lib/validations/products";

// Photos are uploaded by the browser straight to Cloudinary with a signature
// made here, then registered with `addProductImage`, which reads the upload
// from Cloudinary instead of trusting what the browser reports.

/** Throws unless the product exists and still has room for another photo. */
async function assertCanAddImage(organizationId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    select: { _count: { select: { images: true } } },
  });

  if (!product) throw new APIError("NOT_FOUND", { code: "PRODUCT_NOT_FOUND" });
  if (product._count.images >= PRODUCT_LIMITS.maxImages) {
    throw new APIError("BAD_REQUEST", { code: "TOO_MANY_IMAGES" });
  }
}

/** Signed fields to upload one photo of the product to Cloudinary. */
export async function prepareProductImageUpload(
  productId: unknown,
): Promise<ActionResult<{ url: string; fields: Record<string, string> }>> {
  return runAction(productIdSchema, productId, async (id) => {
    const { organizationId } = await requirePermission({
      product: ["update"],
    });

    await assertCanAddImage(organizationId, id);

    return signImageUpload(
      productFolder(organizationId, id),
      PRODUCT_IMAGE_FORMATS,
    );
  });
}

/** Registers a photo uploaded with `prepareProductImageUpload`. */
export async function addProductImage(input: unknown): Promise<ActionResult> {
  return runAction(
    productImageSchema,
    input,
    async ({ productId, publicId }) => {
      const { organizationId } = await requirePermission({
        product: ["update"],
      });

      // Only uploads into this product's folder can be attached to it.
      if (
        !publicId.startsWith(`${productFolder(organizationId, productId)}/`)
      ) {
        throw new APIError("BAD_REQUEST", { code: "INVALID_IMAGE" });
      }

      await assertCanAddImage(organizationId, productId);
      const image = await getImage(publicId);

      if (!image) throw new APIError("BAD_REQUEST", { code: "INVALID_IMAGE" });
      if (image.bytes > PRODUCT_LIMITS.maxImageBytes) {
        await deleteImage(publicId);
        throw new APIError("BAD_REQUEST", { code: "IMAGE_TOO_LARGE" });
      }

      const last = await prisma.productImage.findFirst({
        where: { productId, organizationId },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      await prisma.productImage.create({
        data: {
          organizationId,
          productId,
          publicId: image.public_id,
          url: image.secure_url,
          width: image.width,
          height: image.height,
          bytes: image.bytes,
          position: (last?.position ?? -1) + 1,
        },
      });

      return undefined;
    },
  );
}

/** Rewrites the positions of a product's photos in the given order. */
async function savePositions(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, position) =>
      prisma.productImage.update({ where: { id }, data: { position } }),
    ),
  );
}

export async function moveProductImage(input: unknown): Promise<ActionResult> {
  return runAction(moveProductImageSchema, input, async ({ id, direction }) => {
    const { organizationId } = await requirePermission({
      product: ["update"],
    });
    const image = await prisma.productImage.findFirst({
      where: { id, organizationId },
      select: { productId: true },
    });

    if (!image) {
      throw new APIError("NOT_FOUND", { code: "IMAGE_NOT_FOUND" });
    }

    const ids = (
      await prisma.productImage.findMany({
        where: { productId: image.productId, organizationId },
        orderBy: { position: "asc" },
        select: { id: true },
      })
    ).map((row) => row.id);
    const index = ids.indexOf(id);
    const target =
      direction === "first" ? 0 : direction === "up" ? index - 1 : index + 1;

    if (target < 0 || target >= ids.length || target === index) {
      return undefined;
    }

    ids.splice(index, 1);
    ids.splice(target, 0, id);
    await savePositions(ids);

    return undefined;
  });
}

export async function deleteProductImage(id: unknown): Promise<ActionResult> {
  return runAction(productIdSchema, id, async (imageId) => {
    const { organizationId } = await requirePermission({
      product: ["update"],
    });
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, organizationId },
      select: { publicId: true, productId: true },
    });

    if (!image) throw new APIError("NOT_FOUND", { code: "IMAGE_NOT_FOUND" });

    await deleteImage(image.publicId);
    await prisma.productImage.delete({ where: { id: imageId } });

    const remaining = await prisma.productImage.findMany({
      where: { productId: image.productId, organizationId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    await savePositions(remaining.map((row) => row.id));

    return undefined;
  });
}
