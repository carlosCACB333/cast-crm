import type { Metadata } from "next";

import { SalesPrintView } from "@/components/sales/sales-print-view";

export const metadata: Metadata = { title: "Imprimir documento" };

export default async function PrintSalesDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SalesPrintView id={id} />;
}
