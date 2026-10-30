import type { Metadata } from "next";

import { ServiceCategories } from "@/components/catalog/catalog-categories";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Categorías de servicios" };

export default function ServiceCategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Agrupa tus servicios para encontrarlos y filtrarlos más rápido."
        title="Categorías de servicios"
      />
      <ServiceCategories />
    </div>
  );
}
