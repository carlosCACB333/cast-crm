"use client";

import { useState } from "react";
import NextLink from "next/link";
import clsx from "clsx";

import {
  ArrowLeftIcon,
  BanknoteIcon,
  ReceiptIcon,
  StoreIcon,
  WalletIcon,
} from "@/components/icons";
import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  CashMovementModal,
  CashSummaryList,
  CloseSessionModal,
} from "@/components/pos/pos-cash-modals";
import { SalesStatusChip } from "@/components/sales/sales-format";
import {
  AppButton,
  AppCard,
  AppConfirm,
  AppStatCard,
  AppStatusChip,
} from "@/components/ui";
import { cashMovementLabel, cashSessionStatusInfo } from "@/config/pos";
import { salesDocumentHref } from "@/config/sales";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCashSession } from "@/hooks/use-pos";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { voidPosTicket } from "@/lib/actions/pos";
import { formatDateTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

/** One opening of a register: its figures, tickets, movements and cash count. */
export function CashSessionDetailView({ id }: { id: string }) {
  const money = useMoneyFormatter();
  const session = useCashSession(id);
  const [modal, setModal] = useState<"movement" | "close">();
  const [toVoid, setToVoid] = useState<{ id: string; number: string | null }>();
  const voidTicket = useActionMutation(voidPosTicket, {
    successMessage: "Ticket anulado",
    invalidate: [queryKeys.sales, queryKeys.products],
  });
  const data = session.data;

  if (session.error) {
    return (
      <QueryError error={session.error} onRetry={() => session.refetch()} />
    );
  }
  if (!data) return <ListSkeleton rows={6} />;

  const status = cashSessionStatusInfo(data.status);
  const { summary } = data;

  return (
    <div className="flex flex-col gap-6">
      <NextLink
        className="flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground"
        href="/pos/sessions"
      >
        <ArrowLeftIcon size={14} />
        Aperturas de caja
      </NextLink>
      <PageHeader
        actions={
          data.canOperate ? (
            <>
              <AppButton
                variant="secondary"
                onPress={() => setModal("movement")}
              >
                <BanknoteIcon size={16} />
                Movimiento de efectivo
              </AppButton>
              <AppButton onPress={() => setModal("close")}>
                Cerrar caja
              </AppButton>
            </>
          ) : null
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <AppStatusChip color={status.color} label={status.label} />
            <span>
              Abierta por {data.openedBy?.name ?? "una persona eliminada"} el{" "}
              {formatDateTime(data.openedAt)}
              {data.closedAt
                ? ` · cerrada por ${data.closedBy?.name ?? "una persona eliminada"} el ${formatDateTime(data.closedAt)}`
                : ""}
            </span>
          </span>
        }
        title={data.register.name}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AppStatCard
          hint={`${summary.ticketCount} tickets${summary.voidedCount ? ` · ${summary.voidedCount} anulados` : ""}`}
          icon={<ReceiptIcon size={18} />}
          label="Ventas"
          value={money.format(summary.ticketTotal)}
        />
        <AppStatCard
          hint="Tickets y facturas cobradas aquí"
          icon={<WalletIcon size={18} />}
          label="Total cobrado"
          value={money.format(summary.totalCollected)}
        />
        <AppStatCard
          hint={`Fondo inicial ${money.format(summary.openingAmount)}`}
          icon={<BanknoteIcon size={18} />}
          label="Efectivo esperado"
          value={money.format(data.expectedCash ?? summary.expectedCash)}
        />
        <AppStatCard
          hint={
            data.countedCash === null
              ? "Se calcula al cerrar la caja"
              : `Contado ${money.format(data.countedCash)}`
          }
          icon={<StoreIcon size={18} />}
          label="Descuadre"
          tone={
            data.difference === null || data.difference === 0
              ? "success"
              : "danger"
          }
          value={
            data.difference === null
              ? "—"
              : data.difference === 0
                ? "Cuadra"
                : money.format(data.difference)
          }
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <AppCard
            description={
              data.canOperate
                ? "Mientras la caja esté abierta, un ticket anulado devuelve su importe y su stock."
                : undefined
            }
            title="Tickets"
          >
            {data.tickets.length ? (
              <ul className="flex flex-col divide-y divide-separator">
                {data.tickets.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <NextLink
                      className="flex min-w-0 flex-col rounded-lg hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                      href={salesDocumentHref("INVOICE", ticket.id)}
                    >
                      <span className="font-medium tabular-nums">
                        {ticket.number}
                      </span>
                      <span className="truncate text-xs text-muted">
                        {formatDateTime(ticket.createdAt)} ·{" "}
                        {ticket.customerName}
                        {ticket.methods.length
                          ? ` · ${ticket.methods.join(", ")}`
                          : ""}
                      </span>
                    </NextLink>
                    <div className="flex shrink-0 items-center gap-2">
                      <SalesStatusChip status={ticket.status} type="INVOICE" />
                      <span
                        className={clsx(
                          "font-medium tabular-nums",
                          ticket.status === "CANCELLED" &&
                            "text-muted line-through",
                        )}
                      >
                        {money.format(ticket.total)}
                      </span>
                      {data.canOperate && ticket.status !== "CANCELLED" ? (
                        <AppButton
                          size="sm"
                          variant="ghost"
                          onPress={() => setToVoid(ticket)}
                        >
                          Anular
                        </AppButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Aún no hay tickets.</p>
            )}
          </AppCard>

          {data.collected.length ? (
            <AppCard
              description="Facturas de Ventas cobradas en esta caja."
              title="Cobros de facturas"
            >
              <ul className="flex flex-col divide-y divide-separator">
                {data.collected.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <NextLink
                      className="flex min-w-0 flex-col hover:underline"
                      href={salesDocumentHref("INVOICE", payment.document.id)}
                    >
                      <span className="font-medium tabular-nums">
                        {payment.document.number}
                      </span>
                      <span className="truncate text-xs text-muted">
                        {payment.document.customerName} · {payment.method}
                      </span>
                    </NextLink>
                    <span className="font-medium tabular-nums">
                      {money.format(payment.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </AppCard>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <AppCard title="Arqueo">
            <CashSummaryList summary={summary} />
            {data.closingNotes ? (
              <p className="whitespace-pre-line rounded-xl bg-default p-3 text-sm">
                {data.closingNotes}
              </p>
            ) : null}
          </AppCard>
          <AppCard title="Movimientos de efectivo">
            {data.movements.length ? (
              <ul className="flex flex-col divide-y divide-separator">
                {data.movements.map((movement) => (
                  <li
                    key={movement.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">
                        {movement.reason}
                      </span>
                      <span className="text-xs text-muted">
                        {cashMovementLabel(movement.type)} ·{" "}
                        {formatDateTime(movement.createdAt)}
                      </span>
                    </div>
                    <span
                      className={clsx(
                        "font-medium tabular-nums",
                        movement.type === "OUT"
                          ? "text-danger"
                          : "text-success",
                      )}
                    >
                      {money.format(
                        movement.type === "OUT"
                          ? -movement.amount
                          : movement.amount,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Sin movimientos.</p>
            )}
          </AppCard>
        </div>
      </div>

      {modal === "movement" ? (
        <CashMovementModal
          isOpen
          sessionId={data.id}
          onOpenChange={(isOpen) => !isOpen && setModal(undefined)}
        />
      ) : null}
      {modal === "close" ? (
        <CloseSessionModal
          isOpen
          registerName={data.register.name}
          sessionId={data.id}
          summary={summary}
          onOpenChange={(isOpen) => !isOpen && setModal(undefined)}
        />
      ) : null}
      <AppConfirm
        confirmLabel="Anular ticket"
        description={`El ticket ${toVoid?.number ?? ""} quedará anulado: su importe se devuelve desde esta caja con las mismas formas de pago y las unidades vuelven al stock.`}
        isOpen={Boolean(toVoid)}
        isPending={voidTicket.isPending}
        title="Anular ticket"
        onConfirm={() =>
          toVoid &&
          voidTicket.mutate(toVoid.id, {
            onSuccess: () => setToVoid(undefined),
          })
        }
        onOpenChange={(isOpen) => !isOpen && setToVoid(undefined)}
      />
    </div>
  );
}
