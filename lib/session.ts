import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { hasMembership } from "@/lib/organization";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession(redirectTo?: string) {
  const session = await getSession();

  if (!session) {
    redirect(
      redirectTo
        ? `/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`
        : "/sign-in",
    );
  }

  return session;
}

/** Returns the active organization id if the user is still a member of it. */
export async function getValidActiveOrganizationId(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
) {
  const organizationId = session.session.activeOrganizationId;

  if (!organizationId) return null;

  return (await hasMembership(session.user.id, organizationId))
    ? organizationId
    : null;
}

/** Session for the CRM area: requires sign-in and a valid active organization. */
export async function requireOrganizationSession() {
  const session = await requireSession();
  const organizationId = await getValidActiveOrganizationId(session);

  if (!organizationId) redirect("/onboarding");

  return { ...session, organizationId };
}
