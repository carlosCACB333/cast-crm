import { MembersLayout } from "@/components/organization/members-view";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MembersLayout>{children}</MembersLayout>;
}
