import { z } from "zod";

import {
  SALES_DELIVERY_METHOD_CODES,
  SALES_DOCUMENT_TYPES,
  SALES_LIMITS,
  SALES_SORT_FIELDS,
  SALES_STATUSES,
} from "@/config/sales";
import {
  amountField,
  idField,
  optionalDate,
  optionalText,
  percentField,
  quantityField,
} from "@/lib/validations/fields";
import { listQuerySchema } from "@/lib/validations/table";

export const salesTypeField = z.enum(SALES_DOCUMENT_TYPES);
export const salesStatusField = z.enum(SALES_STATUSES);

/** Catalog item of a line: "product:<id>", "service:<id>" or "" (free line). */
export const salesItemRefField = z
  .string()
  .trim()
  .max(140)
  .refine(
    (value) => value === "" || /^(product|service):[^:\s]+$/.test(value),
    "Selecciona un producto o servicio válido",
  );

/**
 * Presentation of a product line: "" not chosen (only valid for products
 * without presentations), "base" for the base unit, or the presentation id.
 */
export const SALES_BASE_PRESENTATION = "base";

/**
 * Form value of the presentation of a stored line. A product line without one
 * was sold in its base unit; if its presentation was deleted since, it is
 * left unchosen so the user picks one again.
 */
export function storedLinePresentation(line: {
  productId: string | null;
  presentationId: string | null;
  presentationLabel: string | null;
}) {
  if (line.presentationId) return line.presentationId;

  return line.productId && !line.presentationLabel
    ? SALES_BASE_PRESENTATION
    : "";
}

export const salesLineSchema = z.object({
  itemRef: salesItemRefField,
  presentationId: z.string().trim().max(128),
  description: z
    .string()
    .trim()
    .min(1, "Describe la línea")
    .max(
      SALES_LIMITS.maxLineDescriptionLength,
      `Máximo ${SALES_LIMITS.maxLineDescriptionLength} caracteres`,
    ),
  unit: optionalText(30),
  quantity: quantityField.refine(
    (value) => value !== "" && Number(value.replace(",", ".")) > 0,
    "Indica una cantidad mayor que 0",
  ),
  unitPrice: amountField.refine((value) => value !== "", "Indica el precio"),
  discount: percentField,
  taxRate: percentField,
});

export const salesDocumentFormSchema = z
  .object({
    customerId: z.string().trim().min(1, "Selecciona un cliente").max(128),
    issueDate: optionalDate.refine((value) => value !== "", "Indica la fecha"),
    dueDate: optionalDate,
    reference: optionalText(SALES_LIMITS.maxReferenceLength),
    /** "" for types without delivery (invoices). */
    deliveryMethod: z.enum(SALES_DELIVERY_METHOD_CODES).or(z.literal("")),
    shippingAddress: optionalText(SALES_LIMITS.maxAddressLength),
    ownerId: z.string().trim().max(128),
    terms: optionalText(SALES_LIMITS.maxTermsLength),
    internalNotes: optionalText(SALES_LIMITS.maxNotesLength),
    lines: z
      .array(salesLineSchema)
      .min(1, "Añade al menos una línea")
      .max(SALES_LIMITS.maxLines, `Máximo ${SALES_LIMITS.maxLines} líneas`),
  })
  .refine((values) => !values.dueDate || values.dueDate >= values.issueDate, {
    message: "No puede ser anterior a la fecha del documento",
    path: ["dueDate"],
  })
  .refine(
    (values) => values.deliveryMethod !== "shipping" || values.shippingAddress,
    {
      message: "Indica la dirección de envío o elige recogida en tienda",
      path: ["shippingAddress"],
    },
  );

export const createSalesDocumentSchema = z.object({
  type: salesTypeField,
  values: salesDocumentFormSchema,
});

export const updateSalesDocumentSchema = z.object({
  id: idField,
  values: salesDocumentFormSchema,
});

export const setSalesStatusSchema = z.object({
  id: idField,
  status: salesStatusField,
});

export const convertSalesDocumentSchema = z.object({
  id: idField,
  target: salesTypeField,
});

export const salesListSchema = listQuerySchema(SALES_SORT_FIELDS, {
  sort: "issueDate",
  direction: "desc",
}).extend({
  type: salesTypeField.default("QUOTE"),
  status: salesStatusField.or(z.literal("")).default(""),
  customerId: z.string().trim().max(128).default(""),
  /** Owner user id, or "none" for documents without one. */
  ownerId: z.string().trim().max(128).default(""),
  /** Where the documents were made: back office or point of sale. */
  channel: z.enum(["", "BACKOFFICE", "POS"]).default(""),
  /** Invoices only: issued and unpaid after their due date. */
  overdue: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .default(false)
    .transform((value) => value === true || value === "true"),
});

/** A customer's documents of every type, most recent first. */
export const customerSalesSchema = z.object({
  customerId: idField,
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const salesPaymentFormSchema = z.object({
  amount: amountField.refine(
    (value) => value !== "" && Number(value.replace(",", ".")) > 0,
    "Indica un importe mayor que 0",
  ),
  paidOn: optionalDate.refine((value) => value !== "", "Indica la fecha"),
  paymentMethodId: z
    .string()
    .trim()
    .min(1, "Selecciona una forma de pago")
    .max(128),
  note: optionalText(SALES_LIMITS.maxPaymentNoteLength),
  /** Put the money in the caller's open cash session (point of sale). */
  toCashSession: z.boolean(),
});

export const addSalesPaymentSchema = z.object({
  documentId: idField,
  values: salesPaymentFormSchema,
});

const prefixField = z
  .string()
  .trim()
  .max(
    SALES_LIMITS.maxPrefixLength,
    `Máximo ${SALES_LIMITS.maxPrefixLength} caracteres`,
  )
  .regex(/^[\p{L}\p{N}/_.-]*$/u, "Usa solo letras, números, - / _ o .");

const daysField = z
  .string()
  .trim()
  .refine(
    (value) => /^\d{1,3}$/.test(value) && Number(value) <= SALES_LIMITS.maxDays,
    `Introduce un número de días entre 0 y ${SALES_LIMITS.maxDays}`,
  );

export const salesSettingsSchema = z.object({
  quotePrefix: prefixField,
  orderPrefix: prefixField,
  deliveryNotePrefix: prefixField,
  invoicePrefix: prefixField,
  quoteValidityDays: daysField,
  invoiceDueDays: daysField,
  defaultTerms: optionalText(SALES_LIMITS.maxTermsLength),
  stockOnDelivery: z.boolean(),
  allowNegativeStock: z.boolean(),
});

export const salesDocumentIdSchema = idField;

export type SalesLineValues = z.infer<typeof salesLineSchema>;
export type SalesDocumentFormValues = z.infer<typeof salesDocumentFormSchema>;
export type SalesListFilters = z.output<typeof salesListSchema>;
export type SalesListInput = z.input<typeof salesListSchema>;
export type SalesPaymentFormValues = z.infer<typeof salesPaymentFormSchema>;
export type SalesSettingsValues = z.infer<typeof salesSettingsSchema>;

export const EMPTY_SALES_LINE: SalesLineValues = {
  itemRef: "",
  presentationId: "",
  description: "",
  unit: "",
  quantity: "1",
  unitPrice: "",
  discount: "",
  taxRate: "",
};
