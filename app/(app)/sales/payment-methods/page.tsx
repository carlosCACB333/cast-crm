import type { Metadata } from "next";

import { PaymentMethodsView } from "@/components/sales/payment-methods-view";

export const metadata: Metadata = { title: "Formas de pago" };

export default function PaymentMethodsPage() {
  return <PaymentMethodsView />;
}
