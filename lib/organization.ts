import "server-only";

import type {
  InvitationListParams,
  MemberListParams,
} from "@/lib/validations/organization";

import { z } from "zod";

import { deploymentConfig } from "@/config/deployment";
import { TABLE_DEFAULTS } from "@/config/tables";
import { Prisma } from "@/lib/generated/prisma/client";
import { pageWindow } from "@/lib/pagination";
import {
  OWNER_ROLE,
  type Permissions,
  mergePermissions,
  ownerPermissions,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const permissionSchema = z.record(z.string(), z.array(z.string()));

export const OWNER_LABEL = "Propietario";

function splitRoles(role: string) {
  return role
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function parsePermission(value: string) {
  return permissionSchema.parse(JSON.parse(value)) as Permissions;
}

/** Whether the user still belongs to the organization stored in the session. */
export async function hasMembership(userId: string, organizationId: string) {
  const member = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { id: true },
  });

  return member !== null;
}

/**
 * Whether the user may create a new organization. In a single-company
 * deployment only owners of an existing organization can add branches, plus
 * the very first user so the company can be set up.
 */
export async function canCreateOrganization(userId: string) {
  if (!deploymentConfig.isSingleCompany) return true;

  const memberships = await prisma.member.findMany({
    where: { userId },
    select: { role: true },
  });

  if (memberships.some(({ role }) => splitRoles(role).includes(OWNER_ROLE))) {
    return true;
  }

  return (await prisma.organization.count()) === 0;
}

/** Effective permissions of a role string (one or more comma-separated roles). */
export async function getRolePermissions(
  organizationId: string,
  role: string,
): Promise<Permissions> {
  const names = splitRoles(role);
  const dynamicRoles = await prisma.organizationRole.findMany({
    where: { organizationId, role: { in: names } },
    select: { permission: true },
  });

  return mergePermissions(
    ...(names.includes(OWNER_ROLE) ? [ownerPermissions()] : []),
    ...dynamicRoles.map(({ permission }) => parsePermission(permission)),
  );
}

/** Role and effective permissions of a member, or null if not a member. */
export async function getMemberAccess(organizationId: string, userId: string) {
  const member = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { id: true, role: true },
  });

  if (!member) return null;

  return {
    memberId: member.id,
    role: member.role,
    isOwner: splitRoles(member.role).includes(OWNER_ROLE),
    permissions: await getRolePermissions(organizationId, member.role),
  };
}

/** Roles of an organization (the fixed owner role first) with member counts. */
export async function listOrganizationRoles(
  organizationId: string,
  { includePermissions }: { includePermissions: boolean },
) {
  const [dynamicRoles, members] = await Promise.all([
    prisma.organizationRole.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        label: true,
        description: true,
        permission: true,
      },
    }),
    prisma.member.findMany({
      where: { organizationId },
      select: { role: true },
    }),
  ]);

  const memberCount = (role: string) =>
    members.filter((member) => splitRoles(member.role).includes(role)).length;

  return [
    {
      id: OWNER_ROLE,
      role: OWNER_ROLE,
      label: OWNER_LABEL,
      description: "Creador de la organización. Acceso total.",
      isSystem: true,
      memberCount: memberCount(OWNER_ROLE),
      permission: includePermissions ? ownerPermissions() : null,
    },
    ...dynamicRoles.map((role) => ({
      id: role.id,
      role: role.role,
      label: role.label,
      description: role.description,
      isSystem: false,
      memberCount: memberCount(role.role),
      permission: includePermissions ? parsePermission(role.permission) : null,
    })),
  ];
}

/** Organizations the user belongs to, with the user's role in each one. */
export async function listUserOrganizations(userId: string) {
  const memberships = await prisma.member.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          logo: true,
          roles: { select: { role: true, label: true } },
        },
      },
    },
  });

  return memberships.map(
    ({ role, organization: { roles, ...organization } }) => ({
      ...organization,
      role,
      roleLabel: splitRoles(role)
        .map((name) =>
          name === OWNER_ROLE
            ? OWNER_LABEL
            : (roles.find((item) => item.role === name)?.label ?? name),
        )
        .join(", "),
    }),
  );
}

/**
 * Matches a role column that stores one or more comma-separated roles
 * ("admin,sales") against any of the given roles.
 */
function hasAnyRole(roles: string[]) {
  return roles.flatMap((role) => [
    { role },
    { role: { startsWith: `${role},` } },
    { role: { endsWith: `,${role}` } },
    { role: { contains: `,${role},` } },
  ]);
}

/** Members of an organization, searched, filtered, sorted and paginated. */
export async function findMemberPage(
  organizationId: string,
  { q, roles, sort, direction, page }: MemberListParams,
) {
  const where: Prisma.MemberWhereInput = { organizationId };

  if (q) {
    const contains = { contains: q, mode: "insensitive" } as const;

    where.user = { OR: [{ name: contains }, { email: contains }] };
  }
  if (roles.length) where.OR = hasAnyRole(roles);

  const total = await prisma.member.count({ where });
  const window = pageWindow(page, TABLE_DEFAULTS.pageSize, total);
  const members = await prisma.member.findMany({
    where,
    // The id keeps the order stable across pages when values are equal.
    orderBy: [
      sort === "joined"
        ? { createdAt: direction }
        : { user: { name: direction } },
      { id: "asc" },
    ],
    skip: window.skip,
    take: window.take,
    select: {
      id: true,
      userId: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return {
    ...window,
    total,
    items: members.map((member) => ({
      ...member,
      createdAt: member.createdAt.toISOString(),
    })),
  };
}

/** Pending invitations of an organization, paginated. */
export async function findInvitationPage(
  organizationId: string,
  { q, roles, sort, direction, page }: InvitationListParams,
) {
  const where: Prisma.InvitationWhereInput = {
    organizationId,
    status: "pending",
  };

  if (q) where.email = { contains: q, mode: "insensitive" };
  if (roles.length) {
    // Invitations without a role join as "member".
    where.OR = [
      ...hasAnyRole(roles),
      ...(roles.includes("member") ? [{ role: null }] : []),
    ];
  }

  const total = await prisma.invitation.count({ where });
  const window = pageWindow(page, TABLE_DEFAULTS.pageSize, total);
  const invitations = await prisma.invitation.findMany({
    where,
    orderBy: [
      sort === "email" ? { email: direction } : { expiresAt: direction },
      { id: "asc" },
    ],
    skip: window.skip,
    take: window.take,
    select: { id: true, email: true, role: true, expiresAt: true },
  });

  return {
    ...window,
    total,
    items: invitations.map((invitation) => ({
      ...invitation,
      role: invitation.role ?? "member",
      expiresAt: invitation.expiresAt.toISOString(),
    })),
  };
}
