"use client";

import { useRouter } from "next/navigation";

import { ListSkeleton } from "@/components/organization/query-state";
import { fallbackRoleLabel } from "@/components/organization/role";
import {
  AppAlert,
  AppAvatar,
  AppButton,
  AppCard,
  AppLink,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useInvitation } from "@/hooks/use-organization";
import { acceptInvitation, rejectInvitation } from "@/lib/actions/organization";
import { queryKeys } from "@/lib/query-keys";

const invalidate = [
  queryKeys.organizations,
  queryKeys.userInvitations,
] as const;

export function AcceptInvitationView({
  invitationId,
  userEmail,
}: {
  invitationId: string;
  userEmail: string;
}) {
  const router = useRouter();
  const invitation = useInvitation(invitationId);
  const accept = useActionMutation(acceptInvitation, {
    successMessage: "Te uniste a la organización",
    invalidate,
  });
  const reject = useActionMutation(rejectInvitation, {
    successMessage: "Invitación rechazada",
    invalidate,
  });

  const goTo = (path: string) => {
    router.replace(path);
    router.refresh();
  };

  if (invitation.isPending) {
    return (
      <AppCard>
        <ListSkeleton rows={2} />
      </AppCard>
    );
  }

  if (invitation.error || !invitation.data) {
    return (
      <AppCard title="Invitación no disponible">
        <AppAlert
          description={`Puede que haya caducado, que ya se haya usado o que sea para otro correo. Has iniciado sesión como ${userEmail}.`}
          status="danger"
          title="No pudimos abrir esta invitación"
        />
        <AppLink href="/dashboard">Ir a Cast CRM</AppLink>
      </AppCard>
    );
  }

  const data = invitation.data;

  return (
    <AppCard>
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <AppAvatar
          className="rounded-xl"
          name={data.organizationName}
          size="lg"
        />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Únete a {data.organizationName}
          </h1>
          <p className="text-sm text-muted">
            {data.inviterEmail} te invitó como{" "}
            <strong>
              {fallbackRoleLabel(data.role ?? "member").toLowerCase()}
            </strong>
            .
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <AppButton
          fullWidth
          isDisabled={accept.isPending}
          isPending={reject.isPending}
          variant="tertiary"
          onPress={() =>
            reject.mutate(invitationId, {
              onSuccess: () => goTo("/onboarding"),
            })
          }
        >
          Rechazar
        </AppButton>
        <AppButton
          fullWidth
          isDisabled={reject.isPending}
          isPending={accept.isPending}
          onPress={() =>
            accept.mutate(invitationId, { onSuccess: () => goTo("/dashboard") })
          }
        >
          Aceptar
        </AppButton>
      </div>
    </AppCard>
  );
}
