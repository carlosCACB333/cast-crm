"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";

import {
  MoreIcon,
  PlusIcon,
  SendIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import { ChangeRoleModal } from "@/components/organization/change-role-modal";
import { InviteMemberModal } from "@/components/organization/invite-member-modal";
import { QueryError } from "@/components/organization/query-state";
import { dateFormatter, roleColor } from "@/components/organization/role";
import { PageHeader } from "@/components/page-header";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppDataTable,
  AppDropdown,
  type AppDropdownItem,
  AppEmptyState,
  type AppTabItem,
  AppTabs,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useListParams } from "@/hooks/use-list-params";
import {
  useActiveMember,
  useInvitationPage,
  useMemberPage,
  useMyAccess,
  usePermission,
  useRoleLabel,
} from "@/hooks/use-organization";
import {
  type InvitationListItem,
  type MemberListItem,
  cancelInvitation,
  leaveOrganization,
  removeMember,
} from "@/lib/actions/organization";
import { optionSources } from "@/lib/option-sources";
import { OWNER_ROLE } from "@/lib/permissions";
import {
  type InvitationListParams,
  type MemberListParams,
  invitationListSchema,
  memberListSchema,
} from "@/lib/validations/organization";

type Member = MemberListItem;
type Invitation = InvitationListItem;
type MemberColumn = "member" | "role" | "joined" | "actions";
type InvitationColumn = "email" | "role" | "expires" | "actions";

const tabs: AppTabItem[] = [
  { label: "Equipo", href: "/members", icon: UsersIcon },
  { label: "Invitaciones", href: "/members/invitations", icon: SendIcon },
];

/** Opens the layout's invite modal from any tab. */
const InviteContext = createContext<() => void>(() => {});

const roleFilter = (list: {
  params: { roles: string[] };
  setParams: (patch: { roles: string[] }) => void;
}) => ({
  type: "options" as const,
  label: "Rol",
  multiple: true,
  source: optionSources.roles("filter"),
  value: list.params.roles,
  onChange: (value: string[]) => list.setParams({ roles: value }),
});

export function MembersLayout({ children }: { children: React.ReactNode }) {
  const canInvite = usePermission({ invitation: ["create"] });
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const openInvite = () => setIsInviteOpen(true);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        actions={
          canInvite ? (
            <AppButton onPress={openInvite}>
              <PlusIcon size={16} />
              Invitar miembro
            </AppButton>
          ) : null
        }
        description="Gestiona quién tiene acceso a esta organización y con qué rol."
        title="Miembros"
      />
      <AppTabs aria-label="Miembros" items={tabs}>
        <InviteContext.Provider value={openInvite}>
          {children}
        </InviteContext.Provider>
      </AppTabs>
      <InviteMemberModal isOpen={isInviteOpen} onOpenChange={setIsInviteOpen} />
    </div>
  );
}

type MemberConfirm = { type: "remove"; member: Member } | { type: "leave" };

