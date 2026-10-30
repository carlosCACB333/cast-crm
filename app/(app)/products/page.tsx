import type { Metadata } from "next";

import { Suspense } from "react";

import { ListSkeleton } from "@/components/organization/query-state";
import { ProductsView } from "@/components/products/products-view";

export const metadata: Metadata = { title: "Productos" };

export default function ProductsPage() {
  return (
    // The view reads its filters from the URL search params.
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <ProductsView />
    </Suspense>
  );
}
