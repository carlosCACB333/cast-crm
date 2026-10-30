import type { Metadata } from "next";

import { Suspense } from "react";

import { ListSkeleton } from "@/components/organization/query-state";
import { ServicesView } from "@/components/services/services-view";

export const metadata: Metadata = { title: "Servicios" };

export default function ServicesPage() {
  return (
    // The view reads its filters from the URL search params.
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <ServicesView />
    </Suspense>
  );
}
