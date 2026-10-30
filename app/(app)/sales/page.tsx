import type { Metadata } from "next";

import { SalesOverviewView } from "@/components/sales/sales-overview-view";

export const metadata: Metadata = { title: "Ventas" };

export default function SalesPage() {
  return <SalesOverviewView />;
}
