"use client";

import type { MyProfile, MySession } from "@/lib/actions/profile";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { LockIcon, MailIcon, UserIcon } from "@/components/icons";
import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { dateFormatter } from "@/components/organization/role";
import { PageHeader } from "@/components/page-header";
import {
  AppAlert,
  AppAvatar,
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppInput,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useMySessions, useProfile } from "@/hooks/use-profile";
import {
  changeEmail,
  changePassword,
  revokeOtherSessions,
  revokeSession,
  setPassword,
  updateProfile,
} from "@/lib/actions/profile";
import { queryKeys } from "@/lib/query-keys";
import {
  type ChangeEmailValues,
  type ChangePasswordValues,
  type SetPasswordValues,
  type UpdateProfileValues,
  changeEmailSchema,
  changePasswordSchema,
  setPasswordSchema,
  updateProfileSchema,
} from "@/lib/validations/profile";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
};

const dateTimeFormatter = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Short device description from a user agent, e.g. "Chrome en Windows". */
function describeDevice(userAgent: string | null) {
  if (!userAgent) return "Dispositivo desconocido";

  const browser =
    [
      ["Edg/", "Edge"],
      ["OPR/", "Opera"],
      ["Firefox/", "Firefox"],
      ["Chrome/", "Chrome"],
      ["Safari/", "Safari"],
    ].find(([token]) => userAgent.includes(token))?.[1] ?? "Navegador";
  const os =
    [
      ["Windows", "Windows"],
      ["Android", "Android"],
      ["iPhone", "iOS"],
      ["iPad", "iPadOS"],
      ["Mac OS", "macOS"],
      ["Linux", "Linux"],
    ].find(([token]) => userAgent.includes(token))?.[1] ?? null;

  return os ? `${browser} en ${os}` : browser;
}

function ProfileSummary({ profile }: { profile: MyProfile }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <AppAvatar name={profile.name} size="lg" src={profile.image} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-lg font-semibold">{profile.name}</p>
        <p className="truncate text-sm text-muted">{profile.email}</p>
        <p className="text-xs text-muted">
          Miembro desde {dateFormatter.format(new Date(profile.createdAt))}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <AppChip color={profile.emailVerified ? "success" : "warning"}>
          {profile.emailVerified ? "Correo verificado" : "Correo sin verificar"}
        </AppChip>
        {profile.providers.map((provider) => (
          <AppChip key={provider}>
            {PROVIDER_LABELS[provider] ?? provider}
          </AppChip>
        ))}
      </div>
    </div>
  );
}

function PersonalForm({ name }: { name: string }) {
  const router = useRouter();
  const update = useActionMutation(updateProfile, {
    successMessage: "Perfil actualizado",
    invalidate: [queryKeys.profile, queryKeys.organizations],
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name },
  });

  // Sync the form with the saved value after saving.
  useEffect(() => reset({ name }), [name, reset]);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) =>
        // Refresh the server-rendered shell so the account menu shows the new name.
        update.mutate(values, { onSuccess: () => router.refresh() }),
      )}
    >
      <AppInput
        isRequired
        autoComplete="name"
        control={control}
        icon={<UserIcon size={16} />}
        label="Nombre completo"
        name="name"
      />
      <div className="flex justify-end gap-2">
        <AppButton
          isDisabled={!isDirty || update.isPending}
          variant="tertiary"
          onPress={() => reset({ name })}
        >
          Descartar
        </AppButton>
        <AppButton
          isDisabled={!isDirty}
          isPending={update.isPending}
          type="submit"
        >
          Guardar cambios
        </AppButton>
      </div>
    </form>
  );
}

function EmailForm({ email }: { email: string }) {
  const [sentTo, setSentTo] = useState<string>();
  const change = useActionMutation(changeEmail, { invalidate: [] });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: "" },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) =>
        change.mutate(values, {
          onSuccess: () => {
            setSentTo(values.email);
            reset({ email: "" });
          },
        }),
      )}
    >
      {sentTo ? (
        <AppAlert
          description={`Si la dirección está disponible, enviamos un enlace a ${sentTo}. Tu correo cambiará cuando lo abras.`}
          status="success"
          title="Revisa tu bandeja de entrada"
        />
      ) : null}
      <p className="text-sm">
        <span className="text-muted">Correo actual: </span>
        <span className="font-medium">{email}</span>
      </p>
      <AppInput
        isRequired
        autoComplete="email"
        control={control}
        description="Te enviaremos un enlace para confirmar la nueva dirección."
        icon={<MailIcon size={16} />}
        label="Nuevo correo"
        name="email"
        type="email"
      />
      <div className="flex justify-end">
        <AppButton
          isDisabled={!isDirty}
          isPending={change.isPending}
          type="submit"
        >
          Enviar enlace
        </AppButton>
      </div>
    </form>
  );
}

function ChangePasswordForm() {
  const update = useActionMutation(changePassword, {
    successMessage: "Contraseña actualizada",
    invalidate: [queryKeys.sessions],
  });
  const { control, handleSubmit, reset } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) =>
        update.mutate(values, { onSuccess: () => reset() }),
      )}
    >
      <AppInput
        isRequired
        autoComplete="current-password"
        control={control}
        icon={<LockIcon size={16} />}
        label="Contraseña actual"
        name="currentPassword"
        type="password"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput
          isRequired
          autoComplete="new-password"
          control={control}
          icon={<LockIcon size={16} />}
          label="Nueva contraseña"
          name="password"
          type="password"
        />
        <AppInput
          isRequired
          autoComplete="new-password"
          control={control}
          icon={<LockIcon size={16} />}
          label="Confirmar contraseña"
          name="confirmPassword"
          type="password"
        />
      </div>
      <div className="flex justify-end">
        <AppButton isPending={update.isPending} type="submit">
          Cambiar contraseña
        </AppButton>
      </div>
    </form>
  );
}

