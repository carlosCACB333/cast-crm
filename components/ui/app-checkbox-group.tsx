"use client";

import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from "react-hook-form";
import { Checkbox, CheckboxGroup, Description, Label } from "@heroui/react";

export interface AppCheckboxOption {
  value: string;
  label: string;
  isDisabled?: boolean;
}

export interface AppCheckboxGroupProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  options: AppCheckboxOption[];
}

export function AppCheckboxGroup<T extends FieldValues>({
  control,
  name,
  label,
  description,
  options,
}: AppCheckboxGroupProps<T>) {
  const {
    field: { value, onChange, onBlur },
  } = useController({ control, name });

  return (
    <CheckboxGroup
      className="flex flex-col gap-2"
      name={name}
      value={value ?? []}
      variant="secondary"
      onBlur={onBlur}
      onChange={onChange}
    >
      <div className="flex flex-col">
        <Label>{label}</Label>
        {description ? <Description>{description}</Description> : null}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <Checkbox
            key={option.value}
            isDisabled={option.isDisabled}
            value={option.value}
            variant="secondary"
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              {option.label}
            </Checkbox.Content>
          </Checkbox>
        ))}
      </div>
    </CheckboxGroup>
  );
}
