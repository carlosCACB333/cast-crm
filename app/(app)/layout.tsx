import { cookies } from "next/headers";

import { AppShell } from "@/components/app-shell/app-shell";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/components/app-shell/sidebar-state";
import { requireOrganizationSession } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireOrganizationSession();
  const cookieStore = await cookies();
  const defaultCollapsed =
    cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "true";

  return (
    <AppShell
      defaultCollapsed={defaultCollapsed}
      user={{ name: user.name, email: user.email, image: user.image }}
    >
      {children}
    </AppShell>
  );
}
