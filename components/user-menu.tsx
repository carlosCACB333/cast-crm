"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";

import { AppButton } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (isPending) return <div aria-hidden className="h-9 w-24" />;

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <NextLink
          className="button button--tertiary button--sm"
          href="/sign-in"
        >
          Iniciar sesión
        </NextLink>
        <NextLink className="button button--primary button--sm" href="/sign-up">
          Registrarse
        </NextLink>
      </div>
    );
  }

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await authClient.signOut();
    setIsSigningOut(false);
    router.replace("/sign-in");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3">
      <NextLink className="hidden text-sm md:inline" href="/dashboard">
        {session.user.name}
      </NextLink>
      <AppButton
        isPending={isSigningOut}
        size="sm"
        variant="tertiary"
        onPress={handleSignOut}
      >
        Cerrar sesión
      </AppButton>
    </div>
  );
}
