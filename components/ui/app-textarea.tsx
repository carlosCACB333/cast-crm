"use client";

import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from "react-hook-form";
import {
  Description,
  FieldError,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";

export interface AppTextareaProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** Hides the label visually; it is still announced to screen readers. */
  isLabelHidden?: boolean;
  placeholder?: string;
  description?: string;
  rows?: number;
  isRequired?: boolean;
  /** Called on Ctrl/Cmd + Enter, e.g. to submit a note quickly. */
  onSubmitShortcut?: () => void;
}

export function AppTextarea<T extends FieldValues>({
  control,
  name,
  label,
  isLabelHidden,
  placeholder,
  description,
  rows = 3,
  isRequired,
  onSubmitShortcut,
}: AppTextareaProps<T>) {
  const {
    field: { ref, value, onChange, onBlur },
    fieldState,
  } = useController({ control, name });

  return (
    <TextField
      fullWidth
      isInvalid={fieldState.invalid}
      isRequired={isRequired}
      name={name}
      validationBehavior="aria"
      value={value ?? ""}
      variant="secondary"
      onBlur={onBlur}
      onChange={onChange}
    >
      <Label className={isLabelHidden ? "sr-only" : undefined}>{label}</Label>
      <TextArea
        ref={ref}
        fullWidth
        placeholder={placeholder}
        rows={rows}
        variant="secondary"
        onKeyDown={(event) => {
          if (
            onSubmitShortcut &&
            event.key === "Enter" &&
            (event.metaKey || event.ctrlKey)
          ) {
            event.preventDefault();
            onSubmitShortcut();
          }
        }}
      />
      {description && !fieldState.invalid ? (
        <Description>{description}</Description>
      ) : null}
      <FieldError>{fieldState.error?.message}</FieldError>
    </TextField>
  );
}
