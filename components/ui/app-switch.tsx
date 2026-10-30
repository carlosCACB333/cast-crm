"use client";

import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from "react-hook-form";
import { Description, Label, Switch } from "@heroui/react";

export interface AppSwitchProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  isDisabled?: boolean;
}

/** On/off field of a form, with its label and an optional explanation. */
export function AppSwitch<T extends FieldValues>({
  control,
  name,
  label,
  description,
  isDisabled,
}: AppSwitchProps<T>) {
  const {
    field: { ref, value, onChange, onBlur },
  } = useController({ control, name });

  return (
    <Switch
      ref={ref}
      className="flex flex-col items-start gap-1"
      isDisabled={isDisabled}
      isSelected={Boolean(value)}
      name={name}
      onBlur={onBlur}
      onChange={onChange}
    >
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label>{label}</Label>
      </Switch.Content>
      {description ? <Description>{description}</Description> : null}
    </Switch>
  );
}
