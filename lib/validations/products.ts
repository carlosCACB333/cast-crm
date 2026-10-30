import { z } from "zod";

import {
  PRODUCT_LIMITS,
  PRODUCT_SORT_FIELDS,
  PRODUCT_UNIT_CODES,
  STOCK_MOVEMENT_TYPES,
} from "@/config/products";
import {
  amountField,
  idField,
  optionalText,
  percentField,
  quantityField,
  tagList,
} from "@/lib/validations/fields";
import { listQuerySchema } from "@/lib/validations/table";

const id = idField;

export const presentationFormSchema = z.object({
  unit: z.enum(PRODUCT_UNIT_CODES, "Selecciona una unidad"),
  /** Base units it contains. */
  factor: quantityField.refine(
    (value) => value !== "" && Number(value.replace(",", ".")) > 0,
    "Indica cuántas unidades contiene",
  ),
  price: amountField.refine((value) => value !== "", "Indica el precio"),
  barcode: optionalText(60),
});

export const productFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Mínimo 2 caracteres")
      .max(150, "Máximo 150 caracteres"),
    description: optionalText(PRODUCT_LIMITS.maxDescriptionLength),
    categoryId: z.string().trim().max(128),
    tags: tagList(PRODUCT_LIMITS.maxTags, PRODUCT_LIMITS.maxTagLength),
    price: amountField.refine((value) => value !== "", "Indica el precio"),
    taxRate: percentField,
    cost: amountField,
    unit: z.enum(PRODUCT_UNIT_CODES, "Selecciona una unidad"),
    sku: optionalText(60),
    barcode: optionalText(60),
    trackStock: z.boolean(),
    /** Stock when the product is created; later it changes through movements. */
    initialStock: quantityField,
    minStock: quantityField,
    isActive: z.boolean(),
    presentations: z
      .array(presentationFormSchema)
      .max(
        PRODUCT_LIMITS.maxPresentations,
        `Máximo ${PRODUCT_LIMITS.maxPresentations} presentaciones`,
      )
      .superRefine((items, ctx) => {
        const seen = new Set<string>();

        items.forEach((item, index) => {
          const key = `${item.unit}:${Number(item.factor.replace(",", "."))}`;

          if (seen.has(key)) {
            ctx.addIssue({
              code: "custom",
              message: "Ya hay una presentación igual",
              path: [index, "factor"],
            });
          }
          seen.add(key);
        });
      }),
  })
  .superRefine((values, ctx) => {
    // A barcode identifies a single product or presentation when scanned.
    const seen = new Set([values.barcode].filter(Boolean));

    values.presentations.forEach((item, index) => {
      if (!item.barcode) return;
      if (seen.has(item.barcode)) {
        ctx.addIssue({
          code: "custom",
          message: "Este código de barras ya se usa en este producto",
          path: ["presentations", index, "barcode"],
        });
      }
      seen.add(item.barcode);
    });
  });

export const createProductSchema = z.object({
  values: productFormSchema,
  /** Product of another organization picked from the barcode suggestions. */
  sourceId: id.optional(),
});

/** Code read by a scanner or typed when starting a new product. */
export const barcodeLookupSchema = z.string().trim().min(1).max(60);

export const updateProductSchema = z.object({
  id,
  values: productFormSchema,
});

export const setProductActiveSchema = z.object({
  id,
  isActive: z.boolean(),
});

export const productListSchema = listQuerySchema(PRODUCT_SORT_FIELDS, {
  sort: "updatedAt",
  direction: "desc",
}).extend({
  /** Category id, or "none" for uncategorized products. */
  categoryId: z.string().trim().max(128).default(""),
  status: z.enum(["active", "inactive"]).or(z.literal("")).default(""),
  stock: z.enum(["low", "out"]).or(z.literal("")).default(""),
  tag: z.string().trim().max(PRODUCT_LIMITS.maxTagLength).default(""),
});

export const stockMovementSchema = z
  .object({
    productId: id,
    type: z.enum(STOCK_MOVEMENT_TYPES, "Selecciona un tipo de movimiento"),
    quantity: quantityField.refine(
      (value) => value !== "",
      "Indica una cantidad",
    ),
    reason: optionalText(PRODUCT_LIMITS.maxReasonLength),
    /** Presentation the quantity is counted in; "" for the base unit. */
    presentationId: z.string().trim().max(128),
  })
  .refine(
    (values) =>
      values.type === "COUNT" || Number(values.quantity.replace(",", ".")) > 0,
    { message: "La cantidad debe ser mayor que 0", path: ["quantity"] },
  );

export const productIdSchema = id;

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type PresentationFormValues = z.infer<typeof presentationFormSchema>;
export type ProductListFilters = z.infer<typeof productListSchema>;
export type StockMovementValues = z.infer<typeof stockMovementSchema>;

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: "",
  description: "",
  categoryId: "",
  tags: [],
  price: "",
  taxRate: "",
  cost: "",
  unit: "unit",
  sku: "",
  barcode: "",
  trackStock: true,
  initialStock: "",
  minStock: "",
  isActive: true,
  presentations: [],
};

export const productImageSchema = z.object({
  productId: idField,
  /** Public id Cloudinary returned for the upload. */
  publicId: z.string().trim().min(1).max(255),
});

export const moveProductImageSchema = z.object({
  id: idField,
  /** "first" makes the image the main one. */
  direction: z.enum(["up", "down", "first"]),
});

export const createPresentationSchema = z.object({
  productId: idField,
  values: presentationFormSchema,
});

export const updatePresentationSchema = z.object({
  id: idField,
  values: presentationFormSchema,
});

export const STOCK_MOVEMENT_SORT_FIELDS = ["createdAt", "quantity"] as const;

export const stockMovementListSchema = listQuerySchema(
  STOCK_MOVEMENT_SORT_FIELDS,
  { sort: "createdAt", direction: "desc" },
).extend({
  productId: idField,
  /** Movement types to show; empty shows every type. */
  types: z.array(z.enum(STOCK_MOVEMENT_TYPES)).max(3).default([]),
  /** Author user id; "" for anyone. */
  authorId: z.string().trim().max(128).default(""),
});

export type StockMovementListParams = z.infer<typeof stockMovementListSchema>;
