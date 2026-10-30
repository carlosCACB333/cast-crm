import type { Metadata } from "next";

import { SalesEditView } from "@/components/sales/sales-document-form";
import { salesTypeFromParams } from "@/lib/sales-route";

type Props = { params: Promise<{ kind: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { label } = await salesTypeFromParams(params);

  return { title: `Editar ${label.toLowerCase()}` };
}

export default async function EditSalesDocumentPage({ params }: Props) {
  const { type } = await salesTypeFromParams(params);
  const { id } = await params;

  return <SalesEditView id={id} type={type} />;
}
