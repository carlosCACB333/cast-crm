import type { Metadata } from "next";

import { ServiceCreateView } from "@/components/services/service-form";

export const metadata: Metadata = { title: "Nuevo servicio" };

export default function NewServicePage() {
  return <ServiceCreateView />;
}
