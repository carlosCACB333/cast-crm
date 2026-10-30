import type { Metadata } from "next";

import { CashRegisterDetailView } from "@/components/pos/cash-register-detail-view";

export const metadata: Metadata = { title: "Caja" };

type Props = { params: Promise<{ id: string }> };

export default async function CashRegisterPage({ params }: Props) {
  const { id } = await params;

  return <CashRegisterDetailView key={id} id={id} />;
}
