import { COLORS } from "@/config/colors";
import { APP_LOCALE } from "@/config/organization";
import { findUnit } from "@/config/catalog";

/**
 * Product configuration of the products module. Values that each organization
 * can change (e.g. its categories) live in the database and are edited from
 * its settings; these are the defaults and limits shared by every organization.
 */

/** Units a product is counted in. The code is stored; the labels are shown. */
export const PRODUCT_UNITS = [
  { code: "unit", label: "Unidad", short: "ud." },
  { code: "kg", label: "Kilogramo", short: "kg" },
  { code: "g", label: "Gramo", short: "g" },
  { code: "l", label: "Litro", short: "l" },
  { code: "m", label: "Metro", short: "m" },
  { code: "m2", label: "Metro cuadrado", short: "m²" },
  { code: "box", label: "Caja", short: "caja" },
  { code: "pack", label: "Paquete", short: "paq." },
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number]["code"];

export const PRODUCT_UNIT_CODES = PRODUCT_UNITS.map(
  (unit) => unit.code,
) as unknown as readonly [ProductUnit, ...ProductUnit[]];

export const unitInfo = (code: string) => findUnit(PRODUCT_UNITS, code);

const factorFormatter = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 3,
});

/** Name of a presentation, e.g. "Paquete de 12 ud." or "Caja de 2,5 kg". */
export function presentationLabel(
  unit: string,
  factor: number,
  baseUnit: string,
) {
  return `${unitInfo(unit).label} de ${factorFormatter.format(factor)} ${unitInfo(baseUnit).short}`;
}

export const PRODUCT_STOCK_FILTERS = [
  { value: "low", label: "Stock bajo" },
  { value: "out", label: "Sin stock" },
] as const;

export const STOCK_MOVEMENT_TYPES = ["IN", "OUT", "COUNT"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_MOVEMENT_LABELS: Record<
  StockMovementType,
  { label: string; description: string }
> = {
  IN: { label: "Entrada", description: "Compras, devoluciones o producción" },
  OUT: { label: "Salida", description: "Ventas, mermas o consumo interno" },
  COUNT: {
    label: "Recuento",
    description: "Fija el stock real tras contar el almacén",
  },
};

/** Categories created with every new organization. They can be edited later. */
export const DEFAULT_PRODUCT_CATEGORIES: { name: string; color: string }[] = [
  { name: "General", color: COLORS.blue },
];

export const PRODUCT_LIMITS = {
  pageSize: 25,
  maxTags: 10,
  maxTagLength: 30,
  maxCategories: 50,
  /** Extra ways of selling a product besides its base unit. */
  maxPresentations: 10,
  maxDescriptionLength: 2000,
  maxReasonLength: 200,
  /** Photos per product; the first one is the main image. */
  maxImages: 8,
  /** Largest photo accepted, in bytes. */
  maxImageBytes: 5 * 1024 * 1024,
  /** Rows per page of the stock history. */
  historyPageSize: 20,
  /** Maximum rows in a single CSV export. */
  exportRows: 5000,
  /** Products of other organizations suggested when scanning a barcode. */
  maxBarcodeSuggestions: 10,
};

/** Photo formats accepted by the uploader (checked again by Cloudinary). */
export const PRODUCT_IMAGE_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
] as const;

export const PRODUCT_SORT_FIELDS = [
  "name",
  "price",
  "stock",
  "updatedAt",
] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];
