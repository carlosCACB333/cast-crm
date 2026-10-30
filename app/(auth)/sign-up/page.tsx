import type { Metadata } from "next";

import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { AppLink } from "@/components/ui";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <>
      <AuthHeader
        description="Empieza a gestionar tus clientes en minutos"
        title="Crea tu cuenta"
      />
      <SignUpForm />
      <AuthFooter>
        ¿Ya tienes cuenta? <AppLink href="/sign-in">Inicia sesión</AppLink>
      </AuthFooter>
    </>
  );
}
