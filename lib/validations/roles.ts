import { z } from "zod";

import { type Permissions, type Resource, statements } from "@/lib/permissions";
import { listQuerySchema } from "@/lib/validations/table";

const permissionSchema = z
  .record(z.string(), z.array(z.string()))
  .refine(
    (permission) =>
      Object.entries(permission).every(
        ([resource, actions]) =>
          resource in statements &&
          actions.every((action) =>
            (statements[resource as Resource] as readonly string[]).includes(
              action,
            ),
          ),
      ),
    "Permisos no válidos",
  );

/** Drops resources without actions before storing a role. */
export function compactPermission(permission: Record<string, string[]>) {
  return Object.fromEntries(
    Object.entries(permission).filter(([, actions]) => actions.length > 0),
  ) as Permissions;
}

export const roleFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(40, "Máximo 40 caracteres"),
  description: z.string().trim().max(160, "Máximo 160 caracteres"),
  permission: permissionSchema,
});

export const updateRoleSchema = roleFormSchema.extend({
  roleId: z.string().trim().min(1).max(128),
});

export type RoleFormValues = z.infer<typeof roleFormSchema>;

export const ROLE_TYPES = ["system", "custom"] as const;

export const roleListSchema = listQuerySchema(["role", "members"], {
  sort: "role",
  direction: "asc",
}).extend({ types: z.array(z.enum(ROLE_TYPES)).max(2).default([]) });

export type RoleListParams = z.infer<typeof roleListSchema>;
