import type { Metadata } from "next";

import { Suspense } from "react";

import { CustomerDetailView } from "@/components/customers/customer-detail-view";
import { ListSkeleton } from "@/components/organization/query-state";

export const metadata: Metadata = { title: "Cliente" };

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <CustomerDetailView id={id} />
    </Suspense>
  );
}
