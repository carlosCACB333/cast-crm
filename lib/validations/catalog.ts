import { z } from "zod";

import { colorField, idField } from "@/lib/validations/fields";

// Categories work the same way in every catalog module (products, services).

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(40, "Máximo 40 caracteres"),
  color: colorField,
});

export const updateCategorySchema = z.object({
  id: idField,
  values: categoryFormSchema,
});

export const moveCategorySchema = z.object({
  id: idField,
  direction: z.enum(["up", "down"]),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
