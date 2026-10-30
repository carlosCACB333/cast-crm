"use client";

import type {
  InvitationListParams,
  MemberListParams,
} from "@/lib/validations/organization";
import type { RoleListParams } from "@/lib/validations/roles";

import { useCallback } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getOrganizationCreationAccess,
  listInvitations,
  listMembers,
  listMyOrganizations,
} from "@/lib/actions/organization";
import { getMyAccess, listRolePage, listRoles } from "@/lib/actions/roles";
import { authClient } from "@/lib/auth-client";
import {
  OWNER_ROLE,
  type Permissions,
  includesPermissions,
} from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";

type BetterFetchResult<T> = {
  data: T | null;
  error: { message?: string; status: number } | null;
};

async function unwrap<T>(request: Promise<BetterFetchResult<T>>) {
  const { data, error } = await request;

  if (error)
    throw new Error(error.message ?? "No se pudieron cargar los datos");

  return data;
}

export async function unwrapAction<T>(
  request: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
) {
  const result = await request;

  if (!result.ok) throw new Error(result.error);

  return result.data;
}

/** Organizations of the signed-in user, including their role in each one. */
export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations,
    queryFn: () => unwrapAction(listMyOrganizations()),
  });
}

/** Only for showing or hiding UI: Better Auth enforces it on creation. */
export function useCanCreateOrganization() {
  return useQuery({
    queryKey: queryKeys.organizationCreation,
    queryFn: () => unwrapAction(getOrganizationCreationAccess()),
    select: (access) => access.canCreate,
  });
}

export function useActiveOrganization() {
  return useQuery({
    queryKey: queryKeys.activeOrganization,
    queryFn: () => unwrap(authClient.organization.getFullOrganization()),
  });
}

export function useActiveMember() {
  return useQuery({
    queryKey: queryKeys.activeMember,
    queryFn: () => unwrap(authClient.organization.getActiveMember()),
  });
}

/** Role and effective permissions (fixed + dynamic roles) in the active organization. */
export function useMyAccess() {
  return useQuery({
    queryKey: queryKeys.myAccess,
    queryFn: () => unwrapAction(getMyAccess()),
  });
}

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles,
    queryFn: () => unwrapAction(listRoles()),
  });
}

// Table pages keep the previous page visible while the next one loads.

export function useMemberPage(params: MemberListParams) {
  return useQuery({
    queryKey: queryKeys.memberPage(params),
    queryFn: () => unwrapAction(listMembers(params)),
    placeholderData: keepPreviousData,
  });
}

export function useInvitationPage(params: InvitationListParams) {
  return useQuery({
    queryKey: queryKeys.invitationPage(params),
    queryFn: () => unwrapAction(listInvitations(params)),
    placeholderData: keepPreviousData,
  });
}

export function useRolePage(params: RoleListParams) {
  return useQuery({
    queryKey: queryKeys.rolePage(params),
    queryFn: () => unwrapAction(listRolePage(params)),
    placeholderData: keepPreviousData,
  });
}

/** Resolves a role id (or comma-separated ids) to its display name. */
export function useRoleLabel() {
  const { data: roles } = useRoles();

  return useCallback(
    (role: string) =>
      role
        .split(",")
        .map((name) => name.trim())
        .map(
          (name) =>
            roles?.find((item) => item.role === name)?.label ??
            (name === OWNER_ROLE ? "Propietario" : name),
        )
        .join(", "),
    [roles],
  );
}

export function useUserInvitations() {
  return useQuery({
    queryKey: queryKeys.userInvitations,
    queryFn: () => unwrap(authClient.organization.listUserInvitations()),
  });
}

export function useInvitation(id: string) {
  return useQuery({
    queryKey: queryKeys.invitation(id),
    queryFn: () =>
      unwrap(authClient.organization.getInvitation({ query: { id } })),
    retry: false,
  });
}

/**
 * Whether the current member has the given permissions. Only for showing or
 * hiding UI: the server enforces every permission again.
 */
export function usePermission(permissions: Permissions) {
  const { data: access } = useMyAccess();

  return access ? includesPermissions(access.permissions, permissions) : false;
}
