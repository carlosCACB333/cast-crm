import { z } from "zod";

import { HEX_COLOR_PATTERN } from "@/config/colors";

// Shared field rules for CRM forms. Optional fields are plain strings in the
// form ("" = empty); the server stores empty values as null.

export const idField = z.string().trim().min(1).max(128);

export const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`);

export const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .refine(
    (value) => value === "" || z.email().safeParse(value).success,
    "Introduce un correo válido",
  );

export const optionalPhone = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^[+()\d\s.-]{6,25}$/.test(value),
    "Introduce un teléfono válido",
  );

/** Amount typed by the user: digits with up to two decimals, "." or ",". */
export const amountField = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{1,12}([.,]\d{1,2})?$/.test(value),
    "Introduce un importe válido, por ejemplo 1500 o 1500,50",
  );

/** Quantity typed by the user: digits with up to three decimals. */
export const quantityField = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{1,11}([.,]\d{1,3})?$/.test(value),
    "Introduce una cantidad válida, por ejemplo 10 o 2,5",
  );

/** Percentage from 0 to 100 with up to two decimals. */
export const percentField = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (/^\d{1,3}([.,]\d{1,2})?$/.test(value) &&
        Number(value.replace(",", ".")) <= 100),
    "Introduce un porcentaje entre 0 y 100",
  );

/** "YYYY-MM-DD" date from a date input; "" when empty. */
export const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())),
    "Introduce una fecha válida",
  );

/** Stores a "YYYY-MM-DD" date at UTC midnight, as `@db.Date` expects. */
export const toDbDate = (value: string) => new Date(`${value}T00:00:00Z`);

/** A `@db.Date` value as "YYYY-MM-DD". */
export const fromDbDate = (value: Date) => value.toISOString().slice(0, 10);

/** Parses a validated decimal typed with "," or "."; "" becomes null. */
export function toDecimal(value: string) {
  return value === "" ? null : value.replace(",", ".");
}

export const tagList = (maxTags: number, maxLength: number) =>
  z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(maxLength, `Máximo ${maxLength} caracteres por etiqueta`),
    )
    .max(maxTags, `Máximo ${maxTags} etiquetas`);

/** Hex color from the color picker, normalized to lowercase #rrggbb. */
export const colorField = z
  .string("Elige un color")
  .trim()
  .toLowerCase()
  .regex(HEX_COLOR_PATTERN, "Elige un color válido");

export function emptyToNull(value: string) {
  return value === "" ? null : value;
}

/** Removes repeated tags ignoring case, keeping the first spelling. */
export function normalizeTags(tags: string[]) {
  const seen = new Set<string>();

  return tags.filter((tag) => {
    const key = tag.toLocaleLowerCase("es");

    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
}
