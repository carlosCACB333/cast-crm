import type { Metadata } from "next";

import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { SignInForm } from "@/components/auth/sign-in-form";
import { AppLink } from "@/components/ui";
import { safeRedirectPath } from "@/lib/redirect";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;

  return (
    <>
      <AuthHeader
        description="Accede a tu espacio de trabajo"
        title="Bienvenido de nuevo"
      />
      <SignInForm
        initialError={
          error
            ? "No se pudo completar el inicio de sesión. Inténtalo de nuevo."
            : undefined
        }
        redirectTo={safeRedirectPath(redirectTo)}
      />
      <AuthFooter>
        ¿No tienes cuenta? <AppLink href="/sign-up">Regístrate</AppLink>
      </AuthFooter>
    </>
  );
}
