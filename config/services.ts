import { COLORS } from "@/config/colors";
import { findUnit } from "@/config/catalog";

/**
 * Product configuration of the services module. Values that each
 * organization can change (e.g. its categories) live in the database and are
 * edited from its settings; these are the defaults and limits.
 */

/** Units a service is charged by. The code is stored; the labels are shown. */
export const SERVICE_UNITS = [
  { code: "hour", label: "Hora", short: "h" },
  { code: "session", label: "Sesión", short: "sesión" },
  { code: "day", label: "Día", short: "día" },
  { code: "week", label: "Semana", short: "sem." },
  { code: "month", label: "Mes", short: "mes" },
  { code: "year", label: "Año", short: "año" },
  { code: "project", label: "Proyecto", short: "proyecto" },
  { code: "service", label: "Servicio", short: "serv." },
] as const;

export type ServiceUnit = (typeof SERVICE_UNITS)[number]["code"];

export const SERVICE_UNIT_CODES = SERVICE_UNITS.map(
  (unit) => unit.code,
) as unknown as readonly [ServiceUnit, ...ServiceUnit[]];

export const serviceUnitInfo = (code: string) => findUnit(SERVICE_UNITS, code);

/** Categories created with every new organization. They can be edited later. */
export const DEFAULT_SERVICE_CATEGORIES: { name: string; color: string }[] = [
  { name: "General", color: COLORS.blue },
];

export const SERVICE_LIMITS = {
  pageSize: 25,
  maxTags: 10,
  maxTagLength: 30,
  maxCategories: 50,
  maxDescriptionLength: 2000,
  /** Longest estimated duration, in minutes (30 days). */
  maxDurationMinutes: 60 * 24 * 30,
  /** Maximum rows in a single CSV export. */
  exportRows: 5000,
};

export const SERVICE_SORT_FIELDS = ["name", "price", "updatedAt"] as const;
export type ServiceSortField = (typeof SERVICE_SORT_FIELDS)[number];
