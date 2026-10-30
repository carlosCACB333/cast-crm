"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { authErrorMessage } from "@/components/auth/auth-errors";
import { MailIcon } from "@/components/icons";
import { AppAlert, AppButton, AppInput } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import {
  type ForgotPasswordValues,
  forgotPasswordSchema,
} from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string>();
  const [isSent, setIsSent] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: ForgotPasswordValues) => {
    setFormError(undefined);

    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setFormError(
        authErrorMessage(error, "No se pudo procesar la solicitud."),
      );

      return;
    }

    setIsSent(true);
  };

  if (isSent) {
    return (
      <AppAlert
        description="Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña."
        status="success"
        title="Revisa tu correo"
      />
    );
  }

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
          autoComplete="email"
          control={control}
          icon={<MailIcon size={16} />}
          label="Correo electrónico"
          name="email"
          placeholder="tu@empresa.com"
          type="email"
        />
        <AppButton
          fullWidth
          className="mt-2"
          isPending={isSubmitting}
          type="submit"
        >
          Enviar enlace
        </AppButton>
      </form>
    </div>
  );
}
