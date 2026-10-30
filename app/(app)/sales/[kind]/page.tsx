import type { Metadata } from "next";

import { Suspense } from "react";

import { ListSkeleton } from "@/components/organization/query-state";
import { SalesListView } from "@/components/sales/sales-list-view";
import { salesTypeFromParams } from "@/lib/sales-route";

type Props = { params: Promise<{ kind: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: (await salesTypeFromParams(params)).plural };
}

export default async function SalesListPage({ params }: Props) {
  const { type } = await salesTypeFromParams(params);

  return (
    // The view reads its filters from the URL search params.
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <SalesListView key={type} type={type} />
    </Suspense>
  );
}
