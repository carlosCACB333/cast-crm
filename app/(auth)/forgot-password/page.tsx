import type { Metadata } from "next";

import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AppLink } from "@/components/ui";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeader
        description="Te enviaremos un enlace para restablecerla"
        title="¿Olvidaste tu contraseña?"
      />
      <ForgotPasswordForm />
      <AuthFooter>
        <AppLink href="/sign-in">Volver a iniciar sesión</AppLink>
      </AuthFooter>
    </>
  );
}
