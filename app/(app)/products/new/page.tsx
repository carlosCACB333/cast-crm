import type { Metadata } from "next";

import { ProductCreateView } from "@/components/products/product-form";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function NewProductPage() {
  return <ProductCreateView />;
}