export function MembersTeamTab() {
  const router = useRouter();
  const memberList = useListParams<MemberListParams>(
    memberListSchema.parse({}),
  );
  const members = useMemberPage(memberList.params);
  const { data: currentMember } = useActiveMember();
  const { data: access } = useMyAccess();
  const roleLabel = useRoleLabel();
  const canUpdate = usePermission({ member: ["update"] });
  const canRemove = usePermission({ member: ["delete"] });
  const [confirm, setConfirm] = useState<MemberConfirm>();
  const [roleTarget, setRoleTarget] = useState<Member>();

  const remove = useActionMutation(removeMember, {
    successMessage: "Miembro eliminado",
  });
  const leave = useActionMutation(leaveOrganization);

  const closeConfirm = () => setConfirm(undefined);

  const memberItems = (member: Member): AppDropdownItem[] => {
    const isSelf = member.userId === currentMember?.userId;

    if (isSelf)
      return [
        { id: "leave", label: "Salir de la organización", isDanger: true },
      ];

    // Only owners can change the role of another owner.
    const canChangeRole =
      canUpdate && (member.role !== OWNER_ROLE || access?.isOwner);

    return [
      ...(canChangeRole
        ? [{ id: "role", label: "Cambiar rol", icon: <ShieldIcon size={16} /> }]
        : []),
      ...(canRemove
        ? [
            {
              id: "remove",
              label: "Eliminar de la organización",
              isDanger: true,
            },
          ]
        : []),
    ];
  };

  const handleMemberAction = (member: Member, id: string) => {
    if (id === "leave") setConfirm({ type: "leave" });
    else if (id === "remove") setConfirm({ type: "remove", member });
    else if (id === "role") setRoleTarget(member);
  };

  const handleConfirm = () => {
    if (!confirm) return;
    if (confirm.type === "remove") {
      remove.mutate(confirm.member.id, { onSuccess: closeConfirm });
    } else {
      leave.mutate(undefined, {
        onSuccess: () => {
          closeConfirm();
          router.replace("/onboarding");
          router.refresh();
        },
      });
    }
  };

  const confirmCopy =
    confirm?.type === "leave"
      ? {
          title: "Salir de la organización",
          description:
            "Perderás el acceso a sus datos hasta que te vuelvan a invitar.",
          label: "Salir",
        }
      : {
          title: "Eliminar miembro",
          description: `${confirm?.member.user.name ?? ""} perderá el acceso a esta organización.`,
          label: "Eliminar",
        };

  return (
    <>
      <AppCard
        title={`Equipo${members.data ? ` (${members.data.total})` : ""}`}
      >
        {members.error ? (
          <QueryError error={members.error} onRetry={() => members.refetch()} />
        ) : (
          <AppDataTable<Member, MemberColumn>
            columns={[
              {
                key: "member",
                label: "Miembro",
                isRowHeader: true,
                defaultWidth: "2fr",
                allowsSorting: true,
              },
              { key: "role", label: "Rol", filter: roleFilter(memberList) },
              { key: "joined", label: "Desde", allowsSorting: true },
              {
                key: "actions",
                label: "Acciones",
                className: "text-right",
                width: 96,
              },
            ]}
            emptyContent="Aún no hay miembros"
            getRowKey={(member) => member.id}
            label="Miembros de la organización"
            pagination={memberList.pagination(members.data)}
            query={members}
            renderCell={(member, column) => {
              switch (column) {
                case "member":
                  return (
                    <div className="flex items-center gap-3">
                      <AppAvatar
                        name={member.user.name}
                        size="sm"
                        src={member.user.image}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {member.user.name}
                          {member.userId === currentMember?.userId ? (
                            <span className="ml-2 text-xs text-muted">
                              (tú)
                            </span>
                          ) : null}
                        </span>
                        <span className="truncate text-xs text-muted">
                          {member.user.email}
                        </span>
                      </div>
                    </div>
                  );
                case "role":
                  return (
                    <AppChip color={roleColor(member.role)}>
                      {roleLabel(member.role)}
                    </AppChip>
                  );
                case "joined":
                  return (
                    <span className="text-sm text-muted">
                      {dateFormatter.format(new Date(member.createdAt))}
                    </span>
                  );
                case "actions": {
                  const items = memberItems(member);

                  return items.length ? (
                    <AppDropdown
                      items={items}
                      label={`Acciones para ${member.user.name}`}
                      trigger={
                        <AppButton
                          isIconOnly
                          aria-label={`Acciones para ${member.user.name}`}
                          size="sm"
                          variant="ghost"
                        >
                          <MoreIcon size={16} />
                        </AppButton>
                      }
                      onAction={(id) => handleMemberAction(member, id)}
                    />
                  ) : null;
                }
              }
            }}
            rows={members.data?.items ?? []}
            search={{
              ...memberList.search,
              placeholder: "Buscar por nombre o correo…",
            }}
            sort={memberList.sort}
            onClearFilters={memberList.onClearFilters}
            onSortChange={memberList.onSortChange}
          />
        )}
      </AppCard>

      <ChangeRoleModal
        member={roleTarget}
        onOpenChange={(open) => !open && setRoleTarget(undefined)}
      />
      <AppConfirm
        confirmLabel={confirmCopy.label}
        description={confirmCopy.description}
        isOpen={confirm !== undefined}
        isPending={remove.isPending || leave.isPending}
        title={confirmCopy.title}
        onConfirm={handleConfirm}
        onOpenChange={(open) => !open && closeConfirm()}
      />
    </>
  );
}

