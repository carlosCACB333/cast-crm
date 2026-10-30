"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SocialButtons } from "@/components/auth/social-buttons";
import { TOO_MANY_REQUESTS } from "@/components/auth/auth-errors";
import { LockIcon, MailIcon } from "@/components/icons";
import {
  AppAlert,
  AppButton,
  AppDivider,
  AppInput,
  AppLink,
} from "@/components/ui";
import { VERIFY_EMAIL_PATH } from "@/components/auth/resend-verification-form";
import { authClient } from "@/lib/auth-client";
import { type SignInValues, signInSchema } from "@/lib/validations/auth";

interface SignInFormProps {
  initialError?: string;
  redirectTo: string;
}

export function SignInForm({ initialError, redirectTo }: SignInFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState(initialError);
  const [notice, setNotice] = useState<string>();
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: SignInValues) => {
    setFormError(undefined);
    setNotice(undefined);

    const { error } = await authClient.signIn.email({
      ...values,
      callbackURL: `${window.location.origin}${VERIFY_EMAIL_PATH}`,
    });

    if (!error) {
      router.replace(redirectTo);
      router.refresh();

      return;
    }

    if (error.code === "EMAIL_NOT_VERIFIED") {
      setNotice(
        "Tu correo aún no está verificado. Te enviamos un nuevo enlace de verificación.",
      );
    } else if (error.status === 429) {
      setFormError(TOO_MANY_REQUESTS);
    } else {
      setFormError("Correo o contraseña incorrectos.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {formError ? <AppAlert status="danger" title={formError} /> : null}
      {notice ? <AppAlert status="accent" title={notice} /> : null}

      <SocialButtons callbackPath={redirectTo} onError={setFormError} />
      <AppDivider label="o con tu correo" />

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
        <AppInput
          isRequired
          autoComplete="current-password"
          control={control}
          icon={<LockIcon size={16} />}
          label="Contraseña"
          labelAction={
            <AppLink href="/forgot-password" size="xs">
              ¿Olvidaste tu contraseña?
            </AppLink>
          }
          name="password"
          placeholder="••••••••"
          type="password"
        />
        <AppButton
          fullWidth
          className="mt-2"
          isPending={isSubmitting}
          type="submit"
        >
          Iniciar sesión
        </AppButton>
      </form>
    </div>
  );
}
