import type { Metadata } from "next";

import { ServiceEditView } from "@/components/services/service-form";

export const metadata: Metadata = { title: "Editar servicio" };

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ServiceEditView id={id} />;
}
