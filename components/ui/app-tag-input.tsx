"use client";

import type { OptionSource } from "@/lib/option-sources";

import { useEffect, useId, useState } from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from "react-hook-form";
import { Input, Label, Tag, TagGroup } from "@heroui/react";

import { OPTION_DEFAULTS } from "@/config/tables";
import { useOptionSearch } from "@/hooks/use-options";

/** Suggestions shown at once under the input. */
const MAX_SUGGESTIONS = 8;

export interface AppTagInputProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** Existing tags, searched on the server and offered while typing. */
  source?: OptionSource;
  maxTags?: number;
  maxLength?: number;
  placeholder?: string;
}

/** Free-form tag list bound to a `string[]` form field. Enter or comma adds a tag. */
export function AppTagInput<T extends FieldValues>({
  control,
  name,
  label,
  source,
  maxTags,
  maxLength,
  placeholder = "Escribe y pulsa Enter",
}: AppTagInputProps<T>) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const {
    field: { value, onChange, onBlur },
    fieldState,
  } = useController({ control, name });
  const tags: string[] = value ?? [];
  const isFull = maxTags !== undefined && tags.length >= maxTags;

  const add = (raw: string) => {
    const tag = raw.trim().slice(0, maxLength);

    setDraft("");
    if (!tag || isFull) return;
    if (tags.some((item) => item.toLowerCase() === tag.toLowerCase())) return;
    onChange([...tags, tag]);
  };

  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(
      () => setQuery(draft.trim()),
      OPTION_DEFAULTS.searchDebounceMs,
    );

    return () => clearTimeout(timeout);
  }, [draft]);

  // Searched once the field is used, so closed forms do not query tags.
  const search = useOptionSearch(source, query, isFocused || Boolean(query));
  const matches = (search.data?.pages[0]?.items ?? [])
    .map((item) => item.value)
    .filter(
      (item) => !tags.some((tag) => tag.toLowerCase() === item.toLowerCase()),
    )
    .slice(0, MAX_SUGGESTIONS);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      {tags.length > 0 ? (
        <TagGroup
          aria-label={label}
          size="sm"
          onRemove={(keys) => onChange(tags.filter((tag) => !keys.has(tag)))}
        >
          <TagGroup.List>
            {tags.map((tag) => (
              <Tag key={tag} id={tag} textValue={tag}>
                {tag}
                <Tag.RemoveButton aria-label={`Quitar ${tag}`} />
              </Tag>
            ))}
          </TagGroup.List>
        </TagGroup>
      ) : null}
      <Input
        fullWidth
        aria-invalid={fieldState.invalid || undefined}
        disabled={isFull}
        id={inputId}
        maxLength={maxLength}
        placeholder={
          isFull ? "Has alcanzado el máximo de etiquetas" : placeholder
        }
        value={draft}
        variant="secondary"
        onBlur={() => {
          if (draft.trim()) add(draft);
          onBlur();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add(draft);
          } else if (event.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
      />
      {matches.length > 0 && !isFull ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">Sugerencias:</span>
          {/* preventDefault on mouse down keeps focus in the input, so its
              blur does not add the draft before the suggestion. */}
          {matches.map((item) => (
            <button
              key={item}
              className="rounded-full border border-separator px-2 py-0.5 text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
              type="button"
              onClick={() => add(item)}
              onMouseDown={(event) => event.preventDefault()}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
      {fieldState.error ? (
        <p className="text-xs text-danger" role="alert">
          {fieldState.error.message}
        </p>
      ) : maxTags !== undefined ? (
        <p className="text-xs text-muted">
          {tags.length}/{maxTags} etiquetas
        </p>
      ) : null}
    </div>
  );
}
