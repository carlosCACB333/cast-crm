"use client";

import type { PosItem, PosSourceSummary, PosState } from "@/lib/actions/pos";
import type { PosSourceDocument } from "@/components/pos/pos-cash-modals";
import type { RecoveredCart } from "@/components/pos/pos-held-carts";
import type {
  OpenCashSessionValues,
  PosCartValues,
} from "@/lib/validations/pos";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";

import {
  BanknoteIcon,
  CartIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileTextIcon,
  MinusIcon,
  MoreIcon,
  PlusIcon,
  RefreshIcon,
  StoreIcon,
  TrashIcon,
  WalletIcon,
} from "@/components/icons";
import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { CustomerFormDrawer } from "@/components/customers/customer-form-drawer";
import { PageHeader } from "@/components/page-header";
import {
  CashMovementModal,
  CloseSessionModal,
  CollectInvoiceModal,
  LoadDocumentModal,
  ReportDiscrepancyModal,
} from "@/components/pos/pos-cash-modals";
import { PosCatalog } from "@/components/pos/pos-catalog";
import { PosCheckoutModal } from "@/components/pos/pos-checkout-modal";
import { HeldCartsModal, HoldCartModal } from "@/components/pos/pos-held-carts";
import { SalesTotals } from "@/components/sales/sales-totals";
import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppCard,
  AppChip,
  AppDropdown,
  AppEmptyState,
  AppInput,
  AppLink,
  AppTooltip,
  notify,
} from "@/components/ui";
import { SALES_TYPES, salesItemHref } from "@/config/sales";
import { useActionMutation } from "@/hooks/use-action-mutation";
import {
  useActiveMember,
  useMyAccess,
  usePermission,
} from "@/hooks/use-organization";
import { usePosState } from "@/hooks/use-pos";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { openCashSession } from "@/lib/actions/pos";
import { formatRelative } from "@/lib/format";
import { optionSources } from "@/lib/option-sources";
import { decimalToText } from "@/lib/pricing";
import { queryKeys } from "@/lib/query-keys";
import { documentTotals, lineAmounts, typedNumber } from "@/lib/sales-math";
import { openCashSessionSchema, posCartSchema } from "@/lib/validations/pos";

const OPEN_FORM = "open-cash-session-form";
const EMPTY_CART: PosCartValues = { customerId: "", sourceId: "", lines: [] };

function OpenSessionCard() {
  const money = useMoneyFormatter();
  const [mismatch, setMismatch] = useState<
    OpenCashSessionValues & { expected: number }
  >();
  const [isReportOpen, setIsReportOpen] = useState(false);
  /** Register whose difference was just reported. */
  const [reportedId, setReportedId] = useState<string>();
  const open = useActionMutation(openCashSession, {
    invalidate: [queryKeys.pos],
  });
  const { control, handleSubmit } = useForm<OpenCashSessionValues>({
    resolver: zodResolver(openCashSessionSchema),
    defaultValues: { registerId: "", countedCash: "" },
  });
  const values = useWatch({ control });
  const isMismatch =
    mismatch?.registerId === values.registerId &&
    mismatch?.countedCash === values.countedCash;
  const difference = mismatch
    ? typedNumber(mismatch.countedCash) - mismatch.expected
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <StoreIcon size={24} />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Abrir caja</h1>
          <p className="text-muted">
            Elige la caja y cuenta el efectivo que hay en el cajón.
          </p>
        </div>
      </div>
      <AppCard>
        <form
          noValidate
          className="flex flex-col gap-4"
          id={OPEN_FORM}
          onSubmit={handleSubmit((form) =>
            open.mutate(form, {
              onSuccess: (result) => {
                if (result.opened) {
                  setMismatch(undefined);
                  notify.success("Caja abierta");
                } else {
                  setMismatch({ ...form, expected: result.expected });
                }
              },
            }),
          )}
        >
          {open.error ? (
            <AppAlert
              description={open.error.message}
              status="danger"
              title="No se pudo abrir la caja"
            />
          ) : null}
          <AppAutocomplete
            isRequired
            control={control}
            label="Caja"
            name="registerId"
            source={optionSources.cashRegisters}
          />
          <AppInput
            isRequired
            control={control}
            description="Debe coincidir con el efectivo que quedó al cerrarla."
            inputMode="decimal"
            label="Efectivo contado"
            name="countedCash"
            placeholder="0"
          />
          {mismatch && isMismatch ? (
            <AppAlert
              description={
                <>
                  Esta caja debería tener {money.format(mismatch.expected)} y
                  has contado {money.format(typedNumber(mismatch.countedCash))}{" "}
                  ({difference > 0 ? "sobran" : "faltan"}{" "}
                  {money.format(Math.abs(difference))}). Vuelve a contar o
                  reporta la diferencia para que el administrador ajuste la
                  caja.
                </>
              }
              status="danger"
              title="El efectivo no coincide"
            />
          ) : reportedId && reportedId === values.registerId ? (
            <AppAlert
              description="El administrador revisará la diferencia y ajustará el efectivo de la caja. Después podrás abrirla con lo que has contado."
              status="accent"
              title="Diferencia reportada"
            />
          ) : null}
          {mismatch && isMismatch ? (
            <AppButton
              fullWidth
              size="lg"
              variant="secondary"
              onPress={() => setIsReportOpen(true)}
            >
              Reportar diferencia
            </AppButton>
          ) : (
            <AppButton
              fullWidth
              isPending={open.isPending}
              size="lg"
              type="submit"
            >
              Abrir caja
            </AppButton>
          )}
        </form>
      </AppCard>
      <p className="text-center text-sm text-muted">
        ¿Buscas un cierre anterior?{" "}
        <AppLink href="/pos/sessions">Ver aperturas de caja</AppLink>
      </p>
      {mismatch ? (
        <ReportDiscrepancyModal
          countedCash={mismatch.countedCash}
          isOpen={isReportOpen}
          registerId={mismatch.registerId}
          onOpenChange={setIsReportOpen}
          onReported={() => {
            setReportedId(mismatch.registerId);
            setMismatch(undefined);
          }}
        />
      ) : null}
    </div>
  );
}

