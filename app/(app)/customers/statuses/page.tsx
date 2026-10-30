import type { Metadata } from "next";

import { CustomerStatusesSettings } from "@/components/customers/customer-statuses-settings";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Estados de clientes" };

export default function CustomerStatusesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Etapas por las que pasan tus clientes, de la primera a la última."
        title="Estados de clientes"
      />
      <CustomerStatusesSettings />
    </div>
  );
}
