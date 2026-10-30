import type { Metadata } from "next";

import { PosSettingsView } from "@/components/pos/pos-settings-view";

export const metadata: Metadata = { title: "Configuración del punto de venta" };

export default function PosSettingsPage() {
  return <PosSettingsView />;
}
