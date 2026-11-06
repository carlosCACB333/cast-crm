import { z } from "zod";

import {
  CASH_DISCREPANCY_STATUS_CODES,
  CASH_MOVEMENT_TYPE_CODES,
  CASH_REGISTER_MOVEMENT_TYPE_CODES,
  POS_LIMITS,
} from "@/config/pos";
import { SALES_LIMITS } from "@/config/sales";
import { amountField, idField, optionalText } from "@/lib/validations/fields";
import { salesLineSchema } from "@/lib/validations/sales";
import { listQuerySchema } from "@/lib/validations/table";

const positiveAmount = (message: string) =>
  amountField.refine(
    (value) => value !== "" && Number(value.replace(",", ".")) > 0,
    message,
  );

const requiredAmount = (message: string) =>
  amountField.refine((value) => value !== "", message);

const typedAmount = (value: string) => Number(value.replace(",", "."));

const reasonField = z
  .string()
  .trim()
  .min(2, "Indica el motivo")
  .max(
    POS_LIMITS.maxReasonLength,
    `Máximo ${POS_LIMITS.maxReasonLength} caracteres`,
  );

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

/** The cash counted in the drawer must match the register's balance. */
export const openCashSessionSchema = z.object({
  registerId: z.string().trim().min(1, "Selecciona una caja").max(128),
  countedCash: requiredAmount("Indica el efectivo que hay en el cajón"),
});

export const reportCashDiscrepancyFormSchema = z.object({
  reason: reasonField,
});

/** The cashier counted another amount at opening and tells the admin. */
export const reportCashDiscrepancySchema = openCashSessionSchema.extend(
  reportCashDiscrepancyFormSchema.shape,
);

/**
 * Movement of a closed register: entries and withdrawals move `amount`; an
 * adjustment sets the balance to `amount`, the cash actually in the drawer.
 */
export const cashRegisterMovementFormSchema = z
  .object({
    type: z.enum(CASH_REGISTER_MOVEMENT_TYPE_CODES, "Selecciona el tipo"),
    amount: requiredAmount("Indica el importe"),
    reason: reasonField,
  })
  .superRefine((values, ctx) => {
    if (
      values.type !== "ADJUSTMENT" &&
      values.amount &&
      typedAmount(values.amount) <= 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Indica un importe mayor que 0",
      });
    }
  });

export const addCashRegisterMovementSchema = z.object({
  registerId: idField,
  values: cashRegisterMovementFormSchema,
});

export const cashRegisterMovementListSchema = listQuerySchema(
  ["createdAt", "amount"],
  { sort: "createdAt", direction: "desc" },
).extend({
  registerId: idField,
  /** Movement types to show; empty shows every type. */
  types: z.array(z.enum(CASH_REGISTER_MOVEMENT_TYPE_CODES)).max(3).default([]),
  /** Author user id; "" for anyone. */
  authorId: z.string().trim().max(128).default(""),
});

export const cashDiscrepancyReportListSchema = listQuerySchema(["createdAt"], {
  sort: "createdAt",
  direction: "desc",
}).extend({
  registerId: idField,
  /** "" shows every report. */
  status: z.enum(["", ...CASH_DISCREPANCY_STATUS_CODES]).default(""),
  /** Who reported it; "" for anyone. */
  authorId: z.string().trim().max(128).default(""),
});

export const cashMovementFormSchema = z.object({
  type: z.enum(CASH_MOVEMENT_TYPE_CODES, "Selecciona el tipo"),
  amount: positiveAmount("Indica un importe mayor que 0"),
  reason: reasonField,
});

export const addCashMovementSchema = z.object({
  sessionId: idField,
  values: cashMovementFormSchema,
});

/**
 * Cash count at closing. With `withdraw`, `withdrawAmount` leaves the drawer
 * as a cash movement of the session and the rest stays in the register.
 */
export const closeCashSessionFormSchema = z
  .object({
    countedCash: requiredAmount("Indica el efectivo contado"),
    withdraw: z.boolean(),
    withdrawAmount: amountField,
    notes: optionalText(POS_LIMITS.maxClosingNotesLength),
  })
  .superRefine((values, ctx) => {
    if (!values.withdraw) return;

    const amount = values.withdrawAmount
      ? typedAmount(values.withdrawAmount)
      : 0;

    if (amount <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["withdrawAmount"],
        message: "Indica un importe mayor que 0",
      });
    } else if (values.countedCash && amount > typedAmount(values.countedCash)) {
      ctx.addIssue({
        code: "custom",
        path: ["withdrawAmount"],
        message: "No puedes retirar más de lo contado",
      });
    }
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

/** Lines of the cart whose stock is checked before charging. */
export const posStockCheckSchema = z.object({
  lines: z
    .array(
      salesLineSchema.pick({
        itemRef: true,
        presentationId: true,
        quantity: true,
      }),
    )
    .max(SALES_LIMITS.maxLines),
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

export const cashSessionListSchema = listQuerySchema(["openedAt", "closedAt"], {
  sort: "openedAt",
  direction: "desc",
}).extend({
  /** "" for every register. */
  registerId: z.string().trim().max(128).default(""),
  status: z.enum(["", "OPEN", "CLOSED"]).default(""),
});

export const cashRegisterListSchema = listQuerySchema(
  ["name", "cashBalance", "sessionCount"],
  { sort: "name", direction: "asc" },
);

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
export type ReportCashDiscrepancyFormValues = z.infer<
  typeof reportCashDiscrepancyFormSchema
>;
export type CashRegisterMovementFormValues = z.infer<
  typeof cashRegisterMovementFormSchema
>;
export type CashRegisterMovementListParams = z.infer<
  typeof cashRegisterMovementListSchema
>;
export type CashDiscrepancyReportListParams = z.infer<
  typeof cashDiscrepancyReportListSchema
>;
export type CashMovementFormValues = z.infer<typeof cashMovementFormSchema>;
export type CloseCashSessionFormValues = z.infer<
  typeof closeCashSessionFormSchema
>;
export type PosPaymentValues = z.infer<typeof posPaymentSchema>;
export type PosCartValues = z.infer<typeof posCartSchema>;
export type PosStockCheckInput = z.infer<typeof posStockCheckSchema>;
export type HoldPosCartFormValues = z.infer<typeof holdPosCartFormSchema>;
export type PosCheckoutFormValues = z.infer<typeof posCheckoutFormSchema>;
export type CollectInvoiceFormValues = z.infer<typeof collectInvoiceFormSchema>;
export type PosLoadSourceValues = z.infer<typeof posLoadSourceSchema>;
export type PosItemsInput = z.input<typeof posItemsSchema>;
export type CashSessionListParams = z.infer<typeof cashSessionListSchema>;
export type CashRegisterListParams = z.infer<typeof cashRegisterListSchema>;
export type PosSettingsValues = z.infer<typeof posSettingsSchema>;
