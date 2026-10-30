import type { Metadata } from "next";

import { ProductInventoryTab } from "@/components/products/product-detail-view";

export const metadata: Metadata = { title: "Inventario del producto" };

export default function Page() {
  return <ProductInventoryTab />;
}
