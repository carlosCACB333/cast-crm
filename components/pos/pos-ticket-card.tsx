"use client";

import type { SalesDocumentDetail } from "@/lib/actions/sales";

import { useState } from "react";
import NextLink from "next/link";

import { StoreIcon } from "@/components/icons";
import { AppButton, AppCard, AppConfirm } from "@/components/ui";
import { cashSessionStatusInfo } from "@/config/pos";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useActiveMember, usePermission } from "@/hooks/use-organization";
import { voidPosTicket } from "@/lib/actions/pos";
import { queryKeys } from "@/lib/query-keys";

/**
 * Where a ticket was sold. While its cash session is open, the cashier who
 * opened it (or a POS manager) can void it from here.
 */
export function PosTicketCard({ document }: { document: SalesDocumentDetail }) {
  const { data: member } = useActiveMember();
  const canRead = usePermission({ pos: ["read"] });
  const canSell = usePermission({ pos: ["sell"] });
  const canManage = usePermission({ pos: ["manage"] });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const voidTicket = useActionMutation(voidPosTicket, {
    successMessage: "Ticket anulado",
    invalidate: [queryKeys.sales, queryKeys.products],
  });
  const session = document.cashSession;

  if (!session) return null;

  const status = cashSessionStatusInfo(session.status);
  const canVoid =
    document.status !== "CANCELLED" &&
    session.status === "OPEN" &&
    canSell &&
    (canManage || session.openedById === member?.userId);

  return (
    <AppCard
      description={
        session.status === "OPEN"
          ? "Mientras la caja siga abierta, el ticket se puede anular desde aquí."
          : "La caja ya está cerrada: el ticket no se puede anular."
      }
      title="Punto de venta"
    >
      <div className="flex items-center gap-2 text-sm">
        <StoreIcon size={16} />
        {canRead ? (
          <NextLink
            className="font-medium hover:underline"
            href={`/pos/sessions/${session.id}`}
          >
            {session.register.name}
          </NextLink>
        ) : (
          <span className="font-medium">{session.register.name}</span>
        )}
        <span className="text-muted">· Caja {status.label.toLowerCase()}</span>
      </div>
      {canVoid ? (
        <AppButton variant="secondary" onPress={() => setIsConfirmOpen(true)}>
          Anular ticket
        </AppButton>
      ) : null}
      <AppConfirm
        confirmLabel="Anular ticket"
        description="Su importe se devuelve desde la caja con las mismas formas de pago y las unidades vuelven al stock."
        isOpen={isConfirmOpen}
        isPending={voidTicket.isPending}
        title={`Anular ticket ${document.number ?? ""}`}
        onConfirm={() =>
          voidTicket.mutate(document.id, {
            onSuccess: () => setIsConfirmOpen(false),
          })
        }
        onOpenChange={setIsConfirmOpen}
      />
    </AppCard>
  );
}
