"use client";

import { useState } from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from "react-hook-form";
import {
  Button,
  Description,
  FieldError,
  InputGroup,
  Label,
  TextField,
} from "@heroui/react";

import { EyeIcon, EyeSlashIcon } from "@/components/icons";

export interface AppInputProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** Keeps the label for screen readers only, e.g. in table-like rows. */
  isLabelHidden?: boolean;
  type?: "text" | "email" | "password" | "date";
  inputMode?: "text" | "decimal" | "numeric" | "tel";
  placeholder?: string;
  description?: string;
  autoComplete?: string;
  isRequired?: boolean;
  /** Element rendered next to the label, e.g. a "forgot password" link. */
  labelAction?: React.ReactNode;
  icon?: React.ReactNode;
  /** Short text inside the end of the field, e.g. the unit of a quantity. */
  suffix?: string;
  autoFocus?: boolean;
  /**
   * Runs on Enter instead of submitting the form, e.g. after a barcode
   * scanner types a code.
   */
  onEnter?: () => void;
}

export function AppInput<T extends FieldValues>({
  control,
  name,
  label,
  isLabelHidden,
  type = "text",
  inputMode,
  placeholder,
  description,
  autoComplete,
  isRequired,
  labelAction,
  icon,
  suffix,
  autoFocus,
  onEnter,
}: AppInputProps<T>) {
  const {
    field: { ref, value, onChange, onBlur },
    fieldState,
  } = useController({ control, name });
  const [isVisible, setIsVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <TextField
      fullWidth
      autoComplete={autoComplete}
      isInvalid={fieldState.invalid}
      isRequired={isRequired}
      name={name}
      type={isPassword && isVisible ? "text" : type}
      validationBehavior="aria"
      value={value ?? ""}
      variant="secondary"
      onBlur={onBlur}
      onChange={onChange}
    >
      {isLabelHidden ? (
        <Label className="sr-only">{label}</Label>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <Label>{label}</Label>
          {labelAction}
        </div>
      )}
      <InputGroup fullWidth variant="secondary">
        {icon ? (
          <InputGroup.Prefix className="text-muted">{icon}</InputGroup.Prefix>
        ) : null}
        <InputGroup.Input
          ref={ref}
          autoFocus={autoFocus}
          inputMode={inputMode}
          placeholder={placeholder}
          onKeyDown={
            onEnter
              ? (event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  onEnter();
                }
              : undefined
          }
        />
        {suffix ? (
          <InputGroup.Suffix className="max-w-[45%] truncate text-xs text-muted">
            {suffix}
          </InputGroup.Suffix>
        ) : null}
        {isPassword ? (
          <InputGroup.Suffix className="pe-0">
            <Button
              isIconOnly
              aria-label={
                isVisible ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              size="sm"
              variant="ghost"
              onPress={() => setIsVisible((visible) => !visible)}
            >
              {isVisible ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
            </Button>
          </InputGroup.Suffix>
        ) : null}
      </InputGroup>
      {description && !fieldState.invalid ? (
        <Description>{description}</Description>
      ) : null}
      <FieldError>{fieldState.error?.message}</FieldError>
    </TextField>
  );
}
