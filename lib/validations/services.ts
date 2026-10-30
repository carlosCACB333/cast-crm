import { z } from "zod";

import {
  SERVICE_LIMITS,
  SERVICE_SORT_FIELDS,
  SERVICE_UNIT_CODES,
} from "@/config/services";
import {
  amountField,
  idField,
  optionalText,
  percentField,
  tagList,
} from "@/lib/validations/fields";
import { listQuerySchema } from "@/lib/validations/table";

/** Hours and minutes typed separately; both empty means no duration. */
const durationPart = (max: number) =>
  z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" || (/^\d{1,3}$/.test(value) && Number(value) <= max),
      `Introduce un número entre 0 y ${max}`,
    );

export const serviceFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Mínimo 2 caracteres")
      .max(150, "Máximo 150 caracteres"),
    code: optionalText(60),
    description: optionalText(SERVICE_LIMITS.maxDescriptionLength),
    categoryId: z.string().trim().max(128),
    tags: tagList(SERVICE_LIMITS.maxTags, SERVICE_LIMITS.maxTagLength),
    price: amountField.refine((value) => value !== "", "Indica el precio"),
    unit: z.enum(SERVICE_UNIT_CODES, "Selecciona una unidad"),
    taxRate: percentField,
    cost: amountField,
    durationHours: durationPart(SERVICE_LIMITS.maxDurationMinutes / 60),
    durationMinutes: durationPart(59),
    isActive: z.boolean(),
  })
  .refine(
    (values) =>
      Number(values.durationHours || 0) * 60 +
        Number(values.durationMinutes || 0) <=
      SERVICE_LIMITS.maxDurationMinutes,
    { message: "La duración es demasiado larga", path: ["durationHours"] },
  );

export const updateServiceSchema = z.object({
  id: idField,
  values: serviceFormSchema,
});

export const setServiceActiveSchema = z.object({
  id: idField,
  isActive: z.boolean(),
});

export const serviceListSchema = listQuerySchema(SERVICE_SORT_FIELDS, {
  sort: "updatedAt",
  direction: "desc",
}).extend({
  /** Category id, or "none" for uncategorized services. */
  categoryId: z.string().trim().max(128).default(""),
  status: z.enum(["active", "inactive"]).or(z.literal("")).default(""),
  tag: z.string().trim().max(SERVICE_LIMITS.maxTagLength).default(""),
});

export const serviceIdSchema = idField;

export type ServiceFormValues = z.infer<typeof serviceFormSchema>;
export type ServiceListFilters = z.infer<typeof serviceListSchema>;

export const EMPTY_SERVICE_FORM: ServiceFormValues = {
  name: "",
  code: "",
  description: "",
  categoryId: "",
  tags: [],
  price: "",
  unit: "hour",
  taxRate: "",
  cost: "",
  durationHours: "",
  durationMinutes: "",
  isActive: true,
};
