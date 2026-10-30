/** Definitions shared by the catalog modules (products and services). */

/** A unit a price or a quantity refers to. The code is stored. */
export interface UnitDefinition {
  code: string;
  label: string;
  /** Short form shown after numbers, e.g. "ud." or "h". */
  short: string;
}

/** Unit of a list by its code; unknown codes are shown as they are. */
export function findUnit(units: readonly UnitDefinition[], code: string) {
  return (
    units.find((unit) => unit.code === code) ?? {
      code,
      label: code,
      short: code,
    }
  );
}

/** Filters of a catalog list (products, services) by availability. */
export const CATALOG_STATUS_FILTERS = [
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
] as const;
