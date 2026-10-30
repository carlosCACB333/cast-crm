"use client";

import type { OptionSource, OptionSourceLinks } from "@/lib/option-sources";

import { useEffect, useMemo, useState } from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from "react-hook-form";
import {
  Autocomplete,
  FieldError,
  Label,
  ListBox,
  ListBoxLoadMoreItem,
  SearchField,
  Spinner,
} from "@heroui/react";
import NextLink from "next/link";
import clsx from "clsx";

import { ExternalLinkIcon, PlusIcon } from "@/components/icons";
import { OPTION_DEFAULTS } from "@/config/tables";
import { useOptionLabels, useOptionSearch } from "@/hooks/use-options";
import { normalizeSearch } from "@/lib/pagination";

export interface AppOption {
  value: string;
  label: string;
  description?: string;
}

// React Aria keys cannot be empty, so "" (the usual "all" value) is mapped.
const EMPTY_KEY = "__all__";
const toKey = (value: string) => (value === "" ? EMPTY_KEY : value);
const fromKey = (key: unknown) =>
  key == null || key === EMPTY_KEY ? "" : String(key);

export interface OptionSourceProps {
  /**
   * Fixed options. With a `source` they are listed first (e.g. "Sin asignar");
   * without one they are the whole list and are filtered in the browser.
   */
  options?: AppOption[];
  /** Options searched and paginated on the server. */
  source?: OptionSource;
}

/**
 * Options of a searchable list: fixed ones filtered locally plus the source's
 * pages for the debounced search, loaded while the list is open.
 */
export function useOptionItems({
  options = [],
  source,
  isOpen,
}: OptionSourceProps & { isOpen: boolean }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timeout = setTimeout(
      () => setQuery(draft.trim()),
      OPTION_DEFAULTS.searchDebounceMs,
    );

    return () => clearTimeout(timeout);
  }, [draft]);

  const search = useOptionSearch(source, query, isOpen);
  const term = normalizeSearch(query);
  const fixed = term
    ? options.filter((option) =>
        normalizeSearch(`${option.label} ${option.description ?? ""}`).includes(
          term,
        ),
      )
    : options;
  const loaded = search.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    items: [...fixed, ...loaded],
    loaded,
    draft,
    setDraft,
    showSearch:
      Boolean(source) || options.length > OPTION_DEFAULTS.searchThreshold,
    isLoading: Boolean(source) && search.isPending && isOpen,
    isLoadingMore: search.isFetchingNextPage,
    loadMore: search.hasNextPage ? () => search.fetchNextPage() : undefined,
    error: search.error,
  };
}

/** Labels of the selected values, resolving on the server the ones not loaded. */
export function useSelectedLabels(
  values: string[],
  { options = [], source }: OptionSourceProps,
  loaded: AppOption[],
) {
  const known = new Map(
    [...options, ...loaded].map((option) => [option.value, option.label]),
  );
  const missing = values.filter((value) => value && !known.has(value));
  const resolved = useOptionLabels(source, missing);

  for (const option of resolved.data?.items ?? []) {
    known.set(option.value, option.label);
  }

  // Once resolved, a value the source does not know is shown as is.
  const isResolved = !source || !missing.length || !resolved.isPending;

  return values
    .map((value) => known.get(value) ?? (isResolved ? value : undefined))
    .filter(Boolean) as string[];
}

