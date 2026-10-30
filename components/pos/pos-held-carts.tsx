"use client";

import type { HeldCart, PosSourceSummary } from "@/lib/actions/pos";
import type {
  HoldPosCartFormValues,
  PosCartValues,
} from "@/lib/validations/pos";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CartIcon, TrashIcon } from "@/components/icons";
import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import {
  AppAlert,
  AppButton,
  AppChip,
  AppEmptyState,
  AppInput,
  AppModal,
  AppSwitch,
} from "@/components/ui";
import { SALES_TYPES } from "@/config/sales";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useHeldCarts } from "@/hooks/use-pos";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import {
  deleteHeldCart,
  holdPosCart,
  recoverHeldCart,
} from "@/lib/actions/pos";
import { formatRelative } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { holdPosCartFormSchema } from "@/lib/validations/pos";

const HOLD_FORM = "hold-pos-cart-form";

/** A cart taken back from the list, ready to fill the till. */
export interface RecoveredCart {
  customerId: string;
  lines: PosCartValues["lines"];
  source: PosSourceSummary | null;
}

/** Parks the current cart with an optional note to find it again. */
export function HoldCartModal({
  cart,
  isOpen,
  onOpenChange,
  onHeld,
}: {
  cart: PosCartValues;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onHeld: () => void;
}) {
  const hold = useActionMutation(holdPosCart, {
    successMessage: "Ticket guardado",
    invalidate: [queryKeys.pos],
  });
  const { control, handleSubmit } = useForm<HoldPosCartFormValues>({
    resolver: zodResolver(holdPosCartFormSchema),
    defaultValues: { note: "", isShared: false },
  });

  return (
    <AppModal
      description="Podrás recuperarlo después para cobrarlo."
      footer={
        <>
          <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancelar
          </AppButton>
          <AppButton form={HOLD_FORM} isPending={hold.isPending} type="submit">
            Guardar ticket
          </AppButton>
        </>
      }
      isOpen={isOpen}
      title="Guardar ticket"
      onOpenChange={onOpenChange}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        id={HOLD_FORM}
        onSubmit={handleSubmit(({ note }) =>
          hold.mutate(
            { ...cart, note },
            {
              onSuccess: () => {
                onHeld();
                onOpenChange(false);
              },
            },
          ),
        )}
      >
        {hold.error ? (
          <AppAlert
            description={hold.error.message}
            status="danger"
            title="No se pudo guardar"
          />
        ) : null}
        <AppInput
          control={control}
          description="Opcional. Ayuda a encontrarlo, por ejemplo «Mesa 3» o «Vuelve a las 17:00»."
          label="Nota"
          name="note"
        />
        <AppSwitch
          control={control}
          description="Si lo desactivas, solo esta caja podrá verlo y recuperarlo."
          label="Visible en otras cajas"
          name="isShared"
        />
      </form>
    </AppModal>
  );
}

function heldCartTitle(cart: HeldCart) {
  return cart.note || cart.customer?.name || "Ticket guardado";
}

function HeldCartRow({
  cart,
  isBusy,
  onRecover,
  onDelete,
}: {
  cart: HeldCart;
  isBusy: boolean;
  onRecover: () => void;
  onDelete: () => void;
}) {
  const money = useMoneyFormatter();
  const details = [
    cart.register?.name ?? "Sin caja",
    cart.itemCount === 1 ? "1 línea" : `${cart.itemCount} líneas`,
    cart.note && cart.customer ? cart.customer.name : null,
    cart.source
      ? `${SALES_TYPES[cart.source.type].label} ${cart.source.number ?? ""}`.trim()
      : null,
    `${cart.createdBy?.name ?? "Persona eliminada"}, ${formatRelative(cart.createdAt)}`,
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{heldCartTitle(cart)}</span>
          {cart.isShared ? null : (
            <AppChip size="sm">Solo {cart.register?.name ?? "su caja"}</AppChip>
          )}
        </span>
        <span className="truncate text-xs text-muted">
          {details.join(" · ")}
        </span>
      </div>
      <span className="shrink-0 font-semibold tabular-nums">
        {money.format(cart.total)}
      </span>
      <AppButton
        isDisabled={isBusy}
        size="sm"
        variant="secondary"
        onPress={onRecover}
      >
        Recuperar
      </AppButton>
      {cart.canDelete ? (
        <AppButton
          isIconOnly
          aria-label={`Eliminar ${heldCartTitle(cart)}`}
          isDisabled={isBusy}
          size="sm"
          variant="ghost"
          onPress={onDelete}
        >
          <TrashIcon size={14} />
        </AppButton>
      ) : null}
    </li>
  );
}

/** Carts parked in the organization; recovering one moves it to this till. */
export function HeldCartsModal({
  hasCart,
  isOpen,
  onOpenChange,
  onRecover,
}: {
  hasCart: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRecover: (cart: RecoveredCart) => void;
}) {
  const carts = useHeldCarts({ enabled: isOpen });
  const recover = useActionMutation(recoverHeldCart, {
    invalidate: [queryKeys.pos],
  });
  const remove = useActionMutation(deleteHeldCart, {
    successMessage: "Ticket guardado eliminado",
    invalidate: [queryKeys.pos],
  });
  const error = recover.error ?? remove.error;
  const items = carts.data ?? [];
  // The server lists this register's carts first.
  const groups = [
    {
      title: "En esta caja",
      carts: items.filter((cart) => cart.isCurrentRegister),
    },
    {
      title: "Otras cajas",
      carts: items.filter((cart) => !cart.isCurrentRegister),
    },
  ];

  return (
    <AppModal
      description={
        hasCart
          ? "Al recuperar uno, sustituirá los artículos del ticket actual. Guárdalo antes si lo necesitas."
          : "Al recuperar uno pasa a esta caja y deja de estar guardado."
      }
      footer={
        <AppButton variant="tertiary" onPress={() => onOpenChange(false)}>
          Cerrar
        </AppButton>
      }
      isOpen={isOpen}
      title="Tickets guardados"
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-3">
        {error ? (
          <AppAlert
            description={error.message}
            status="danger"
            title={
              recover.error
                ? "No se pudo recuperar"
                : "No se pudo eliminar el ticket guardado"
            }
          />
        ) : null}
        {carts.error ? (
          <QueryError error={carts.error} onRetry={() => carts.refetch()} />
        ) : carts.isPending ? (
          <ListSkeleton rows={3} />
        ) : items.length === 0 ? (
          <AppEmptyState
            description="Guarda un ticket para atender a otro cliente y cobrarlo después."
            icon={<CartIcon size={20} />}
            title="No hay tickets guardados"
          />
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            {groups.map((group) =>
              group.carts.length ? (
                <section key={group.title} aria-label={group.title}>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                    {group.title} · {group.carts.length}
                  </h3>
                  <ul className="flex flex-col divide-y divide-separator">
                    {group.carts.map((cart) => (
                      <HeldCartRow
                        key={cart.id}
                        cart={cart}
                        isBusy={recover.isPending || remove.isPending}
                        onDelete={() => remove.mutate(cart.id)}
                        onRecover={() =>
                          recover.mutate(cart.id, {
                            onSuccess: (recovered) => {
                              onRecover(recovered);
                              onOpenChange(false);
                            },
                          })
                        }
                      />
                    ))}
                  </ul>
                </section>
              ) : null,
            )}
          </div>
        )}
      </div>
    </AppModal>
  );
}
