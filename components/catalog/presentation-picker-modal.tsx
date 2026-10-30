"use client";

import clsx from "clsx";

import { CheckIcon } from "@/components/icons";
import { AppButton, AppModal } from "@/components/ui";

export interface PresentationPickerOption {
  /** "base" for the product's base unit, or the presentation id. */
  id: string;
  label: string;
  /** Secondary line, e.g. the barcode. */
  detail?: string | null;
  /** Price already formatted. */
  price: string;
}

/**
 * Asks which presentation of a product is being sold (its base unit or a
 * pack, box…), since each one has its own price and stock factor.
 */
export function PresentationPickerModal({
  title,
  options,
  selectedId,
  onOpenChange,
  onPick,
}: {
  title: string;
  options: PresentationPickerOption[];
  selectedId?: string;
  onOpenChange: (isOpen: boolean) => void;
  onPick: (id: string) => void;
}) {
  return (
    <AppModal
      isOpen
      description="Cada presentación tiene su precio y descuenta del stock las unidades que contiene."
      footer={
        <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
          Cancelar
        </AppButton>
      }
      title={title}
      onOpenChange={onOpenChange}
    >
      <ul className="flex flex-col gap-2">
        {options.map((option) => {
          const isSelected = option.id === selectedId;

          return (
            <li key={option.id}>
              <button
                aria-pressed={isSelected}
                className={clsx(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border bg-surface p-3 text-left transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.99]",
                  isSelected ? "border-accent" : "border-separator",
                )}
                type="button"
                onClick={() => {
                  onPick(option.id);
                  onOpenChange(false);
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {isSelected ? (
                    <CheckIcon className="shrink-0 text-accent" size={16} />
                  ) : null}
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{option.label}</span>
                    {option.detail ? (
                      <span className="truncate text-xs text-muted tabular-nums">
                        {option.detail}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {option.price}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </AppModal>
  );
}
