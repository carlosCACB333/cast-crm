import type { Metadata } from "next";

import { CashSessionDetailView } from "@/components/pos/cash-session-detail-view";

export const metadata: Metadata = { title: "Apertura de caja" };

type Props = { params: Promise<{ id: string }> };

export default async function CashSessionPage({ params }: Props) {
  const { id } = await params;

  return <CashSessionDetailView key={id} id={id} />;
}
