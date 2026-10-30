import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { OnboardingView } from "@/components/organization/onboarding-view";
import { getValidActiveOrganizationId, requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Empezar" };

export default async function OnboardingPage() {
  const session = await requireSession("/onboarding");

  if (await getValidActiveOrganizationId(session)) redirect("/dashboard");

  return <OnboardingView userName={session.user.name} />;
}