type Modal =
  | "checkout"
  | "movement"
  | "close"
  | "collect"
  | "load"
  | "hold"
  | "held"
  | "customer";

function PosTerminal({ state }: { state: PosState }) {
  const router = useRouter();
  const money = useMoneyFormatter();
  const session = state.session!;
  const { settings, paymentMethods } = state;
  const [modal, setModal] = useState<Modal>();
  const [source, setSource] = useState<PosSourceSummary>();
  const [checkoutKey, setCheckoutKey] = useState(0);
  const [editing, setEditing] = useState<string>();
  const queryClient = useQueryClient();
  const isRefreshing = useIsFetching({ queryKey: queryKeys.pos });
  const canCreateCustomer = usePermission({ customer: ["create"] });
  const { data: currentMember } = useActiveMember();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PosCartValues>({
    resolver: zodResolver(posCartSchema),
    defaultValues: EMPTY_CART,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const cart = useWatch({ control }) as PosCartValues;
  const lines = cart.lines ?? [];
  const numbers = lines.map((line) => ({
    quantity: typedNumber(line?.quantity),
    unitPrice: typedNumber(line?.unitPrice),
    discount: typedNumber(line?.discount),
    taxRate: typedNumber(line?.taxRate),
  }));
  // Same totals the server will charge, with the tax on the total if active.
  const totals = documentTotals(numbers, settings.totalTax?.rate);
  const units = numbers.reduce((sum, line) => sum + line.quantity, 0);

  /** Adds one unit of the item in the chosen presentation ("" or "base"). */
  const addItem = (item: PosItem, presentationId: string) => {
    const index = lines.findIndex(
      (line) =>
        line?.itemRef === item.ref && line.presentationId === presentationId,
    );
    const presentation = item.presentations.find(
      (option) => option.id === presentationId,
    );
    const price = presentation?.price ?? item.unitPrice;

    if (index >= 0) {
      setValue(
        `lines.${index}.quantity`,
        decimalToText(typedNumber(lines[index].quantity) + 1),
        { shouldValidate: Boolean(errors.lines?.[index]) },
      );

      return;
    }
    append({
      itemRef: item.ref,
      presentationId,
      description: presentation
        ? `${item.name} (${presentation.label})`
        : item.name,
      unit: presentation?.unit ?? item.unit,
      quantity: "1",
      unitPrice: decimalToText(price),
      listPrice: decimalToText(price),
      discount: "",
      taxRate: decimalToText(item.taxRate ?? settings.defaultTaxRate ?? 0),
    });
  };

  const changeQuantity = (index: number, delta: number) => {
    const next = typedNumber(lines[index]?.quantity) + delta;

    if (next <= 0) remove(index);
    else {
      setValue(`lines.${index}.quantity`, decimalToText(next), {
        shouldValidate: Boolean(errors.lines?.[index]),
      });
    }
  };

  const clear = () => {
    reset(EMPTY_CART);
    setSource(undefined);
    setEditing(undefined);
  };

  const loadSource = (document: PosSourceDocument) => {
    reset({
      customerId: document.customerId ?? "",
      sourceId: document.id,
      lines: document.lines.map((line) => ({
        ...line,
        listPrice: line.unitPrice,
      })),
    });
    setSource(document);
  };

  const recoverCart = (recovered: RecoveredCart) => {
    reset({
      customerId: recovered.customerId,
      sourceId: recovered.source?.id ?? "",
      lines: recovered.lines,
    });
    setSource(recovered.source ?? undefined);
    setEditing(undefined);
  };

  // Only a valid cart can be parked, like one that is charged.
  const hold = handleSubmit(() => setModal("hold"));

  const charge = handleSubmit(() => {
    // A fresh form for each charge, with the current total.
    setCheckoutKey((key) => key + 1);
    setModal("checkout");
  });

  const closeModal = () => setModal(undefined);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <>
            <AppTooltip content="Actualizar catálogo y caja">
              <AppButton
                isIconOnly
                aria-label="Actualizar catálogo y caja"
                isPending={isRefreshing > 0}
                variant="secondary"
                onPress={() =>
                  queryClient.invalidateQueries({ queryKey: queryKeys.pos })
                }
              >
                {isRefreshing ? null : <RefreshIcon size={16} />}
              </AppButton>
            </AppTooltip>
            <AppButton variant="secondary" onPress={() => setModal("held")}>
              <CartIcon size={16} />
              <span className="hidden sm:inline">Guardados</span>
              {state.heldCartCount ? (
                <AppChip size="sm">{state.heldCartCount}</AppChip>
              ) : null}
            </AppButton>
            <AppButton variant="secondary" onPress={() => setModal("collect")}>
              <WalletIcon size={16} />
              <span className="hidden sm:inline">Cobrar factura</span>
            </AppButton>
            <AppDropdown
              items={[
                {
                  id: "load",
                  label: "Cargar presupuesto o pedido",
                  icon: <FileTextIcon size={16} />,
                },
                {
                  id: "movement",
                  label: "Entrada o salida de efectivo",
                  icon: <BanknoteIcon size={16} />,
                },
                {
                  id: "session",
                  label: "Ver apertura de caja",
                  icon: <StoreIcon size={16} />,
                },
                {
                  id: "close",
                  label: "Cerrar caja",
                  icon: <WalletIcon size={16} />,
                  isDanger: true,
                },
              ]}
              label="Acciones de caja"
              placement="bottom end"
              trigger={
                <AppButton
                  isIconOnly
                  aria-label="Acciones de caja"
                  variant="secondary"
                >
                  <MoreIcon size={18} />
                </AppButton>
              }
              onAction={(id) =>
                id === "session"
                  ? router.push(`/pos/sessions/${session.id}`)
                  : setModal(id as Modal)
              }
            />
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Abierta {formatRelative(session.openedAt)}</span>
            <span aria-hidden>·</span>
            <span>
              Efectivo en caja:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {money.format(session.summary.expectedCash)}
              </span>
            </span>
            <span aria-hidden>·</span>
            <span>
              {session.summary.ticketCount === 1
                ? "1 ticket"
                : `${session.summary.ticketCount} tickets`}{" "}
              · {money.format(session.summary.ticketTotal)}
            </span>
          </span>
        }
        title={session.registerName}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <PosCatalog defaultTaxRate={settings.defaultTaxRate} onAdd={addItem} />

        <section
          aria-label="Ticket"
          className="flex flex-col gap-4 rounded-3xl border border-separator bg-surface p-4 shadow-sm lg:sticky lg:top-6"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <CartIcon size={18} />
              Ticket
              {units ? (
                <AppChip size="sm">
                  {units === 1 ? "1 artículo" : `${units} artículos`}
                </AppChip>
              ) : null}
            </h2>
            {fields.length ? (
              <div className="flex gap-1">
                <AppButton size="sm" variant="ghost" onPress={hold}>
                  Guardar
                </AppButton>
                <AppButton size="sm" variant="ghost" onPress={clear}>
                  Vaciar
                </AppButton>
              </div>
            ) : null}
          </div>

          {source ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm">
              <span className="truncate">
                {SALES_TYPES[source.type].label} {source.number ?? ""}
              </span>
              <AppButton size="sm" variant="ghost" onPress={clear}>
                Quitar
              </AppButton>
            </div>
          ) : null}

          <AppAutocomplete
            control={control}
            createLabel="Nuevo cliente"
            label="Cliente"
            name="customerId"
            placeholder={settings.walkInCustomerName}
            source={optionSources.customers}
            onCreate={
              canCreateCustomer ? () => setModal("customer") : undefined
            }
          />

          {fields.length === 0 ? (
            <AppEmptyState
              description="Toca un artículo del catálogo o escanea su código."
              icon={<CartIcon size={20} />}
              title="Ticket vacío"
            />
          ) : (
            <ul className="-mx-1 flex max-h-[45vh] flex-col divide-y divide-separator overflow-x-hidden overflow-y-auto px-1">
              {fields.map((field, index) => {
                const line = numbers[index];
                const amount = line ? lineAmounts(line).total : 0;
                const description = lines[index]?.description ?? "la línea";
                const itemHref = salesItemHref(lines[index]?.itemRef);
                const listPrice = lines[index]?.listPrice;
                const isRepriced =
                  Boolean(line) &&
                  listPrice !== undefined &&
                  typedNumber(listPrice) !== line.unitPrice;
                // Lines with an invalid value stay open so the error is visible.
                const isEditing =
                  editing === field.id || Boolean(errors.lines?.[index]);

                return (
                  <li key={field.id} className="flex flex-col gap-2 py-3">
                    <div className="flex items-start justify-between gap-2">
                      {itemHref ? (
                        <AppLink
                          newTab
                          className="min-w-0 leading-snug text-foreground"
                          href={itemHref}
                        >
                          {lines[index]?.description}
                        </AppLink>
                      ) : (
                        <span className="min-w-0 text-sm font-medium leading-snug">
                          {lines[index]?.description}
                        </span>
                      )}
                      <span className="shrink-0 font-semibold tabular-nums">
                        {money.format(amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AppButton
                        isIconOnly
                        aria-label="Quitar una unidad"
                        size="sm"
                        variant="secondary"
                        onPress={() => changeQuantity(index, -1)}
                      >
                        <MinusIcon size={14} />
                      </AppButton>
                      <div className="w-20">
                        <AppInput
                          isLabelHidden
                          control={control}
                          inputMode="decimal"
                          label={`Cantidad de ${description}`}
                          name={`lines.${index}.quantity`}
                        />
                      </div>
                      <AppButton
                        isIconOnly
                        aria-label="Añadir una unidad"
                        size="sm"
                        variant="secondary"
                        onPress={() => changeQuantity(index, 1)}
                      >
                        <PlusIcon size={14} />
                      </AppButton>
                      <span className="ml-auto flex flex-col items-end text-xs text-muted tabular-nums">
                        <span>
                          {isRepriced ? (
                            <>
                              <s aria-label="Precio original">
                                {money.format(typedNumber(listPrice))}
                              </s>{" "}
                              <span className="font-medium text-foreground">
                                {money.format(line.unitPrice)}
                              </span>
                            </>
                          ) : line ? (
                            money.format(line.unitPrice)
                          ) : null}{" "}
                          / {lines[index]?.unit || "ud."}
                        </span>
                        {line?.discount || line?.taxRate ? (
                          <span>
                            {[
                              line.discount
                                ? `-${decimalToText(line.discount)} %`
                                : null,
                              line.taxRate
                                ? `Imp. ${decimalToText(line.taxRate)} %`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </span>
                      <AppButton
                        isIconOnly
                        aria-expanded={isEditing}
                        aria-label={`${isEditing ? "Ocultar" : "Mostrar"} precio, descuento e impuesto de ${description}`}
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          setEditing(isEditing ? undefined : field.id)
                        }
                      >
                        {isEditing ? (
                          <ChevronUpIcon size={14} />
                        ) : (
                          <ChevronDownIcon size={14} />
                        )}
                      </AppButton>
                      <AppButton
                        isIconOnly
                        aria-label="Quitar línea"
                        size="sm"
                        variant="ghost"
                        onPress={() => remove(index)}
                      >
                        <TrashIcon size={14} />
                      </AppButton>
                    </div>
                    {isEditing ? (
                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-default/60 p-2 [&_input]:min-w-0 [&>*]:min-w-0">
                        <AppInput
                          control={control}
                          inputMode="decimal"
                          label="Precio"
                          name={`lines.${index}.unitPrice`}
                          placeholder="0,00"
                        />
                        <AppInput
                          control={control}
                          inputMode="decimal"
                          label="Dto. %"
                          name={`lines.${index}.discount`}
                          placeholder="0"
                        />
                        <AppInput
                          control={control}
                          inputMode="decimal"
                          label="Impuesto %"
                          name={`lines.${index}.taxRate`}
                          placeholder="0"
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {errors.lines?.message ? (
            <p className="text-sm text-danger">{errors.lines.message}</p>
          ) : null}

          <SalesTotals
            format={money.format}
            totalTaxName={settings.totalTax?.name}
            totals={totals}
          />

          <AppButton
            fullWidth
            isDisabled={fields.length === 0 || paymentMethods.length === 0}
            size="lg"
            onPress={charge}
          >
            Cobrar {money.format(totals.total)}
          </AppButton>
          {paymentMethods.length === 0 ? (
            <p className="text-center text-xs text-muted">
              No hay formas de pago activas.{" "}
              <AppLink href="/sales/payment-methods">Configúralas</AppLink>
            </p>
          ) : null}
        </section>
      </div>

      {modal === "checkout" ? (
        <PosCheckoutModal
          key={checkoutKey}
          isOpen
          cart={cart}
          paymentMethods={paymentMethods}
          total={totals.total}
          onOpenChange={(isOpen) => !isOpen && closeModal()}
          onSold={clear}
        />
      ) : null}
      {modal === "movement" ? (
        <CashMovementModal
          isOpen
          sessionId={session.id}
          onOpenChange={(isOpen) => !isOpen && closeModal()}
        />
      ) : null}
      {modal === "close" ? (
        <CloseSessionModal
          isOpen
          registerName={session.registerName}
          sessionId={session.id}
          summary={session.summary}
          onClosed={() => router.push(`/pos/sessions/${session.id}`)}
          onOpenChange={(isOpen) => !isOpen && closeModal()}
        />
      ) : null}
      {modal === "collect" ? (
        <CollectInvoiceModal
          isOpen
          paymentMethods={paymentMethods}
          onOpenChange={(isOpen) => !isOpen && closeModal()}
        />
      ) : null}
      {modal === "hold" ? (
        <HoldCartModal
          isOpen
          cart={cart}
          onHeld={clear}
          onOpenChange={(isOpen) => !isOpen && closeModal()}
        />
      ) : null}
      {modal === "held" ? (
        <HeldCartsModal
          isOpen
          hasCart={fields.length > 0}
          onOpenChange={(isOpen) => !isOpen && closeModal()}
          onRecover={recoverCart}
        />
      ) : null}
      {modal === "customer" ? (
        <CustomerFormDrawer
          isOpen
          defaults={
            currentMember ? { ownerId: currentMember.userId } : undefined
          }
          onOpenChange={(isOpen) => !isOpen && closeModal()}
          onSaved={(id) => setValue("customerId", id, { shouldDirty: true })}
        />
      ) : null}
      {modal === "load" ? (
        <LoadDocumentModal
          isOpen
          hasCart={fields.length > 0}
          onLoad={loadSource}
          onOpenChange={(isOpen) => !isOpen && closeModal()}
        />
      ) : null}
    </div>
  );
}

/** The till: opens a register if the user has none, then sells. */
export function PosView() {
  const access = useMyAccess();
  const canSell = usePermission({ pos: ["sell"] });
  const state = usePosState({ enabled: canSell });

  if (access.data && !canSell) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Punto de venta" />
        <AppEmptyState
          action={<AppLink href="/pos/sessions">Ver aperturas de caja</AppLink>}
          description="Pide a un administrador el permiso para vender en el punto de venta."
          icon={<StoreIcon size={20} />}
          title="No puedes vender"
        />
      </div>
    );
  }
  if (state.error) {
    return <QueryError error={state.error} onRetry={() => state.refetch()} />;
  }
  if (!state.data) return <ListSkeleton rows={6} />;

  return state.data.session ? (
    <PosTerminal state={state.data} />
  ) : (
    <OpenSessionCard />
  );
}
