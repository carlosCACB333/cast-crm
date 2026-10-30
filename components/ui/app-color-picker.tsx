"use client";

import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from "react-hook-form";
import {
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
} from "@heroui/react";

import { COLOR_PRESETS, DEFAULT_COLOR } from "@/config/colors";

export interface AppColorPickerProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
}

/**
 * Color field bound to a hex string: suggested colors, a saturation/brightness
 * area, a hue slider and a hex input for exact values.
 */
export function AppColorPicker<T extends FieldValues>({
  control,
  name,
  label,
}: AppColorPickerProps<T>) {
  const {
    field: { value, onChange },
    fieldState,
  } = useController({ control, name });
  const color: string = value || DEFAULT_COLOR;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <ColorPicker
        value={color}
        onChange={(next) => onChange(next.toString("hex").toLowerCase())}
      >
        <ColorPicker.Trigger
          aria-label={`${label}: ${color}`}
          className="flex w-fit items-center gap-3 rounded-xl border border-separator bg-surface-secondary px-3 py-2 text-sm outline-none transition-colors hover:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ColorSwatch size="sm" />
          <span className="font-mono text-muted uppercase">{color}</span>
        </ColorPicker.Trigger>
        <ColorPicker.Popover className="max-w-64 gap-3">
          <ColorSwatchPicker
            aria-label="Colores sugeridos"
            className="flex-wrap justify-center"
            size="xs"
          >
            {COLOR_PRESETS.map((preset) => (
              <ColorSwatchPicker.Item key={preset} color={preset}>
                <ColorSwatchPicker.Swatch />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>
          <ColorArea
            aria-label="Saturación y brillo"
            className="max-w-full"
            colorSpace="hsb"
            xChannel="saturation"
            yChannel="brightness"
          >
            <ColorArea.Thumb />
          </ColorArea>
          <ColorSlider
            aria-label="Tono"
            channel="hue"
            className="px-1"
            colorSpace="hsb"
          >
            <ColorSlider.Track>
              <ColorSlider.Thumb />
            </ColorSlider.Track>
          </ColorSlider>
          <ColorField aria-label="Código hexadecimal">
            <ColorField.Group variant="secondary">
              <ColorField.Prefix>
                <ColorSwatch size="xs" />
              </ColorField.Prefix>
              <ColorField.Input />
            </ColorField.Group>
          </ColorField>
        </ColorPicker.Popover>
      </ColorPicker>
      {fieldState.error ? (
        <p className="text-xs text-danger" role="alert">
          {fieldState.error.message}
        </p>
      ) : null}
    </div>
  );
}
