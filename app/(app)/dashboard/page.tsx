import type { Metadata } from "next";

import { DashboardView } from "@/components/organization/dashboard-view";
import { requireOrganizationSession } from "@/lib/session";

export const metadata: Metadata = { title: "Panel" };

export default async function DashboardPage() {
  const { user } = await requireOrganizationSession();

  return <DashboardView userName={user.name} />;
}
