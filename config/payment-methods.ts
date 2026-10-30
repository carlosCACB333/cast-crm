/**
 * Payment methods are configured per organization (name, kind, active) from
 * the sales module. These are their kinds, the ones every new organization
 * starts with and their limits.
 */

export const PAYMENT_METHOD_KINDS = [
  {
    kind: "CASH",
    label: "Efectivo",
    description: "Entra en el cajón y cuenta en el arqueo de caja.",
  },
  {
    kind: "CARD",
    label: "Tarjeta",
    description: "Datáfono o pasarela de pago.",
  },
  {
    kind: "TRANSFER",
    label: "Transferencia",
    description: "Transferencias, domiciliaciones o pagos móviles al banco.",
  },
  { kind: "OTHER", label: "Otro", description: "Cualquier otra forma." },
] as const;

export type PaymentMethodKind = (typeof PAYMENT_METHOD_KINDS)[number]["kind"];

export const PAYMENT_METHOD_KIND_CODES = PAYMENT_METHOD_KINDS.map(
  (item) => item.kind,
) as unknown as readonly [PaymentMethodKind, ...PaymentMethodKind[]];

export const paymentMethodKindLabel = (kind: string) =>
  PAYMENT_METHOD_KINDS.find((item) => item.kind === kind)?.label ?? kind;

/** Methods created with every new organization. They can be edited later. */
export const DEFAULT_PAYMENT_METHODS: {
  name: string;
  kind: PaymentMethodKind;
}[] = [
  { name: "Efectivo", kind: "CASH" },
  { name: "Tarjeta", kind: "CARD" },
  { name: "Transferencia", kind: "TRANSFER" },
  { name: "Domiciliación", kind: "TRANSFER" },
  { name: "Otro", kind: "OTHER" },
];

export const PAYMENT_METHOD_LIMITS = {
  maxMethods: 30,
  maxNameLength: 40,
};
