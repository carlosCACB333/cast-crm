"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { LogOutIcon, SettingsIcon, UserIcon } from "@/components/icons";
import {
  AppAvatar,
  AppButton,
  AppDropdown,
  type AppDropdownProps,
  notify,
} from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export interface ShellUser {
  name: string;
  email: string;
  image?: string | null;
}

export function AccountMenu({
  user,
  compact,
  placement = compact ? "bottom end" : "top start",
}: {
  user: ShellUser;
  compact?: boolean;
  placement?: AppDropdownProps["placement"];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleAction = async (id: string) => {
    if (id === "profile") {
      router.push("/profile");

      return;
    }
    if (id === "settings") {
      router.push("/settings");

      return;
    }
    if (id === "sign-out") {
      const { error } = await authClient.signOut();

      if (error) {
        notify.error("No se pudo cerrar la sesión");

        return;
      }
      queryClient.clear();
      router.replace("/sign-in");
      router.refresh();
    }
  };

  return (
    <AppDropdown
      header={
        <div className="flex flex-col">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted">{user.email}</span>
        </div>
      }
      items={[
        {
          id: "profile",
          label: "Mi perfil",
          icon: <UserIcon size={16} />,
        },
        {
          id: "settings",
          label: "Configuración",
          icon: <SettingsIcon size={16} />,
        },
        {
          id: "sign-out",
          label: "Cerrar sesión",
          icon: <LogOutIcon size={16} />,
          isDanger: true,
        },
      ]}
      label="Menú de cuenta"
      placement={placement}
      trigger={
        compact ? (
          <AppButton isIconOnly aria-label="Menú de cuenta" variant="ghost">
            <AppAvatar name={user.name} size="sm" src={user.image} />
          </AppButton>
        ) : (
          <AppButton
            fullWidth
            aria-label="Menú de cuenta"
            className="h-auto justify-start gap-3 px-2 py-2"
            variant="ghost"
          >
            <AppAvatar name={user.name} size="sm" src={user.image} />
            <span className="flex min-w-0 flex-1 flex-col items-start text-left">
              <span className="w-full truncate text-sm font-medium">
                {user.name}
              </span>
              <span className="w-full truncate text-xs text-muted">
                {user.email}
              </span>
            </span>
          </AppButton>
        )
      }
      onAction={handleAction}
    />
  );
}
