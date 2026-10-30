import type { Metadata } from "next";

import { SalesSettingsView } from "@/components/sales/sales-settings-view";

export const metadata: Metadata = { title: "Configuración de ventas" };

export default function SalesSettingsPage() {
  return <SalesSettingsView />;
}
