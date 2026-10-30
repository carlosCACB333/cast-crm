"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { authErrorMessage } from "@/components/auth/auth-errors";
import { LockIcon } from "@/components/icons";
import { AppAlert, AppButton, AppInput, AppLink } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import {
  PASSWORD_MIN_LENGTH,
  type ResetPasswordValues,
  resetPasswordSchema,
} from "@/lib/validations/auth";

const INVALID_LINK =
  "El enlace no es válido o ha caducado. Solicita uno nuevo.";

interface ResetPasswordFormProps {
  token?: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [formError, setFormError] = useState<string>();
  const [isDone, setIsDone] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <AppAlert
          description={INVALID_LINK}
          status="danger"
          title="Enlace inválido"
        />
        <AppLink href="/forgot-password">Solicitar un nuevo enlace</AppLink>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="flex flex-col gap-4">
        <AppAlert
          description="Ya puedes iniciar sesión con tu nueva contraseña."
          status="success"
          title="Contraseña actualizada"
        />
        <AppLink href="/sign-in">Ir a iniciar sesión</AppLink>
      </div>
    );
  }

  const onSubmit = async ({ password }: ResetPasswordValues) => {
    setFormError(undefined);

    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    if (error) {
      setFormError(
        error.code === "INVALID_TOKEN"
          ? INVALID_LINK
          : authErrorMessage(error, "No se pudo restablecer la contraseña."),
      );

      return;
    }

    setIsDone(true);
  };

  return (
    <div className="flex flex-col gap-5">
      {formError ? <AppAlert status="danger" title={formError} /> : null}
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <AppInput
          isRequired
          autoComplete="new-password"
          control={control}
          description={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
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
        <AppButton
          fullWidth
          className="mt-2"
          isPending={isSubmitting}
          type="submit"
        >
          Guardar contraseña
        </AppButton>
      </form>
    </div>
  );
}
