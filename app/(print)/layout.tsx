import { requireOrganizationSession } from "@/lib/session";

/** Pages laid out to be printed, without the app navigation. */
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrganizationSession();

  return <main>{children}</main>;
}
