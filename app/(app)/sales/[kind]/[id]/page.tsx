import type { Metadata } from "next";

import { SalesDetailView } from "@/components/sales/sales-detail-view";
import { salesTypeFromParams } from "@/lib/sales-route";

type Props = { params: Promise<{ kind: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: (await salesTypeFromParams(params)).label };
}

export default async function SalesDocumentPage({ params }: Props) {
  const { type } = await salesTypeFromParams(params);
  const { id } = await params;

  return <SalesDetailView id={id} type={type} />;
}