function SetPasswordForm() {
  const create = useActionMutation(setPassword, {
    successMessage: "Contraseña creada",
    invalidate: [queryKeys.profile],
  });
  const { control, handleSubmit } = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) => create.mutate(values))}
    >
      <AppAlert
        description="Entraste con una cuenta externa. Crea una contraseña para poder iniciar sesión también con tu correo."
        status="accent"
        title="Tu cuenta no tiene contraseña"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput
          isRequired
          autoComplete="new-password"
          control={control}
          icon={<LockIcon size={16} />}
          label="Nueva contraseña"
          name="password"
          type="password"
        />
        <AppInput
          isRequired
          autoComplete="new-password"
          control={control}
          icon={<LockIcon size={16} />}
          label="Confirmar contraseña"
          name="confirmPassword"
          type="password"
        />
      </div>
      <div className="flex justify-end">
        <AppButton isPending={create.isPending} type="submit">
          Crear contraseña
        </AppButton>
      </div>
    </form>
  );
}

type PendingConfirm = { type: "one"; session: MySession } | { type: "others" };

function SessionsSection() {
  const sessions = useMySessions();
  const [confirm, setConfirm] = useState<PendingConfirm>();
  const revokeOne = useActionMutation(revokeSession, {
    successMessage: "Sesión cerrada",
    invalidate: [queryKeys.sessions],
  });
  const revokeOthers = useActionMutation(revokeOtherSessions, {
    successMessage: "Se cerraron las demás sesiones",
    invalidate: [queryKeys.sessions],
  });

  const closeConfirm = () => setConfirm(undefined);
  const hasOthers = sessions.data?.some((session) => !session.isCurrent);

  const handleConfirm = () => {
    if (confirm?.type === "one") {
      revokeOne.mutate(confirm.session.id, { onSuccess: closeConfirm });
    } else if (confirm?.type === "others") {
      revokeOthers.mutate(undefined, { onSuccess: closeConfirm });
    }
  };

  return (
    <AppCard
      description="Dispositivos donde tu cuenta tiene una sesión abierta."
      title="Sesiones activas"
    >
      {sessions.error ? (
        <QueryError error={sessions.error} onRetry={() => sessions.refetch()} />
      ) : sessions.isPending ? (
        <ListSkeleton rows={2} />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-separator">
            {sessions.data.map((session) => (
              <li
                key={session.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {describeDevice(session.userAgent)}
                    </span>
                    {session.isCurrent ? (
                      <AppChip color="accent">Esta sesión</AppChip>
                    ) : null}
                  </div>
                  <span className="text-muted">
                    {[
                      session.ipAddress,
                      `Última actividad: ${dateTimeFormatter.format(new Date(session.updatedAt))}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                {session.isCurrent ? null : (
                  <AppButton
                    size="sm"
                    variant="tertiary"
                    onPress={() => setConfirm({ type: "one", session })}
                  >
                    Cerrar sesión
                  </AppButton>
                )}
              </li>
            ))}
          </ul>
          {hasOthers ? (
            <div className="flex justify-end">
              <AppButton
                variant="danger"
                onPress={() => setConfirm({ type: "others" })}
              >
                Cerrar las demás sesiones
              </AppButton>
            </div>
          ) : null}
        </>
      )}

      <AppConfirm
        confirmLabel="Cerrar sesión"
        description={
          confirm?.type === "one"
            ? `Se cerrará la sesión en ${describeDevice(confirm.session.userAgent)}.`
            : "Se cerrará tu sesión en todos los dispositivos excepto en este."
        }
        isOpen={Boolean(confirm)}
        isPending={revokeOne.isPending || revokeOthers.isPending}
        title={
          confirm?.type === "one"
            ? "Cerrar sesión"
            : "Cerrar las demás sesiones"
        }
        onConfirm={handleConfirm}
        onOpenChange={(isOpen) => !isOpen && closeConfirm()}
      />
    </AppCard>
  );
}

export function ProfileView() {
  const profile = useProfile();
  const data = profile.data;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        description="Gestiona tus datos personales, el acceso y la seguridad de tu cuenta."
        title="Mi perfil"
      />

      {profile.error ? (
        <QueryError error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <>
          <AppCard>
            {data ? (
              <ProfileSummary profile={data} />
            ) : (
              <ListSkeleton rows={1} />
            )}
          </AppCard>

          <AppCard
            description="Así te verán los miembros de tus organizaciones."
            title="Datos personales"
          >
            {data ? (
              <PersonalForm name={data.name} />
            ) : (
              <ListSkeleton rows={1} />
            )}
          </AppCard>

          <AppCard
            description="Lo usas para iniciar sesión y recibir notificaciones."
            title="Correo electrónico"
          >
            {data ? (
              <EmailForm email={data.email} />
            ) : (
              <ListSkeleton rows={1} />
            )}
          </AppCard>

          <AppCard
            description={
              data?.hasPassword === false
                ? undefined
                : "Al cambiarla se cerrará tu sesión en los demás dispositivos."
            }
            title="Contraseña"
          >
            {!data ? (
              <ListSkeleton rows={2} />
            ) : data.hasPassword ? (
              <ChangePasswordForm />
            ) : (
              <SetPasswordForm />
            )}
          </AppCard>

          <SessionsSection />
        </>
      )}
    </div>
  );
}
