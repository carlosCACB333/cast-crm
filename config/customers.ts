import { COLORS } from "@/config/colors";

/**
 * Product configuration of the customers module. Values that each organization
 * can change (e.g. its statuses) live in the database and are edited from its
 * settings; these are the defaults and limits shared by every organization.
 */

export const CUSTOMER_TYPES = ["PERSON", "COMPANY"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  PERSON: "Persona",
  COMPANY: "Empresa",
};

/** Statuses created with every new organization. They can be edited later. */
export const DEFAULT_CUSTOMER_STATUSES: { label: string; color: string }[] = [
  { label: "Prospecto", color: COLORS.blue },
  { label: "Activo", color: COLORS.green },
  { label: "Inactivo", color: COLORS.gray },
];

export const CUSTOMER_LIMITS = {
  pageSize: 25,
  maxTags: 10,
  maxTagLength: 30,
  maxStatuses: 20,
  maxNoteLength: 5000,
  /** Maximum rows in a single CSV export. */
  exportRows: 5000,
};

export const CUSTOMER_SORT_FIELDS = ["name", "createdAt", "updatedAt"] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];