/** Search field and option list shared by every searchable select. */
export function OptionList({
  label,
  list,
  isInAutocomplete,
  selection,
}: {
  label: string;
  list: ReturnType<typeof useOptionItems>;
  /** Inside `Autocomplete.Filter` the search field is wired by the filter. */
  isInAutocomplete?: boolean;
  /** Selection when the list is used on its own (e.g. a table filter). */
  selection?: {
    mode: "single" | "multiple";
    values: string[];
    onChange: (values: string[]) => void;
  };
}) {
  return (
    <>
      {list.showSearch ? (
        <SearchField
          autoFocus
          aria-label={`Buscar ${label.toLowerCase()}`}
          {...(isInAutocomplete
            ? {}
            : { value: list.draft, onChange: list.setDraft })}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      ) : null}
      <ListBox
        aria-label={label}
        className="max-h-64 overflow-y-auto"
        {...(selection
          ? {
              selectionMode: selection.mode,
              selectedKeys: new Set(selection.values.map(toKey)),
              onSelectionChange: (keys) =>
                selection.onChange(
                  keys === "all"
                    ? list.items.map((option) => option.value)
                    : [...keys].map(fromKey),
                ),
            }
          : {})}
        renderEmptyState={() => (
          <p className="px-3 py-2 text-sm text-muted">
            {list.error
              ? list.error.message
              : list.isLoading
                ? "Cargando…"
                : "Sin resultados"}
          </p>
        )}
      >
        {list.items.map((option) => (
          <ListBox.Item
            key={toKey(option.value)}
            id={toKey(option.value)}
            textValue={option.label}
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate">{option.label}</span>
              {option.description ? (
                <span className="truncate text-xs text-muted">
                  {option.description}
                </span>
              ) : null}
            </div>
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
        {/* Reaching the end of the list loads the next page. */}
        <ListBoxLoadMoreItem
          isLoading={list.isLoadingMore}
          onLoadMore={list.loadMore}
        >
          <div className="flex justify-center py-2">
            <Spinner size="sm" />
          </div>
        </ListBoxLoadMoreItem>
      </ListBox>
    </>
  );
}

interface AutocompleteBaseProps extends OptionSourceProps {
  label: string;
  isLabelHidden?: boolean;
  /** Defaults to full width unless the label is hidden (filters). */
  fullWidth?: boolean;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  isRequired?: boolean;
  isDisabled?: boolean;
  isClearable?: boolean;
  errorMessage?: string;
  name?: string;
  className?: string;
  /** Element right after the visible label, e.g. a link to the records. */
  labelAction?: React.ReactNode;
}

function AutocompleteBase({
  label,
  isLabelHidden,
  fullWidth = !isLabelHidden,
  placeholder,
  value,
  onChange,
  onBlur,
  isRequired,
  isDisabled,
  isClearable,
  errorMessage,
  name,
  className,
  labelAction,
  options,
  source,
}: AutocompleteBaseProps) {
  const [isOpen, setIsOpen] = useState(false);
  const list = useOptionItems({ options, source, isOpen });
  const values = useMemo(() => (value ? [value] : []), [value]);
  const [selected] = useSelectedLabels(
    values,
    { options, source },
    list.loaded,
  );
  // The "all" option of filters ("") is a real option, not an empty value.
  const fixedLabel = options?.find((option) => option.value === value)?.label;
  const display = fixedLabel ?? selected;

  return (
    <Autocomplete
      // Server options load once the list opens, so it must open while empty
      // (React Aria's Select refuses to by default).
      allowsEmptyCollection
      className={className}
      fullWidth={fullWidth}
      isDisabled={isDisabled}
      isInvalid={Boolean(errorMessage)}
      isOpen={isOpen}
      isRequired={isRequired}
      name={name}
      placeholder={placeholder}
      validationBehavior="aria"
      value={value || fixedLabel !== undefined ? toKey(value) : null}
      variant="secondary"
      onBlur={onBlur}
      onChange={(key) => onChange(fromKey(key))}
      onClear={() => onChange("")}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) list.setDraft("");
      }}
    >
      {labelAction && !isLabelHidden ? (
        <div className="flex items-center gap-1">
          <Label>{label}</Label>
          {labelAction}
        </div>
      ) : (
        <Label className={clsx(isLabelHidden && "sr-only")}>{label}</Label>
      )}
      <Autocomplete.Trigger>
        {/* Selected options may not be in the loaded page, so the label is ours. */}
        <Autocomplete.Value>
          {() =>
            display ? (
              <span className="truncate text-foreground">{display}</span>
            ) : value ? (
              "…"
            ) : (
              placeholder
            )
          }
        </Autocomplete.Value>
        {isClearable && value ? <Autocomplete.ClearButton /> : null}
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        {list.showSearch ? (
          // No `filter`: the source searches on the server.
          <Autocomplete.Filter
            inputValue={list.draft}
            onInputChange={list.setDraft}
          >
            <OptionList isInAutocomplete label={label} list={list} />
          </Autocomplete.Filter>
        ) : (
          <OptionList label={label} list={list} />
        )}
      </Autocomplete.Popover>
      <FieldError>{errorMessage}</FieldError>
    </Autocomplete>
  );
}

/**
 * Opens the source's records in a new tab, so a form being filled is not
 * lost: the selected one's detail, or the list while nothing is selected.
 */
