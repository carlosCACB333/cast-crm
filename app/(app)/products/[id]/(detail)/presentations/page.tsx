import type { Metadata } from "next";

import { ProductPresentationsTab } from "@/components/products/product-detail-view";

export const metadata: Metadata = { title: "Formas de venta" };

export default function Page() {
  return <ProductPresentationsTab />;
}
