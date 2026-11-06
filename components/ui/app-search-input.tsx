"use client";

import { useEffect, useState } from "react";
import { Label, SearchField } from "@heroui/react";
import clsx from "clsx";

export interface AppSearchInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Waits this long after the last keystroke before calling `onChange`. */
  debounceMs?: number;
  /**
   * Changing it puts the box back to `value` even if `value` looks the same,
   * e.g. a search that is cleared right after being made (a scanned code).
   */
  resetKey?: number;
}

/** Search box for lists. The label is visually hidden. */
export function AppSearchInput({
  label,
  value,
  onChange,
  placeholder,
  className,
  debounceMs = 0,
  resetKey = 0,
}: AppSearchInputProps) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const [syncedResetKey, setSyncedResetKey] = useState(resetKey);

  if (resetKey !== syncedResetKey) {
    setSyncedResetKey(resetKey);
    setSyncedValue(value);
    setDraft(value);
  }

  // Follow external changes (e.g. "clear filters" or back navigation).
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value !== draft.trim()) setDraft(value);
  }

  useEffect(() => {
    if (draft.trim() === value) return;
    const timeout = setTimeout(() => onChange(draft.trim()), debounceMs);

    return () => clearTimeout(timeout);
  }, [draft, value, onChange, debounceMs]);

  return (
    <SearchField
      fullWidth
      className={clsx("min-w-0", className)}
      value={draft}
      variant="secondary"
      onChange={setDraft}
    >
      <Label className="sr-only">{label}</Label>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input placeholder={placeholder} />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}
