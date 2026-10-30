"use client";

import { useState } from "react";
import NextLink from "next/link";
import clsx from "clsx";

import {
  AccountMenu,
  type ShellUser,
} from "@/components/app-shell/account-menu";
import { OrgSwitcher } from "@/components/app-shell/org-switcher";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/components/app-shell/sidebar-state";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import {
  Logo,
  MenuIcon,
  SidebarCollapseIcon,
  SidebarExpandIcon,
} from "@/components/icons";
import { ThemeSwitch } from "@/components/theme-switch";
import { AppButton, AppDrawer, AppTooltip } from "@/components/ui";

function SidebarContent({
  user,
  onNavigate,
  isCollapsed,
  onToggleCollapsed,
}: {
  user: ShellUser;
  onNavigate?: () => void;
  isCollapsed?: boolean;
  /** Only the desktop sidebar can collapse; the mobile drawer omits it. */
  onToggleCollapsed?: () => void;
}) {
  const toggleLabel = isCollapsed ? "Expandir menú" : "Contraer menú";
  const toggle = onToggleCollapsed ? (
    <AppTooltip content={toggleLabel} placement="right">
      <AppButton
        isIconOnly
        aria-label={toggleLabel}
        size="sm"
        variant="ghost"
        onPress={onToggleCollapsed}
      >
        {isCollapsed ? (
          <SidebarExpandIcon size={18} />
        ) : (
          <SidebarCollapseIcon size={18} />
        )}
      </AppButton>
    </AppTooltip>
  ) : null;

  if (isCollapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-4 px-2 py-4">
        {toggle}
        <OrgSwitcher isCollapsed />
        <div className="w-full flex-1 overflow-y-auto">
          <SidebarNav isCollapsed />
        </div>
        <div className="flex flex-col items-center gap-3 border-t border-separator pt-4">
          <ThemeSwitch />
          <AccountMenu compact placement="right" user={user} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <OrgSwitcher />
        </div>
        {toggle}
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="flex flex-col gap-2 border-t border-separator pt-4">
        <div className="flex items-center justify-between px-3 text-sm text-muted">
          Tema
          <ThemeSwitch />
        </div>
        <AccountMenu user={user} />
      </div>
    </div>
  );
}

export function AppShell({
  user,
  defaultCollapsed = false,
  children,
}: {
  user: ShellUser;
  /** Read from the cookie on the server so the first render matches. */
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapsed = () => {
    const next = !isCollapsed;

    setIsCollapsed(next);
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div className="flex min-h-dvh">
      <aside
        className={clsx(
          "sticky top-0 hidden h-dvh shrink-0 border-r border-separator bg-surface transition-[width] duration-200 lg:block",
          isCollapsed ? "w-16" : "w-72",
        )}
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          user={user}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-separator bg-background/80 px-4 backdrop-blur-lg lg:hidden">
          <AppButton
            isIconOnly
            aria-label="Abrir menú"
            variant="ghost"
            onPress={() => setIsMenuOpen(true)}
          >
            <MenuIcon size={20} />
          </AppButton>
          <NextLink
            className="flex items-center gap-1 font-semibold"
            href="/dashboard"
          >
            <Logo size={28} />
            Cast CRM
          </NextLink>
          <AccountMenu compact user={user} />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>

      <AppDrawer isOpen={isMenuOpen} label="Menú" onOpenChange={setIsMenuOpen}>
        <SidebarContent user={user} onNavigate={() => setIsMenuOpen(false)} />
      </AppDrawer>
    </div>
  );
}
