import type { Metadata } from "next";

import { ProductCategories } from "@/components/catalog/catalog-categories";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Categorías de productos" };

export default function ProductCategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Agrupa tus productos para encontrarlos y filtrarlos más rápido."
        title="Categorías de productos"
      />
      <ProductCategories />
    </div>
  );
}
