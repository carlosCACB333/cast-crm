"use server";

import { APIError } from "better-auth/api";
import { z } from "zod";

import { getActorContext } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { TABLE_DEFAULTS } from "@/config/tables";
import { auth } from "@/lib/auth";
import { OWNER_LABEL, listOrganizationRoles } from "@/lib/organization";
import { type Page, paginateInMemory } from "@/lib/pagination";
import { type Permissions, includesPermissions } from "@/lib/permissions";
import { idSchema, slugify } from "@/lib/validations/organization";
import {
  compactPermission,
  roleFormSchema,
  roleListSchema,
  updateRoleSchema,
} from "@/lib/validations/roles";

// Better Auth enforces `ac:*` permissions on role endpoints and rejects roles
// that grant permissions the caller does not have.

export interface MyAccess {
  role: string;
  roleLabel: string;
  isOwner: boolean;
  permissions: Permissions;
}

export type OrganizationRoleItem = Awaited<
  ReturnType<typeof listOrganizationRoles>
>[number];

/** Role and effective permissions of the caller in the active organization. */
export async function getMyAccess(): Promise<ActionResult<MyAccess>> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId, access } = await getActorContext();
    const roles = await listOrganizationRoles(organizationId, {
      includePermissions: false,
    });
    const roleLabel =
      roles.find((item) => item.role === access.role)?.label ??
      (access.isOwner ? OWNER_LABEL : access.role);

    return {
      role: access.role,
      roleLabel,
      isOwner: access.isOwner,
      permissions: access.permissions,
    };
  });
}

/**
 * Roles of the active organization. Any member can list them (names are needed
 * to show and assign roles); the permission detail requires `ac:read`.
 */
export async function listRoles(): Promise<
  ActionResult<OrganizationRoleItem[]>
> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId, access } = await getActorContext();

    return listOrganizationRoles(organizationId, {
      includePermissions: includesPermissions(access.permissions, {
        ac: ["read"],
      }),
    });
  });
}

/**
 * Roles table. Organizations have at most 50 roles and member counts are
 * computed, so the page is built in memory on the server.
 */
export async function listRolePage(
  input: unknown,
): Promise<ActionResult<Page<OrganizationRoleItem>>> {
  return runAction(roleListSchema, input, async (params) => {
    const { organizationId, access } = await getActorContext();
    const roles = await listOrganizationRoles(organizationId, {
      includePermissions: includesPermissions(access.permissions, {
        ac: ["read"],
      }),
    });
    const { types } = params;

    return paginateInMemory(
      types.length
        ? roles.filter((role) =>
            types.includes(role.isSystem ? "system" : "custom"),
          )
        : roles,
      {
        ...params,
        pageSize: TABLE_DEFAULTS.pageSize,
        searchText: (role) => [role.label, role.description],
        sortValue: (role) =>
          params.sort === "members" ? role.memberCount : role.label,
      },
    );
  });
}

export async function createRole(input: unknown): Promise<ActionResult> {
  return runAction(
    roleFormSchema,
    input,
    async ({ label, description, permission }) => {
      const { headers } = await getActorContext();
      const role = slugify(label);

      if (!role) {
        throw new APIError("BAD_REQUEST", { code: "INVALID_ROLE_NAME" });
      }

      await auth.api.createOrgRole({
        headers,
        body: {
          role,
          permission: compactPermission(permission),
          additionalFields: { label, description: description || undefined },
        },
      });

      return undefined;
    },
  );
}

export async function updateRole(input: unknown): Promise<ActionResult> {
  return runAction(
    updateRoleSchema,
    input,
    async ({ roleId, label, description, permission }) => {
      const { headers } = await getActorContext();

      await auth.api.updateOrgRole({
        headers,
        body: {
          roleId,
          data: {
            permission: compactPermission(permission),
            label,
            description,
          },
        },
      });

      return undefined;
    },
  );
}

export async function deleteRole(roleId: unknown): Promise<ActionResult> {
  return runAction(idSchema, roleId, async (id) => {
    const { headers } = await getActorContext();

    await auth.api.deleteOrgRole({ headers, body: { roleId: id } });

    return undefined;
  });
}
