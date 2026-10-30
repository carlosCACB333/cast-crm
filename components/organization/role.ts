import type { AppChipProps } from "@/components/ui";

import { OWNER_ROLE } from "@/lib/permissions";

export function roleColor(role: string): AppChipProps["color"] {
  return role === OWNER_ROLE ? "accent" : "default";
}

export const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DEFAULT_LABELS: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
};

/**
 * Display name when the organization's role catalog is not available
 * (e.g. an invitation viewed by someone who is not a member yet).
 */
export function fallbackRoleLabel(role: string) {
  return DEFAULT_LABELS[role] ?? role.replace(/-/g, " ");
}
