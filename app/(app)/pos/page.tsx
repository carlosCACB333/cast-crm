import type { Metadata } from "next";

import { PosView } from "@/components/pos/pos-view";

export const metadata: Metadata = { title: "Punto de venta" };

export default function PosPage() {
  return <PosView />;
}
