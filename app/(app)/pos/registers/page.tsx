import type { Metadata } from "next";

import { CashRegistersView } from "@/components/pos/cash-registers-view";

export const metadata: Metadata = { title: "Cajas" };

export default function CashRegistersPage() {
  return <CashRegistersView />;
}