function SourceLink({
  links,
  value,
  isIcon,
}: {
  links: OptionSourceLinks;
  value: string;
  isIcon: boolean;
}) {
  const itemHref = value ? links.item?.(value) : null;
  const href = itemHref ?? links.list;
  const text = itemHref ? "Ver ficha" : `Ver ${links.listLabel}`;

  // Next to a visible label: a small icon right after its text.
  if (!isIcon) {
    return (
      <NextLink
        aria-label={text}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-default hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        href={href}
        rel="noopener noreferrer"
        target="_blank"
        title={text}
      >
        <ExternalLinkIcon size={14} />
      </NextLink>
    );
  }

  return (
    <NextLink
      aria-label={text}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-default hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      title={text}
    >
      <ExternalLinkIcon size={16} />
    </NextLink>
  );
}

/** Small icon button that creates a record without leaving the form. */
function CreateButton({
  label,
  isIcon,
  onPress,
}: {
  label: string;
  isIcon: boolean;
  onPress: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={clsx(
        "flex shrink-0 cursor-pointer items-center justify-center text-muted transition-colors hover:bg-default focus-visible:outline-2 focus-visible:outline-accent",
        isIcon
          ? "size-10 rounded-xl hover:text-foreground"
          : "size-6 rounded-md hover:text-accent",
      )}
      title={label}
      type="button"
      onClick={onPress}
    >
      <PlusIcon size={isIcon ? 16 : 14} />
    </button>
  );
}

export interface AppAutocompleteProps<
  T extends FieldValues,
> extends OptionSourceProps {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** Keeps the label for screen readers only, e.g. in table-like rows. */
  isLabelHidden?: boolean;
  placeholder?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  /** Called after the user picks or clears a value, e.g. to fill other fields. */
  onValueChange?: (value: string) => void;
  /** Hides the link to the source's records (shown when the source has one). */
  hideLink?: boolean;
  /** Shows a "+" button to create a record in place, e.g. in a drawer. */
  onCreate?: () => void;
  /** Accessible name of the create button. */
  createLabel?: string;
}

/**
 * Searchable select bound to a form field. Prefer it over a plain select:
 * with a `source` it searches the server and loads more options on scroll.
 */
export function AppAutocomplete<T extends FieldValues>({
  control,
  name,
  label,
  isLabelHidden,
  placeholder = "Selecciona una opción",
  isRequired,
  isDisabled,
  options,
  source,
  onValueChange,
  hideLink,
  onCreate,
  createLabel = "Crear",
}: AppAutocompleteProps<T>) {
  const {
    field: { value, onChange, onBlur },
    fieldState,
  } = useController({ control, name });
  const links = hideLink ? undefined : source?.links;
  const field = (
    <AutocompleteBase
      fullWidth
      errorMessage={fieldState.error?.message}
      isClearable={!isRequired}
      isDisabled={isDisabled}
      isLabelHidden={isLabelHidden}
      isRequired={isRequired}
      label={label}
      labelAction={
        links || onCreate ? (
          <>
            {links ? (
              <SourceLink isIcon={false} links={links} value={value ?? ""} />
            ) : null}
            {onCreate ? (
              <CreateButton
                isIcon={false}
                label={createLabel}
                onPress={onCreate}
              />
            ) : null}
          </>
        ) : undefined
      }
      name={name}
      options={options}
      placeholder={placeholder}
      source={source}
      value={value ?? ""}
      onBlur={onBlur}
      onChange={(next) => {
        onChange(next);
        onValueChange?.(next);
      }}
    />
  );

  // Without a visible label the actions sit next to the field.
  return (links || onCreate) && isLabelHidden ? (
    <div className="flex min-w-0 items-start gap-1">
      <div className="min-w-0 flex-1">{field}</div>
      {links ? <SourceLink isIcon links={links} value={value ?? ""} /> : null}
      {onCreate ? (
        <CreateButton isIcon label={createLabel} onPress={onCreate} />
      ) : null}
    </div>
  ) : (
    field
  );
}

export interface AppFilterAutocompleteProps extends OptionSourceProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Controlled searchable select for list filters (not bound to a form). The
 * label is visually hidden; the first fixed option is usually the "all"
 * value, e.g. `{ value: "", label: "Todos" }`.
 */
export function AppFilterAutocomplete({
  label,
  value,
  onChange,
  placeholder,
  className,
  options,
  source,
}: AppFilterAutocompleteProps) {
  return (
    <AutocompleteBase
      isLabelHidden
      className={clsx("min-w-40", className)}
      label={label}
      options={options}
      placeholder={placeholder ?? label}
      source={source}
      value={value}
      onChange={onChange}
    />
  );
}
