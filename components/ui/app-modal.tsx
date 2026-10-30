"use client";

import { Modal } from "@heroui/react";

export interface AppModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** "lg" for forms with several fields per row. */
  size?: "md" | "lg";
}

export function AppModal({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: AppModalProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className={size === "lg" ? "sm:max-w-xl" : "sm:max-w-md"}>
          <Modal.CloseTrigger />
          <Modal.Header className="flex flex-col items-start gap-1">
            <Modal.Heading>{title}</Modal.Heading>
            {description ? (
              <p className="text-sm text-muted">{description}</p>
            ) : null}
          </Modal.Header>
          {children ? (
            <Modal.Body className="flex flex-col gap-4">{children}</Modal.Body>
          ) : null}
          {footer ? (
            <Modal.Footer className="flex justify-end gap-2">
              {footer}
            </Modal.Footer>
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
