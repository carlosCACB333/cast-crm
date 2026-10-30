import type { Metadata } from "next";

import { SalesCreateView } from "@/components/sales/sales-document-form";
import { salesTypeFromParams } from "@/lib/sales-route";

type Props = {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ customerId?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: (await salesTypeFromParams(params)).newLabel };
}

export default async function NewSalesDocumentPage({
  params,
  searchParams,
}: Props) {
  const { type } = await salesTypeFromParams(params);
  const { customerId } = await searchParams;

  // Only preselects the field; the server checks the customer on save.
  return (
    <SalesCreateView
      customerId={
        typeof customerId === "string" ? customerId.slice(0, 128) : ""
      }
      type={type}
    />
  );
}
