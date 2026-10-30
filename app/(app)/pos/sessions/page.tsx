import type { Metadata } from "next";

import { CashSessionsView } from "@/components/pos/cash-sessions-view";

export const metadata: Metadata = { title: "Aperturas de caja" };

export default function CashSessionsPage() {
  return <CashSessionsView />;
}
