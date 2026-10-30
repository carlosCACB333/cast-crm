import type { Metadata } from "next";

import { MembersTeamTab } from "@/components/organization/members-view";

export const metadata: Metadata = { title: "Miembros" };

export default function MembersPage() {
  return <MembersTeamTab />;
}
