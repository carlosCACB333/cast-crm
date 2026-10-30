"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { authErrorMessage } from "@/components/auth/auth-errors";
import { MailIcon } from "@/components/icons";
import { AppAlert, AppButton, AppInput } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import {
  type ResendVerificationValues,
  resendVerificationSchema,
} from "@/lib/validations/auth";

/** Where Better Auth redirects after the verification link is opened. */
export const VERIFY_EMAIL_PATH = "/verify-email";

export function ResendVerificationForm() {
  const [formError, setFormError] = useState<string>();
  const [isSent, setIsSent] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ResendVerificationValues>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: ResendVerificationValues) => {
    setFormError(undefined);

    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}${VERIFY_EMAIL_PATH}`,
    });

    if (error) {
      setFormError(authErrorMessage(error, "No se pudo enviar el enlace."));

      return;
    }

    setIsSent(true);
  };

  if (isSent) {
    return (
      <AppAlert
        description="Si la cuenta existe y aún no está verificada, recibirás un nuevo enlace."
        status="success"
        title="Revisa tu correo"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
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
        <AppButton fullWidth isPending={isSubmitting} type="submit">
          Enviar nuevo enlace
        </AppButton>
      </form>
    </div>
  );
}
