"use client";

import { FunnelXIcon } from "@/components/icons";

import { useSelectedLabels } from "./app-autocomplete";
import { AppButton } from "./app-button";
import { type AppTableFilter, isFilterActive } from "./app-table-filter";
import { AppTooltip } from "./app-tooltip";

export interface AppClearFiltersButtonProps {
  /** Text searched; counts as one more filter. */
  search?: string;
  /** Filters of the list; only the active ones are counted and listed. */
  filters: AppTableFilter[];
  onPress: () => void;
}

/** "Label: value" line of the summary, with option labels resolved. */
function AppliedFilter({ filter }: { filter: AppTableFilter }) {
  const isOptions = filter.type === "options";
  const labels = useSelectedLabels(
    isOptions ? filter.value : [],
    isOptions ? filter : {},
    [],
  );
  const value = isOptions ? labels.join(", ") || "…" : `«${filter.value}»`;

  return (
    <li className="truncate">
      <span className="opacity-70">{filter.label}:</span> {value}
    </li>
  );
}

/**
 * Compact icon button that resets the filters of a list or board. Its
 * tooltip lists the filters it will clear. Renders nothing without filters.
 */
export function AppClearFiltersButton({
  search,
  filters,
  onPress,
}: AppClearFiltersButtonProps) {
  const active = filters.filter(isFilterActive);
  const count = active.length + (search ? 1 : 0);

  if (count === 0) return null;

  return (
    <AppTooltip
      content={
        <div className="flex max-w-64 flex-col gap-1 py-0.5 text-xs">
          <span className="font-semibold">Limpiar filtros</span>
          <ul className="flex flex-col gap-0.5">
            {search ? (
              <li className="truncate">
                <span className="opacity-70">Búsqueda:</span> «{search}»
              </li>
            ) : null}
            {active.map((filter) => (
              <AppliedFilter key={filter.label} filter={filter} />
            ))}
          </ul>
        </div>
      }
    >
      <AppButton
        isIconOnly
        aria-label={`Limpiar ${count === 1 ? "1 filtro" : `${count} filtros`}`}
        className="relative overflow-visible text-danger hover:bg-danger/10"
        size="sm"
        variant="ghost"
        onPress={onPress}
      >
        <FunnelXIcon size={16} />
        <span
          aria-hidden
          className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] leading-none font-semibold text-danger-foreground tabular-nums"
        >
          {count}
        </span>
      </AppButton>
    </AppTooltip>
  );
}
