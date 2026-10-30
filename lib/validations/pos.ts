import { z } from "zod";

import { CASH_MOVEMENT_TYPE_CODES, POS_LIMITS } from "@/config/pos";
import { SALES_LIMITS } from "@/config/sales";
import { amountField, idField, optionalText } from "@/lib/validations/fields";
import { salesLineSchema } from "@/lib/validations/sales";

const positiveAmount = (message: string) =>
  amountField.refine(
    (value) => value !== "" && Number(value.replace(",", ".")) > 0,
    message,
  );

const requiredAmount = (message: string) =>
  amountField.refine((value) => value !== "", message);

export const cashRegisterFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(
      POS_LIMITS.maxRegisterNameLength,
      `Máximo ${POS_LIMITS.maxRegisterNameLength} caracteres`,
    ),
  isActive: z.boolean(),
});

export const updateCashRegisterSchema = z.object({
  id: idField,
  values: cashRegisterFormSchema,
});

export const openCashSessionSchema = z.object({
  registerId: z.string().trim().min(1, "Selecciona una caja").max(128),
  openingAmount: requiredAmount("Indica el efectivo con el que abres"),
});

export const cashMovementFormSchema = z.object({
  type: z.enum(CASH_MOVEMENT_TYPE_CODES, "Selecciona el tipo"),
  amount: positiveAmount("Indica un importe mayor que 0"),
  reason: z
    .string()
    .trim()
    .min(2, "Indica el motivo")
    .max(
      POS_LIMITS.maxReasonLength,
      `Máximo ${POS_LIMITS.maxReasonLength} caracteres`,
    ),
});

export const addCashMovementSchema = z.object({
  sessionId: idField,
  values: cashMovementFormSchema,
});

export const closeCashSessionFormSchema = z.object({
  countedCash: requiredAmount("Indica el efectivo contado"),
  notes: optionalText(POS_LIMITS.maxClosingNotesLength),
});

export const closeCashSessionSchema = z.object({
  sessionId: idField,
  values: closeCashSessionFormSchema,
});

/** One way the customer pays a ticket; `tendered` only for cash. */
export const posPaymentSchema = z.object({
  paymentMethodId: z
    .string()
    .trim()
    .min(1, "Selecciona una forma de pago")
    .max(128),
  amount: positiveAmount("Indica un importe mayor que 0"),
  tendered: amountField,
});

/** The cart of the till: lines, optional customer and source document. */
export const posCartSchema = z.object({
  /** "" sells to the walk-in customer. */
  customerId: z.string().trim().max(128),
  /** Quote or order loaded into the till; "" when none. */
  sourceId: z.string().trim().max(128),
  lines: z
    .array(
      salesLineSchema.extend({
        /**
         * Price the line started with (catalog or loaded document), to show
         * when it was changed at the till. Display only: never stored.
         */
        listPrice: amountField.optional(),
      }),
    )
    .min(1, "Añade al menos un artículo")
    .max(SALES_LIMITS.maxLines, `Máximo ${SALES_LIMITS.maxLines} líneas`),
});

export const posCheckoutFormSchema = z.object({
  payments: z
    .array(posPaymentSchema)
    .max(
      POS_LIMITS.maxPaymentsPerTicket,
      `Máximo ${POS_LIMITS.maxPaymentsPerTicket} formas de pago`,
    ),
});

export const createPosTicketSchema = posCartSchema.extend(
  posCheckoutFormSchema.shape,
);

export const collectInvoiceFormSchema = z.object({
  documentId: z.string().trim().min(1, "Selecciona una factura").max(128),
  payment: posPaymentSchema,
});

export const holdPosCartFormSchema = z.object({
  note: optionalText(POS_LIMITS.maxHeldCartNoteLength),
  /** Other registers can see and recover it; otherwise only this one. */
  isShared: z.boolean(),
});

/** The cart parked as it is, with a note to find it again. */
export const holdPosCartSchema = posCartSchema.extend(
  holdPosCartFormSchema.shape,
);

export const posLoadSourceSchema = z.object({
  documentId: z.string().trim().min(1, "Selecciona un documento").max(128),
});

export const posItemsSchema = z.object({
  q: z.string().trim().max(100).default(""),
  kind: z.enum(["", "product", "service"]).default(""),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export const cashSessionListSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  registerId: z.string().trim().max(128).default(""),
  status: z.enum(["", "OPEN", "CLOSED"]).default(""),
});

const prefixField = z
  .string()
  .trim()
  .max(
    SALES_LIMITS.maxPrefixLength,
    `Máximo ${SALES_LIMITS.maxPrefixLength} caracteres`,
  )
  .regex(/^[\p{L}\p{N}/_.-]*$/u, "Usa solo letras, números, - / _ o .");

export const posSettingsSchema = z.object({
  ticketPrefix: prefixField,
  walkInCustomerName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(
      POS_LIMITS.maxWalkInNameLength,
      `Máximo ${POS_LIMITS.maxWalkInNameLength} caracteres`,
    ),
});

export type CashRegisterFormValues = z.infer<typeof cashRegisterFormSchema>;
export type OpenCashSessionValues = z.infer<typeof openCashSessionSchema>;
export type CashMovementFormValues = z.infer<typeof cashMovementFormSchema>;
export type CloseCashSessionFormValues = z.infer<
  typeof closeCashSessionFormSchema
>;
export type PosPaymentValues = z.infer<typeof posPaymentSchema>;
export type PosCartValues = z.infer<typeof posCartSchema>;
export type HoldPosCartFormValues = z.infer<typeof holdPosCartFormSchema>;
export type PosCheckoutFormValues = z.infer<typeof posCheckoutFormSchema>;
export type CollectInvoiceFormValues = z.infer<typeof collectInvoiceFormSchema>;
export type PosLoadSourceValues = z.infer<typeof posLoadSourceSchema>;
export type PosItemsInput = z.input<typeof posItemsSchema>;
export type CashSessionListFilters = z.output<typeof cashSessionListSchema>;
export type PosSettingsValues = z.infer<typeof posSettingsSchema>;
