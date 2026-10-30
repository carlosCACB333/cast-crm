"use client";

import { AppButton } from "./app-button";
import { AppModal } from "./app-modal";

export interface AppConfirmProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  isPending?: boolean;
  onConfirm: () => void;
}

/** Confirmation dialog for destructive actions. */
export function AppConfirm({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  isPending,
  onConfirm,
}: AppConfirmProps) {
  return (
    <AppModal
      description={description}
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton isPending={isPending} variant="danger" onPress={onConfirm}>
            {confirmLabel}
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title={title}
      onOpenChange={onOpenChange}
    />
  );
}
