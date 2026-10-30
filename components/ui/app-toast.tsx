"use client";

import { Toast, toast } from "@heroui/react";

export function AppToastProvider() {
  return <Toast.Provider placement="bottom end" />;
}

export const notify = {
  success: (message: string) => toast.success(message),
  warning: (message: string) => toast.warning(message),
  error: (message: string) => toast.danger(message),
};
