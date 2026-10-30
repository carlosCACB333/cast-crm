"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";

import { getActorContext, requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { auth } from "@/lib/auth";
import { assetFolder, deleteImagesInFolder } from "@/lib/cloudinary";
import {
  canCreateOrganization,
  findInvitationPage,
  findMemberPage,
  getRolePermissions,
  listUserOrganizations,
} from "@/lib/organization";
import { OWNER_ROLE, includesPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  createOrganizationSchema,
  deleteOrganizationSchema,
  idSchema,
  invitationListSchema,
  inviteMemberSchema,
  memberListSchema,
  slugify,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from "@/lib/validations/organization";

// Better Auth verifies the session, membership and role permissions for every
// endpoint below. Organization-scoped endpoints run against the session's
// active organization, so no organization id is ever taken from the client.

export type UserOrganization = Awaited<
  ReturnType<typeof listUserOrganizations>
>[number];

/** Read used by TanStack Query: only the signed-in user's own memberships. */
export async function listMyOrganizations(): Promise<
  ActionResult<UserOrganization[]>
> {
  return runAction(z.undefined(), undefined, async () => {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      throw new APIError("UNAUTHORIZED");
    }

    return listUserOrganizations(session.user.id);
  });
}

/** Whether the signed-in user may create organizations (see DEPLOYMENT_MODE). */
export async function getOrganizationCreationAccess(): Promise<
  ActionResult<{ canCreate: boolean }>
> {
  return runAction(z.undefined(), undefined, async () => {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      throw new APIError("UNAUTHORIZED");
    }

    return { canCreate: await canCreateOrganization(session.user.id) };
  });
}

export type MemberPage = Awaited<ReturnType<typeof findMemberPage>>;
export type MemberListItem = MemberPage["items"][number];
export type InvitationPage = Awaited<ReturnType<typeof findInvitationPage>>;
export type InvitationListItem = InvitationPage["items"][number];

/** Members of the active organization. Any member can see who is on the team. */
export async function listMembers(
  input: unknown,
): Promise<ActionResult<MemberPage>> {
  return runAction(memberListSchema, input, async (params) => {
    const { organizationId } = await getActorContext();

    return findMemberPage(organizationId, params);
  });
}

/** Pending invitations of the active organization, visible to every member. */
export async function listInvitations(
  input: unknown,
): Promise<ActionResult<InvitationPage>> {
  return runAction(invitationListSchema, input, async (params) => {
    const { organizationId } = await getActorContext();

    return findInvitationPage(organizationId, params);
  });
}

/**
 * Prevents privilege escalation: only an owner can grant the owner role, and
 * nobody can grant a role with permissions they do not have themselves.
 */
async function assertCanGrantRole(role: string) {
  const { organizationId, access } = await getActorContext();

  if (access.isOwner) return;
  if (role.split(",").some((name) => name.trim() === OWNER_ROLE)) {
    throw new APIError("FORBIDDEN", { code: "CANNOT_GRANT_OWNER_ROLE" });
  }

  const target = await getRolePermissions(organizationId, role);

  if (!includesPermissions(access.permissions, target)) {
    throw new APIError("FORBIDDEN", { code: "CANNOT_GRANT_HIGHER_ROLE" });
  }
}

export async function createOrganization(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(createOrganizationSchema, input, async ({ name }) => {
    const suffix = crypto.randomUUID().slice(0, 6);
    const organization = await auth.api.createOrganization({
      headers: await headers(),
      body: { name, slug: `${slugify(name) || "org"}-${suffix}` },
    });

    return { id: organization.id };
  });
}

export async function updateOrganization(
  input: unknown,
): Promise<ActionResult> {
  return runAction(updateOrganizationSchema, input, async (data) => {
    await auth.api.updateOrganization({
      headers: await headers(),
      body: { data },
    });

    return undefined;
  });
}

export async function setActiveOrganization(
  organizationId: unknown,
): Promise<ActionResult> {
  return runAction(idSchema, organizationId, async (id) => {
    await auth.api.setActiveOrganization({
      headers: await headers(),
      body: { organizationId: id },
    });

    return undefined;
  });
}

export async function inviteMember(input: unknown): Promise<ActionResult> {
  return runAction(inviteMemberSchema, input, async ({ email, role }) => {
    await assertCanGrantRole(role);
    await auth.api.createInvitation({
      headers: await headers(),
      body: { email, role, resend: true },
    });

    return undefined;
  });
}

