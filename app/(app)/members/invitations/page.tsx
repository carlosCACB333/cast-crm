import type { Metadata } from "next";

import { MembersInvitationsTab } from "@/components/organization/members-view";

export const metadata: Metadata = { title: "Invitaciones" };

export default function MemberInvitationsPage() {
  return <MembersInvitationsTab />;
}
