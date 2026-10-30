import type { Metadata } from "next";

import { Suspense } from "react";

import { ListSkeleton } from "@/components/organization/query-state";
import { ServiceDetailView } from "@/components/services/service-detail-view";

export const metadata: Metadata = { title: "Servicio" };

export default async function ServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <ServiceDetailView id={id} />
    </Suspense>
  );
}
