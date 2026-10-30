"use client";

import { Button, Spinner } from "@heroui/react";

export interface AppButtonProps {
  children: React.ReactNode;
  type?: "button" | "submit";
  /** Id of the form a submit button belongs to when rendered outside of it. */
  form?: string;
  variant?:
    "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  isIconOnly?: boolean;
  isPending?: boolean;
  isDisabled?: boolean;
  className?: string;
  "aria-label"?: string;
  onPress?: () => void;
}

export function AppButton({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  isPending = false,
  ...props
}: AppButtonProps) {
  return (
    <Button
      isPending={isPending}
      size={size}
      type={type}
      variant={variant}
      {...props}
    >
      {isPending ? <Spinner color="current" size="sm" /> : null}
      {children}
    </Button>
  );
}
