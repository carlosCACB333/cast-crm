import type { Metadata } from "next";

import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { AppAlert, AppLink } from "@/components/ui";

export const metadata: Metadata = { title: "Verificar correo" };

const errorMessages: Record<string, string> = {
  TOKEN_EXPIRED: "El enlace de verificación ha caducado.",
  INVALID_TOKEN: "El enlace de verificación no es válido.",
  USER_NOT_FOUND: "No encontramos una cuenta para este enlace.",
};

// A successful verification signs the user in, so the (auth) layout redirects
// to the dashboard before this page renders. Reaching it means either an error
// or a verified user without a session.
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (!error) {
    return (
      <>
        <AuthHeader
          description="Tu cuenta ya está activa"
          title="Correo verificado"
        />
        <AppAlert
          description="Ya puedes iniciar sesión con tu correo y contraseña."
          status="success"
          title="¡Listo!"
        />
        <AuthFooter>
          <AppLink href="/sign-in">Ir a iniciar sesión</AppLink>
        </AuthFooter>
      </>
    );
  }

  return (
    <>
      <AuthHeader
        description="Solicita un nuevo enlace para activar tu cuenta"
        title="No pudimos verificar tu correo"
      />
      <AppAlert
        status="danger"
        title={errorMessages[error] ?? "No se pudo verificar el correo."}
      />
      <ResendVerificationForm />
      <AuthFooter>
        <AppLink href="/sign-in">Volver a iniciar sesión</AppLink>
      </AuthFooter>
    </>
  );
}