export function MembersInvitationsTab() {
  const openInvite = useContext(InviteContext);
  const invitationList = useListParams<InvitationListParams>(
    invitationListSchema.parse({}),
  );
  const invitations = useInvitationPage(invitationList.params);
  const roleLabel = useRoleLabel();
  const canInvite = usePermission({ invitation: ["create"] });
  const canCancel = usePermission({ invitation: ["cancel"] });
  const [cancelTarget, setCancelTarget] = useState<Invitation>();

  const cancel = useActionMutation(cancelInvitation, {
    successMessage: "Invitación cancelada",
  });

  const closeConfirm = () => setCancelTarget(undefined);
  const hasFilters = Boolean(
    invitationList.params.q || invitationList.params.roles.length,
  );

  return (
    <>
      <AppCard
        description="Invitaciones enviadas que aún no han sido aceptadas."
        title={`Invitaciones pendientes${invitations.data ? ` (${invitations.data.total})` : ""}`}
      >
        {invitations.error ? (
          <QueryError
            error={invitations.error}
            onRetry={() => invitations.refetch()}
          />
        ) : invitations.data?.total === 0 && !hasFilters ? (
          <AppEmptyState
            action={
              canInvite ? (
                <AppButton size="sm" variant="secondary" onPress={openInvite}>
                  Invitar miembro
                </AppButton>
              ) : null
            }
            description="Invita a tu equipo para colaborar en esta organización."
            icon={<SendIcon size={18} />}
            title="No hay invitaciones pendientes"
          />
        ) : (
          <AppDataTable<Invitation, InvitationColumn>
            columns={[
              {
                key: "email",
                label: "Correo",
                isRowHeader: true,
                allowsSorting: true,
              },
              {
                key: "role",
                label: "Rol",
                filter: roleFilter(invitationList),
              },
              { key: "expires", label: "Caduca", allowsSorting: true },
              {
                key: "actions",
                label: "Acciones",
                className: "text-right",
                width: 96,
              },
            ]}
            getRowKey={(invitation) => invitation.id}
            label="Invitaciones pendientes"
            pagination={invitationList.pagination(invitations.data)}
            query={invitations}
            renderCell={(invitation, column) => {
              switch (column) {
                case "email":
                  return (
                    <span className="font-medium">{invitation.email}</span>
                  );
                case "role":
                  return <AppChip>{roleLabel(invitation.role)}</AppChip>;
                case "expires":
                  return (
                    <span className="text-sm text-muted">
                      {dateFormatter.format(new Date(invitation.expiresAt))}
                    </span>
                  );
                case "actions":
                  return canCancel ? (
                    <AppButton
                      size="sm"
                      variant="ghost"
                      onPress={() => setCancelTarget(invitation)}
                    >
                      Cancelar
                    </AppButton>
                  ) : null;
              }
            }}
            rows={invitations.data?.items ?? []}
            search={{
              ...invitationList.search,
              placeholder: "Buscar por correo…",
            }}
            sort={invitationList.sort}
            onClearFilters={invitationList.onClearFilters}
            onSortChange={invitationList.onSortChange}
          />
        )}
      </AppCard>

      <AppConfirm
        confirmLabel="Cancelar invitación"
        description={`El enlace enviado a ${cancelTarget?.email ?? ""} dejará de funcionar.`}
        isOpen={cancelTarget !== undefined}
        isPending={cancel.isPending}
        title="Cancelar invitación"
        onConfirm={() =>
          cancelTarget &&
          cancel.mutate(cancelTarget.id, { onSuccess: closeConfirm })
        }
        onOpenChange={(open) => !open && closeConfirm()}
      />
    </>
  );
}
