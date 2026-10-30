import type { Metadata } from "next";

import { ProductSummaryTab } from "@/components/products/product-detail-view";

export const metadata: Metadata = { title: "Producto" };

export default function Page() {
  return <ProductSummaryTab />;
}
