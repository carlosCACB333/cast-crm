"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { authErrorMessage } from "@/components/auth/auth-errors";
import { SocialButtons } from "@/components/auth/social-buttons";
import { LockIcon, MailIcon, UserIcon } from "@/components/icons";
import { AppAlert, AppButton, AppDivider, AppInput } from "@/components/ui";
import { VERIFY_EMAIL_PATH } from "@/components/auth/resend-verification-form";
import { authClient } from "@/lib/auth-client";
import {
  PASSWORD_MIN_LENGTH,
  type SignUpValues,
  signUpSchema,
} from "@/lib/validations/auth";

export function SignUpForm() {
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async ({ name, email, password }: SignUpValues) => {
    setFormError(undefined);

    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: `${window.location.origin}${VERIFY_EMAIL_PATH}`,
    });

    if (error) {
      setFormError(authErrorMessage(error, "No se pudo crear la cuenta."));

      return;
    }

    setSentTo(email);
  };

  if (sentTo) {
    return (
      <AppAlert
        description={
          <>
            Enviamos un enlace de verificación a <strong>{sentTo}</strong>.
            Ábrelo para activar tu cuenta.
          </>
        }
        status="success"
        title="Revisa tu correo"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {formError ? <AppAlert status="danger" title={formError} /> : null}

      <SocialButtons callbackPath="/dashboard" onError={setFormError} />
      <AppDivider label="o con tu correo" />

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <AppInput
          isRequired
          autoComplete="name"
          control={control}
          icon={<UserIcon size={16} />}
          label="Nombre"
          name="name"
          placeholder="Ana García"
        />
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
        <AppInput
          isRequired
          autoComplete="new-password"
          control={control}
          description={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
          icon={<LockIcon size={16} />}
          label="Contraseña"
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
          Crear cuenta
        </AppButton>
      </form>
    </div>
  );
}
