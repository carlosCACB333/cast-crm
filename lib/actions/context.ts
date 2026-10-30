import "server-only";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getMemberAccess } from "@/lib/organization";
import { type Permissions, includesPermissions } from "@/lib/permissions";

/**
 * Session, active organization and effective permissions of the caller.
 * Throws an APIError (handled by runAction) when not signed in or not a member.
 */
export async function getActorContext() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) throw new APIError("UNAUTHORIZED");

  const organizationId = session.session.activeOrganizationId;

  if (!organizationId) {
    throw new APIError("BAD_REQUEST", { code: "NO_ACTIVE_ORGANIZATION" });
  }

  const access = await getMemberAccess(organizationId, session.user.id);

  if (!access) {
    throw new APIError("FORBIDDEN", {
      code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION",
    });
  }

  return { headers: requestHeaders, session, organizationId, access };
}

/** Actor context that also requires the given permissions in the active organization. */
export async function requirePermission(permissions: Permissions) {
  const context = await getActorContext();

  if (!includesPermissions(context.access.permissions, permissions)) {
    throw new APIError("FORBIDDEN");
  }

  return context;
}
