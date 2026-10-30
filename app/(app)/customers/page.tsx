import type { Metadata } from "next";

import { Suspense } from "react";

import { CustomersView } from "@/components/customers/customers-view";
import { ListSkeleton } from "@/components/organization/query-state";

export const metadata: Metadata = { title: "Clientes" };

export default function CustomersPage() {
  return (
    // The view reads its filters from the URL search params.
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <CustomersView />
    </Suspense>
  );
}
