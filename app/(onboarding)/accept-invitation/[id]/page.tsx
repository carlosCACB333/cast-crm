import type { Metadata } from "next";

import { AcceptInvitationView } from "@/components/organization/accept-invitation-view";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Invitación" };

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession(`/accept-invitation/${id}`);

  return (
    <AcceptInvitationView invitationId={id} userEmail={session.user.email} />
  );
}
