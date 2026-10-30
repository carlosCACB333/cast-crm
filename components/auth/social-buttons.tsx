"use client";

import { useState } from "react";

import { GithubIcon, GoogleIcon } from "@/components/icons";
import { AppButton } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

const providers = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "github", label: "GitHub", Icon: GithubIcon },
] as const;

type Provider = (typeof providers)[number]["id"];

interface SocialButtonsProps {
  callbackPath: string;
  onError: (message: string) => void;
}

export function SocialButtons({ callbackPath, onError }: SocialButtonsProps) {
  const [pendingProvider, setPendingProvider] = useState<Provider>();

  const signIn = async (provider: Provider, label: string) => {
    setPendingProvider(provider);
    const origin = window.location.origin;
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: `${origin}${callbackPath}`,
      errorCallbackURL: `${origin}/sign-in`,
    });

    // On success the browser is redirected to the provider.
    if (error) {
      setPendingProvider(undefined);
      onError(error.message ?? `No se pudo conectar con ${label}`);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {providers.map(({ id, label, Icon }) => (
        <AppButton
          key={id}
          fullWidth
          isDisabled={pendingProvider !== undefined && pendingProvider !== id}
          isPending={pendingProvider === id}
          variant="outline"
          onPress={() => signIn(id, label)}
        >
          {pendingProvider === id ? null : <Icon size={18} />}
          {label}
        </AppButton>
      ))}
    </div>
  );
}