export async function cancelInvitation(
  invitationId: unknown,
): Promise<ActionResult> {
  return runAction(idSchema, invitationId, async (id) => {
    await auth.api.cancelInvitation({
      headers: await headers(),
      body: { invitationId: id },
    });

    return undefined;
  });
}

export async function updateMemberRole(input: unknown): Promise<ActionResult> {
  return runAction(
    updateMemberRoleSchema,
    input,
    async ({ memberId, role }) => {
      const { access } = await getActorContext();

      if (access.memberId === memberId) {
        throw new APIError("FORBIDDEN", { code: "CANNOT_CHANGE_OWN_ROLE" });
      }
      await assertCanGrantRole(role);
      await auth.api.updateMemberRole({
        headers: await headers(),
        body: { memberId, role },
      });

      return undefined;
    },
  );
}

export async function removeMember(memberId: unknown): Promise<ActionResult> {
  return runAction(idSchema, memberId, async (id) => {
    await auth.api.removeMember({
      headers: await headers(),
      body: { memberIdOrEmail: id },
    });

    return undefined;
  });
}

export async function acceptInvitation(
  invitationId: unknown,
): Promise<ActionResult> {
  return runAction(idSchema, invitationId, async (id) => {
    const requestHeaders = await headers();
    const result = await auth.api.acceptInvitation({
      headers: requestHeaders,
      body: { invitationId: id },
    });

    if (result?.invitation.organizationId) {
      await auth.api.setActiveOrganization({
        headers: requestHeaders,
        body: { organizationId: result.invitation.organizationId },
      });
    }

    return undefined;
  });
}

export async function rejectInvitation(
  invitationId: unknown,
): Promise<ActionResult> {
  return runAction(idSchema, invitationId, async (id) => {
    await auth.api.rejectInvitation({
      headers: await headers(),
      body: { invitationId: id },
    });

    return undefined;
  });
}

export async function leaveOrganization(): Promise<ActionResult> {
  return runAction(z.undefined(), undefined, async () => {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    const organizationId = session?.session.activeOrganizationId;

    if (!organizationId) return undefined;

    await auth.api.leaveOrganization({
      headers: requestHeaders,
      body: { organizationId },
    });

    return undefined;
  });
}

/**
 * Permanently deletes the active organization with all its data, after the
 * user typed its exact name. The caller moves to their oldest remaining
 * organization; other members' sessions are left without an active one.
 */
export async function deleteOrganization(
  input: unknown,
): Promise<ActionResult<{ hasOrganization: boolean }>> {
  return runAction(
    deleteOrganizationSchema,
    input,
    async ({ confirmation }) => {
      const {
        headers: requestHeaders,
        session,
        organizationId,
      } = await requirePermission({ organization: ["delete"] });
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });

      if (!organization || confirmation !== organization.name.trim()) {
        throw new APIError("BAD_REQUEST", {
          code: "ORGANIZATION_NAME_MISMATCH",
        });
      }

      // Rows behind restrictive foreign keys (stages of leads, cash
      // registers and payment methods of sales) go first; deleting the
      // organization then cascades to everything else it owns.
      const where = { organizationId };

      await prisma.$transaction([
        prisma.lead.deleteMany({ where }),
        prisma.salesPayment.deleteMany({ where }),
        prisma.salesDocument.deleteMany({ where }),
        prisma.cashSession.deleteMany({ where }),
        prisma.session.updateMany({
          where: { activeOrganizationId: organizationId },
          data: { activeOrganizationId: null },
        }),
        prisma.organization.delete({ where: { id: organizationId } }),
      ]);

      // The data is already gone, so a failure here only leaves orphaned
      // files in Cloudinary: report it without failing the deletion.
      try {
        await deleteImagesInFolder(assetFolder(organizationId));
      } catch (error) {
        // eslint-disable-next-line no-console -- server log of the orphan files
        console.error(
          `No se pudieron borrar las imágenes de la organización ${organizationId}`,
          error,
        );
      }

      const next = await prisma.member.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true },
      });

      if (next) {
        await auth.api.setActiveOrganization({
          headers: requestHeaders,
          body: { organizationId: next.organizationId },
        });
      }

      return { hasOrganization: Boolean(next) };
    },
  );
}
