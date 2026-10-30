import { z } from "zod";

import {
  colorField,
  idField,
  optionalEmail,
  optionalPhone,
  optionalText,
  tagList,
} from "@/lib/validations/fields";
import {
  CUSTOMER_LIMITS,
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_TYPES,
} from "@/config/customers";

const id = idField;

export const customerFormSchema = z.object({
  type: z.enum(CUSTOMER_TYPES, "Selecciona un tipo"),
  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(120, "Máximo 120 caracteres"),
  companyName: optionalText(120),
  jobTitle: optionalText(80),
  email: optionalEmail,
  phone: optionalPhone,
  website: optionalText(200).refine(
    (value) =>
      value === "" || /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(value),
    "Introduce una web válida, por ejemplo acme.com",
  ),
  taxId: optionalText(40),
  address: optionalText(200),
  city: optionalText(80),
  region: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(80),
  statusId: z.string().trim().max(128),
  ownerId: z.string().trim().max(128),
  tags: tagList(CUSTOMER_LIMITS.maxTags, CUSTOMER_LIMITS.maxTagLength),
});

export const updateCustomerSchema = z.object({
  id,
  values: customerFormSchema,
});

export const updateCustomerStatusSchema = z.object({
  id,
  statusId: id,
});

export const customerListSchema = z.object({
  q: z.string().trim().max(100).default(""),
  statusId: z.string().trim().max(128).default(""),
  type: z.enum(CUSTOMER_TYPES).or(z.literal("")).default(""),
  /** Member user id, "me" for the caller or "none" for unassigned. */
  ownerId: z.string().trim().max(128).default(""),
  tag: z.string().trim().max(CUSTOMER_LIMITS.maxTagLength).default(""),
  sort: z.enum(CUSTOMER_SORT_FIELDS).default("updatedAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const customerNoteSchema = z.object({
  customerId: id,
  body: z
    .string()
    .trim()
    .min(1, "Escribe una nota")
    .max(
      CUSTOMER_LIMITS.maxNoteLength,
      `Máximo ${CUSTOMER_LIMITS.maxNoteLength} caracteres`,
    ),
});

export const customerStatusFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(40, "Máximo 40 caracteres"),
  color: colorField,
});

export const updateCustomerStatusDefinitionSchema = z.object({
  id,
  values: customerStatusFormSchema,
});

export const moveCustomerStatusSchema = z.object({
  id,
  direction: z.enum(["up", "down"]),
});

export const customerIdSchema = id;

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
export type CustomerListFilters = z.infer<typeof customerListSchema>;
export type CustomerNoteValues = z.infer<typeof customerNoteSchema>;
export type CustomerStatusFormValues = z.infer<typeof customerStatusFormSchema>;

export const EMPTY_CUSTOMER_FORM: CustomerFormValues = {
  type: "PERSON",
  name: "",
  companyName: "",
  jobTitle: "",
  email: "",
  phone: "",
  website: "",
  taxId: "",
  address: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  statusId: "",
  ownerId: "",
  tags: [],
};
