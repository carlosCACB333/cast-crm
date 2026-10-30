"use client";

import { useRouter } from "next/navigation";

import { CreateOrganizationForm } from "@/components/organization/create-organization-form";
import { ListSkeleton } from "@/components/organization/query-state";
import { fallbackRoleLabel } from "@/components/organization/role";
import { AppAvatar, AppButton, AppCard, AppDivider } from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import {
  useCanCreateOrganization,
  useOrganizations,
  useUserInvitations,
} from "@/hooks/use-organization";
import {
  acceptInvitation,
  rejectInvitation,
  setActiveOrganization,
} from "@/lib/actions/organization";
import { queryKeys } from "@/lib/query-keys";

const invalidate = [
  queryKeys.organizations,
  queryKeys.userInvitations,
] as const;

export function OnboardingView({ userName }: { userName: string }) {
  const router = useRouter();
  const invitations = useUserInvitations();
  const organizations = useOrganizations();
  const canCreate = useCanCreateOrganization();
  const accept = useActionMutation(acceptInvitation, {
    successMessage: "Te uniste a la organización",
    invalidate,
  });
  const reject = useActionMutation(rejectInvitation, {
    successMessage: "Invitación rechazada",
    invalidate,
  });
  const enter = useActionMutation(setActiveOrganization, { invalidate });

  const goToDashboard = () => {
    router.replace("/dashboard");
    router.refresh();
  };

  const pending =
    invitations.data?.filter((invitation) => invitation.status === "pending") ??
    [];
  const existing = organizations.data ?? [];
  const isLoading =
    invitations.isPending || organizations.isPending || canCreate.isPending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bienvenido, {userName.split(" ")[0]}
        </h1>
        <p className="text-muted">
          {canCreate.data === false
            ? "Únete a una organización para empezar a usar Cast CRM."
            : "Crea tu organización o únete a una para empezar a usar Cast CRM."}
        </p>
      </div>

      {isLoading ? (
        <AppCard>
          <ListSkeleton rows={2} />
        </AppCard>
      ) : null}

      {pending.length > 0 ? (
        <AppCard
          description="Te han invitado a estas organizaciones."
          title="Invitaciones"
        >
          <ul className="flex flex-col divide-y divide-separator">
            {pending.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <AppAvatar
                    className="rounded-lg"
                    name={invitation.organizationName}
                    size="sm"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {invitation.organizationName}
                    </span>
                    <span className="text-xs text-muted">
                      Como{" "}
                      {fallbackRoleLabel(
                        invitation.role ?? "member",
                      ).toLowerCase()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <AppButton
                    isDisabled={accept.isPending}
                    size="sm"
                    variant="tertiary"
                    onPress={() => reject.mutate(invitation.id)}
                  >
                    Rechazar
                  </AppButton>
                  <AppButton
                    isDisabled={reject.isPending}
                    isPending={
                      accept.isPending && accept.variables === invitation.id
                    }
                    size="sm"
                    onPress={() =>
                      accept.mutate(invitation.id, { onSuccess: goToDashboard })
                    }
                  >
                    Aceptar
                  </AppButton>
                </div>
              </li>
            ))}
          </ul>
        </AppCard>
      ) : null}

      {existing.length > 0 ? (
        <AppCard
          description="Ya perteneces a estas organizaciones."
          title="Tus organizaciones"
        >
          <ul className="flex flex-col divide-y divide-separator">
            {existing.map((organization) => (
              <li
                key={organization.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <AppAvatar
                    className="rounded-lg"
                    name={organization.name}
                    size="sm"
                    src={organization.logo}
                  />
                  <span className="font-medium">{organization.name}</span>
                </div>
                <AppButton
                  isPending={
                    enter.isPending && enter.variables === organization.id
                  }
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    enter.mutate(organization.id, { onSuccess: goToDashboard })
                  }
                >
                  Entrar
                </AppButton>
              </li>
            ))}
          </ul>
        </AppCard>
      ) : null}

      {canCreate.data ? (
        <AppCard
          description="Serás el propietario y podrás invitar a tu equipo."
          title="Crear una organización"
        >
          {pending.length > 0 || existing.length > 0 ? (
            <AppDivider label="o empieza de cero" />
          ) : null}
          <CreateOrganizationForm onCreated={goToDashboard} />
        </AppCard>
      ) : null}

      {canCreate.data === false &&
      !isLoading &&
      pending.length === 0 &&
      existing.length === 0 ? (
        <AppCard
          description="Pide a un propietario de tu empresa que te envíe una invitación a este correo."
          title="Aún no tienes acceso"
        />
      ) : null}
    </div>
  );
}
