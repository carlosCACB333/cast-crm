import type { Metadata } from "next";

import { AuthHeader } from "@/components/auth/auth-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <>
      <AuthHeader
        description="Elige una contraseña segura para tu cuenta"
        title="Nueva contraseña"
      />
      <ResetPasswordForm token={error ? undefined : token} />
    </>
  );
}
