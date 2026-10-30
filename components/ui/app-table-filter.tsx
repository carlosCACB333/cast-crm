"use client";

import type { OptionSource } from "@/lib/option-sources";

import { useState } from "react";
import { Popover } from "@heroui/react";
import clsx from "clsx";

import { FilterIcon } from "@/components/icons";
import { TABLE_DEFAULTS } from "@/config/tables";

import { AppButton } from "./app-button";
import {
  type AppOption,
  AppFilterAutocomplete,
  OptionList,
  useOptionItems,
} from "./app-autocomplete";
import { AppSearchInput } from "./app-search-input";

/**
 * Controlled filter of a data table. On a column (`AppTableColumn.filter`) it
 * opens from an icon in the header; in `AppDataTable.filters` it is shown in
 * the toolbar above the table.
 */
export type AppTableFilter =
  | {
      type: "options";
      label: string;
      /**
       * Selectable values; the "no filter" state is an empty `value`. With a
       * `source` they are listed before the server options.
       */
      options?: AppOption[];
      /** Options searched and paginated on the server. */
      source?: OptionSource;
      value: string[];
      onChange: (value: string[]) => void;
      /** Allows picking several values (they are combined with OR). */
      multiple?: boolean;
      /** Label of the "no filter" option in the toolbar select. */
      allLabel?: string;
    }
  | {
      type: "text";
      label: string;
      value: string;
      onChange: (value: string) => void;
      placeholder?: string;
    };

export const isFilterActive = (filter: AppTableFilter) =>
  filter.type === "options" ? filter.value.length > 0 : filter.value !== "";

export const clearFilter = (filter: AppTableFilter) =>
  filter.type === "options" ? filter.onChange([]) : filter.onChange("");

function FilterOptions({
  filter,
  isOpen,
  onPicked,
}: {
  filter: Extract<AppTableFilter, { type: "options" }>;
  isOpen: boolean;
  onPicked: () => void;
}) {
  const list = useOptionItems({
    options: filter.options,
    source: filter.source,
    isOpen,
  });

  return (
    <OptionList
      label={filter.label}
      list={list}
      selection={{
        mode: filter.multiple ? "multiple" : "single",
        values: filter.value,
        onChange: (values) => {
          filter.onChange(values);
          onPicked();
        },
      }}
    />
  );
}

function FilterPopover({
  filter,
  trigger,
}: {
  filter: AppTableFilter;
  trigger: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = isFilterActive(filter);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      {trigger}
      <Popover.Content className="w-64">
        <Popover.Dialog className="flex flex-col gap-3">
          <Popover.Heading className="text-sm font-medium">
            Filtrar por {filter.label.toLowerCase()}
          </Popover.Heading>
          {filter.type === "options" ? (
            <FilterOptions
              filter={filter}
              isOpen={isOpen}
              onPicked={() => !filter.multiple && setIsOpen(false)}
            />
          ) : (
            <AppSearchInput
              debounceMs={TABLE_DEFAULTS.searchDebounceMs}
              label={filter.label}
              placeholder={filter.placeholder ?? "Contiene…"}
              value={filter.value}
              onChange={filter.onChange}
            />
          )}
          <div className="flex justify-end">
            <AppButton
              isDisabled={!isActive}
              size="sm"
              variant="ghost"
              onPress={() => clearFilter(filter)}
            >
              Limpiar
            </AppButton>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** Filter icon for a column header; a dot marks it as active. */
export function AppHeaderFilter({ filter }: { filter: AppTableFilter }) {
  const isActive = isFilterActive(filter);

  return (
    <FilterPopover
      filter={filter}
      trigger={
        <AppButton
          isIconOnly
          aria-label={`Filtrar por ${filter.label.toLowerCase()}${isActive ? " (activo)" : ""}`}
          className={clsx(
            "relative size-7 min-w-7",
            isActive ? "text-accent" : "text-muted",
          )}
          size="sm"
          variant="ghost"
        >
          <FilterIcon size={14} />
          {isActive ? (
            <span
              aria-hidden
              className="absolute top-1 right-1 size-1.5 rounded-full bg-accent"
            />
          ) : null}
        </AppButton>
      }
    />
  );
}

/** Filter rendered in the toolbar above a table. */
export function AppToolbarFilter({ filter }: { filter: AppTableFilter }) {
  if (filter.type === "text") {
    return (
      <AppSearchInput
        className="sm:max-w-48"
        debounceMs={TABLE_DEFAULTS.searchDebounceMs}
        label={filter.label}
        placeholder={filter.placeholder ?? filter.label}
        value={filter.value}
        onChange={filter.onChange}
      />
    );
  }

  if (!filter.multiple) {
    return (
      <AppFilterAutocomplete
        label={filter.label}
        options={[
          { value: "", label: filter.allLabel ?? `${filter.label}: todos` },
          ...(filter.options ?? []),
        ]}
        source={filter.source}
        value={filter.value[0] ?? ""}
        onChange={(value) => filter.onChange(value ? [value] : [])}
      />
    );
  }

  const count = filter.value.length;

  return (
    <FilterPopover
      filter={filter}
      trigger={
        <AppButton size="sm" variant={count ? "secondary" : "outline"}>
          <FilterIcon size={14} />
          {count ? `${filter.label} (${count})` : filter.label}
        </AppButton>
      }
    />
  );
}
