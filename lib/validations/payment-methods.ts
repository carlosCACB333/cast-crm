import { z } from "zod";

import {
  PAYMENT_METHOD_KIND_CODES,
  PAYMENT_METHOD_LIMITS,
} from "@/config/payment-methods";
import { idField } from "@/lib/validations/fields";

export const paymentMethodFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(
      PAYMENT_METHOD_LIMITS.maxNameLength,
      `Máximo ${PAYMENT_METHOD_LIMITS.maxNameLength} caracteres`,
    ),
  kind: z.enum(PAYMENT_METHOD_KIND_CODES, "Selecciona el tipo"),
  isActive: z.boolean(),
});

export const updatePaymentMethodSchema = z.object({
  id: idField,
  values: paymentMethodFormSchema,
});

export const movePaymentMethodSchema = z.object({
  id: idField,
  direction: z.enum(["up", "down"]),
});

export type PaymentMethodFormValues = z.infer<typeof paymentMethodFormSchema>;
