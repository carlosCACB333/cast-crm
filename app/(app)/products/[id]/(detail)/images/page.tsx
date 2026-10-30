import type { Metadata } from "next";

import { ProductImagesTab } from "@/components/products/product-detail-view";

export const metadata: Metadata = { title: "Imágenes del producto" };

export default function Page() {
  return <ProductImagesTab />;
}
